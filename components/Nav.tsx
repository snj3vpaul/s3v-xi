"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/team", label: "My Team", hint: "Pick your seven, captain and bench" },
  { href: "/matches", label: "Matches", hint: "Fixtures, team sheets and scoresheets" },
  { href: "/table", label: "Table", hint: "Who's top of the league and of Pick 7" },
  { href: "/stats", label: "Stats", hint: "Goals, assists and form, player by player" },
  { href: "/rules", label: "Rules", hint: "How every point is scored" },
] as const;

/** What the deadline clock says about the signed-in user's seven. */
export type TeamStatus = "guest" | "none" | "fix" | "no_captain" | "set";

export interface NavDeadline {
  /** Kick-off (= Pick 7 deadline), UTC ISO. */
  at: string;
  /** e.g. "Thu, Nov 26, 10:00 p.m." */
  label: string;
}

const WEEK = 7 * 86_400_000;

function useNow(every = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

function left(ms: number): string {
  if (ms <= 0) return "Locked";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const STATUS_TEXT: Record<TeamStatus, string> = {
  guest: "Make an account to play Pick 7.",
  none: "You haven't picked your seven yet.",
  fix: "Your seven doesn't fit the formation. Fix it or it won't be entered.",
  no_captain: "Your seven is in, but it has no captain.",
  set: "Your seven is in. It carries over unless you change it.",
};

/**
 * The deadline clock: a ring that drains over the week before kick-off, with
 * the time left. Hover or focus shows the kick-off time and your team status.
 */
function DeadlineClock({ deadline, status, compact }: { deadline: NavDeadline; status: TeamStatus; compact?: boolean }) {
  const now = useNow();
  const tipId = useId();
  const ms = now === null ? null : new Date(deadline.at).getTime() - now;
  const frac = ms === null ? 1 : Math.max(0, Math.min(1, ms / WEEK));
  const urgent = ms !== null && ms > 0 && ms < 86_400_000;
  const needs = status !== "set";
  const r = 8.5;
  const c = 2 * Math.PI * r;
  return (
    <span className={`clock${urgent ? " is-urgent" : ""}${needs ? " needs-team" : " is-set"}${compact ? " is-compact" : ""}`}>
      <Link href={status === "guest" ? "/join" : "/team"} className="clock-btn" aria-describedby={tipId}>
        <svg className="clock-ring" viewBox="0 0 22 22" aria-hidden="true">
          <circle cx="11" cy="11" r={r} className="clock-track" />
          <circle cx="11" cy="11" r={r} className="clock-fill" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 11 11)" />
          {needs && <circle cx="11" cy="11" r="2.4" className="clock-dot" />}
        </svg>
        <span className="clock-text" suppressHydrationWarning>
          {ms === null ? (
            "Pick 7"
          ) : ms <= 0 ? (
            "Locked"
          ) : (
            <>
              <span className="clock-pre">Locks in </span>
              {left(ms)}
            </>
          )}
        </span>
      </Link>
      <span className="clock-tip" id={tipId} role="tooltip">
        <b>Pick 7 locks at kick-off</b>
        <span>{deadline.label}</span>
        <span className={needs ? "tip-warn" : "tip-ok"}>{STATUS_TEXT[status]}</span>
      </span>
    </span>
  );
}

export function Nav({ userName, deadline, status }: { userName: string | null; deadline: NavDeadline | null; status: TeamStatus }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);
  const active = LINKS.find((l) => isActive(l.href))?.href ?? null;

  // ---- Sliding line under the links -------------------------------------------------
  const navRef = useRef<HTMLElement>(null);
  const [line, setLine] = useState<{ x: number; w: number; on: boolean }>({ x: 0, w: 0, on: false });
  const moveTo = useCallback((href: string | null) => {
    const nav = navRef.current;
    const a = href ? nav?.querySelector<HTMLElement>(`a[data-href="${href}"]`) : null;
    if (!nav || !a) return setLine((l) => ({ ...l, on: false }));
    setLine({ x: a.offsetLeft, w: a.offsetWidth, on: true });
  }, []);
  useLayoutEffect(() => moveTo(active), [active, moveTo]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => moveTo(active));
    ro.observe(nav);
    return () => ro.disconnect();
  }, [active, moveTo]);

  // ---- Slim on scroll; hide going down, show going up --------------------------------
  const [slim, setSlim] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setSlim(y > 24);
        const focusInside = headerRef.current?.contains(document.activeElement);
        if (y < 160 || y < last - 4 || focusInside) setHidden(false);
        else if (y > last + 6) setHidden(true);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ---- Mobile sheet --------------------------------------------------------------------
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>(".menu-list a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuBtn.current?.focus();
      }
      if (e.key === "Tab" && sheetRef.current) {
        const f = [...sheetRef.current.querySelectorAll<HTMLElement>("a, button")];
        const first = f[0];
        const lastEl = f.at(-1)!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const accountActive = ["/account", "/login", "/join"].some((p) => path.startsWith(p));
  const first = userName ? userName.split(" ")[0] : null;

  return (
    <header ref={headerRef} className={`topbar${slim ? " is-slim" : ""}${hidden && !open ? " is-hidden" : ""}${open ? " menu-open" : ""}`}>
      <div className="wrap topbar-row">
        <Link href="/" className="brand" aria-label="RSFC League home">
          RSFC <span>League</span>
        </Link>

        <nav className="nav" aria-label="Main" ref={navRef} onMouseLeave={() => moveTo(active)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && moveTo(active)}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              data-href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              onMouseEnter={() => moveTo(l.href)}
              onFocus={() => moveTo(l.href)}
            >
              {l.label}
            </Link>
          ))}
          <span
            className={`nav-line${line.on ? " is-on" : ""}`}
            aria-hidden="true"
            style={{ transform: `translateX(${line.x}px)`, width: line.w }}
          />
        </nav>

        <div className="topbar-end">
          {deadline && <DeadlineClock deadline={deadline} status={status} />}
          <Link href={userName ? "/account" : "/login"} className="nav-account" aria-current={accountActive ? "page" : undefined}>
            {first ? (
              <>
                <span className="nav-avatar" aria-hidden="true">{first[0]}</span>
                <span className="nav-account-name">{first}</span>
              </>
            ) : (
              "Log in"
            )}
          </Link>
          <button
            ref={menuBtn}
            type="button"
            className="menu-btn"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen(!open)}
          >
            <span className="menu-icon" aria-hidden="true">
              <i />
              <i />
            </span>
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      <div id="site-menu" ref={sheetRef} className={`menu-sheet${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu" hidden={!open}>
        <div className="wrap">
          {deadline && (
            <div className="menu-clock">
              <DeadlineClock deadline={deadline} status={status} />
            </div>
          )}
          <ol className="menu-list">
            {LINKS.map((l, i) => (
              <li key={l.href} style={{ "--i": i } as React.CSSProperties}>
                <Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                  <span className="menu-label">{l.label}</span>
                  <span className="menu-hint">{l.hint}</span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="menu-foot">
            <Link href={userName ? "/account" : "/login"} onClick={() => setOpen(false)}>
              {userName ? `Signed in as ${first}. Account settings` : "Log in"}
            </Link>
            {!userName && (
              <Link href="/join" onClick={() => setOpen(false)}>
                Create an account
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
