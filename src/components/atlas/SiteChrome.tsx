import { Link } from "@tanstack/react-router";

const NAV = [
  { to: "/tenders", label: "Tenders" },
  { to: "/countries", label: "Countries" },
  { to: "/cpv", label: "Categories" },
  { to: "/buyers", label: "Buyers" },
  { to: "/alerts", label: "Alerts" },
  { to: "/app", label: "Workspace" },
  { to: "/pricing", label: "Dossiers" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold text-primary">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-sm bg-primary font-mono text-xs text-primary-foreground">TA</span>
          TenderAtlas
        </Link>
        <nav aria-label="Main" className="ml-auto flex gap-1 overflow-x-auto text-sm">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="rounded-sm px-2.5 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" activeProps={{ className: "rounded-sm px-2.5 py-1.5 bg-secondary text-foreground" }}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-ink-deep text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg">TenderAtlas</p>
          <p className="mt-2 text-sm opacity-70">Public procurement notices read directly from official publishers. Always verify in the original notice before bidding.</p>
        </div>
        <div className="text-sm">
          <p className="eyebrow !text-primary-foreground/60">Directory</p>
          <ul className="mt-3 space-y-1.5 opacity-85">
            <li><Link to="/tenders">Latest tenders</Link></li>
            <li><Link to="/countries">By country</Link></li>
            <li><Link to="/cpv">By CPV category</Link></li>
            <li><Link to="/buyers">Public buyers</Link></li>
            <li><Link to="/alerts">Email & RSS alerts</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="eyebrow !text-primary-foreground/60">About</p>
          <ul className="mt-3 space-y-1.5 opacity-85">
            <li><Link to="/methodology">Methodology & sources</Link></li>
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/pricing">Readiness dossiers</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
