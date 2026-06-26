"use client";

import { useEffect } from "react";
import OneSignal from "react-onesignal";

declare global {
  interface Window {
    __ONESIGNAL_INITED__?: boolean;
  }
}

async function sendSubscription(id: string) {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      onesignalId: id,
      permissionStatus: Notification.permission,
      userAgent: navigator.userAgent,
      deviceType: "web",
    }),
  });
}

export function OneSignalInitializer() {
  useEffect(() => {
    if (window.__ONESIGNAL_INITED__) return;
    window.__ONESIGNAL_INITED__ = true;

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    console.log("[OS] === OneSignal init start ===");
    console.log("[OS] appId present:", Boolean(appId));
    console.log("[OS] serviceWorker supported:", "serviceWorker" in navigator);
    console.log("[OS] Notification supported:", "Notification" in window);
    console.log("[OS] Notification.permission:", typeof Notification !== "undefined" ? Notification.permission : "N/A");

    if (!appId) {
      console.warn("[OS] NEXT_PUBLIC_ONESIGNAL_APP_ID not set — aborting.");
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        console.log("[OS] SW registrations before init:", regs.length);
        regs.forEach((r, i) =>
          console.log(`[OS]   SW[${i}] scope="${r.scope}" state="${r.active?.state ?? "no active worker"}"`)
        );
      });
    }

    console.log("[OS] Calling OneSignal.init() with:", {
      appId: appId.slice(0, 8) + "...",
      autoResubscribe: true,
      serviceWorkerParam: { scope: "/onesignal/" },
      serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
    });

    void OneSignal.init({
      appId,
      autoResubscribe: true,
      serviceWorkerParam: { scope: "/onesignal/" },
      serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
    }).then(() => {
      console.log("[OS] init() resolved successfully.");

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          console.log("[OS] SW registrations after init:", regs.length);
          regs.forEach((r, i) =>
            console.log(`[OS]   SW[${i}] scope="${r.scope}" state="${r.active?.state ?? "no active worker"}"`)
          );
        });
      }

      console.log("[OS] PushSubscription.id:", OneSignal.User.PushSubscription.id ?? "null");
      console.log("[OS] PushSubscription.optedIn:", OneSignal.User.PushSubscription.optedIn);
      console.log("[OS] Notifications.permission:", OneSignal.Notifications.permission);

      OneSignal.User.PushSubscription.addEventListener("change", (event) => {
        console.log("[OS] PushSubscription changed:", event.current);
        const { id, optedIn } = event.current;
        if (id && optedIn) {
          void sendSubscription(id);
        }
      });

      const currentId = OneSignal.User.PushSubscription.id;
      const currentOptedIn = OneSignal.User.PushSubscription.optedIn;
      if (currentId && currentOptedIn) {
        console.log("[OS] Already subscribed — syncing to API.");
        void sendSubscription(currentId);
      }

      console.log("[OS] Calling Slidedown.promptPush().");
      void OneSignal.Slidedown.promptPush();
    }).catch((error: unknown) => {
      console.error("[OS] init() FAILED.");
      console.error("[OS] Error:", error);
      if (error instanceof Error) {
        console.error("[OS] Message:", error.message);
        console.error("[OS] Stack:", error.stack);
      }
    });
  }, []);

  return null;
}
