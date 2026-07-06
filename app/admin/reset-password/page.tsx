"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/lib/app-config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { checkPasswordPolicy } from "@/lib/password-policy";

// Sem guard de admin (requireSuperAdmin/requireTenantAccess) de proposito:
// quem chega aqui ainda nao tem cookie de sessao do app, so o token de
// recovery do Supabase Auth na URL (ver app/page.tsx). A seguranca do fluxo
// e o proprio token assinado/expiravel emitido pelo Supabase, nao um guard
// nosso.
type ScreenStatus = "loading" | "ready" | "invalid" | "submitting";

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenStatus>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    async function init() {
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        if (isActive) {
          setStatus("invalid");
          setErrorMessage("Supabase nao configurado neste ambiente.");
        }
        return;
      }

      // O evento PASSWORD_RECOVERY dispara quando o cliente Supabase termina
      // de processar o hash da URL (#access_token=...&type=recovery).
      // Cobrimos os dois caminhos (getSession abaixo + este listener) porque
      // a ordem entre o processamento do hash e este efeito rodar nao e
      // garantida.
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isActive || event !== "PASSWORD_RECOVERY" || !session) {
          return;
        }

        setEmail(session.user.email ?? null);
        setStatus("ready");
      });

      unsubscribe = () => listener.subscription.unsubscribe();

      const { data, error } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (error || !data.session) {
        setStatus("invalid");
        setErrorMessage(
          "Link de redefinicao invalido ou expirado. Solicite um novo link.",
        );
        return;
      }

      setEmail(data.session.user.email ?? null);
      setStatus("ready");
    }

    init();

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!password || !confirmPassword) {
      setErrorMessage("Preencha a nova senha e a confirmacao.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas nao coincidem.");
      return;
    }

    const policyResult = checkPasswordPolicy(password, { email: email ?? undefined });

    if (!policyResult.ok) {
      setErrorMessage(policyResult.reason);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setErrorMessage("Supabase nao configurado neste ambiente.");
      return;
    }

    setStatus("submitting");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("ready");
      setErrorMessage(
        "Nao foi possivel atualizar a senha. Tente novamente ou solicite um novo link.",
      );
      return;
    }

    await supabase.auth.signOut();
    router.replace("/admin/login?password_reset=1");
  }

  return (
    <main
      className="grid min-h-dvh place-items-center px-5 py-8 text-slate-950"
      style={{ backgroundColor: appConfig.backgroundColor }}
    >
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold text-slate-500">
            {appConfig.shortName}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-normal">
            Definir nova senha
          </h1>
        </div>

        <div className="grid gap-4 rounded-lg bg-white p-5 shadow-sm">
          {status === "loading" ? (
            <p className="text-sm font-medium text-slate-600">
              Verificando o link de redefinicao...
            </p>
          ) : null}

          {status === "invalid" ? (
            <>
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                {errorMessage}
              </p>
              <a
                className="text-sm font-bold text-slate-700"
                href="/admin/login"
              >
                Voltar ao login
              </a>
            </>
          ) : null}

          {status === "ready" || status === "submitting" ? (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              {email ? (
                <p className="text-sm text-slate-500">
                  Conta: <span className="font-semibold text-slate-700">{email}</span>
                </p>
              ) : null}

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Nova senha
                <input
                  autoComplete="new-password"
                  className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-normal outline-none focus:border-slate-400"
                  disabled={status === "submitting"}
                  minLength={12}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Confirmar nova senha
                <input
                  autoComplete="new-password"
                  className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-normal outline-none focus:border-slate-400"
                  disabled={status === "submitting"}
                  minLength={12}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>

              <p className="text-xs font-normal text-slate-500">
                Minimo 12 caracteres. Sem senhas genericas (123456, admin, etc.).
              </p>

              <button
                className="min-h-12 rounded-lg px-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={status === "submitting"}
                style={{ backgroundColor: appConfig.themeColor }}
                type="submit"
              >
                {status === "submitting" ? "Salvando..." : "Salvar nova senha"}
              </button>

              {errorMessage ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                  {errorMessage}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}
