import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";

import {
  assertSafeAuditJson,
  getSettingsAuditChangedFields,
  sanitizeAdminAuditSnapshot,
  sanitizeAssetAuditMetadata,
  sanitizePushAuditMetadata,
  sanitizeSettingsAuditMetadata,
  sanitizeSettingsAuditSnapshot,
  sanitizeTenantGrantAuditMetadata,
} from "../lib/admin-audit.ts";

const schema = readFileSync("supabase/schema.sql", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260915153506_admin_audit_logs.sql",
  "utf8",
);
const rollback = readFileSync(
  "supabase/migrations/20260915153506_admin_audit_logs.rollback.sql",
  "utf8",
);
const helper = readFileSync("lib/admin-audit.server.ts", "utf8");

const routes = {
  settings: readFileSync("app/api/admin/settings/route.ts", "utf8"),
  upload: readFileSync("app/api/admin/upload/route.ts", "utf8"),
  push: readFileSync("app/api/push/send/route.ts", "utf8"),
  createAdmin: readFileSync("app/api/admin/admins/route.ts", "utf8"),
  updateAdmin: readFileSync("app/api/admin/admins/[id]/route.ts", "utf8"),
  tenantAccess: readFileSync(
    "app/api/admin/admins/[id]/access/route.ts",
    "utf8",
  ),
};

function assertOrdered(source, first, second, label) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.notEqual(firstIndex, -1, `missing ${first} in ${label}`);
  assert.notEqual(secondIndex, -1, `missing ${second} in ${label}`);
  assert.ok(firstIndex < secondIndex, `${first} must precede ${second} in ${label}`);
}

function allCodeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return allCodeFiles(path);
    }
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

test("baseline and canonical migration define the persistent table", () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /create table if not exists public\.admin_audit_logs/i);
    assert.match(sql, /id bigint generated always as identity primary key/i);
    assert.match(sql, /correlation_id uuid not null/i);
    assert.match(sql, /actor_admin_user_id uuid null[\s\S]*on delete set null/i);
    assert.match(sql, /actor_email_snapshot text not null/i);
    assert.match(sql, /actor_role_snapshot text not null/i);
    assert.match(sql, /before_json jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /after_json jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /metadata_json jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /attempt[\s\S]*success[\s\S]*failure[\s\S]*partial/i);
  }

  assert.match(migration, /PWA-WL/i);
  assert.match(migration, /Apply exactly once/i);
  assert.match(rollback, /refusing to drop non-empty/i);
});

test("all required audit indexes exist without GIN or partitioning", () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /\(source_tenant_domain, occurred_at desc\)/i);
    assert.match(
      sql,
      /\(target_tenant_domain, occurred_at desc\)[\s\S]*where target_tenant_domain is not null/i,
    );
    assert.match(sql, /\(actor_admin_user_id, occurred_at desc\)/i);
    assert.match(sql, /\(entity_type, entity_id, occurred_at desc\)/i);
    assert.match(sql, /\(correlation_id\)/i);
    assert.doesNotMatch(sql, /admin_audit_logs[\s\S]{0,120}\bgin\b/i);
    assert.doesNotMatch(sql, /partition by/i);
  }
});

test("RLS and append-only grants are least privilege", () => {
  for (const sql of [schema, migration]) {
    assert.match(
      sql,
      /alter table public\.admin_audit_logs enable row level security/i,
    );
    assert.match(
      sql,
      /revoke all on table public\.admin_audit_logs[\s\S]{0,100}from public, anon, authenticated, service_role/i,
    );
    assert.match(
      sql,
      /grant select, insert on table public\.admin_audit_logs to service_role/i,
    );
    assert.doesNotMatch(
      sql,
      /grant[^;]*(?:update|delete|truncate)[^;]*admin_audit_logs/i,
    );
    assert.doesNotMatch(
      sql,
      /create policy[^;]*admin_audit_logs/i,
    );
  }
});

test("helper derives identity and source tenant only from trusted server context", () => {
  assert.match(helper, /extractHostname\(appConfig\.publicUrl\)/);
  assert.match(helper, /actorAdminUserId: input\.actor\.id/);
  assert.match(helper, /actorAuthUserId: input\.actor\.authUserId/);
  assert.match(helper, /actorEmailSnapshot: input\.actor\.email/);
  assert.match(helper, /actorRoleSnapshot: input\.actor\.role/);
  assert.doesNotMatch(helper, /request\.json|Request\b|body\b/);
  assert.match(helper, /createSupabaseAdminClient\(\)/);
});

test("attempt persistence is ordered before every administrative mutation", () => {
  assertOrdered(routes.settings, "beginAdminAudit({", "supabase.from(\"app_settings\").update", "settings");
  assertOrdered(routes.upload, "beginAdminAudit({", ".upload(path, uploadData", "upload");
  assertOrdered(routes.push, "beginAdminAudit({", ".insert({", "push");
  assertOrdered(routes.createAdmin, "beginAdminAudit({", "supabase.auth.admin.createUser", "admin create");
  assertOrdered(routes.updateAdmin, "beginAdminAudit({", ".update(update)", "admin update");
  assertOrdered(routes.tenantAccess, "beginAdminAudit({", ".upsert(", "tenant grant");

  for (const [name, source] of Object.entries(routes)) {
    assert.match(source, /AdminAuditUnavailableError/);
    assert.match(source, /Auditoria administrativa indisponivel/);
    assert.match(source, /status: 503/);
    assert.match(source, /completeAdminAudit\(/, `missing terminal audit in ${name}`);
  }
});

test("common and BigPix-only action names are instrumented", () => {
  assert.match(routes.settings, /settings\.updated/);
  assert.match(routes.upload, /asset\.uploaded/);
  for (const action of ["push.sent", "push.failed", "push.partial"]) {
    assert.match(routes.push, new RegExp(action.replace(".", "\\.")));
  }
  for (const action of ["admin.created", "admin.linked"]) {
    assert.match(routes.createAdmin, new RegExp(action.replace(".", "\\.")));
  }
  for (const action of [
    "admin.updated",
    "admin.role_changed",
    "admin.activated",
    "admin.deactivated",
  ]) {
    assert.match(routes.updateAdmin, new RegExp(action.replace(".", "\\.")));
  }
  assert.match(routes.tenantAccess, /admin\.tenant_granted/);
  assert.match(routes.tenantAccess, /admin\.tenant_revoked/);
});

test("outcome paths include success, failure, and partial where required", () => {
  assert.match(routes.settings, /outcome: "success"/);
  assert.match(routes.settings, /outcome: "failure"/);
  assert.match(routes.upload, /outcome: "success"/);
  assert.match(routes.upload, /outcome: "failure"/);
  assert.match(routes.push, /outcome: "partial"/);
  assert.match(routes.createAdmin, /"partial"/);
  assert.match(routes.createAdmin, /"failure"/);
  assert.match(routes.createAdmin, /"success"/);
});

test("entity allowlists omit secrets and bulky values", () => {
  const secret = "must-not-survive";
  const settings = sanitizeSettingsAuditSnapshot({
    appName: "BigPix",
    publicUrl: "https://big.example/path?token=abc#private",
    notificationsEnabled: true,
    oneSignalAppId: secret,
    password: secret,
    access_token: secret,
  });
  const admin = sanitizeAdminAuditSnapshot({
    name: "Operator",
    role: "admin",
    active: true,
    email: secret,
    password: secret,
  });
  const asset = sanitizeAssetAuditMetadata({
    assetType: "logo",
    mimeType: "image/webp",
    sizeBytes: 321,
    file: secret,
    originalName: secret,
  });
  const push = sanitizePushAuditMetadata({
    targetType: "all",
    recipientCount: 9,
    httpStatus: 200,
    notificationAccepted: true,
    campaignPersisted: true,
    recipients: [secret],
    message: secret,
  });
  const grant = sanitizeTenantGrantAuditMetadata({
    previousActive: false,
    currentActive: true,
    token: secret,
  });

  const serialized = JSON.stringify({ settings, admin, asset, push, grant });
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.equal(settings.publicUrl, "https://big.example/path");
  assert.deepEqual(Object.keys(admin), ["name", "role", "active"]);
  assert.deepEqual(Object.keys(asset), ["assetType", "mimeType", "sizeBytes"]);
  assert.deepEqual(Object.keys(push), [
    "targetType",
    "recipientCount",
    "httpStatus",
    "notificationAccepted",
    "campaignPersisted",
  ]);
  assert.deepEqual(Object.keys(grant), ["previousActive", "currentActive"]);
});

test("settings metadata contains only allowlisted changed field names", () => {
  const before = { appName: "Before", oneSignalAppId: "old", password: "old" };
  const after = { appName: "After", oneSignalAppId: "new", password: "new" };
  const changed = getSettingsAuditChangedFields(before, after);
  const metadata = sanitizeSettingsAuditMetadata([...changed, "password"]);

  assert.deepEqual(changed, ["appName", "oneSignalAppId"]);
  assert.deepEqual(metadata.changedFields, ["appName", "oneSignalAppId"]);
});

test("defense-in-depth rejects forbidden keys and oversized JSON", () => {
  assert.throws(() => assertSafeAuditJson({ password: "x" }));
  assert.throws(() =>
    assertSafeAuditJson({ allowed: "x".repeat(17 * 1024) }),
  );
});

test("application code never updates or deletes audit events", () => {
  const files = [...allCodeFiles("app"), ...allCodeFiles("lib")];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /from\(["']admin_audit_logs["']\)[\s\S]{0,160}\.(?:update|delete)\(/,
      file,
    );
  }
});

test("correlation id and immutable actor snapshots connect attempt and terminal rows", () => {
  assert.match(helper, /const correlationId = randomUUID\(\)/);
  assert.match(helper, /outcome: "attempt"/);
  assert.match(
    helper,
    /correlation_id: context\.correlationId[\s\S]*outcome: input\.outcome/,
  );
  assert.match(helper, /actor_email_snapshot: context\.actorEmailSnapshot/);
  assert.match(helper, /actor_role_snapshot: context\.actorRoleSnapshot/);
  assert.match(helper, /admin_audit_write_error/);
});

test("authentication, MFA, logout, and password reset stay outside M-7", () => {
  assert.doesNotMatch(
    readFileSync("lib/admin-audit.ts", "utf8"),
    /login|logout|mfa|password_reset|password\.reset/i,
  );
});
