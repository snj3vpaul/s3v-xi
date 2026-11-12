"use client";
import { useRouter } from "next/navigation";
import { leagueApi } from "./api";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button type="button" className="lg-iconbtn" title="Sign out" aria-label="Sign out"
      onClick={async () => { await leagueApi("/auth/logout", "POST"); router.push("/league/login"); router.refresh(); }}>
      ⏏︎
    </button>
  );
}
