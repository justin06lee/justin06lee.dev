"use client";

import * as React from "react";
import { Eye, Grid3x3, ImageUp, Link2, Magnet, RotateCcw, Save, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/chrome/button";
import { Input } from "@/components/chrome/input";
import { Checkbox } from "@/components/chrome/checkbox";
import { Segmented } from "@/components/chrome/segmented";
import {
  DESIGN_WIDTH,
  MIN_PIECE_SIZE,
  autoArrange,
  clampToCanvas,
  resizeRect,
  seedWall,
  snapMove,
  snapResize,
  wallHeight,
  type Guide,
  type Placement,
  type ResizeHandle,
  type WallVariant,
} from "@/lib/gallery-wall";
import type { WallPieceData } from "@/lib/project-images";
import type { WallMode } from "@/lib/site-config";

export type StoredLayout = {
  desktop: Placement | null;
  mobile: Placement | null;
  image: string | null;
};

export type WallEditorProps = {
  pieces: WallPieceData[];
  initialLayouts: Record<string, StoredLayout>;
  initialMode: WallMode;
};

type ResolvedLayout = { desktop: Placement; mobile: Placement; image: string | null };
type LayoutMap = Record<string, ResolvedLayout>;

type Drag =
  | { kind: "move"; id: string; grabDx: number; grabDy: number }
  | { kind: "resize"; id: string; handle: ResizeHandle };

const HANDLES: ResizeHandle[] = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];

const HANDLE_POSITION: Record<ResizeHandle, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
};

/** Corner handles preserve the piece's aspect; edge handles stretch one axis. */
function cornerHandle(handle: ResizeHandle): boolean {
  return handle.length === 2;
}

function seedBoth(
  pieces: WallPieceData[],
  stored: Record<string, StoredLayout>,
): LayoutMap {
  const arrange = pieces.map((p) => ({
    id: p.id,
    width: p.naturalWidth,
    height: p.naturalHeight,
  }));
  const desktop = seedWall(
    arrange,
    Object.fromEntries(Object.entries(stored).map(([id, l]) => [id, l.desktop])),
    "desktop",
  );
  const mobile = seedWall(
    arrange,
    Object.fromEntries(Object.entries(stored).map(([id, l]) => [id, l.mobile])),
    "mobile",
  );
  const out: LayoutMap = {};
  for (const piece of pieces) {
    out[piece.id] = {
      desktop: desktop[piece.id],
      mobile: mobile[piece.id],
      image: stored[piece.id]?.image ?? null,
    };
  }
  return out;
}

/**
 * A Slides-style canvas for arranging the projects wall.
 *
 * All interaction maths happens in design units, never screen pixels: the
 * pointer position is divided back through the canvas scale on the way in, so
 * dragging behaves identically whether the editor is showing the 1200-unit
 * desktop canvas on a wide monitor or the 390-unit mobile canvas in a narrow
 * column. That is also what lets the stored numbers be WYSIWYG on the public
 * wall, which scales the same units by its own container width.
 */
export function WallEditor({ pieces, initialLayouts, initialMode }: WallEditorProps) {
  const [variant, setVariant] = React.useState<WallVariant>("desktop");
  const [layout, setLayout] = React.useState<LayoutMap>(() => seedBoth(pieces, initialLayouts));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [guides, setGuides] = React.useState<Guide[]>([]);
  const [grid, setGrid] = React.useState(0);
  const [align, setAlign] = React.useState(true);
  const [mode, setMode] = React.useState<WallMode>(initialMode);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = React.useState(DESIGN_WIDTH.desktop);
  const dragRef = React.useRef<Drag | null>(null);
  // Mirrors `layout` for the pointer handlers, which are bound once per drag
  // and would otherwise close over a stale snapshot mid-gesture.
  const layoutRef = React.useRef(layout);
  layoutRef.current = layout;

  const design = DESIGN_WIDTH[variant];
  const scale = canvasWidth / design;

  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setCanvasWidth(w);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Guard against losing an arrangement to a stray navigation.
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const placementsFor = React.useCallback(
    (v: WallVariant) => pieces.map((p) => layout[p.id]?.[v]).filter(Boolean) as Placement[],
    [pieces, layout],
  );

  const contentHeight = wallHeight(placementsFor(variant));
  // Leave room below the hang so a piece can always be dragged further down.
  const canvasDesignHeight = Math.max(contentHeight + 240, variant === "mobile" ? 760 : 640);

  const setPlacement = React.useCallback(
    (id: string, next: Placement) => {
      setLayout((prev) => ({ ...prev, [id]: { ...prev[id], [variant]: next } }));
      setDirty(true);
    },
    [variant],
  );

  /* ── pointer ─────────────────────────────────────────────────────────── */

  const toDesign = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { px: 0, py: 0 };
    return { px: (clientX - rect.left) / scale, py: (clientY - rect.top) / scale };
  };

  const beginDrag = (e: React.PointerEvent, drag: Drag) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = drag;
    setSelectedId(drag.id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const current = layoutRef.current[drag.id]?.[variant];
    if (!current) return;

    const { px, py } = toDesign(e.clientX, e.clientY);
    const others = pieces
      .filter((p) => p.id !== drag.id)
      .map((p) => layoutRef.current[p.id]?.[variant])
      .filter(Boolean) as Placement[];
    const opts = { canvasWidth: design, grid, align };

    if (drag.kind === "move") {
      const moved = { ...current, x: px - drag.grabDx, y: py - drag.grabDy };
      const snapped = snapMove(moved, others, opts);
      setGuides(snapped.guides);
      setPlacement(drag.id, clampToCanvas(snapped.rect, design));
    } else {
      // Shift inverts each handle's default: corners normally hold aspect,
      // edges normally stretch.
      const lock = cornerHandle(drag.handle) ? !e.shiftKey : e.shiftKey;
      const resized = resizeRect(current, drag.handle, px, py, lock);
      const snapped = snapResize(resized, drag.handle, others, opts);
      setGuides(snapped.guides);
      setPlacement(drag.id, clampToCanvas(snapped.rect, design));
    }
  };

  const endDrag = () => {
    dragRef.current = null;
    setGuides([]);
  };

  /* ── keyboard ────────────────────────────────────────────────────────── */

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const target = e.target as HTMLElement | null;
      // Don't hijack arrows while a numeric field in the inspector has focus.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = deltas[e.key];
      if (!delta) return;
      e.preventDefault();
      const current = layoutRef.current[selectedId]?.[variant];
      if (!current) return;
      setPlacement(
        selectedId,
        clampToCanvas({ ...current, x: current.x + delta[0], y: current.y + delta[1] }, design),
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, variant, design, setPlacement]);

  /* ── actions ─────────────────────────────────────────────────────────── */

  const handleAutoArrange = () => {
    const arranged = autoArrange(
      pieces.map((p) => ({ id: p.id, width: p.naturalWidth, height: p.naturalHeight })),
      variant,
    );
    setLayout((prev) => {
      const next = { ...prev };
      for (const [id, placement] of Object.entries(arranged)) {
        next[id] = { ...next[id], [variant]: placement };
      }
      return next;
    });
    setDirty(true);
    setStatus(`auto-arranged the ${variant} wall`);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/items/wall", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          layouts: pieces.map((p) => ({
            id: p.id,
            desktop: layout[p.id]?.desktop ?? null,
            mobile: layout[p.id]?.mobile ?? null,
            image: layout[p.id]?.image ?? null,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus(body.error ? `save failed: ${body.error}` : "save failed.");
        return;
      }
      setDirty(false);
      setStatus("saved.");
    } catch {
      setStatus("save failed — network error.");
    } finally {
      setSaving(false);
    }
  };

  const selected = selectedId ? pieces.find((p) => p.id === selectedId) ?? null : null;
  const selectedPlacement = selectedId ? layout[selectedId]?.[variant] ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        variant={variant}
        onVariant={(v) => { setVariant(v); setGuides([]); }}
        grid={grid}
        onGrid={setGrid}
        align={align}
        onAlign={setAlign}
        mode={mode}
        onMode={(m) => { setMode(m); setDirty(true); }}
        onAutoArrange={handleAutoArrange}
        onSave={handleSave}
        saving={saving}
        dirty={dirty}
        status={status}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* CANVAS */}
        <div className="min-w-0 flex-1">
          <div
            className="mx-auto"
            style={{ maxWidth: variant === "mobile" ? 420 : undefined }}
          >
            <div
              ref={canvasRef}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={() => setSelectedId(null)}
              className="relative w-full touch-none select-none overflow-hidden border border-white/15 bg-[#050505]"
              style={{ height: canvasDesignHeight * scale }}
            >
              {grid > 0 && <GridOverlay step={grid * scale} />}

              {pieces.map((piece) => {
                const placement = layout[piece.id]?.[variant];
                if (!placement) return null;
                return (
                  <PieceBox
                    key={piece.id}
                    piece={piece}
                    placement={placement}
                    scale={scale}
                    selected={piece.id === selectedId}
                    override={layout[piece.id]?.image ?? null}
                    onBeginMove={(e) => {
                      const { px, py } = toDesign(e.clientX, e.clientY);
                      beginDrag(e, {
                        kind: "move",
                        id: piece.id,
                        grabDx: px - placement.x,
                        grabDy: py - placement.y,
                      });
                    }}
                    onBeginResize={(e, handle) =>
                      beginDrag(e, { kind: "resize", id: piece.id, handle })
                    }
                  />
                );
              })}

              {guides.map((guide, i) => (
                <div
                  key={`${guide.axis}-${guide.at}-${i}`}
                  className={cn(
                    "pointer-events-none absolute",
                    guide.source === "canvas" ? "bg-sky-400/70" : "bg-fuchsia-400/80",
                  )}
                  style={
                    guide.axis === "x"
                      ? { left: guide.at * scale, top: 0, width: 1, height: "100%" }
                      : { top: guide.at * scale, left: 0, height: 1, width: "100%" }
                  }
                />
              ))}
            </div>
          </div>
          <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-white/30">
            {design} × {Math.round(canvasDesignHeight)} design units · {(scale * 100).toFixed(0)}% ·
            drag to move · corners keep aspect (shift frees) · arrows nudge
          </p>
        </div>

        {/* INSPECTOR */}
        <aside className="w-full shrink-0 border border-white/15 bg-white/[0.02] p-4 lg:w-80">
          {selected && selectedPlacement ? (
            <Inspector
              piece={selected}
              placement={selectedPlacement}
              override={layout[selected.id]?.image ?? null}
              design={design}
              onPlacement={(next) => setPlacement(selected.id, clampToCanvas(next, design))}
              onImage={(image) => {
                setLayout((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], image } }));
                setDirty(true);
              }}
            />
          ) : (
            <div className="text-sm text-white/40">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
                nothing selected
              </p>
              <p>click a piece to move, resize, or swap its image.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── toolbar ──────────────────────────────────────────────────────────── */

const GRID_STEPS = [0, 8, 16, 24, 40];

function Toolbar({
  variant, onVariant, grid, onGrid, align, onAlign, mode, onMode,
  onAutoArrange, onSave, saving, dirty, status,
}: {
  variant: WallVariant;
  onVariant: (v: WallVariant) => void;
  grid: number;
  onGrid: (g: number) => void;
  align: boolean;
  onAlign: (a: boolean) => void;
  mode: WallMode;
  onMode: (m: WallMode) => void;
  onAutoArrange: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  status: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border border-white/15 bg-white/[0.02] px-4 py-3">
      <Segmented
        value={variant}
        onChange={onVariant}
        options={[
          { value: "desktop", label: "desktop" },
          { value: "mobile", label: "mobile" },
        ]}
        ariaLabel="which arrangement to edit"
      />

      <div className="flex items-center gap-2">
        <Grid3x3 className="size-3.5 text-white/40" aria-hidden />
        <label className="sr-only" htmlFor="wall-grid">grid step</label>
        <select
          id="wall-grid"
          value={grid}
          onChange={(e) => onGrid(Number(e.target.value))}
          className="border border-white/15 bg-black px-2 py-1 text-xs text-white/80 outline-none focus:border-white/40"
        >
          {GRID_STEPS.map((g) => (
            <option key={g} value={g}>{g === 0 ? "grid off" : `grid ${g}`}</option>
          ))}
        </select>
      </div>

      <Checkbox
        checked={align}
        onChange={(e) => onAlign(e.target.checked)}
        label={
          <span className="inline-flex items-center gap-1.5">
            <Magnet className="size-3.5 text-white/40" aria-hidden />
            snap to edges
          </span>
        }
      />

      <Button variant="outline" size="sm" icon={Undo2} onClick={onAutoArrange}>
        auto-arrange
      </Button>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          gallery shows
        </span>
        <Segmented
          size="compact"
          value={mode}
          onChange={onMode}
          options={[
            { value: "auto", label: "auto" },
            { value: "manual", label: "this wall" },
          ]}
          ariaLabel="what the public gallery renders"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {status && <span className="text-xs text-white/50">{status}</span>}
        {dirty && !status && <span className="text-xs text-amber-300/70">unsaved</span>}
        {/* Opens the real gallery forced into wall mode — admin-only, and it
            reads saved state, so it previews the last save rather than the
            current unsaved canvas. */}
        <Button variant="outline" size="sm" icon={Eye} href="/gallery?tab=projects&wall=preview">
          preview
        </Button>
        <Button variant="solid" size="sm" icon={Save} onClick={onSave} disabled={saving}>
          {saving ? "saving…" : "save"}
        </Button>
      </div>
    </div>
  );
}

function GridOverlay({ step }: { step: number }) {
  if (step < 4) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: `${step}px ${step}px`,
      }}
    />
  );
}

/* ── piece ────────────────────────────────────────────────────────────── */

function PieceBox({
  piece, placement, scale, selected, override, onBeginMove, onBeginResize,
}: {
  piece: WallPieceData;
  placement: Placement;
  scale: number;
  selected: boolean;
  override: string | null;
  onBeginMove: (e: React.PointerEvent) => void;
  onBeginResize: (e: React.PointerEvent, handle: ResizeHandle) => void;
}) {
  const src = override || piece.src;
  return (
    <div
      className={cn(
        "absolute overflow-visible",
        selected ? "z-20" : "z-10",
      )}
      style={{
        left: placement.x * scale,
        top: placement.y * scale,
        width: placement.w * scale,
        height: placement.h * scale,
      }}
    >
      <div
        onPointerDown={onBeginMove}
        className={cn(
          "h-full w-full cursor-move overflow-hidden border bg-white/[0.02]",
          selected ? "border-white/80" : "border-white/20 hover:border-white/45",
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none block h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center font-mono text-[10px] lowercase text-white/40">
            {piece.title}
          </div>
        )}
      </div>

      {selected &&
        HANDLES.map((handle) => (
          <button
            key={handle}
            type="button"
            aria-label={`resize ${handle}`}
            onPointerDown={(e) => onBeginResize(e, handle)}
            className={cn(
              "absolute z-30 size-2.5 border border-black bg-white",
              HANDLE_POSITION[handle],
            )}
          />
        ))}

      {selected && (
        <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap font-mono text-[10px] lowercase text-white/70">
          {piece.title}
        </span>
      )}
    </div>
  );
}

/* ── inspector ────────────────────────────────────────────────────────── */

function Inspector({
  piece, placement, override, design, onPlacement, onImage,
}: {
  piece: WallPieceData;
  placement: Placement;
  override: string | null;
  design: number;
  onPlacement: (p: Placement) => void;
  onImage: (url: string | null) => void;
}) {
  const [urlDraft, setUrlDraft] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setUrlDraft("");
    setError(null);
  }, [piece.id]);

  const num = (key: keyof Placement) => (raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const next = { ...placement, [key]: value };
    if ((key === "w" || key === "h") && value < MIN_PIECE_SIZE) next[key] = MIN_PIECE_SIZE;
    onPlacement(next);
  };

  const fitAspect = () => {
    const aspect = piece.naturalWidth / piece.naturalHeight;
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    onPlacement({ ...placement, h: placement.w / aspect });
  };

  const fillWidth = () => onPlacement({ ...placement, x: 0, w: design });

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "upload failed.");
        return;
      }
      onImage(body.url);
    } catch {
      setError("upload failed — network error.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">piece</p>
        <p className="mt-1 truncate text-sm text-white">{piece.title}</p>
      </div>

      {/* geometry */}
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
          box · design units
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["x", "y", "w", "h"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2">
              <span className="w-3 font-mono text-xs text-white/40">{key}</span>
              <Input
                type="number"
                value={Math.round(placement[key])}
                onChange={(e) => num(key)(e.target.value)}
                className="w-full"
              />
            </label>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={RotateCcw} onClick={fitAspect}>
            fit aspect
          </Button>
          <Button variant="outline" size="sm" onClick={fillWidth}>
            full width
          </Button>
        </div>
      </div>

      {/* image source */}
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
          image
        </p>
        <p className="mb-2 text-xs text-white/40">
          {override ? "custom override" : piece.src ? "from readme" : "no image — shows a placard"}
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            icon={ImageUp}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "uploading…" : "upload gif/png"}
          </Button>
          {override && (
            <Button variant="ghost" size="sm" onClick={() => onImage(null)}>
              use readme
            </Button>
          )}
        </div>

        <div className="mt-2 flex gap-2">
          <Input
            placeholder="or paste an image url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            icon={Link2}
            label="use url"
            onClick={() => {
              const url = urlDraft.trim();
              if (url) onImage(url);
              setUrlDraft("");
            }}
          />
        </div>

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
