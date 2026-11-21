/** Reminder email sending: retry on Resend's rate limit, pace sends, never throw from the batch. */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { EmailError, SEND_GAP_MS, sendEmail, sendPaced } = await import("./email");

const msg = { subject: "s", text: "t", html: "<p>t</p>" };
const reply = (status: number, body = "{}", headers: Record<string, string> = {}) => new Response(body, { status, headers });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("email", () => {
  it("E01 retries a 429 once, then succeeds", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    const fetch = vi.fn().mockResolvedValueOnce(reply(429, "{}", { "retry-after": "0" })).mockResolvedValueOnce(reply(200));
    vi.stubGlobal("fetch", fetch);
    await expect(sendEmail("a@x.invalid", msg)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("E02 a 403 throws an EmailError with the status (no retry)", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    const fetch = vi.fn().mockImplementation(async () => reply(403, '{"message":"verify a domain"}'));
    vi.stubGlobal("fetch", fetch);
    await expect(sendEmail("a@x.invalid", msg)).rejects.toMatchObject({ status: 403 });
    await expect(sendEmail("a@x.invalid", msg)).rejects.toBeInstanceOf(EmailError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("E03 without a key nothing is sent", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(sendEmail("a@x.invalid", msg)).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("E04 paces sends, keeps going after a failure, and reports both", async () => {
    const times: number[] = [];
    const t0 = Date.now();
    const r = await sendPaced(["ok1", "bad", "ok2"], async (x) => {
      times.push(Date.now() - t0);
      if (x === "bad") throw new EmailError(403, "domain");
      return true;
    });
    expect(r.sent).toEqual(["ok1", "ok2"]);
    expect(r.failed).toEqual([{ item: "bad", status: 403, message: "Resend 403: domain" }]);
    expect(times[2] - times[0]).toBeGreaterThanOrEqual(2 * SEND_GAP_MS - 5);
  });
});
