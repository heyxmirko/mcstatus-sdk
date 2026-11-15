import { describe, expect, it } from "vite-plus/test";
import { McStatusClient, McStatusError } from "../src";
import { json, mockClient } from "./helpers";

const offline = {
  online: false,
  host: "nope.invalid",
  port: 25565,
  ip_address: null,
  eula_blocked: false,
  retrieved_at: 1,
  expires_at: 2,
  srv_record: null,
};

describe("status", () => {
  it("fetches Java status and narrows on `online`", async () => {
    const { mcstatus, lastRequest } = mockClient(() => json(offline));
    const status = await mcstatus.java("nope.invalid");

    expect(lastRequest().method).toBe("GET");
    expect(lastRequest().url).toBe("https://api.mcstatus.io/v2/status/java/nope.invalid");
    expect(status).toEqual(offline);
    // @ts-expect-error `players` only exists once narrowed to online
    void status.players;
    if (status.online) expect.unreachable();
  });

  it("sends status query params and encodes the address", async () => {
    const { mcstatus, lastRequest } = mockClient();
    await mcstatus.java("play.example.com:25566", { query: false, timeout: 2.5 });
    expect(lastRequest().url).toBe(
      "https://api.mcstatus.io/v2/status/java/play.example.com%3A25566?query=false&timeout=2.5",
    );
  });

  it("fetches Bedrock status", async () => {
    const { mcstatus, lastRequest } = mockClient(() => json({ ...offline, port: 19132 }));
    const status = await mcstatus.bedrock("pe.example.com");
    expect(lastRequest().url).toBe("https://api.mcstatus.io/v2/status/bedrock/pe.example.com");
    expect(status.port).toBe(19132);
  });

  it("respects a custom baseUrl", async () => {
    const { fetch } = mockClient();
    const mcstatus = new McStatusClient({
      baseUrl: "http://localhost:3001/",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    await mcstatus.bedrock("a");
    expect(String(fetch.mock.lastCall![0])).toBe("http://localhost:3001/status/bedrock/a");
  });
});

describe("icon and widget", () => {
  it("returns the icon as a Blob", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const { mcstatus, lastRequest } = mockClient(
      () => new Response(png, { headers: { "Content-Type": "image/png" } }),
    );
    const icon = await mcstatus.icon("play.example.com");

    expect(lastRequest().url).toBe("https://api.mcstatus.io/v2/icon/play.example.com");
    expect(icon.type).toBe("image/png");
    expect(new Uint8Array(await icon.arrayBuffer())).toEqual(png);
  });

  it("builds URLs without fetching", () => {
    const { mcstatus, fetch } = mockClient();
    expect(mcstatus.iconUrl()).toBe("https://api.mcstatus.io/v2/icon");
    expect(mcstatus.iconUrl("a:1", { timeout: 3 })).toBe(
      "https://api.mcstatus.io/v2/icon/a%3A1?timeout=3",
    );
    expect(mcstatus.widgetUrl("java", "a", { dark: false, transparent: true })).toBe(
      "https://api.mcstatus.io/v2/widget/java/a?dark=false&transparent=true",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("vote", () => {
  it("POSTs everything as query params", async () => {
    const { mcstatus, lastRequest } = mockClient(
      () => new Response("The vote was successfully sent to the server"),
    );
    await expect(
      mcstatus.vote({
        host: "play.example.com",
        username: "Notch",
        token: "secret",
        timestamp: new Date("2026-01-02T03:04:05Z"),
      }),
    ).resolves.toBeUndefined();

    const url = new URL(lastRequest().url);
    expect(lastRequest().method).toBe("POST");
    expect(url.pathname).toBe("/v2/vote");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      host: "play.example.com",
      username: "Notch",
      token: "secret",
      timestamp: "2026-01-02T03:04:05.000Z",
    });
  });
});

describe("errors and cancellation", () => {
  it("throws McStatusError with the plain-text message", async () => {
    const { mcstatus } = mockClient(
      () => new Response("Invalid address value", { status: 400, statusText: "Bad Request" }),
    );
    const error = await mcstatus.java("::bad::").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(McStatusError);
    expect(error).toMatchObject({
      name: "McStatusError",
      message: "Invalid address value",
      status: 400,
      method: "GET",
      path: "/status/java/%3A%3Abad%3A%3A",
      body: "Invalid address value",
    });
  });

  it("falls back to the status text for empty error bodies", async () => {
    const { mcstatus } = mockClient(
      () => new Response(null, { status: 429, statusText: "Too Many Requests" }),
    );
    await expect(mcstatus.bedrock("a")).rejects.toMatchObject({
      status: 429,
      message: "Too Many Requests",
    });
  });

  const hang = (_url: URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) =>
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
    );

  it("times out", async () => {
    const mcstatus = new McStatusClient({ timeout: 10, fetch: hang as unknown as typeof fetch });
    await expect(mcstatus.java("a")).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("aborts with the caller's signal", async () => {
    const mcstatus = new McStatusClient({ timeout: 0, fetch: hang as unknown as typeof fetch });
    const controller = new AbortController();
    const pending = mcstatus.java("a", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
