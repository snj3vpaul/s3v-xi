/** Tiny fetch helper for league API calls from the browser (cookies are sent automatically). */
export async function leagueApi<T = Record<string, unknown>>(path: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(`/api/league${path}`, {
      method, credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Couldn't reach the server. Check your connection and try again." } as T & { error?: string } };
  }
}
