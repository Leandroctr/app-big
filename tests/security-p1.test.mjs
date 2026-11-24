import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSettingsPayload,
  resolveTenantSettings,
} from "../lib/admin-settings-payload.ts";
import {
  extractClientIp,
  hashRateLimitKey,
  normalizeAccountIdentifier,
  normalizeOneSignalId,
} from "../lib/request-security.ts";
import nextConfig, {
  contentSecurityPolicy,
  securityHeaders,
} from "../next.config.ts";

test("M-1 ignores tenantDomain supplied by the client", () => {
  const normalized = normalizeSettingsPayload({
    id: "row-id",
    tenantDomain: "attacker.example",
    appName: " BigPix ",
  });

  assert.equal("tenantDomain" in normalized, false);
  assert.equal(normalized.appName, "BigPix");
  assert.equal(normalized.id, "row-id");
});

test("M-1 missing tenantDomain cannot become an empty persisted tenant", () => {
  const serverTenant = "pwa.app-bigpix.com";
  const settings = resolveTenantSettings({ appName: "BigPix" }, serverTenant);

  assert.equal(settings.tenantDomain, serverTenant);
});

test("M-1 server tenant overrides an attacker tenant on the persisted object", () => {
  const settings = resolveTenantSettings(
    { appName: "BigPix", tenantDomain: "pwa.attacker.example" },
    "pwa.app-bigpix.com",
  );

  assert.equal(settings.tenantDomain, "pwa.app-bigpix.com");
});

test("request IP uses Vercel's canonical forwarded header and validates IPs", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.10",
    "x-forwarded-for": "198.51.100.1",
  });

  assert.equal(extractClientIp(headers), "203.0.113.10");
  assert.equal(
    extractClientIp(new Headers({ "x-forwarded-for": "spoofed" })),
    "unknown",
  );
});

test("IPv6 rate-limit identity is normalized to a stable /64 prefix", () => {
  const first = extractClientIp(
    new Headers({
      "x-vercel-forwarded-for": "2001:db8:abcd:12:1111:2222:3333:4444",
    }),
  );
  const second = extractClientIp(
    new Headers({
      "x-vercel-forwarded-for": "2001:db8:abcd:12:aaaa:bbbb:cccc:dddd",
    }),
  );

  assert.equal(first, "2001:0db8:abcd:0012::/64");
  assert.equal(second, first);
  assert.notEqual(
    extractClientIp(
      new Headers({ "x-vercel-forwarded-for": "2001:db8:abcd:13::1" }),
    ),
    first,
  );
});

test("rate-limit keys are deterministic HMACs without plaintext identifiers", () => {
  const email = normalizeAccountIdentifier(" Admin@Example.COM ");
  const key = hashRateLimitKey("admin_login_account", email, "test-secret");

  assert.equal(email, "admin@example.com");
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(key.includes("admin"), false);
});

test("A-5 accepts canonical OneSignal UUIDs and rejects malformed values", () => {
  assert.equal(
    normalizeOneSignalId("123E4567-E89B-42D3-A456-426614174000"),
    "123e4567-e89b-42d3-a456-426614174000",
  );
  assert.equal(normalizeOneSignalId("123e4567-e89b-12d3-a456-426614174000"), null);
  assert.equal(normalizeOneSignalId("not-a-subscription"), null);
  assert.equal(normalizeOneSignalId("123e4567-e89b-42d3-7456-426614174000"), null);
});

test("M-2 exposes the required security headers and frame protection", async () => {
  const configuredHeaders = await nextConfig.headers?.();
  const globalRule = configuredHeaders?.find((rule) => rule.source === "/:path*");
  const headerMap = new Map(globalRule?.headers.map(({ key, value }) => [key, value]));

  for (const { key, value } of securityHeaders) {
    assert.equal(headerMap.get(key), value);
  }

  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
  assert.match(contentSecurityPolicy, /https:\/\/cdn\.onesignal\.com/);
  assert.match(contentSecurityPolicy, /https:\/\/\*\.supabase\.co/);
  assert.match(contentSecurityPolicy, /worker-src 'self' blob:/);
});

async function headersForBuildAppId(appId) {
  const key = "NEXT_PUBLIC_ONESIGNAL_APP_ID";
  const previous = process.env[key];
  try {
    if (appId === undefined) delete process.env[key];
    else process.env[key] = appId;
    return await nextConfig.headers();
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
}

test("M-2 adds only the configured JSONP script to root HTML requests", async () => {
  const appId = "123E4567-E89B-42D3-A456-426614174000";
  const baseline = await headersForBuildAppId(undefined);
  const rules = await headersForBuildAppId(appId);
  assert.deepEqual(rules.slice(0, baseline.length), baseline);
  const rootRules = rules.slice(baseline.length);
  assert.equal(rootRules.length, 2);
  assert.deepEqual(rootRules[0], {
    source: "/",
    headers: [{ key: "Cache-Control", value: "private, no-store" }],
  });

  const document = rootRules[1];
  assert.equal(document.source, "/");
  assert.equal(document.has.length, 1);
  assert.equal(document.has[0].type, "header");
  assert.equal(document.has[0].key, "accept");
  const accepts = new RegExp(`^(?:${document.has[0].value})$`);
  assert.match("text/html,application/xhtml+xml,*/*;q=0.8", accepts);
  assert.match("application/xhtml+xml, text/html;q=0.9", accepts);
  assert.doesNotMatch("text/x-component", accepts);
  assert.doesNotMatch("*/*", accepts);
  assert.deepEqual(document.missing, [
    { type: "header", key: "rsc" },
    { type: "header", key: "next-router-prefetch" },
    { type: "header", key: "next-router-segment-prefetch" },
    { type: "query", key: "code" },
    { type: "query", key: "token_hash" },
    { type: "query", key: "type" },
    { type: "query", key: "error_code" },
    { type: "query", key: "error_description" },
  ]);
  assert.deepEqual(document.headers, [
    {
      key: "Content-Security-Policy",
      value: `${contentSecurityPolicy}; script-src-elem 'self' 'unsafe-inline' https://cdn.onesignal.com https://api.onesignal.com/sync/${appId}/web`,
    },
  ]);
});

test("M-2 keeps the baseline with missing or invalid build configuration", async () => {
  const baseline = await headersForBuildAppId(undefined);
  for (const invalid of [
    "",
    "not-an-id",
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-42d3-7456-426614174000",
    "123e4567-e89b-42d3-a456-426614174000\n",
    "123e4567-e89b-42d3-a456-426614174000/web",
  ]) {
    assert.deepEqual(await headersForBuildAppId(invalid), baseline);
  }
});

test("offline documents have a dedicated same-origin URL and CDN no-store", async () => {
  const rules = await headersForBuildAppId("123e4567-e89b-42d3-a456-426614174000");
  assert.deepEqual(await nextConfig.rewrites(), [{ source: "/pwa-offline", destination: "/" }]);
  assert.deepEqual(rules.filter((rule) => rule.source === "/pwa-offline"), [{
    source: "/pwa-offline",
    headers: [
      { key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" },
      { key: "CDN-Cache-Control", value: "no-store" },
    ],
  }]);
  assert.equal(rules.filter((rule) =>
    rule.headers.some(({ value }) => value.includes("script-src-elem")),
  )[0].source, "/");
});
