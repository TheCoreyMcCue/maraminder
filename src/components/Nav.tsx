"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/",        label: "Week",     icon: CalIcon },
  { href: "/overview",label: "Overview", icon: GridIcon },
  { href: "/zones",   label: "Zones",    icon: ZapIcon },
  { href: "/trends",  label: "Trends",   icon: TrendIcon },
];

export default function Nav() {
  const path = usePathname();

  function isActive(href: string) {
    return href === "/"
      ? path === "/" || path.startsWith("/week")
      : path.startsWith(href);
  }

  return (
    <>
      {/* Top bar */}
      <nav style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        gap: 32,
        height: 52,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)", letterSpacing: "-0.03em" }}>
          Maraminder
        </span>
        {/* Desktop nav links */}
        <div className="top-nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              <div style={{
                padding: "5px 12px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: isActive(l.href) ? 600 : 400,
                color: isActive(l.href) ? "var(--text)" : "var(--text-muted)",
                background: isActive(l.href) ? "var(--surface-2)" : "transparent",
              }}>
                {l.label}
              </div>
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="bottom-nav">
        {links.map((l) => {
          const active = isActive(l.href);
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} style={{ flex: 1 }}>
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "10px 0 8px",
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}>
                <Icon size={22} />
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{l.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function CalIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function GridIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function ZapIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function TrendIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
