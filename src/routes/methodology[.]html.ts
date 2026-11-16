import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy static URL from the previous site: permanent redirect.
export const Route = createFileRoute("/methodology.html")({
  beforeLoad: () => { throw redirect({ to: "/methodology", statusCode: 301 }); },
});
