import { vi } from "vite-plus/test";
import { McStatusClient } from "../src";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function mockClient(respond: (request: Request) => Response = () => json({})) {
  const fetch = vi.fn(async (input: URL, init?: RequestInit) => respond(new Request(input, init)));
  const mcstatus = new McStatusClient({ fetch: fetch as unknown as typeof globalThis.fetch });
  const lastRequest = () => {
    const [input, init] = fetch.mock.lastCall!;
    return new Request(input, init);
  };
  return { mcstatus, fetch, lastRequest };
}
