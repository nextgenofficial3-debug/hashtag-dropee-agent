import { useState, useEffect } from "react";

export function useHubConnection() {
  const [hubConnected, setHubConnected] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setHubConnected(true);
    const handleOffline = () => setHubConnected(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return hubConnected;
}
