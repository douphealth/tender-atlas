import { useEffect, useRef } from "react";

export const TURNSTILE_SITE_KEY = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;

type TurnstileApi = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };

export function Turnstile({ onToken }: { onToken?: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (!document.querySelector('script[data-tenderatlas-turnstile]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true; script.defer = true; script.dataset["tenderatlasTurnstile"] = "true";
      document.head.appendChild(script);
    }
    let widget: string | undefined;
    const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    const timer = setInterval(() => {
      const turnstile = api();
      if (!turnstile || !container.current || widget) return;
      widget = turnstile.render(container.current, { sitekey: TURNSTILE_SITE_KEY, theme: "light", size: "flexible", callback: (token: string) => callback.current?.(token), "expired-callback": () => callback.current?.(""), "error-callback": () => callback.current?.("") });
      clearInterval(timer);
    }, 100);
    return () => { clearInterval(timer); if (widget) api()?.remove(widget); };
  }, []);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={container} className="min-h-[65px]" />;
}
