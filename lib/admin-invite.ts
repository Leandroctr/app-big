export const ADMIN_ACTIVATION_PATH = "/admin/activate";
export const ADMIN_PASSWORD_RESET_PATH = "/admin/reset-password";

const MAX_AUTH_PARAMETER_LENGTH = 8192;

export type AdminInviteCallback =
  | {
      kind: "implicit";
      accessToken: string;
      refreshToken: string;
    }
  | {
      kind: "token_hash";
      tokenHash: string;
      otpType: "invite" | "magiclink";
    }
  | { kind: "code"; code: string }
  | { kind: "error" }
  | { kind: "invalid" }
  | { kind: "none" };

function parseParameters(value: string, prefix: "?" | "#") {
  return new URLSearchParams(value.startsWith(prefix) ? value.slice(1) : value);
}

function isSafeAuthParameter(value: string | null): value is string {
  return Boolean(value && value.length <= MAX_AUTH_PARAMETER_LENGTH);
}

function normalizedType(
  query: URLSearchParams,
  fragment: URLSearchParams,
) {
  return (fragment.get("type") || query.get("type") || "").toLowerCase();
}

function isAdminActivationType(
  value: string,
): value is "invite" | "magiclink" {
  return value === "invite" || value === "magiclink";
}

function hasSupabaseAuthError(parameters: URLSearchParams) {
  return (
    parameters.has("error_code") ||
    (parameters.has("error") && parameters.has("error_description"))
  );
}

export function parseAdminInviteCallback(
  search: string,
  hash: string,
): AdminInviteCallback {
  const query = parseParameters(search, "?");
  const fragment = parseParameters(hash, "#");
  const type = normalizedType(query, fragment);

  if (
    hasSupabaseAuthError(query) ||
    hasSupabaseAuthError(fragment)
  ) {
    return { kind: "error" };
  }

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");

  if (accessToken || refreshToken) {
    if (
      !isAdminActivationType(type) ||
      !isSafeAuthParameter(accessToken) ||
      !isSafeAuthParameter(refreshToken)
    ) {
      return { kind: "invalid" };
    }

    return { kind: "implicit", accessToken, refreshToken };
  }

  const tokenHash = query.get("token_hash");

  if (tokenHash) {
    if (!isAdminActivationType(type) || !isSafeAuthParameter(tokenHash)) {
      return { kind: "invalid" };
    }

    return { kind: "token_hash", tokenHash, otpType: type };
  }

  const code = query.get("code");

  if (code) {
    if ((type && !isAdminActivationType(type)) || !isSafeAuthParameter(code)) {
      return { kind: "invalid" };
    }

    return { kind: "code", code };
  }

  return isAdminActivationType(type) ? { kind: "invalid" } : { kind: "none" };
}

export function getRootAdminAuthCallbackTarget(
  search: string,
  hash: string,
): string | null {
  const query = parseParameters(search, "?");
  const fragment = parseParameters(hash, "#");

  if ((fragment.get("type") || "").toLowerCase() === "recovery") {
    return ADMIN_PASSWORD_RESET_PATH;
  }

  const callback = parseAdminInviteCallback(search, hash);

  if (callback.kind !== "none") {
    return ADMIN_ACTIVATION_PATH;
  }

  // O Supabase pode omitir `type` ao devolver um erro de verificacao. Esses
  // parametros nunca pertencem ao launcher publico e devem terminar em uma
  // tela local, sem serem encaminhados para a plataforma externa.
  if (
    hasSupabaseAuthError(query) ||
    hasSupabaseAuthError(fragment)
  ) {
    return ADMIN_ACTIVATION_PATH;
  }

  return null;
}
