/** Text with Minecraft formatting, in three flavours. */
export interface Motd {
  /** With `§` formatting codes. */
  raw: string;
  /** All formatting removed. */
  clean: string;
  /** HTML with formatting applied. Line breaks are `\n`. */
  html: string;
}

/** Fields present on every status response, online or offline. */
interface StatusBase {
  /** Hostname resolved from the address. */
  host: string;
  /** Port resolved from the address. */
  port: number;
  /** `null` if IP resolution failed. */
  ip_address: string | null;
  /** Whether Mojang has blocked this address. */
  eula_blocked: boolean;
  /** Unix ms when the status was fetched from the server. */
  retrieved_at: number;
  /** Unix ms when the API cache for this status expires. */
  expires_at: number;
}

// Java Edition

export interface SrvRecord {
  host: string;
  port: number;
}

export interface JavaPlayer {
  uuid: string;
  name_raw: string;
  name_clean: string;
  name_html: string;
}

export interface JavaMod {
  name: string;
  version: string;
}

export interface JavaPlugin {
  name: string;
  version: string | null;
}

export interface JavaStatusOffline extends StatusBase {
  online: false;
  /** `null` if no SRV record was found. */
  srv_record: SrvRecord | null;
}

export interface JavaStatusOnline extends StatusBase {
  online: true;
  /** `null` if no SRV record was found. */
  srv_record: SrvRecord | null;
  version: {
    name_raw: string;
    name_clean: string;
    name_html: string;
    protocol: number;
  };
  players: {
    online: number;
    max: number;
    /** Sample players. Often empty because servers disable it. */
    list: JavaPlayer[];
  };
  motd: Motd;
  /** `data:image/png;base64,...` 64×64 icon, or `null` if the server has none. */
  icon: string | null;
  /** Forge mods. Usually empty. */
  mods: JavaMod[];
  /** From query lookup; `null` if unavailable. */
  software: string | null;
  /** From query lookup. */
  plugins: JavaPlugin[];
}

export type JavaStatus = JavaStatusOnline | JavaStatusOffline;

// Bedrock Edition

export interface BedrockStatusOffline extends StatusBase {
  online: false;
}

export interface BedrockStatusOnline extends StatusBase {
  online: true;
  version: {
    name: string | null;
    protocol: number | null;
  };
  players: {
    online: number | null;
    max: number | null;
  };
  motd: Motd;
  gamemode: string | null;
  server_id: string | null;
  /** `MCPE` = Bedrock/Pocket Edition, `MCEE` = Education Edition. */
  edition: "MCPE" | "MCEE" | null;
}

export type BedrockStatus = BedrockStatusOnline | BedrockStatusOffline;
