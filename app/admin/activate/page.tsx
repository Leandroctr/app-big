"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_ACTIVATION_PATH,
  parseAdminInviteCallback,
} from "@/lib/admin-invite";
import { appConfig } from "@/lib/app-config";
import { checkPasswordPolicy } from "@/lib/password-policy";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ScreenStatus = "loading" | "ready" | "invalid" | "submitting";

type ActivationValidation = {
  ok?: boolean;
  email?: string;
};

const invalidLinkMessage =
  "Link de ativacao invalido ou expirado. Solicite um novo link administrativo.";

async function validateAdministrativeSession(session: Session) {
  const response = await fetch("/api/admin/activation/validate", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const result = (await response.json().catch(() => null)) as
    | ActivationValidation
    | null;

  if (!response.ok || !result?.ok || !result.email) {
    return null;
  }

  return result.email;
}

export default function AdminActivationPage() {
  const router = useRouter();
  const initialized = useRef(false);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const [status, setStatus] = useState<ScreenStatus>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (initialized.current) {
      return;
    }
    initialized.current = true;

    let isActive = true;

    async function init() {
      const callback = parseAdminInviteCallback(
        window.location.search,
        window.location.hash,
      );

      // Fragmentos, token hashes e codigos sao usados somente em memoria. A
      // barra e limpa antes de qualquer fetch, analytics ou navegacao externa.
      window.history.replaceState(
        window.history.state,
        "",
        ADMIN_ACTIVATION_PATH,
      );

      if (
        callback.kind === "none" ||
        callback.kind === "invalid" ||
        callback.kind === "error"
      ) {
        if (isActive) {
          setStatus("invalid");
          setErrorMessage(invalidLinkMessage);
        }
        return;
      }

      const supabase = createSupabaseBrowserClient({
        detectSessionInUrl: false,
      });

      if (!supabase) {
        if (isActive) {
          setStatus("invalid");
          setErrorMessage("Supabase nao configurado neste ambiente.");
        }
        return;
      }

      supabaseRef.current = supabase;
      let session: Session | null = null;

      if (callback.kind === "implicit") {
        const { data, error } = await supabase.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: callback.refreshToken,
        });
        session = error ? null : data.session;
      } else if (callback.kind === "token_hash") {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: callback.tokenHash,
          type: callback.otpType,
        });
        session = error ? null : data.session;
      } else {
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          callback.code,
        );
        session = error ? null : data.session;
      }

      if (!session) {
        if (isActive) {
          setStatus("invalid");
          setErrorMessage(invalidLinkMessage);
        }
        return;
      }

      const administrativeEmail = await validateAdministrativeSession(session);

      if (!administrativeEmail) {
        await supabase.auth.signOut({ scope: "local" });
        if (isActive) {
          setStatus("invalid");
          setErrorMessage(invalidLinkMessage);
        }
        return;
      }

      if (isActive) {
        setEmail(administrativeEmail);
        setStatus("ready");
      }
    }

    init().catch(() => {
      if (isActive) {
        setStatus("invalid");
        setErrorMessage(invalidLinkMessage);
      }
    });

    return () => {
      isActive = false;
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

    const policyResult = checkPasswordPolicy(password, {
      email: email ?? undefined,
    });

    if (!policyResult.ok) {
      setErrorMessage(policyResult.reason);
      return;
    }

    const supabase = supabaseRef.current;

    if (!supabase) {
      setStatus("invalid");
      setErrorMessage(invalidLinkMessage);
      return;
    }

    setStatus("submitting");
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    const currentSession = sessionError ? null : sessionData.session;

    if (
      !currentSession ||
      !(await validateAdministrativeSession(currentSession))
    ) {
      await supabase.auth.signOut({ scope: "local" });
      setStatus("invalid");
      setErrorMessage(invalidLinkMessage);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("ready");
      setErrorMessage(
        "Nao foi possivel definir a senha. Solicite um novo link administrativo.",
      );
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut({
      scope: "global",
    });

    if (signOutError) {
      await supabase.auth.signOut({ scope: "local" });
    }

    router.replace("/admin/login?activated=1");
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
            Ativar acesso administrativo
          </h1>
        </div>

        <div className="grid gap-4 rounded-lg bg-white p-5 shadow-sm">
          {status === "loading" ? (
            <p className="text-sm font-medium text-slate-600">
              Validando o convite...
            </p>
          ) : null}

          {status === "invalid" ? (
            <>
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                {errorMessage}
              </p>
              <a className="text-sm font-bold text-slate-700" href="/admin/login">
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
                Criar senha
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
                Confirmar senha
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
                Minimo 12 caracteres. No primeiro login, o autenticador TOTP sera
                obrigatorio antes de qualquer acesso administrativo.
              </p>

              <button
                className="min-h-12 rounded-lg px-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={status === "submitting"}
                style={{ backgroundColor: appConfig.themeColor }}
                type="submit"
              >
                {status === "submitting" ? "Ativando..." : "Definir senha"}
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
