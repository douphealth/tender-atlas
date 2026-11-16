import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy static URL from the previous site: permanent redirect.
export const Route = createFileRoute("/privacy.html")({
  beforeLoad: () => { throw redirect({ to: "/privacy", statusCode: 301 }); },
});
