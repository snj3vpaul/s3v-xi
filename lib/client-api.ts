import { browserSupabase } from "./supabase";
const supabase = typeof window !== 'undefined' ? browserSupabase() : null;
export function clientAuth() { return supabase; }
export async function appFetch(url: string, options: RequestInit = {}): Promise<unknown> {
  const session = supabase ? await supabase.auth.getSession() : null;
  const token = session?.data.session?.access_token;
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = json as {error?:string;issues?:string[]};
    throw new Error([details.error??`HTTP ${response.status}`,...(details.issues??[])].join(' '));
  }
  return json;
}
