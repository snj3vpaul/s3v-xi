"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = (id: string) => `rsfc-announce-${id}`;

/** Dismissible site-wide strip. Dismissal is remembered per browser. */
export function Announcement({ id, title, body, href, linkText }: { id: string; title: string; body: string; href: string; linkText: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY(id))) setHidden(true);
    } catch {
      /* storage blocked: just keep showing it */
    }
  }, [id]);
  if (hidden) return null;
  return (
    <div className="announce-bar" role="region" aria-label="Announcement">
      <div className="wrap">
        <span>
          <span className="announce-pill">New</span> <b>{title}:</b> {body}
        </span>
        <span className="announce-actions">
          <Link href={href}>{linkText}</Link>
          <button
            type="button"
            className="announce-close"
            aria-label="Dismiss announcement"
            onClick={() => {
              setHidden(true);
              try {
                localStorage.setItem(KEY(id), "1");
              } catch {
                /* ignore */
              }
            }}
          >
            ✕
          </button>
        </span>
      </div>
    </div>
  );
}
