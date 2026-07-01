"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import OneSignal from "react-onesignal";
import { appConfigClient } from "@/lib/app-config.client";

const DISMISS_STORAGE_KEY = "vipBannerDismissedUntil";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;
const RECHECK_EVENT = "vip-banner-recheck";

function isDismissedRecently(): boolean {
  try {
    const until = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!until) return false;
    return Date.now() < Number(until);
  } catch {
    return false;
  }
}

function isOptedIn(): boolean {
  return (
    Notification.permission === "granted" ||
    OneSignal.User.PushSubscription.optedIn === true
  );
}

function subscribe(onStoreChange: () => void) {
  OneSignal.User.PushSubscription.addEventListener("change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(RECHECK_EVENT, onStoreChange);
  return () => {
    OneSignal.User.PushSubscription.removeEventListener("change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(RECHECK_EVENT, onStoreChange);
  };
}

function getSnapshot(): boolean {
  if (typeof Notification === "undefined") return false;
  return !isOptedIn() && !isDismissedRecently();
}

function getServerSnapshot(): boolean {
  return false;
}

function notifyStateChanged() {
  window.dispatchEvent(new Event(RECHECK_EVENT));
}

type NotificationVipBannerProps = {
  notificationsEnabled: boolean;
};

export function NotificationVipBanner({
  notificationsEnabled,
}: NotificationVipBannerProps) {
  const pathname = usePathname();
  const [activating, setActivating] = useState(false);
  const eligible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const visible =
    notificationsEnabled &&
    Boolean(appConfigClient.oneSignalAppId) &&
    !isAdminRoute &&
    eligible;

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(
        DISMISS_STORAGE_KEY,
        String(Date.now() + DISMISS_DURATION_MS),
      );
    } catch {
      // localStorage indisponivel (modo privado, quota) - segue sem persistir
    }
    notifyStateChanged();
  }, []);

  const activate = useCallback(async () => {
    setActivating(true);
    try {
      await OneSignal.Notifications.requestPermission();
    } finally {
      setActivating(false);
      notifyStateChanged();
    }
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="sticky top-0 z-50 border-b px-4 py-3"
      style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
    >
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <div className="flex items-start gap-3">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: "#BFDBFE" }}
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="18"
              viewBox="0 0 24 24"
              width="18"
            >
              <path
                d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2Zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Z"
                fill="#2563EB"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-bold leading-5 text-slate-900">
              Ative as notificações e faça parte do Clube VIP 👑
            </p>
            <p className="mt-1 text-xs font-medium leading-5" style={{ color: "#475569" }}>
              Receba bônus exclusivos do app, novidades e benefícios.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70"
            disabled={activating}
            onClick={activate}
            style={{ backgroundColor: "#2563EB" }}
            type="button"
          >
            {activating ? "Ativando..." : "Ativar notificações"}
          </button>

          <button
            className="rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            disabled={activating}
            onClick={dismiss}
            style={{ backgroundColor: "#E5E7EB", color: "#4B5563" }}
            type="button"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
