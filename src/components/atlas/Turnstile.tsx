import { useEffect } from "react";

export const TURNSTILE_SITE_KEY = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;

export function Turnstile() {
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || document.querySelector('script[data-tenderatlas-turnstile]')) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true; script.defer = true; script.dataset["tenderatlasTurnstile"] = "true";
    document.head.appendChild(script);
  }, []);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div className="cf-turnstile min-h-[65px]" data-sitekey={TURNSTILE_SITE_KEY} data-theme="light" />;
}
