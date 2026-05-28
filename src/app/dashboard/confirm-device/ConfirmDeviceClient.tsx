"use client";

import { useEffect, useState } from "react";

export function ConfirmDeviceClient() {
  const [status, setStatus] = useState<"polling" | "trusted" | "error">("polling");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch("/api/dashboard/confirm-device/status", { credentials: "same-origin" });
        if (!alive) return;
        if (!res.ok) {
          setStatus("error");
          setMessage("Could not check confirmation status. Refresh this page.");
          return;
        }
        const data = (await res.json()) as { pending: boolean; trusted: boolean };
        if (data.trusted) {
          setStatus("trusted");
          window.location.assign("/dashboard");
          return;
        }
        if (!data.pending) {
          setStatus("error");
          setMessage("No pending sign-in was found. Return to login and try again.");
          return;
        }
        setStatus("polling");
        t = setTimeout(poll, 2000);
      } catch {
        if (!alive) return;
        setStatus("error");
        setMessage("Could not check confirmation status. Refresh this page.");
      }
    };

    void poll();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, []);

  return (
    <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <p className="text-sm text-zinc-400">
        {status === "polling"
          ? "Awaiting confirmation…"
          : status === "trusted"
            ? "Confirmed. Redirecting…"
            : message ?? "Something went wrong. Refresh this page."}
      </p>
    </div>
  );
}

