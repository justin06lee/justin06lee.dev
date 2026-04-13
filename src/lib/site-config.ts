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

const DEFAULT_CONFIG: SiteConfig = {
  description: [
    "im a freshman at ucsc majoring in computer science,",
    "and an addict for the low-level. i love c(++), go, rust, and zig,",
    "but have also been developing a new addiction towards",
    "llms lately, and have been working with agentic llms, mcp and rag.",
    "feel free to look around. this is where ill be posting everything.",
  ],
  socials: {
    github: "https://github.com/justin06lee",
    linkedin: "https://www.linkedin.com/in/justin06lee/",
    x: "https://x.com/justin06lee",
    email: "justin.leehuiyun@gmail.com",
    instagram: "https://instagram.com/justin06lee",
  },
  pfp: {
    url: "/justin-pfp-ghibli.png",
    scale: 1,
    x: 0,
    y: 0,
  },
};

export async function getSiteConfig(): Promise<SiteConfig> {
  await initDb();

  const result = await db.execute("SELECT key, value FROM site_config");
  const rows = result.rows as unknown as { key: string; value: string }[];

  if (rows.length === 0) {
    // Seed defaults
    await db.batch([
      {
        sql: "INSERT OR IGNORE INTO site_config (key, value) VALUES (?, ?)",
        args: ["description", JSON.stringify(DEFAULT_CONFIG.description)],
      },
      {
        sql: "INSERT OR IGNORE INTO site_config (key, value) VALUES (?, ?)",
        args: ["socials", JSON.stringify(DEFAULT_CONFIG.socials)],
      },
      {
        sql: "INSERT OR IGNORE INTO site_config (key, value) VALUES (?, ?)",
        args: ["pfp", JSON.stringify(DEFAULT_CONFIG.pfp)],
      },
    ]);
    return DEFAULT_CONFIG;
  }

  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    description: (() => { try { return map.has("description") ? JSON.parse(map.get("description")!) : DEFAULT_CONFIG.description; } catch { return DEFAULT_CONFIG.description; } })(),
    socials: (() => { try { return map.has("socials") ? JSON.parse(map.get("socials")!) : DEFAULT_CONFIG.socials; } catch { return DEFAULT_CONFIG.socials; } })(),
    pfp: (() => { try { return map.has("pfp") ? { ...DEFAULT_CONFIG.pfp, ...JSON.parse(map.get("pfp")!) } : DEFAULT_CONFIG.pfp; } catch { return DEFAULT_CONFIG.pfp; } })(),
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
