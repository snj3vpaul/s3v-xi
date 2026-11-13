"use client";
/** Small JSON client for the route handlers. Throws Error with the server's message. */
export async function api<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; details?: { message: string }[] } & T;
  if (!res.ok) {
    const extra = data.details?.map((d) => d.message).join(" ");
    throw new Error([data.error ?? `Request failed (${res.status})`, extra].filter(Boolean).join(" "));
  }
  return data;
}
