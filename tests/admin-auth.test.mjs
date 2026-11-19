import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const inviteModule = await import("../lib/admin-invite.ts");

const guardedFiles = [
  "app/admin/page.tsx",
  "app/admin/settings/page.tsx",
  "app/api/admin/settings/route.ts",
  "app/api/admin/upload/route.ts",
  "app/api/push/send/route.ts",
];

const bigPixSuperAdminGuardedFiles = [
  "app/admin/administradores/page.tsx",
  "app/api/admin/admins/route.ts",
  "app/api/admin/admins/[id]/route.ts",
  "app/api/admin/admins/[id]/access/route.ts",
];

const mfaFiles = [
  "app/admin/mfa/page.tsx",
  "app/admin/mfa/actions.ts",
  "app/admin/mfa/mfa-form.tsx",
];

const bigPixAdminFiles = [
  "app/admin/administradores/page.tsx",
  "app/admin/reset-password/page.tsx",
  "app/api/admin/admins/route.ts",
  "app/api/admin/admins/[id]/route.ts",
  "app/api/admin/admins/[id]/access/route.ts",
  "components/admin-admins-form.tsx",
  "components/admin-admins-table.tsx",
  "lib/admin-directory.server.ts",
  "lib/password-policy.ts",
];

test("A-1 removes the deterministic legacy session implementation", () => {
  assert.equal(existsSync("lib/admin-auth.ts"), false);
});

test("A-1 removes ADMIN_EMAIL and ADMIN_PASSWORD from functional source", () => {
  const source = [
    read("app/admin/login/page.tsx"),
    read("lib/admin-identity.server.ts"),
    read("lib/supabase/admin-session.ts"),
    ...guardedFiles.map(read),
  ].join("\n");

  assert.doesNotMatch(source, /ADMIN_EMAIL|ADMIN_PASSWORD/);
  assert.doesNotMatch(source, /createHash\(|sha256/i);
});

test("login requires both Supabase Auth and tenant authorization", () => {
  const source = read("app/admin/login/page.tsx");

  assert.match(source, /signInWithPassword/);
  assert.match(source, /getAdminPendingMfaForTenant/);
  assert.match(source, /signOut\(\{ scope: "local" \}\)/);
  assert.match(source, /redirect\("\/admin\/mfa"\)/);
  assert.doesNotMatch(source, /redirect\("\/admin"\)/);
  assert.doesNotMatch(source, /validateAdminCredentials|createAdminSession|legacy/i);
});

test("all five CETEC guards use only requireTenantAccess", () => {
  for (const path of guardedFiles) {
    const source = read(path);
    assert.match(source, /requireTenantAccess\(\)/, path);
    assert.doesNotMatch(
      source,
      /isAdminAuthenticated|hasLegacySession|currentAdmin\s*\|\|/,
      path,
    );
  }
});

test("identity is revalidated by Supabase Auth instead of trusting getSession", () => {
  const source = read("lib/admin-identity.server.ts");

  assert.match(source, /auth\.getUser\(\)/);
  assert.doesNotMatch(source, /auth\.getSession\(\)/);
  assert.match(source, /!data\.active/);
});

test("administrative identity is separate from the restricted pending-MFA helper", () => {
  const source = read("lib/admin-identity.server.ts");

  assert.match(source, /getAuthenticatedAdmin/);
  assert.match(source, /getAdminPendingMfaForTenant/);
  assert.match(source, /await getAuthenticatedAdmin\(\)/);
  assert.match(source, /hasTenantAccess\(admin, tenantDomain\)/);
});

test("getCurrentAdmin fails closed unless the session has strong TOTP AAL2", () => {
  const source = read("lib/admin-identity.server.ts");

  assert.match(source, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(source, /currentLevel === "aal2"/);
  assert.match(source, /nextLevel === "aal2"/);
  assert.match(source, /method === "totp"/);
  assert.match(source, /!admin \|\| !\(await hasRequiredAdminMfa\(\)\)/);
  assert.match(source, /return !error && isAdminMfaAssuranceSatisfied\(data\)/);
  assert.match(source, /catch \{\s*return false;/s);
});

test("tenant and super-admin guards inherit the central MFA gate", () => {
  const source = read("lib/admin-identity.server.ts");

  assert.match(source, /requireSuperAdmin[\s\S]*await getCurrentAdmin\(\)/);
  assert.match(source, /requireTenantAccess[\s\S]*await getCurrentAdmin\(\)/);
});

test("the MFA route supports enrollment, challenge, verify and AAL2 confirmation", () => {
  for (const path of mfaFiles) {
    assert.equal(existsSync(path), true, path);
  }

  const page = read("app/admin/mfa/page.tsx");
  const actions = read("app/admin/mfa/actions.ts");

  assert.match(page, /getAdminPendingMfaForTenant\(\)/);
  assert.match(page, /listFactors\(\)/);
  assert.match(page, /isAdminMfaAssuranceSatisfied/);
  assert.match(page, /redirect\("\/admin"\)/);
  assert.match(actions, /mfa\.enroll\(\{\s*factorType: "totp"/s);
  assert.match(actions, /mfa\.challenge\(\{ factorId \}\)/);
  assert.match(actions, /mfa\.verify\(\{/);
  assert.match(actions, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(actions, /redirect\("\/admin"\)/);
});

test("MFA secrets remain confined to the enrollment response and form", () => {
  const actions = read("app/admin/mfa/actions.ts");
  const form = read("app/admin/mfa/mfa-form.tsx");
  const combined = `${actions}\n${form}`;

  assert.match(actions, /secret: data\.totp\.secret/);
  assert.doesNotMatch(combined, /console\.|logServer|analytics|searchParams|URLSearchParams/);
  assert.doesNotMatch(actions, /\.from\(|insert\(|update\(/);
});

test("only abandoned unverified TOTP enrollments may be removed", () => {
  const actions = read("app/admin/mfa/actions.ts");

  assert.match(actions, /factor\.factor_type === "totp"/);
  assert.match(actions, /factor\.status === "unverified"/);
  assert.match(actions, /mfa\.unenroll/);
  assert.match(actions, /if \(factors\.totp\.length > 0\)/);
});

test("only super_admin and admin are accepted at runtime", () => {
  const source = read("lib/admin-identity.server.ts");

  assert.match(source, /value === "super_admin" \|\| value === "admin"/);
  assert.match(source, /admin\.role === "super_admin"/);
  assert.match(source, /admin_tenant_access/);
  assert.match(source, /\.eq\("active", true\)/);
});

test("Supabase admin cookies use the required security attributes", () => {
  const source = read("lib/supabase/admin-session.ts");

  assert.match(source, /httpOnly: true/);
  assert.match(source, /sameSite: "lax"/);
  assert.match(source, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(source, /cookieOptions: adminSessionCookieOptions/);
});

test("proxy refreshes Supabase sessions and never authorizes with getSession", () => {
  const source = read("lib/supabase/proxy.ts");

  assert.match(source, /auth\.getClaims\(\)/);
  assert.doesNotMatch(source, /auth\.getSession\(\)/);
  assert.match(source, /Cache-Control|responseHeaders/);
});

test("the obsolete admin_session cookie is only expired, never read as auth", () => {
  const source = read("lib/supabase/proxy.ts");

  assert.match(source, /obsoleteLegacyCookieName = "admin_session"/);
  assert.match(source, /maxAge: 0/);
  assert.doesNotMatch(source, /request\.cookies\.get\(obsoleteLegacyCookieName\)/);
});

test("logout performs remote revocation and local cleanup fallback", () => {
  const source = read("app/api/admin/logout/route.ts");

  assert.match(source, /signOut\(\{ scope: "global" \}\)/);
  assert.match(source, /signOut\(\{ scope: "local" \}\)/);
  assert.match(source, /Cache-Control/);
});

test("BigPix preserves its administrator management surface", () => {
  for (const path of bigPixAdminFiles) {
    assert.equal(existsSync(path), true, path);
  }

  const page = read("app/admin/administradores/page.tsx");
  const routes = [
    read("app/api/admin/admins/route.ts"),
    read("app/api/admin/admins/[id]/route.ts"),
    read("app/api/admin/admins/[id]/access/route.ts"),
  ].join("\n");
  assert.match(page, /requireSuperAdmin\(\)/);
  assert.match(routes, /requireSuperAdmin\(\)/);
  assert.doesNotMatch(routes, /isAdminAuthenticated|hasLegacySession/);
});

test("all BigPix super-admin surfaces use the central super-admin guard", () => {
  for (const path of bigPixSuperAdminGuardedFiles) {
    assert.match(read(path), /requireSuperAdmin\(\)/, path);
  }
});

test("BigPix preserves password reset and password policy", () => {
  const resetPage = read("app/admin/reset-password/page.tsx");
  const policy = read("lib/password-policy.ts");
  const createRoute = read("app/api/admin/admins/route.ts");

  assert.match(resetPage, /PASSWORD_RECOVERY/);
  assert.match(resetPage, /auth\.updateUser\(\{ password \}\)/);
  assert.match(resetPage, /auth\.signOut\(\)/);
  assert.match(resetPage, /password_reset=1/);
  assert.match(read("app/admin/login/page.tsx"), /redirect\("\/admin\/mfa"\)/);
  assert.match(resetPage, /checkPasswordPolicy/);
  assert.match(policy, /MIN_LENGTH = 12/);
  assert.match(policy, /blockedPasswords/);
  assert.match(createRoute, /checkPasswordPolicy/);
});

test("BigPix routes only recognized Supabase Auth callbacks away from the public launcher", () => {
  const {
    getRootAdminAuthCallbackTarget,
    ADMIN_ACTIVATION_PATH,
    ADMIN_PASSWORD_RESET_PATH,
  } = inviteModule;

  assert.equal(
    getRootAdminAuthCallbackTarget(
      "",
      "#access_token=access&refresh_token=refresh&type=recovery",
    ),
    ADMIN_PASSWORD_RESET_PATH,
  );
  assert.equal(
    getRootAdminAuthCallbackTarget(
      "",
      "#access_token=access&refresh_token=refresh&type=invite",
    ),
    ADMIN_ACTIVATION_PATH,
  );
  assert.equal(
    getRootAdminAuthCallbackTarget("?token_hash=hash&type=invite", ""),
    ADMIN_ACTIVATION_PATH,
  );
  assert.equal(
    getRootAdminAuthCallbackTarget(
      "",
      "#access_token=access&refresh_token=refresh&type=magiclink",
    ),
    ADMIN_ACTIVATION_PATH,
  );
  assert.equal(
    getRootAdminAuthCallbackTarget("?code=pkce-code", ""),
    ADMIN_ACTIVATION_PATH,
  );
  assert.equal(getRootAdminAuthCallbackTarget("", ""), null);
  assert.equal(getRootAdminAuthCallbackTarget("?campaign=invite", ""), null);
  assert.equal(getRootAdminAuthCallbackTarget("?error=public-error", ""), null);
  assert.equal(
    getRootAdminAuthCallbackTarget(
      "?error=access_denied&error_description=expired",
      "",
    ),
    ADMIN_ACTIVATION_PATH,
  );
});

test("admin invitation callback parser fails closed across supported formats", () => {
  const { parseAdminInviteCallback } = inviteModule;

  assert.deepEqual(
    parseAdminInviteCallback(
      "",
      "#access_token=access&refresh_token=refresh&type=invite",
    ),
    { kind: "implicit", accessToken: "access", refreshToken: "refresh" },
  );
  assert.deepEqual(
    parseAdminInviteCallback("?token_hash=hash&type=invite", ""),
    { kind: "token_hash", tokenHash: "hash", otpType: "invite" },
  );
  assert.deepEqual(
    parseAdminInviteCallback("?token_hash=hash&type=magiclink", ""),
    { kind: "token_hash", tokenHash: "hash", otpType: "magiclink" },
  );
  assert.deepEqual(parseAdminInviteCallback("?code=pkce-code", ""), {
    kind: "code",
    code: "pkce-code",
  });
  assert.deepEqual(
    parseAdminInviteCallback(
      "",
      "#access_token=access&refresh_token=refresh&type=recovery",
    ),
    { kind: "invalid" },
  );
  assert.deepEqual(
    parseAdminInviteCallback("?token_hash=hash&type=recovery", ""),
    { kind: "invalid" },
  );
  assert.deepEqual(parseAdminInviteCallback("?error_code=otp_expired", ""), {
    kind: "error",
  });
});

test("admin invitation activation validates identity, scrubs tokens, and preserves MFA enforcement", () => {
  const launcher = read("app/page.tsx");
  const activation = read("app/admin/activate/page.tsx");
  const validationRoute = read("app/api/admin/activation/validate/route.ts");
  const login = read("app/admin/login/page.tsx");

  assert.match(launcher, /getRootAdminAuthCallbackTarget/);
  assert.match(activation, /history\.replaceState/);
  assert.match(activation, /detectSessionInUrl: false/);
  assert.match(activation, /auth\.setSession/);
  assert.match(activation, /auth\.verifyOtp\(\{[\s\S]*type: callback\.otpType/);
  assert.match(activation, /auth\.exchangeCodeForSession/);
  assert.match(activation, /\/api\/admin\/activation\/validate/);
  assert.match(activation, /checkPasswordPolicy/);
  assert.match(activation, /auth\.updateUser\(\{ password \}\)/);
  assert.match(activation, /scope: "global"/);
  assert.match(activation, /\/admin\/login\?activated=1/);
  assert.doesNotMatch(activation, /console\.|logServer|analytics\./);

  assert.match(validationRoute, /auth\.getUser\(accessToken\)/);
  assert.match(validationRoute, /\.from\("admin_users"\)/);
  assert.match(validationRoute, /\.eq\("auth_user_id", userData\.user\.id\)/);
  assert.match(validationRoute, /!admin\.active/);
  assert.match(validationRoute, /role === "super_admin" \|\| role === "admin"/);
  assert.match(validationRoute, /Cache-Control/);
  assert.doesNotMatch(validationRoute, /console\.|logServer/);

  assert.match(login, /redirect\("\/admin\/mfa"\)/);
  assert.match(login, /configurar o autenticador TOTP/i);
});

test("BigPix super_admin link remains role-gated", () => {
  const source = read("app/admin/page.tsx");
  assert.match(source, /currentAdmin\.role === "super_admin"/);
  assert.match(source, /href="\/admin\/administradores"/);
});
