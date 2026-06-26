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
    if (!appId) return;

    void OneSignal.init({
      appId,
      autoResubscribe: true,
      serviceWorkerParam: { scope: "/onesignal/" },
      serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
    }).then(() => {
      OneSignal.User.PushSubscription.addEventListener("change", (event) => {
        const { id, optedIn } = event.current;
        if (id && optedIn) {
          void sendSubscription(id);
        }
      });

      const currentId = OneSignal.User.PushSubscription.id;
      const currentOptedIn = OneSignal.User.PushSubscription.optedIn;
      if (currentId && currentOptedIn) {
        void sendSubscription(currentId);
      }

      void OneSignal.Slidedown.promptPush();
    });
  }, []);

  return null;
}
