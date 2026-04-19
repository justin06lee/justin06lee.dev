"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Pencil, Trash2, Plus, LogOut, Save, Upload, MapPin } from "lucide-react";

type Item = {
  id: string;
  category: string;
  title: string;
  description: string;
  year: number;
  tech: string[];
  link?: string;
  repo?: string;
  live?: string;
  notes?: string;
  sort_order: number;
};

type RawItem = Omit<Item, "tech"> & { tech: string };

type Pfp = {
  url: string;
  scale: number;
  x: number;
  y: number;
};

type PrayerLocation = {
  city: string;
  country: string;
  method: number;
  timezone: string;
};

type SiteConfig = {
  description: string[];
  socials: Record<string, string>;
  pfp: Pfp;
  prayerLocation: PrayerLocation;
};

const DEFAULT_PFP: Pfp = { url: "", scale: 1, x: 0, y: 0 };
const DEFAULT_PRAYER_LOCATION: PrayerLocation = { city: "", country: "", method: 2, timezone: "America/New_York" };

const TABS = [
  { key: "projects", label: "Projects" },
  { key: "hobbies", label: "Hobbies" },
  { key: "in-development", label: "In Development" },
  { key: "site-config", label: "Site Config" },
] as const;

function parseItem(raw: RawItem): Item {
  let tech: string[] = [];
  try { tech = JSON.parse(raw.tech); } catch { /* malformed */ }
  return { ...raw, tech };
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ───────── Confirm Modal ───────── */

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-black border border-white/20 p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
        <p className="text-sm text-white">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-sm hover:bg-white/10 px-4 py-1.5 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="bg-red-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-red-500 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Split text into lines by word count ───────── */

function splitIntoLines(text: string, wordsPerLine = 10): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(" "));
  }
  return lines;
}

const inputClass = "w-full bg-black border border-white/20 px-3 py-2 outline-none focus:border-white/40 text-sm text-white placeholder:text-white/40";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState("projects");

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => { setAuthed(res.ok); setAuthChecked(true); })
      .catch(() => { setAuthChecked(true); });
  }, []);

  const handleLogin = async () => {
    setAuthError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput }),
    });
    if (res.ok) {
      setAuthed(true);
    } else if (res.status === 429) {
      setAuthError("Too many attempts. Try again later.");
    } else {
      setAuthError("Wrong password.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthed(false);
    setPasswordInput("");
  };

  if (!authChecked) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-white/60">Loading...</p></div>;
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-full max-w-sm flex flex-col gap-4 px-4">
          <h1 className="text-xl font-semibold text-center">Admin</h1>
          <input
            type="password"
            placeholder="Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full bg-black border border-white/20 px-4 py-2 outline-none focus:border-white/40 text-white placeholder:text-white/40"
            autoFocus
          />
          {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
          <button onClick={handleLogin} className="w-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors">
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Content Manager</h1>
          <button onClick={handleLogout} className="inline-flex items-center gap-2 text-sm hover:bg-white/10 px-3 py-1.5 transition-colors">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>

        <div className="flex gap-0 mb-6 border-b border-white/10 overflow-x-auto">
          {TABS.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveTab(c.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === c.key ? "border-white text-white" : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {activeTab === "site-config" && <SiteConfigPanel />}
        {activeTab !== "site-config" && (
          <CategoryPanel category={activeTab} />
        )}
      </div>
    </div>
  );
}

/* ───────── Pfp Cropper ───────── */

function PfpCropper({ pfp, onChange }: { pfp: Pfp; onChange: (p: Pfp) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number; w: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const clampScale = (s: number) => Math.min(4, Math.max(0.5, s));

  const onMouseDown = (e: React.MouseEvent) => {
    if (!boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pfp.x,
      origY: pfp.y,
      w: rect.width,
    };
    const move = (ev: MouseEvent) => {
      const d = dragState.current;
      if (!d) return;
      const dxPct = ((ev.clientX - d.startX) / d.w) * 100;
      const dyPct = ((ev.clientY - d.startY) / d.w) * 100;
      onChange({ ...pfp, x: d.origX + dxPct, y: d.origY + dyPct });
    };
    const up = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    onChange({ ...pfp, scale: clampScale(pfp.scale + delta) });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        onChange({ ...pfp, url: data.url, x: 0, y: 0, scale: 1 });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <h3 className="font-semibold mb-3">Profile Picture</h3>
      <p className="text-xs text-white/50 mb-3">Drag to reposition. Scroll or use the slider to zoom.</p>
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex flex-col gap-3">
          <div
            ref={boxRef}
            onMouseDown={onMouseDown}
            onWheel={onWheel}
            className="relative size-60 overflow-hidden border border-white/20 bg-white/5 cursor-grab active:cursor-grabbing select-none touch-none"
          >
            {pfp.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pfp.url}
                alt="pfp"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{
                  transform: `translate(${pfp.x}%, ${pfp.y}%) scale(${pfp.scale})`,
                  transformOrigin: "center",
                }}
              />
            )}
            <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/30 rounded-full" />
          </div>
          <div className="text-xs text-white/50">Circle shows the visible crop on the homepage.</div>
        </div>

        <div className="flex flex-col gap-4 flex-1 w-full">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Image URL</label>
            <input
              value={pfp.url}
              onChange={(e) => onChange({ ...pfp, url: e.target.value })}
              placeholder="/justin-pfp-ghibli.png or https://..."
              className={inputClass}
            />
            <div className="flex items-center gap-2 mt-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" id="pfp-upload" />
              <label htmlFor="pfp-upload" className="inline-flex items-center gap-2 border border-white/20 px-3 py-1.5 text-xs cursor-pointer hover:bg-white/10">
                <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : "Upload image"}
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Zoom: {pfp.scale.toFixed(2)}x</label>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.01}
              value={pfp.scale}
              onChange={(e) => onChange({ ...pfp, scale: parseFloat(e.target.value) })}
              className="range-custom w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">X: {pfp.x.toFixed(0)}%</label>
              <input type="range" min={-100} max={100} step={0.5} value={pfp.x} onChange={(e) => onChange({ ...pfp, x: parseFloat(e.target.value) })} className="range-custom w-full" />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Y: {pfp.y.toFixed(0)}%</label>
              <input type="range" min={-100} max={100} step={0.5} value={pfp.y} onChange={(e) => onChange({ ...pfp, y: parseFloat(e.target.value) })} className="range-custom w-full" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...pfp, x: 0, y: 0, scale: 1 })}
            className="self-start text-xs border border-white/20 px-3 py-1.5 hover:bg-white/10"
          >
            Reset position & zoom
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Prayer Location Picker ───────── */

const ALADHAN_METHODS = [
  { id: 2, label: "Islamic Society of North America" },
  { id: 1, label: "Umm al-Qura (Makkah)" },
  { id: 3, label: "Muslim World League" },
  { id: 4, label: "Egyptian General Authority" },
  { id: 5, label: "University of Islamic Sciences, Karachi" },
  { id: 7, label: "Institute of Geophysics, Tehran" },
  { id: 8, label: "Gulf Region" },
  { id: 9, label: "Kuwait" },
  { id: 10, label: "Qatar" },
  { id: 11, label: "Majlis Ugama Islam Singapura" },
  { id: 12, label: "Union Organization Islamic de France" },
  { id: 13, label: "Diyanet İşleri Başkanlığı, Turkey" },
  { id: 14, label: "Spiritual Administration of Muslims of Russia" },
];

function PrayerLocationPicker({
  value,
  onChange,
}: {
  value: PrayerLocation;
  onChange: (p: PrayerLocation) => void;
}) {
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState("");

  const detect = () => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported in this browser.");
      return;
    }
    setError("");
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Reverse geocode failed: ${res.status}`);
          }
          const { city, country } = (await res.json()) as { city: string; country: string };
          onChange({ ...value, city, country, timezone: tz });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Location lookup failed.");
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        setDetecting(false);
        setError(err.message || "Permission denied.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const hasLocation = Boolean(value.city && value.country);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={detect}
          disabled={detecting}
          className="inline-flex items-center gap-2 border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <MapPin className="h-4 w-4" /> {detecting ? "Detecting..." : "Use my location"}
        </button>
        {hasLocation && (
          <span className="text-sm text-white/70">
            {value.city}, {value.country} · <span className="text-white/40">{value.timezone}</span>
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div>
        <label className="text-xs text-white/60 mb-1 block">Calculation Method</label>
        <select
          value={value.method}
          onChange={(e) => onChange({ ...value, method: Number(e.target.value) })}
          className={inputClass}
        >
          {ALADHAN_METHODS.map((m) => (
            <option key={m.id} value={m.id} className="bg-black">
              {m.id} — {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ───────── Site Config Panel ───────── */

function SiteConfigPanel() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [descText, setDescText] = useState("");
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [pfp, setPfp] = useState<Pfp>(DEFAULT_PFP);
  const [prayerLocation, setPrayerLocation] = useState<PrayerLocation>(DEFAULT_PRAYER_LOCATION);
  const [status, setStatus] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/config");
    const data: SiteConfig = await res.json();
    setConfig(data);
    setDescText(data.description.join("\n"));
    setSocials(data.socials);
    setPfp({ ...DEFAULT_PFP, ...(data.pfp ?? {}) });
    setPrayerLocation({ ...DEFAULT_PRAYER_LOCATION, ...(data.prayerLocation ?? {}) });
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    const lines = splitIntoLines(descText);
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: lines, socials, pfp, prayerLocation }),
    });
    setSaving(false);
    setStatus("Saved!");
    setTimeout(() => setStatus(""), 2000);
  };

  if (loading || !config) return <p className="text-white/60">Loading...</p>;

  const previewLines = splitIntoLines(descText);

  return (
    <div className="flex flex-col gap-6">
      <PfpCropper pfp={pfp} onChange={setPfp} />
      <div>
        <h3 className="font-semibold mb-3">Homepage Description</h3>
        <p className="text-xs text-white/50 mb-3">Write your description as a single block of text. It will be automatically split into animated lines (~10 words each).</p>
        <textarea value={descText} onChange={(e) => setDescText(e.target.value)} className={inputClass} rows={5} placeholder="Write your homepage description here..." />
        {previewLines.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-white/50 mb-2">Preview ({previewLines.length} lines):</p>
            <div className="border border-white/10 p-3 text-sm text-white/70">
              {previewLines.map((line, i) => (<div key={i}>{line}</div>))}
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 className="font-semibold mb-3">Social Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {["github", "linkedin", "x", "email", "instagram", "youtube", "website"].map((key) => (
            <div key={key}>
              <label className="text-xs text-white/60 mb-1 block">{key}</label>
              <input value={socials[key] ?? ""} onChange={(e) => setSocials({ ...socials, [key]: e.target.value })} placeholder={key === "email" ? "you@example.com" : "https://..."} className={inputClass} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-3">Prayer Location</h3>
        <p className="text-xs text-white/50 mb-3">Click the button to use your current location for Aladhan prayer times. Your browser will ask for permission.</p>
        <PrayerLocationPicker value={prayerLocation} onChange={setPrayerLocation} />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Config"}
        </button>
        {status && <span className="text-sm text-green-400">{status}</span>}
      </div>
    </div>
  );
}

/* ───────── Category Items Panel ───────── */

function CategoryPanel({ category }: { category: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const [catRes, allRes] = await Promise.all([
      fetch(`/api/items?category=${category}`),
      fetch("/api/items"),
    ]);
    const rows: RawItem[] = await catRes.json();
    const allRows: RawItem[] = await allRes.json();
    setItems(rows.map(parseItem));
    const tags = new Set<string>();
    allRows.forEach((r) => { try { JSON.parse(r.tech).forEach((t: string) => tags.add(t)); } catch { /* skip */ } });
    setAllTags(Array.from(tags).sort((a, b) => a.localeCompare(b)));
    setLoading(false);
  }, [category]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchItems();
  };

  const handleSave = async (item: Item, isNew: boolean) => {
    const res = isNew
      ? await fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) })
      : await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Save failed: ${body.error || res.statusText}`);
      return;
    }
    setEditing(null);
    setAdding(false);
    fetchItems();
  };

  if (loading) return <p className="text-white/60">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      {deleteTarget && (
        <ConfirmModal message="Are you sure you want to delete this item? This action cannot be undone." onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}
      {editing && <ItemForm item={editing} category={category} existingTags={allTags} itemCount={items.length} onSave={(item) => handleSave(item, false)} onCancel={() => setEditing(null)} />}
      {adding && <ItemForm category={category} existingTags={allTags} itemCount={items.length} onSave={(item) => handleSave(item, true)} onCancel={() => setAdding(false)} />}
      {!editing && !adding && (
        <>
          <button className="self-start inline-flex items-center gap-2 border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 transition-colors" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Item
          </button>
          {items.length === 0 && <p className="text-white/60">No items yet.</p>}
          {items.map((item) => (
            <div key={item.id} className="border border-white/10 p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-white/70 mt-1">{item.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tech.map((t) => (<span key={t} className="px-2 py-0.5 text-xs border border-white/15 text-white/80">{t}</span>))}
                </div>
                {item.notes && <p className="text-xs text-white/50 mt-2 italic">{item.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button className="inline-flex items-center justify-center size-9 hover:bg-white/10 transition-colors" onClick={() => setEditing(item)}><Pencil className="h-4 w-4" /></button>
                <button className="inline-flex items-center justify-center size-9 hover:bg-white/10 transition-colors" onClick={() => setDeleteTarget(item.id)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ───────── Item Form ───────── */

function ItemForm({
  item, category, existingTags, itemCount, onSave, onCancel,
}: {
  item?: Item; category: string; existingTags: string[]; itemCount: number; onSave: (item: Item) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [year, setYear] = useState(item?.year ?? new Date().getFullYear());
  const [techStr, setTechStr] = useState(item?.tech.join(", ") ?? "");
  const [link, setLink] = useState(item?.link ?? "");
  const [repo, setRepo] = useState(item?.repo ?? "");
  const [live, setLive] = useState(item?.live ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const techInputRef = useRef<HTMLInputElement>(null);
  const isNew = !item;
  const currentTechList = techStr.split(",").map((s) => s.trim()).filter(Boolean);
  const suggestedTags = existingTags.filter((t) => !currentTechList.includes(t));

  const addTag = (tag: string) => {
    if (currentTechList.includes(tag)) return;
    const next = currentTechList.length > 0 ? techStr.trimEnd().replace(/,?\s*$/, "") + ", " + tag : tag;
    setTechStr(next);
    techInputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: isNew ? slugify(title) : item.id,
      category, title, description, year,
      tech: currentTechList,
      link: link || undefined, repo: repo || undefined, live: live || undefined, notes: notes || undefined,
      sort_order: isNew ? itemCount : item.sort_order,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-white/20 p-5 flex flex-col gap-3">
      <h3 className="font-semibold mb-1">{isNew ? "New Item" : "Edit Item"}</h3>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
        {isNew && title && <p className="text-xs text-white/40 mt-1">ID: {slugify(title)}</p>}
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={3} required />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Year</label>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass} required />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Tech (comma-separated)</label>
        <input ref={techInputRef} value={techStr} onChange={(e) => setTechStr(e.target.value)} className={inputClass} />
        {suggestedTags.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-white/40 mb-1">Existing tags:</p>
            <div className="flex flex-wrap gap-1">
              {suggestedTags.map((t) => (
                <button key={t} type="button" onClick={() => addTag(t)} className="px-2 py-0.5 text-xs border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-colors">+ {t}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-white/60 mb-1 block">Link</label><input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Repo</label><input value={repo} onChange={(e) => setRepo(e.target.value)} className={inputClass} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Live URL</label><input value={live} onChange={(e) => setLive(e.target.value)} className={inputClass} /></div>
      </div>
      <div><label className="text-xs text-white/60 mb-1 block">Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></div>
      <div className="flex gap-2 mt-2">
        <button type="submit" className="bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors">{isNew ? "Create" : "Save"}</button>
        <button type="button" onClick={onCancel} className="text-sm hover:bg-white/10 px-4 py-1.5 transition-colors">Cancel</button>
      </div>
    </form>
  );
}
