"use client";

import { useState, useEffect, useCallback, useRef, useId } from "react";
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
  collection?: string | null;
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
  { key: "projects", label: "projects" },
  { key: "hobbies", label: "hobbies" },
  { key: "in-development", label: "in development" },
  { key: "site-config", label: "site config" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const ITEM_CATEGORIES = [
  { key: "projects", label: "projects" },
  { key: "hobbies", label: "hobbies" },
  { key: "in-development", label: "in development" },
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
  const triggerRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const labelId = useId();

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // chrome's Button doesn't forward arbitrary aria-* props, so reflect the
  // menu-trigger state onto its DOM node directly.
  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    el.setAttribute("aria-haspopup", "menu");
    el.setAttribute("aria-expanded", String(open));
  }, [open]);

  // Move focus into the menu on open; restore it to the trigger on close.
  // wasOpen guards the restore so we don't steal focus on the initial mount.
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const targets = ITEM_CATEGORIES.filter((c) => c.key !== current);

  return (
    <div ref={ref} className="relative">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        icon={FolderInput}
        label="move to another category"
        tooltip={disabled ? "moving…" : "move to…"}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div
          role="menu"
          aria-labelledby={labelId}
          className="absolute top-full right-0 z-20 mt-1 border border-white/20 bg-black min-w-[180px]"
        >
          <div
            id={labelId}
            className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-white/40 border-b border-white/10"
          >
            move to
          </div>
          {targets.map((t, i) => (
            <button
              key={t.key}
              ref={i === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
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
        <p className="text-white/60">loading…</p>
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
          <h1 className="text-2xl font-semibold">content manager</h1>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout}>logout</Button>
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
      <h3 className="font-semibold mb-3">profile picture</h3>
      <p className="text-xs text-white/50 mb-3">drag to reposition. scroll or use the slider to zoom.</p>
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex flex-col gap-3">
          <ImageCropper value={pfp} onChange={onChange} size={240} circle />
          <div className="text-xs text-white/50">circle shows the visible crop on the homepage.</div>
        </div>

        <div className="flex flex-col gap-4 flex-1 w-full">
          <div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/60">image url</span>
              <Input
                className="w-full"
                value={pfp.url}
                onChange={(e) => onChange({ ...pfp, url: e.target.value })}
                placeholder="/justin-pfp-ghibli.png or https://..."
              />
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" id="pfp-upload" />
              <Button variant="outline" size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>
                {uploading ? "uploading…" : "upload image"}
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
      setError("geolocation not supported in this browser.");
      return;
    }
    setError("");
    setSaved(false);
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          // Known limitation: this is the ADMIN's browser timezone, not the tz
          // of the detected coordinates. Deriving tz from lat/long would need a
          // tz-lookup library we don't have, so for a mismatched-location detect
          // the operator should adjust the timezone by hand.
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `reverse geocode failed: ${res.status}`);
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
            throw new Error(body.error || `save failed: ${saveRes.status}`);
          }
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } catch (err) {
          setError(err instanceof Error ? err.message : "location lookup failed.");
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        setDetecting(false);
        setError(err.message || "permission denied.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const hasLocation = Boolean(value.city && value.country);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" icon={MapPin} onClick={detect} disabled={detecting}>
          {detecting ? "detecting…" : "use my location"}
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
      {saved && <p className="text-sm text-white/60">location saved.</p>}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">calculation method</span>
        <Select<number>
          ariaLabel="calculation method"
          value={value.method}
          onChange={(method) => onChange({ ...value, method })}
          options={ALADHAN_METHODS.map((m) => ({
            value: m.id,
            label: `${m.id} — ${m.label}`,
          }))}
        />
      </label>
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
  const [error, setError] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError("");
    // Guard the response: a 500 returns an HTML body, so an unchecked
    // res.json() would throw and leave the panel stuck on "loading" forever.
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error(`request failed: ${res.status}`);
      const data: SiteConfig = await res.json();
      setConfig(data);
      setDescText(data.description.join("\n"));
      setSocials(data.socials);
      setPfp({ ...DEFAULT_PFP, ...(data.pfp ?? {}) });
      setPrayerLocation({ ...DEFAULT_PRAYER_LOCATION, ...(data.prayerLocation ?? {}) });
    } catch {
      setError("couldn't load site config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    setError("");
    const lines = splitIntoLines(descText);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: lines, socials, pfp, prayerLocation }),
      });
      // A 401/429 must not read as success — surface the failure instead.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText || `save failed: ${res.status}`);
      }
      setStatus("saved");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-white/60">loading…</p>;
  if (!config) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-red-400">{error || "couldn't load site config."}</p>
        <Button variant="outline" size="sm" onClick={fetchConfig}>retry</Button>
      </div>
    );
  }

  const previewLines = splitIntoLines(descText);

  return (
    <div className="flex flex-col gap-6">
      <PfpCropper pfp={pfp} onChange={setPfp} />
      <div>
        <h3 className="font-semibold mb-3">homepage description</h3>
        <p className="text-xs text-white/50 mb-3">write your description as a single block of text. it will be automatically split into animated lines (~10 words each).</p>
        <Textarea value={descText} onChange={(e) => setDescText(e.target.value)} rows={5} placeholder="write your homepage description here…" />
        {previewLines.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-white/50 mb-2">preview ({previewLines.length} lines):</p>
            <div className="border border-white/10 p-3 text-sm text-white/70">
              {previewLines.map((line, i) => (<div key={i}>{line}</div>))}
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 className="font-semibold mb-3">social links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {["github", "linkedin", "x", "email", "instagram", "youtube", "website"].map((key) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs text-white/60">{key}</span>
              <Input className="w-full" value={socials[key] ?? ""} onChange={(e) => setSocials({ ...socials, [key]: e.target.value })} placeholder={key === "email" ? "you@example.com" : "https://..."} />
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-3">prayer location</h3>
        <p className="text-xs text-white/50 mb-3">click the button to use your current location for Aladhan prayer times. your browser will ask for permission.</p>
        <PrayerLocationPicker value={prayerLocation} onChange={setPrayerLocation} />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="solid" size="sm" icon={Save} onClick={handleSave} disabled={saving}>
          {saving ? "saving…" : "save config"}
        </Button>
        {status && <span className="text-sm text-white/60">{status}</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

/* ───────── Category Items Panel ───────── */

function CategoryPanel({ category }: { category: ItemCategory }) {
  const [items, setItems] = useState<Item[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allCollections, setAllCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const dialog = useDialog();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");
    // Guard both responses: an unchecked res.json() on a 500 (HTML body) throws
    // and would leave the panel stuck on "loading" forever.
    try {
      const [catRes, allRes] = await Promise.all([
        fetch(`/api/items?category=${category}`),
        fetch("/api/items"),
      ]);
      if (!catRes.ok || !allRes.ok) throw new Error("request failed");
      const rows: RawItem[] = await catRes.json();
      const allRows: RawItem[] = await allRes.json();
      setItems(rows.map(parseItem));
      const tags = new Set<string>();
      const collections = new Set<string>();
      allRows.forEach((r) => {
        try { JSON.parse(r.tech).forEach((t: string) => tags.add(t)); } catch { /* skip */ }
        if (r.collection && r.collection.trim()) collections.add(r.collection.trim());
      });
      setAllTags(Array.from(tags).sort((a, b) => a.localeCompare(b, "en")));
      setAllCollections(Array.from(collections).sort((a, b) => a.localeCompare(b, "en")));
    } catch {
      setError("couldn't load items.");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async (id: string) => {
    const ok = await dialog.confirm({
      title: "are you sure you want to delete this item?",
      message: "this action cannot be undone.",
      confirmText: "delete",
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
      // Surface the server's message (empty/invalid slug 400, id collision 409)
      // so the operator learns the title is invalid or already taken, instead of
      // a bare status line. Fall back to a lowercase status, not res.statusText.
      const body = await res.json().catch(() => ({}));
      await dialog.alert({ title: "save failed", message: body.error || `save failed (${res.status})` });
      return;
    }
    setEditing(null);
    setAdding(false);
    fetchItems();
  };

  const handleTogglePin = async (item: Item) => {
    // A pin PUT rewrites the full row (including the locally-cached category), so
    // firing it during an in-flight move would write a stale category and revert
    // the move. Bail if a move is running or this row's pin is already in flight.
    if (movingId || pinningId === item.id) return;
    setPinningId(item.id);
    const next = { ...item, pinned: !item.pinned };
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        await dialog.alert({ title: "pin failed", message: body.error || res.statusText });
        return;
      }
      await fetchItems();
    } finally {
      setPinningId(null);
    }
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
        await dialog.alert({ title: "move failed", message: body.error || res.statusText });
        return;
      }
      await fetchItems();
    } finally {
      setMovingId(null);
    }
  };

  if (loading) return <p className="text-white/60">loading…</p>;
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchItems}>retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {editing && <ItemForm item={editing} category={category} existingTags={allTags} existingCollections={allCollections} itemCount={items.length} onSave={(item) => handleSave(item, false)} onCancel={() => setEditing(null)} />}
      {adding && <ItemForm category={category} existingTags={allTags} existingCollections={allCollections} itemCount={items.length} onSave={(item) => handleSave(item, true)} onCancel={() => setAdding(false)} />}
      {!editing && !adding && (
        <>
          <Button variant="outline" size="sm" icon={Plus} onClick={() => setAdding(true)} className="self-start">add item</Button>
          {items.length === 0 && <p className="text-white/60">no items yet.</p>}
          {items.map((item) => (
            <Card key={item.id} className="flex-row items-start justify-between gap-4 p-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold flex items-center gap-1.5">
                  {item.pinned && <Pin className="h-3.5 w-3.5 fill-white text-white -rotate-45" aria-label="pinned" />}
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
                  label={item.pinned ? "unpin" : "pin to top"}
                  tooltip={item.pinned ? "unpin" : "pin to top"}
                  onClick={() => handleTogglePin(item)}
                  disabled={movingId !== null || pinningId === item.id}
                  className={item.pinned ? undefined : "[&_svg]:-rotate-45"}
                />
                <MoveMenu current={item.category} onMove={(target) => handleMove(item, target)} disabled={movingId !== null} />
                <Button variant="ghost" size="sm" icon={Pencil} label="edit" tooltip="edit" onClick={() => setEditing(item)} />
                <Button variant="ghost" size="sm" icon={Trash2} label="delete" tooltip="delete" onClick={() => handleDelete(item.id)} />
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
  item, category, existingTags, existingCollections, itemCount, onSave, onCancel,
}: {
  item?: Item; category: ItemCategory; existingTags: string[]; existingCollections: string[]; itemCount: number; onSave: (item: Item) => void; onCancel: () => void;
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
  const [collection, setCollection] = useState(item?.collection ?? "");
  const collectionsId = useId();
  const isNew = !item;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: isNew ? slugify(title) : item.id,
      category: itemCategory, title, description, year,
      tech,
      link: link || undefined, repo: repo || undefined, live: live || undefined, notes: notes || undefined,
      collection: collection.trim() || null,
      sort_order: isNew ? itemCount : item.sort_order,
      pinned: isNew ? false : item.pinned,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-white/20 p-5 flex flex-col gap-3">
      <h3 className="font-semibold mb-1">{isNew ? "new item" : "edit item"}</h3>
      <div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">title</span>
          <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        {isNew && title && <p className="text-xs text-white/40 mt-1">id: {slugify(title)}</p>}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">category</span>
        <Select<ItemCategory>
          ariaLabel="item category"
          value={itemCategory}
          onChange={setItemCategory}
          options={ITEM_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">description</span>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">year</span>
        <Input className="w-full" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
      </label>
      {/* Not a wrapping <label>: TagInput exposes no id, and it leads with a
          per-tag remove button, so a wrapping label would target that button
          (deleting a tag) on caption click instead of focusing the field. */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-white/60">tech</span>
        <TagInput value={tech} onChange={setTech} suggestions={existingTags} placeholder="add a tech tag…" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1"><span className="text-xs text-white/60">link</span><Input className="w-full" value={link} onChange={(e) => setLink(e.target.value)} /></label>
        <label className="flex flex-col gap-1"><span className="text-xs text-white/60">repo</span><Input className="w-full" value={repo} onChange={(e) => setRepo(e.target.value)} /></label>
        <label className="flex flex-col gap-1"><span className="text-xs text-white/60">live url</span><Input className="w-full" value={live} onChange={(e) => setLive(e.target.value)} /></label>
      </div>
      <label className="flex flex-col gap-1"><span className="text-xs text-white/60">notes</span><Input className="w-full" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">collection <span className="text-white/30">— projects sharing one clump together on the gallery wall</span></span>
        <Input className="w-full" list={collectionsId} value={collection} onChange={(e) => setCollection(e.target.value)} placeholder="e.g. colorful, terminal, image…" />
        <datalist id={collectionsId}>
          {existingCollections.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>
      <div className="flex gap-2 mt-2">
        <Button variant="solid" size="sm" type="submit">{isNew ? "create" : "save"}</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>cancel</Button>
      </div>
    </form>
  );
}
