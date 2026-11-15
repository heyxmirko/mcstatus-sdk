# mcstatus-sdk

[![npm](https://img.shields.io/npm/v/mcstatus-sdk)](https://www.npmjs.com/package/mcstatus-sdk)
[![CI](https://github.com/heyxmirko/mcstatus-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/heyxmirko/mcstatus-sdk/actions/workflows/ci.yml)

Unofficial, fully typed TypeScript SDK for the [mcstatus.io](https://mcstatus.io/docs) Minecraft server status API.
Zero dependencies, about 1.3 kB gzipped. Built on native `fetch`, so it runs in browsers, Node 22+, Bun, Deno and edge runtimes.

The official [`node-mcstatus`](https://www.npmjs.com/package/node-mcstatus) client hasn't been updated since May 2024. It depends on a deprecated `superagent` v8 and on zod v3, and [Socket reports](https://socket.dev/npm/package/node-mcstatus) 9 high alerts in its dependencies, including a high-severity CVE. That's a lot of weight and risk for showing a player count on a website, so I made this one instead.

## Install

```sh
npm install mcstatus-sdk
```

## Usage

```ts
import { McStatusClient } from "mcstatus-sdk";

const mcstatus = new McStatusClient();

const status = await mcstatus.java("play.example.com");

if (status.online) {
  console.log(`${status.players.online}/${status.players.max} players`, status.motd.clean);
} else {
  console.log("Server is offline");
}
```

`status.online` narrows the type: `players`, `motd`, `version` and the rest only exist on the online shape, so TypeScript makes you check first.

## Recipes

**Players online chip in React (with React Query)**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { McStatusClient } from "mcstatus-sdk";

const mcstatus = new McStatusClient();

export function PlayersOnline() {
  const { data } = useQuery({
    queryKey: ["mcstatus", "play.example.com"],
    queryFn: ({ signal }) => mcstatus.java("play.example.com", { query: false, signal }),
    refetchInterval: 60_000, // the API caches statuses for about a minute
  });

  if (!data) return null;
  return <span>{data.online ? `${data.players.online} online` : "Offline"}</span>;
}
```

**On the server (Next.js route handler, Node, edge)**

```ts
import { McStatusClient } from "mcstatus-sdk";

const mcstatus = new McStatusClient();

export async function GET() {
  const status = await mcstatus.java("play.example.com");
  return Response.json({
    online: status.online,
    players: status.online ? status.players.online : 0,
  });
}
```

**Bedrock Edition**

```ts
const status = await mcstatus.bedrock("pe.example.com:19132");
if (status.online) console.log(status.players.online, status.gamemode, status.edition);
```

**Server icon and status widget**

```ts
// Plain URLs for <img src>. These make no request.
const iconSrc = mcstatus.iconUrl("play.example.com");
const widgetSrc = mcstatus.widgetUrl("java", "play.example.com", { dark: false });

// Or download the PNG.
const icon: Blob = await mcstatus.icon("play.example.com");
```

The Java status response also contains the icon as a `data:` URL in `status.icon`.

**Send a Votifier vote (server only)**

```ts
await mcstatus.vote({
  host: "play.example.com",
  username: "Notch",
  token: process.env.VOTIFIER_TOKEN!, // or publickey for Votifier 1
});
```

Your Votifier token and key are secrets, so never call `vote` from the browser.

**Handle errors**

```ts
import { McStatusError } from "mcstatus-sdk";

try {
  await mcstatus.java("not a valid address");
} catch (error) {
  if (error instanceof McStatusError) console.error(error.status, error.message); // 400 "Invalid address value"
  else throw error;
}
```

An offline server is **not** an error. It resolves with `{ online: false, ... }`. `McStatusError` is only thrown when the API itself replies with a non-2xx status, such as a malformed address or a rate limit.

## API

| Method                                | Endpoint                         | Returns                  |
| ------------------------------------- | -------------------------------- | ------------------------ |
| `java(address, { query?, timeout? })` | `GET /status/java/<address>`     | `Promise<JavaStatus>`    |
| `bedrock(address, { timeout? })`      | `GET /status/bedrock/<address>`  | `Promise<BedrockStatus>` |
| `icon(address?, { timeout? })`        | `GET /icon/<address>`            | `Promise<Blob>`          |
| `iconUrl(address?, { timeout? })`     | (URL only)                       | `string`                 |
| `widgetUrl(edition, address, opts?)`  | (URL only) `/widget/<edition>/…` | `string`                 |
| `vote(options)`                       | `POST /vote`                     | `Promise<void>`          |

Client options are `new McStatusClient({ baseUrl?, timeout?, fetch? })`. Every method that makes a request also accepts `{ signal }`.

## Good to know

- **Responses are typed, not validated.** The SDK trusts the API and casts the JSON to the documented types, with no runtime schema checks. That keeps it at zero dependencies. If mcstatus.io ever changes its response shape, the types are the only thing to update.
- **Types match the API exactly** (snake_case, `null` where the docs say so). Nothing is renamed.
- **Two different timeouts.** The client `timeout` option is in **milliseconds** and aborts the HTTP request (default 15s, `0` disables it). The per-call `timeout` is the API's own parameter, in **seconds** (default 5, max 10). It sets how long mcstatus.io waits for your Minecraft server before reporting it offline.
- **Addresses** are `host` or `host:port` and are URL-encoded for you.
- **Caching:** the API caches each status for about a minute, and adding query params does not bypass it. Polling more often than that only returns the same data.
- **Rate limit:** 5 requests per second per IP. There are no automatic retries.
- **Self-hosting:** point `baseUrl` at your own [ping-server](https://github.com/mcstatus-io/ping-server) to skip the shared cache and rate limit.

## License

MIT
