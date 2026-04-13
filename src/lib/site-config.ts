import { db, initDb } from "./db";

export type Pfp = {
  url: string;
  scale: number;
  x: number;
  y: number;
};

export type SiteConfig = {
  description: string[];
  socials: {
    github: string;
    linkedin: string;
    x: string;
    email: string;
    instagram: string;
  };
  pfp: Pfp;
};

const EMPTY_CONFIG: SiteConfig = {
  description: [],
  socials: { github: "", linkedin: "", x: "", email: "", instagram: "" },
  pfp: { url: "", scale: 1, x: 0, y: 0 },
};

export async function getSiteConfig(): Promise<SiteConfig> {
  await initDb();

  const result = await db.execute("SELECT key, value FROM site_config");
  const rows = result.rows as unknown as { key: string; value: string }[];

  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    description: (() => { try { return map.has("description") ? JSON.parse(map.get("description")!) : EMPTY_CONFIG.description; } catch { return EMPTY_CONFIG.description; } })(),
    socials: (() => { try { return map.has("socials") ? JSON.parse(map.get("socials")!) : EMPTY_CONFIG.socials; } catch { return EMPTY_CONFIG.socials; } })(),
    pfp: (() => { try { return map.has("pfp") ? { ...EMPTY_CONFIG.pfp, ...JSON.parse(map.get("pfp")!) } : EMPTY_CONFIG.pfp; } catch { return EMPTY_CONFIG.pfp; } })(),
  };
}

const ALLOWED_CONFIG_KEYS = ["description", "socials", "pfp"];

export async function updateSiteConfig(key: string, value: string) {
  if (!ALLOWED_CONFIG_KEYS.includes(key)) {
    throw new Error(`Invalid config key: ${key}`);
  }
  await initDb();
  await db.execute({
    sql: "INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now'))",
    args: [key, value],
  });
}
