import { useCallback, useEffect, useRef, useState } from "react";
import { app, getMessaging, getToken, onMessage, isSupported } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;
const APP_NAME = "agent";

export function useFCM() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isReady, setIsReady] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setPermission(Notification.permission);
  }, []);

  const saveToken = useCallback(async (token: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("fcm_tokens").upsert(
      { user_id: user.id, token, app: APP_NAME, updated_at: new Date().toISOString() },
      { onConflict: "token" }
    );
  }, []);

  const requestPermission = useCallback(async () => {
    const supported = await isSupported();
    if (!supported) return null;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Enable notifications to get order alerts");
        return null;
      }

      const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (token) {
        setFcmToken(token);
        setIsReady(true);
        await saveToken(token);
        toast.success("🔔 Order notifications enabled!");

        // Foreground notification handler
        unsubscribeRef.current = onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {};
          toast(title || "New Order", {
            description: body || "A new delivery order awaits!",
            duration: 8000,
            action: { label: "View", onClick: () => window.location.href = "/agent/dashboard" },
          });
        });
      }

      return token;
    } catch (err) {
      console.error("FCM error:", err);
      toast.error("Failed to enable notifications");
      return null;
    }
  }, [saveToken]);

  const removeToken = useCallback(async () => {
    if (fcmToken) {
      await supabase.from("fcm_tokens").delete().eq("token", fcmToken);
      setFcmToken(null);
      setIsReady(false);
    }
    unsubscribeRef.current?.();
  }, [fcmToken]);

  // Auto-init if already allowed
  useEffect(() => {
    if (Notification.permission === "granted") {
      requestPermission();
    }
    return () => { unsubscribeRef.current?.(); };
  }, []);

  return { fcmToken, permission, isReady, requestPermission, removeToken };
}
