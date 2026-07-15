"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Pencil, Trash2, Plus, LogOut, Save, Upload, MapPin, FolderInput, Pin, PinOff } from "lucide-react";
import { useDialog } from "@/components/Dialog";
import Navbar from "@/components/Navbar";
import Select from "@/components/Select";
import { LoginForm } from "@/components/chrome/login-form";
import { Input } from "@/components/chrome/input";
import { Textarea } from "@/components/chrome/textarea";
import { Button } from "@/components/chrome/button";
import { Badge } from "@/components/chrome/badge";
import { TagInput } from "@/components/chrome/tag-input";
import { ImageCropper } from "@/components/chrome/image-cropper";
import { Card } from "@/components/chrome/card";

type Item = {
  id: string;
  category: ItemCategory;
  title: string;
  description: string;
  year: number;
  tech: string[];
  link?: string;
  repo?: string;
  live?: string;
  notes?: string;
  sort_order: number;
  pinned: boolean;
};

type RawItem = Omit<Item, "tech" | "pinned"> & { tech: string; pinned: number };

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
  latitude: number | null;
  longitude: number | null;
};

type SiteConfig = {
  description: string[];
  socials: Record<string, string>;
  pfp: Pfp;
  prayerLocation: PrayerLocation;
};

const DEFAULT_PFP: Pfp = { url: "", scale: 1, x: 0, y: 0 };
const DEFAULT_PRAYER_LOCATION: PrayerLocation = { city: "", country: "", method: 2, timezone: "America/New_York", latitude: null, longitude: null };

const TABS = [
  { key: "projects", label: "Projects" },
  { key: "hobbies", label: "Hobbies" },
  { key: "in-development", label: "In Development" },
  { key: "site-config", label: "Site Config" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const ITEM_CATEGORIES = [
  { key: "projects", label: "Projects" },
  { key: "hobbies", label: "Hobbies" },
  { key: "in-development", label: "In Development" },
] as const;
type ItemCategory = (typeof ITEM_CATEGORIES)[number]["key"];

function parseItem(raw: RawItem): Item {
  let tech: string[] = [];
  try { tech = JSON.parse(raw.tech); } catch { /* malformed */ }
  return { ...raw, tech, pinned: !!raw.pinned };
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ───────── Move Menu ───────── */

function MoveMenu({
  current,
  onMove,
  disabled,
}: {
  current: ItemCategory;
  onMove: (target: ItemCategory) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const targets = ITEM_CATEGORIES.filter((c) => c.key !== current);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        icon={FolderInput}
        label="Move to another category"
        tooltip={disabled ? "Moving..." : "Move to..."}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="absolute top-full right-0 z-20 mt-1 border border-white/20 bg-black min-w-[180px]">
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-white/40 border-b border-white/10">
            Move to
          </div>
          {targets.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                onMove(t.key);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
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

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("projects");

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => { setAuthed(res.ok); setAuthChecked(true); })
      .catch(() => { setAuthChecked(true); });
  }, []);

  const handleLoginSubmit = async ({ password }: Record<string, string>) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      return;
    }
    if (res.status === 429) return { rateLimited: true };
    return { error: "wrong password." };
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthed(false);
  };

  let body: React.ReactNode;
  if (!authChecked) {
    body = (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  } else if (!authed) {
    body = (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <LoginForm
          title="admin"
          submitLabel="log in"
          loadingLabel="logging in..."
          onSubmit={handleLoginSubmit}
        />
      </div>
    );
  } else {
    body = (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 pt-16 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Content Manager</h1>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout}>Logout</Button>
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

  return (
    <>
      <Navbar />
      {body}
    </>
  );
}

/* ───────── Pfp Cropper ───────── */

function PfpCropper({ pfp, onChange }: { pfp: Pfp; onChange: (p: Pfp) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
          <ImageCropper value={pfp} onChange={onChange} size={240} circle />
          <div className="text-xs text-white/50">Circle shows the visible crop on the homepage.</div>
        </div>

        <div className="flex flex-col gap-4 flex-1 w-full">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Image URL</label>
            <Input
              className="w-full"
              value={pfp.url}
              onChange={(e) => onChange({ ...pfp, url: e.target.value })}
              placeholder="/justin-pfp-ghibli.png or https://..."
            />
            <div className="flex items-center gap-2 mt-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" id="pfp-upload" />
              <Button variant="outline" size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>
                {uploading ? "Uploading..." : "Upload image"}
              </Button>
            </div>
          </div>
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
  const [saved, setSaved] = useState(false);

  const detect = () => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported in this browser.");
      return;
    }
    setError("");
    setSaved(false);
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
          const next: PrayerLocation = { ...value, city, country, timezone: tz, latitude, longitude };
          onChange(next);
          const saveRes = await fetch("/api/config", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prayerLocation: next }),
          });
          if (!saveRes.ok) {
            const body = await saveRes.json().catch(() => ({}));
            throw new Error(body.error || `Save failed: ${saveRes.status}`);
          }
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
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
        <Button variant="outline" size="sm" icon={MapPin} onClick={detect} disabled={detecting}>
          {detecting ? "Detecting..." : "Use my location"}
        </Button>
        {hasLocation && (
          <span className="text-sm text-white/70">
            {value.city}, {value.country}
            {value.latitude !== null && value.longitude !== null && (
              <span className="text-white/40"> · {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}</span>
            )}
            <span className="text-white/40"> · {value.timezone}</span>
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-400">Location saved.</p>}
      <div>
        <label className="text-xs text-white/60 mb-1 block">Calculation Method</label>
        <Select<number>
          ariaLabel="Calculation method"
          value={value.method}
          onChange={(method) => onChange({ ...value, method })}
          options={ALADHAN_METHODS.map((m) => ({
            value: m.id,
            label: `${m.id} — ${m.label}`,
          }))}
        />
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
        <Textarea value={descText} onChange={(e) => setDescText(e.target.value)} rows={5} placeholder="Write your homepage description here..." />
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
              <Input className="w-full" value={socials[key] ?? ""} onChange={(e) => setSocials({ ...socials, [key]: e.target.value })} placeholder={key === "email" ? "you@example.com" : "https://..."} />
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
        <Button variant="solid" size="sm" icon={Save} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Config"}
        </Button>
        {status && <span className="text-sm text-green-400">{status}</span>}
      </div>
    </div>
  );
}

/* ───────── Category Items Panel ───────── */

function CategoryPanel({ category }: { category: ItemCategory }) {
  const [items, setItems] = useState<Item[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const dialog = useDialog();

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
    const ok = await dialog.confirm({
      title: "Are you sure you want to delete this item?",
      message: "This action cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
    fetchItems();
  };

  const handleSave = async (item: Item, isNew: boolean) => {
    const res = isNew
      ? await fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) })
      : await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Save failed", message: body.error || res.statusText });
      return;
    }
    setEditing(null);
    setAdding(false);
    fetchItems();
  };

  const handleTogglePin = async (item: Item) => {
    const next = { ...item, pinned: !item.pinned };
    const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Pin failed", message: body.error || res.statusText });
      return;
    }
    fetchItems();
  };

  const handleMove = async (item: Item, target: ItemCategory) => {
    if (movingId) return;
    setMovingId(item.id);
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(item.id)}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        await dialog.alert({ title: "Move failed", message: body.error || res.statusText });
        return;
      }
      await fetchItems();
    } finally {
      setMovingId(null);
    }
  };

  if (loading) return <p className="text-white/60">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      {editing && <ItemForm item={editing} category={category} existingTags={allTags} itemCount={items.length} onSave={(item) => handleSave(item, false)} onCancel={() => setEditing(null)} />}
      {adding && <ItemForm category={category} existingTags={allTags} itemCount={items.length} onSave={(item) => handleSave(item, true)} onCancel={() => setAdding(false)} />}
      {!editing && !adding && (
        <>
          <Button variant="outline" size="sm" icon={Plus} onClick={() => setAdding(true)} className="self-start">Add Item</Button>
          {items.length === 0 && <p className="text-white/60">No items yet.</p>}
          {items.map((item) => (
            <Card key={item.id} className="flex-row items-start justify-between gap-4 p-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold flex items-center gap-1.5">
                  {item.pinned && <Pin className="h-3.5 w-3.5 fill-white text-white -rotate-45" aria-label="Pinned" />}
                  <span>{item.title}</span>
                </h3>
                <p className="text-sm text-white/70 mt-1">{item.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tech.map((t) => (<Badge key={t} variant="outline">{t}</Badge>))}
                </div>
                {item.notes && <p className="text-xs text-white/50 mt-2 italic">{item.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={item.pinned ? PinOff : Pin}
                  label={item.pinned ? "Unpin" : "Pin to top"}
                  tooltip={item.pinned ? "Unpin" : "Pin to top"}
                  onClick={() => handleTogglePin(item)}
                  className={item.pinned ? undefined : "[&_svg]:-rotate-45"}
                />
                <MoveMenu current={item.category} onMove={(target) => handleMove(item, target)} disabled={movingId !== null} />
                <Button variant="ghost" size="sm" icon={Pencil} label="Edit" tooltip="Edit" onClick={() => setEditing(item)} />
                <Button variant="ghost" size="sm" icon={Trash2} label="Delete" tooltip="Delete" onClick={() => handleDelete(item.id)} />
              </div>
            </Card>
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
  item?: Item; category: ItemCategory; existingTags: string[]; itemCount: number; onSave: (item: Item) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [itemCategory, setItemCategory] = useState<ItemCategory>(item?.category ?? category);
  const [description, setDescription] = useState(item?.description ?? "");
  const [year, setYear] = useState(item?.year ?? new Date().getFullYear());
  const [tech, setTech] = useState<string[]>(item?.tech ?? []);
  const [link, setLink] = useState(item?.link ?? "");
  const [repo, setRepo] = useState(item?.repo ?? "");
  const [live, setLive] = useState(item?.live ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const isNew = !item;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: isNew ? slugify(title) : item.id,
      category: itemCategory, title, description, year,
      tech,
      link: link || undefined, repo: repo || undefined, live: live || undefined, notes: notes || undefined,
      sort_order: isNew ? itemCount : item.sort_order,
      pinned: isNew ? false : item.pinned,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-white/20 p-5 flex flex-col gap-3">
      <h3 className="font-semibold mb-1">{isNew ? "New Item" : "Edit Item"}</h3>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Title</label>
        <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
        {isNew && title && <p className="text-xs text-white/40 mt-1">ID: {slugify(title)}</p>}
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Category</label>
        <Select<ItemCategory>
          ariaLabel="Item category"
          value={itemCategory}
          onChange={setItemCategory}
          options={ITEM_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
        />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Year</label>
        <Input className="w-full" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Tech</label>
        <TagInput value={tech} onChange={setTech} suggestions={existingTags} placeholder="add a tech tag…" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-white/60 mb-1 block">Link</label><Input className="w-full" value={link} onChange={(e) => setLink(e.target.value)} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Repo</label><Input className="w-full" value={repo} onChange={(e) => setRepo(e.target.value)} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Live URL</label><Input className="w-full" value={live} onChange={(e) => setLive(e.target.value)} /></div>
      </div>
      <div><label className="text-xs text-white/60 mb-1 block">Notes</label><Input className="w-full" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="flex gap-2 mt-2">
        <Button variant="solid" size="sm" type="submit">{isNew ? "Create" : "Save"}</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
