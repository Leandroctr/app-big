import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const guardedFiles = [
  "app/admin/page.tsx",
  "app/admin/settings/page.tsx",
  "app/api/admin/settings/route.ts",
  "app/api/admin/upload/route.ts",
  "app/api/push/send/route.ts",
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
  assert.match(source, /getAuthorizedAdminForTenant/);
  assert.match(source, /signOut\(\{ scope: "local" \}\)/);
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

test("BigPix preserves password reset and password policy", () => {
  const resetPage = read("app/admin/reset-password/page.tsx");
  const policy = read("lib/password-policy.ts");
  const createRoute = read("app/api/admin/admins/route.ts");

  assert.match(resetPage, /PASSWORD_RECOVERY/);
  assert.match(resetPage, /auth\.updateUser\(\{ password \}\)/);
  assert.match(resetPage, /auth\.signOut\(\)/);
  assert.match(resetPage, /checkPasswordPolicy/);
  assert.match(policy, /MIN_LENGTH = 12/);
  assert.match(policy, /blockedPasswords/);
  assert.match(createRoute, /checkPasswordPolicy/);
});

test("BigPix super_admin link remains role-gated", () => {
  const source = read("app/admin/page.tsx");
  assert.match(source, /currentAdmin\.role === "super_admin"/);
  assert.match(source, /href="\/admin\/administradores"/);
});
