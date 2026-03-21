import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";

const SEED_DATA = [
  // projects
  {
    id: "1000000x.dev", category: "projects", title: "1,000,000x.dev",
    description: "ai knowledge-graph explorer for research. search a topic, expand connections, visualize relationships, and save sessions.",
    year: 2025, tech: JSON.stringify(["next.js", "full-stack", "agentic ai", "llm"]),
    link: "https://www.1000000x.dev", repo: "https://github.com/justin06lee/1000000x.dev",
    notes: "vibe-learning is now real", sort_order: 0,
  },
  {
    id: "ragpack.top", category: "projects", title: "ragpack.top",
    description: "document chunker and preprocessor for rag with configurable chunking and retrieval methods.",
    year: 2025, tech: JSON.stringify(["next.js", "full-stack", "ai", "rag"]),
    link: "https://www.ragpack.top", repo: "https://github.com/justin06lee/ragpack",
    notes: "runs fully locally + privately!", sort_order: 1,
  },
  {
    id: "takina", category: "projects", title: "takina (beta)",
    description: "a dynamic llm-powered schedule planner over a time span of your preference.",
    year: 2025, tech: JSON.stringify(["agentic ai", "llm", "app dev", "tauri", "rust"]),
    repo: "https://github.com/justin06lee/takina-beta",
    notes: "coming out as a web project?", sort_order: 2,
  },
  {
    id: "truman", category: "projects", title: "truman (beta)",
    description: "block-based time tracker and llm-powered statistics generator.",
    year: 2025, tech: JSON.stringify(["agentic ai", "llm", "app dev", "tauri", "rust"]),
    repo: "https://github.com/justin06lee/truman-beta",
    notes: "coming out as a web project?", sort_order: 3,
  },
  {
    id: "senku", category: "projects", title: "senku",
    description: "my own personal library of every book i encounter.",
    year: 2025, tech: JSON.stringify(["next.js", "google sheets", "full-stack", "llm", "agentic ai"]),
    repo: "https://github.com/justin06lee/senku",
    notes: "i should probably add auth to this...", sort_order: 4,
  },
  // hobbies
  {
    id: "art", category: "hobbies", title: "art",
    description: "traditional, digital. pencil, pen, pixel, paint, you name it. i just love creativity.",
    year: 2025, tech: JSON.stringify(["art", "creative"]),
    notes: "not that good at it though.", sort_order: 0,
  },
  {
    id: "chess", category: "hobbies", title: "chess",
    description: "strategies, problem-solving, puzzles, and devious planning is always good fun.",
    year: 2025, tech: JSON.stringify(["games", "problem-solving"]),
    notes: "i love it when a plan comes together!", sort_order: 1,
  },
  {
    id: "workout", category: "hobbies", title: "working out",
    description: "trying out the good ol' one punch man workout. 100 push ups, sit ups and pull ups, and a 10 km run, every single day!",
    year: 2025, tech: JSON.stringify(["health", "swole"]),
    notes: "healthy body, healthy mind!", sort_order: 2,
  },
  {
    id: "electrical", category: "hobbies", title: "electrical engineering(?)",
    description: "I play around with breadboards every once in a while. still a beginner though.",
    year: 2025, tech: JSON.stringify(["problem-solving", "ee"]),
    notes: "ill build a computer from scratch one day.", sort_order: 3,
  },
  {
    id: "reading", category: "hobbies", title: "reading",
    description: "a smart man learns from his mistakes. a wise man learns from the mistakes of others.",
    year: 2025, tech: JSON.stringify(["philosophy"]),
    notes: 'currently reading "the myth of sisyphus" and "this is how they tell me the world ends".', sort_order: 4,
  },
  {
    id: "abacus", category: "hobbies", title: "mental arithmetic (abacus)",
    description: "it always feels inconvenient and amateurish to pull out the calculator app for basic arithmetic.",
    year: 2025, tech: JSON.stringify(["philosophy"]),
    notes: "i should've done this when i was younger...", sort_order: 5,
  },
  {
    id: "taekwondo", category: "hobbies", title: "tae-kwondo",
    description: "i did taekwondo when i as like eight years old... trying to join the ucsc taekwondo club to relearn",
    year: 2025, tech: JSON.stringify(["martial arts", "health"]),
    notes: "im a complete noob though.", sort_order: 6,
  },
  {
    id: "muaythai", category: "hobbies", title: "muay-thai",
    description: "i have never done this in my life... trying to join the ucsc muay thai club to learn",
    year: 2025, tech: JSON.stringify(["martial arts", "health"]),
    notes: "i just hope i dont get whooped", sort_order: 7,
  },
  {
    id: "judo", category: "hobbies", title: "judo",
    description: "i have never done this in my life... trying to join the ucsc judo club to learn",
    year: 2025, tech: JSON.stringify(["martial arts", "health"]),
    notes: "i just hope i dont get whooped", sort_order: 8,
  },
  {
    id: "fencing", category: "hobbies", title: "fencing",
    description: "ive done this for a maximum of like 3 days before... trying to join the ucsc fencing club to relearn",
    year: 2025, tech: JSON.stringify(["martial arts", "health"]),
    notes: "im a complete noob though.", sort_order: 9,
  },
  {
    id: "wrestling", category: "hobbies", title: "wrestling",
    description: "i have never done this in my life... trying to join the ucsc grappling club to learn",
    year: 2025, tech: JSON.stringify(["martial arts", "health"]),
    notes: "i just hope i dont get whooped", sort_order: 10,
  },
  // in-development
  {
    id: "crows", category: "in-development", title: "crows",
    description: "a terminal-based chatting platform that has peer-to-peer connections, choosable encryption methods, and war mode (otp with custom usb firmware, cover traffic, etc).",
    year: 2025, tech: JSON.stringify(["cybersecurity", "networks", "low-level"]),
    repo: "https://github.com/The-Root-Spell-Project/Crows",
    notes: "nsa and nist will probably find backdoors for this", sort_order: 0,
  },
  {
    id: "ragpack-dev", category: "in-development", title: "ragpack.top",
    description: "document chunker and preprocessor for rag with configurable chunking and retrieval methods, and a custom complementary library to host your own vector database.",
    year: 2025, tech: JSON.stringify(["next.js", "full-stack", "ai", "rag"]),
    link: "https://www.ragpack.top", repo: "https://github.com/justin06lee/ragpack",
    notes: "this will be one hell of a difficult project...", sort_order: 1,
  },
];

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();

  for (const item of SEED_DATA) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO items (id, category, title, description, year, tech, link, repo, live, notes, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        item.id, item.category, item.title, item.description, item.year,
        item.tech, item.link ?? null, item.repo ?? null, null, item.notes ?? null,
        item.sort_order,
      ],
    });
  }

  return NextResponse.json({ ok: true, count: SEED_DATA.length });
}
