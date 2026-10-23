import { describe, it, expect } from "vitest";
import { teamCounts, validateTournamentSquad, type EligiblePlayer } from "./tournament-rules";
import type { Role } from "./fantasy";
const roles: Role[] = ["WK","WK","BAT","BAT","BAT","BAT","BAT","AR","AR","AR","BOWL","BOWL","BOWL","BOWL","BOWL"];
const pool: EligiblePlayer[] = roles.map((role, i) => ({ id: `p${i}`, name: `Player ${i}`, role, teamId: `team-${Math.floor(i / 3)}`, available: true }));
const squad = { playerIds: pool.map((p) => p.id), benchIds: ["p1","p6","p9","p14"], captainId: "p2", viceCaptainId: "p7" };
describe("three-player restriction and squad validation", () => {
  it("accepts exactly three from one cricket team", () => expect(validateTournamentSquad(squad, pool)).toEqual([]));
  it("blocks a fourth from a team even when roles are otherwise valid", () => {
    const changedPool = pool.map((p) => p.id === "p6" ? { ...p, teamId: "team-0" } : p);
    expect(validateTournamentSquad(squad, changedPool).join(" ")).toMatch(/maximum of 3/);
  });
  it("unblocks selection after removing an existing teammate", () => {
    const changed = pool.map((p) => p.id === "p6" ? { ...p, teamId: "team-0" } : p);
    expect(teamCounts(squad.playerIds, changed).get("team-0")).toBe(4);
    expect(teamCounts(squad.playerIds.filter((id) => id !== "p0"), changed).get("team-0")).toBe(3);
  });
  it("rejects duplicate players", () => expect(validateTournamentSquad({...squad, playerIds: [...squad.playerIds.slice(0,14),"p0"]},pool).length).toBeGreaterThan(0));
  it("rejects unavailable players", () => expect(validateTournamentSquad(squad,pool.map(p=>p.id==="p2"?{...p,available:false}:p)).join(" ")).toMatch(/unavailable/));
  it("enforces captain and vice captain in starting XI", () => expect(validateTournamentSquad({...squad,captainId:"p1"},pool).join(" ")).toMatch(/captain/));
  it("supports versioned tournament cap overrides", () => {
    const changed=pool.map(p=>p.id==="p6"?{...p,teamId:"team-0"}:p);
    expect(validateTournamentSquad(squad,changed,{maxPerTeam:4})).toEqual([]);
  });
});
