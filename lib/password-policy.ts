const MIN_LENGTH = 12;

// Senhas genericas/fracas explicitamente proibidas na criacao de admins,
// alem da checagem de tamanho minimo. Nao e uma lista exaustiva de senhas
// vazadas — e um bloqueio de bom senso para os casos citados no projeto
// (123456, admin, admin123, etc.) e variantes obvias.
const blockedPasswords = new Set([
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "senha",
  "senha123",
  "admin",
  "admin123",
  "adminadmin",
  "administrador",
  "qwerty",
  "qwerty123",
  "letmein",
  "trocar123",
  "mudar123",
]);

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; reason: string };

export function checkPasswordPolicy(
  password: string,
  context?: { email?: string; name?: string },
): PasswordPolicyResult {
  const normalized = password.trim();

  if (normalized.length < MIN_LENGTH) {
    return {
      ok: false,
      reason: `A senha precisa ter no minimo ${MIN_LENGTH} caracteres.`,
    };
  }

  const lowered = normalized.toLowerCase();

  if (blockedPasswords.has(lowered)) {
    return { ok: false, reason: "Essa senha e generica demais. Escolha outra." };
  }

  const email = context?.email?.trim().toLowerCase();
  const localPart = email?.split("@")[0];

  if (email && lowered.includes(email)) {
    return {
      ok: false,
      reason: "A senha nao pode conter o e-mail do administrador.",
    };
  }

  if (localPart && localPart.length >= 4 && lowered.includes(localPart)) {
    return {
      ok: false,
      reason: "A senha nao pode conter partes do e-mail do administrador.",
    };
  }

  const name = context?.name?.trim().toLowerCase();

  if (name && name.length >= 4 && lowered.includes(name)) {
    return {
      ok: false,
      reason: "A senha nao pode conter o nome do administrador.",
    };
  }

  return { ok: true };
}
