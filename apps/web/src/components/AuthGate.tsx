import { useEffect, useState, type ReactNode } from "react";
import { getToken, getMe } from "../lib/api";
import { AuthPage } from "../pages/AuthPage";

type Status = "loading" | "authed" | "anon";

/**
 * Gates the app behind authentication. Restores a session from a stored token
 * (validated via /auth/me), shows the login/register page otherwise, and drops
 * back to login on a global `qf-unauthorized` event (401 from any request).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let active = true;
    if (!getToken()) {
      setStatus("anon");
    } else {
      getMe()
        .then(() => active && setStatus("authed"))
        .catch(() => active && setStatus("anon"));
    }
    const onUnauth = () => setStatus("anon");
    window.addEventListener("qf-unauthorized", onUnauth);
    return () => {
      active = false;
      window.removeEventListener("qf-unauthorized", onUnauth);
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      </div>
    );
  }
  if (status === "anon") {
    return <AuthPage onAuthed={() => setStatus("authed")} />;
  }
  return <>{children}</>;
}
