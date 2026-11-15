import { McStatusError } from "./errors";
import type { BedrockStatus, JavaStatus } from "./types";

export interface McStatusClientOptions {
  /** Defaults to `https://api.mcstatus.io/v2`. Point it at a self-hosted ping-server if you like. */
  baseUrl?: string;
  /** Client-side request timeout in milliseconds. `0` disables it. Defaults to `15000`. */
  timeout?: number;
  /** Custom `fetch` implementation. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface StatusOptions extends RequestOptions {
  /** Seconds the API waits for the Minecraft server before reporting it offline. API default `5`, max `10`. */
  timeout?: number;
}

export interface JavaStatusOptions extends StatusOptions {
  /** Also run a query lookup (software, plugins). API default `true`; `false` can be faster. */
  query?: boolean;
}

export interface WidgetOptions {
  /** API default `true`. */
  dark?: boolean;
  /** API default `true`. */
  rounded?: boolean;
  /** API default `false`. */
  transparent?: boolean;
  /** Seconds the API waits for the server. API default `5`, max `10`. */
  timeout?: number;
}

export type Edition = "java" | "bedrock";

interface VoteBase extends RequestOptions {
  /** Host of the Minecraft server. */
  host: string;
  /** Votifier port. API default `8192`. */
  port?: number;
  /** Username of the voting player. */
  username: string;
  uuid?: string;
  /** API default `mcstatus.io`. */
  serviceName?: string;
  /** API default: time of request. */
  timestamp?: string | Date;
  /** API default: IP of the client calling the API. */
  ip?: string;
  /** Seconds until the connection to the server times out. API default `5`. */
  timeout?: number;
}

/** Needs `token` (Votifier 2, preferred), `publickey` (Votifier 1), or both. */
export type VoteOptions = VoteBase &
  ({ token: string; publickey?: string } | { publickey: string; token?: string });

type Query = Record<string, string | number | boolean | undefined>;

export class McStatusClient {
  readonly #baseUrl: string;
  readonly #timeout: number;
  readonly #fetch: typeof fetch;

  constructor(options: McStatusClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? "https://api.mcstatus.io/v2").replace(/\/+$/, "");
    this.#timeout = options.timeout ?? 15_000;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Status of a Java Edition server. `address` is `host` or `host:port`. */
  async java(address: string, options: JavaStatusOptions = {}): Promise<JavaStatus> {
    const { signal, ...query } = options;
    const response = await this.#request("GET", `/status/java/${segment(address)}`, query, signal);
    return (await response.json()) as JavaStatus;
  }

  /** Status of a Bedrock Edition server. `address` is `host` or `host:port`. */
  async bedrock(address: string, options: StatusOptions = {}): Promise<BedrockStatus> {
    const { signal, ...query } = options;
    const response = await this.#request(
      "GET",
      `/status/bedrock/${segment(address)}`,
      query,
      signal,
    );
    return (await response.json()) as BedrockStatus;
  }

  /** The Java server's 64×64 PNG icon. Falls back to the default icon if offline or omitted. */
  async icon(address?: string, options: StatusOptions = {}): Promise<Blob> {
    const { signal, ...query } = options;
    const response = await this.#request("GET", iconPath(address), query, signal);
    return response.blob();
  }

  /** URL of the server icon, for an `<img src>`. Makes no request. */
  iconUrl(address?: string, options: Pick<StatusOptions, "timeout"> = {}): string {
    return this.#url(iconPath(address), options).href;
  }

  /** URL of an embeddable status widget image, for an `<img src>`. Makes no request. */
  widgetUrl(edition: Edition, address: string, options: WidgetOptions = {}): string {
    return this.#url(`/widget/${edition}/${segment(address)}`, { ...options }).href;
  }

  /**
   * Sends a Votifier vote. Resolves once the API has sent it; Votifier 1 cannot confirm it was processed.
   * Keep `token`/`publickey` secret: call this from a server, not the browser.
   */
  async vote(options: VoteOptions): Promise<void> {
    const { signal, timestamp, ...query } = options;
    await this.#request(
      "POST",
      "/vote",
      { ...query, timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp },
      signal,
    );
  }

  #url(path: string, query: Query): URL {
    const url = new URL(this.#baseUrl + path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url;
  }

  async #request(
    method: "GET" | "POST",
    path: string,
    query: Query,
    signal: AbortSignal | undefined,
  ): Promise<Response> {
    const signals = [signal, this.#timeout > 0 && AbortSignal.timeout(this.#timeout)].filter(
      (s) => !!s,
    );

    const response = await this.#fetch(this.#url(path, query), {
      method,
      signal: signals.length ? AbortSignal.any(signals) : null,
    });

    if (!response.ok) {
      // The API sends errors as plain text, e.g. "Invalid address value".
      const body = await response.text().catch(() => "");
      throw new McStatusError({
        message: body.trim() || response.statusText || `HTTP ${response.status}`,
        status: response.status,
        method,
        path,
        body,
      });
    }

    return response;
  }
}

const segment = (value: string): string => encodeURIComponent(value);

const iconPath = (address?: string): string => (address ? `/icon/${segment(address)}` : "/icon");
