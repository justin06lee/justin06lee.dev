"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const HISTORY_LIMIT = 24;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const MIN_WINDOW_HEIGHT = 520;
const MIN_WINDOW_WIDTH = 620;
const WINDOW_MARGIN = 16;

type Tool = "brush" | "eraser";

export interface DrawingPreset {
  key: string;
  label: string;
  width: number;
  height: number;
}

export interface DrawingSaveResult {
  /** The raw drawing PNG (a dark drawing in direct mode; the light master in dark-mapping mode). */
  dataUrl: string;
  /** The dark-mapped variant PNG — only present when `darkMapping` is on. */
  darkDataUrl?: string;
}

const DEFAULT_PRESETS: DrawingPreset[] = [
  { key: "square", label: "Square", width: 1024, height: 1024 },
  { key: "landscape", label: "Wide", width: 1280, height: 720 },
  { key: "portrait", label: "Tall", width: 720, height: 1280 },
];

// Drawn directly on a black canvas (default mode).
const DEFAULT_DIRECT_COLORS = ["#ffffff", "#4ade80", "#f87171", "#60a5fa"];
// Drawn as "light" colors on white, then remapped to a dark variant for display
// + the saved darkDataUrl (the /desk behavior).
const DEFAULT_MAPPED_COLORS = ["#000000", "#15803d", "#b91c1c", "#1d4ed8"];
const DEFAULT_BRUSH_SIZES = [4, 10, 18];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function loadSnapshot(canvas: HTMLCanvasElement, snapshot: string, onDone?: () => void) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = new Image();
  image.onload = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    onDone?.();
  };
  // Release the caller even if the snapshot fails to decode.
  image.onerror = () => onDone?.();
  image.src = snapshot;
}

function createBlankCanvas(canvas: HTMLCanvasElement, fill: string) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = fill;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

// --- light-to-dark colour mapping (only used when darkMapping is on) -----------

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, l: lightness, s: 0 };
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  switch (max) {
    case r:
      hue = (g - b) / delta + (g < b ? 6 : 0);
      break;
    case g:
      hue = (b - r) / delta + 2;
      break;
    default:
      hue = (r - g) / delta + 4;
      break;
  }
  return { h: hue / 6, l: lightness, s: saturation };
}

function hueToRgb(p: number, q: number, t: number) {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  if (saturation === 0) {
    const value = Math.round(lightness * 255);
    return { b: value, g: value, r: value };
  }
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return {
    b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hue) * 255),
    r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
  };
}

function mapPixelForDarkVariant(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  if (min >= 245) return { b: 0, g: 0, r: 0 };
  if (max <= 40) return { b: 255, g: 255, r: 255 };
  const { h, l, s } = rgbToHsl(red, green, blue);
  return hslToRgb(h, clamp(s + 0.2, 0.55, 1), clamp(l + 0.18, 0.45, 0.72));
}

function hexToRgb(value: string) {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    b: Number.parseInt(normalized.slice(4, 6), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    r: Number.parseInt(normalized.slice(0, 2), 16),
  };
}

function rgbToHex({ b, g, r }: { b: number; g: number; r: number }) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function mapHexForDarkVariant(value: string) {
  const rgb = hexToRgb(value);
  if (!rgb) return value;
  return rgbToHex(mapPixelForDarkVariant(rgb.r, rgb.g, rgb.b));
}

function mapImageData(data: Uint8ClampedArray) {
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const next = mapPixelForDarkVariant(data[index]!, data[index + 1]!, data[index + 2]!);
    data[index] = next.r;
    data[index + 1] = next.g;
    data[index + 2] = next.b;
  }
}

/** Paint the source canvas onto the display canvas, dark-mapping when requested. */
function renderDisplayCanvas(
  sourceCanvas: HTMLCanvasElement,
  displayCanvas: HTMLCanvasElement,
  darkMapping: boolean,
) {
  const context = displayCanvas.getContext("2d", { willReadFrequently: darkMapping });
  if (!context) return;
  context.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
  if (!darkMapping) {
    context.drawImage(sourceCanvas, 0, 0);
    return;
  }
  context.fillStyle = "#000000";
  context.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
  context.drawImage(sourceCanvas, 0, 0);
  const imageData = context.getImageData(0, 0, displayCanvas.width, displayCanvas.height);
  mapImageData(imageData.data);
  context.putImageData(imageData, 0, 0);
}

function createDarkVariantDataUrl(canvas: HTMLCanvasElement) {
  const clone = document.createElement("canvas");
  clone.width = canvas.width;
  clone.height = canvas.height;
  const context = clone.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas.toDataURL("image/png");
  context.drawImage(canvas, 0, 0);
  const imageData = context.getImageData(0, 0, clone.width, clone.height);
  mapImageData(imageData.data);
  context.putImageData(imageData, 0, 0);
  return clone.toDataURL("image/png");
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current">
      <path d="M14.5 5.5 18.5 9.5M6.5 17.5l4.3-1.2 7.2-7.2a1.8 1.8 0 0 0 0-2.6l-.5-.5a1.8 1.8 0 0 0-2.6 0l-7.2 7.2-1.2 4.3Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M5 19.2c.9-.1 1.6.1 2.2.7.6.6.8 1.3.7 2.1" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current">
      <path d="m8.5 6.5 8.7 8.7M6.9 17.4l6.8-6.8a2 2 0 0 1 2.8 0l2.1 2.1a2 2 0 0 1 0 2.8l-1.8 1.8a2 2 0 0 1-1.4.6H9.1a2 2 0 0 1-1.4-.6l-.8-.8a2 2 0 0 1 0-2.8Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M13.5 18h6" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function ResizeHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current">
      <path d="M8 16 16 8" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M12 16 16 12" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M16 16h.01" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current">
      <path d="M9 7H4v5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M20 17a7 7 0 0 0-12-5L4 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current">
      <path d="M15 7h5v5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M4 17a7 7 0 0 1 12-5l4 0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current">
      <path d="M5 7h14M9 7V5.8c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8V7M8 10v6M12 10v6M16 10v6M7 7l.7 10.1c0 .9.7 1.6 1.6 1.6h5.4c.9 0 1.6-.7 1.6-1.6L17 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

export interface DrawingWindowProps {
  /** Title bar label. */
  title?: string;
  /** Smaller line under the title. */
  subtitle?: string;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  /** Highlights the border and enables wheel-zoom. Defaults to true. */
  active?: boolean;
  zIndex?: number;
  onClose?: () => void;
  onFocus?: () => void;
  /** Controlled saving flag (e.g. when a parent serializes concurrent saves). */
  saving?: boolean;
  /** Disable Save (e.g. another window owns the save lock). */
  disableSave?: boolean;
  /**
   * When true you draw in "light" colors and the display + saved `darkDataUrl`
   * are recomputed as a dark variant (the /desk behavior). When false (default)
   * you draw directly in dark-friendly colors on a black canvas.
   */
  darkMapping?: boolean;
  presets?: DrawingPreset[];
  /** Hex swatch colors (in source space). Defaults depend on `darkMapping`. */
  colors?: string[];
  brushSizes?: number[];
  /** Called with the finished PNG(s). Omit to download the result instead. */
  onSave?: (result: DrawingSaveResult) => void | Promise<void>;
  className?: string;
}

/**
 * A floating, draggable/resizable paint window: brush/eraser, color + size,
 * undo/redo/clear, zoom/pan, and canvas-size presets. Dark-only. Supports a
 * direct-dark mode (default) and a faithful light-to-dark mapping mode. Save runs
 * `onSave` with the PNG(s), or downloads when no `onSave` is given.
 */
export function DrawingWindow({
  title = "drawing",
  subtitle,
  initialPosition = { x: 72, y: 120 },
  initialSize = { width: 780, height: 720 },
  active = true,
  zIndex = 80,
  onClose,
  onFocus,
  saving,
  disableSave = false,
  darkMapping = false,
  presets = DEFAULT_PRESETS,
  colors,
  brushSizes = DEFAULT_BRUSH_SIZES,
  onSave,
  className,
}: DrawingWindowProps) {
  const palette = useMemo(
    () => colors ?? (darkMapping ? DEFAULT_MAPPED_COLORS : DEFAULT_DIRECT_COLORS),
    [colors, darkMapping],
  );
  const bgFill = darkMapping ? "#ffffff" : "#000000";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ originX: number; originY: number; startX: number; startY: number } | null>(null);
  const drawingRef = useRef(false);
  const redoRef = useRef<string[]>([]);
  const undoRef = useRef<string[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const panRef = useRef<{ originX: number; originY: number; startX: number; startY: number } | null>(null);
  const resizeRef = useRef<{ originHeight: number; originWidth: number; startX: number; startY: number } | null>(null);
  const sizeRef = useRef(initialSize);
  const pointerIdRef = useRef<number | null>(null);
  const darkMappingRef = useRef(darkMapping);
  // Snapshot restores are async (Image.onload); ignore undo/redo until done so
  // rapid clicks can't snapshot the stale canvas into history.
  const restoringRef = useRef(false);

  const [canvasPreset, setCanvasPreset] = useState<string>(
    () => presets[1]?.key ?? presets[0]?.key ?? "landscape",
  );
  const [color, setColor] = useState(() => palette[0] ?? "#ffffff");
  const [error, setError] = useState("");
  const [historyState, setHistoryState] = useState({ redo: 0, undo: 0 });
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [internalSaving, setInternalSaving] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [spacePressed, setSpacePressed] = useState(false);
  const [size, setSize] = useState(() => brushSizes[Math.floor(brushSizes.length / 2)] ?? 10);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState(initialSize);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>("brush");

  const isSaving = saving ?? internalSaving;
  const saveLocked = disableSave && !isSaving;
  const activePreset = useMemo(
    () => presets.find((preset) => preset.key === canvasPreset) ?? presets[0] ?? DEFAULT_PRESETS[1]!,
    [canvasPreset, presets],
  );

  function getSourceCanvas() {
    if (!sourceCanvasRef.current) {
      sourceCanvasRef.current = document.createElement("canvas");
    }
    return sourceCanvasRef.current;
  }

  const syncDisplayCanvas = useCallback(() => {
    const displayCanvas = canvasRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    if (!displayCanvas || !sourceCanvas) return;
    renderDisplayCanvas(sourceCanvas, displayCanvas, darkMappingRef.current);
  }, []);

  function displayColor(hex: string) {
    return darkMapping ? mapHexForDarkVariant(hex) : hex;
  }

  function getDisplayStrokeColor() {
    if (tool === "eraser") return "#000000";
    return displayColor(color);
  }

  function adjustZoom(delta: number) {
    setZoom((current) => clamp(current + delta, MIN_ZOOM, MAX_ZOOM));
  }

  function syncHistoryState() {
    setHistoryState({ redo: redoRef.current.length, undo: undoRef.current.length });
  }

  useEffect(() => {
    sizeRef.current = windowSize;
  }, [windowSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function handleWheel(event: WheelEvent) {
      if (!active) return;
      event.preventDefault();
      event.stopPropagation();
      setZoom((current) => clamp(current + (event.deltaY < 0 ? 0.1 : -0.1), MIN_ZOOM, MAX_ZOOM));
    }
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [active]);

  // Key on the preset's stable fields, not the object identity — an inline
  // `presets` prop would otherwise wipe the drawing on every parent re-render.
  const { key: presetKey, width: presetWidth, height: presetHeight } = activePreset;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sourceCanvas = getSourceCanvas();
    sourceCanvas.width = presetWidth;
    sourceCanvas.height = presetHeight;
    canvas.width = presetWidth;
    canvas.height = presetHeight;
    createBlankCanvas(sourceCanvas, bgFill);
    syncDisplayCanvas();
    undoRef.current = [];
    redoRef.current = [];
    syncHistoryState();
  }, [presetKey, presetWidth, presetHeight, syncDisplayCanvas, bgFill]);

  useEffect(() => {
    darkMappingRef.current = darkMapping;
    syncDisplayCanvas();
  }, [darkMapping, syncDisplayCanvas]);

  useEffect(() => {
    function clampWindowBounds(next: { x: number; y: number }, nextSize = sizeRef.current) {
      const maxX = Math.max(WINDOW_MARGIN, window.innerWidth - nextSize.width - WINDOW_MARGIN);
      const maxY = Math.max(WINDOW_MARGIN, window.innerHeight - nextSize.height - WINDOW_MARGIN);
      return { x: clamp(next.x, WINDOW_MARGIN, maxX), y: clamp(next.y, WINDOW_MARGIN, maxY) };
    }

    function handlePointerMove(event: PointerEvent) {
      const resize = resizeRef.current;
      if (resize) {
        const maxWidth = window.innerWidth - position.x - WINDOW_MARGIN;
        const maxHeight = window.innerHeight - position.y - WINDOW_MARGIN;
        setWindowSize({
          width: clamp(resize.originWidth + event.clientX - resize.startX, MIN_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, maxWidth)),
          height: clamp(resize.originHeight + event.clientY - resize.startY, MIN_WINDOW_HEIGHT, Math.max(MIN_WINDOW_HEIGHT, maxHeight)),
        });
        return;
      }
      const pan = panRef.current;
      if (pan) {
        setViewOffset({ x: pan.originX + event.clientX - pan.startX, y: pan.originY + event.clientY - pan.startY });
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      setPosition(clampWindowBounds({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY }));
    }

    function handlePointerUp() {
      panRef.current = null;
      dragRef.current = null;
      resizeRef.current = null;
      setIsDraggingWindow(false);
      setIsPanning(false);
      setIsResizing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [position.x, position.y]);

  useEffect(() => {
    function handleWindowResize() {
      const maxWidth = Math.max(MIN_WINDOW_WIDTH, window.innerWidth - WINDOW_MARGIN * 2);
      const maxHeight = Math.max(MIN_WINDOW_HEIGHT, window.innerHeight - WINDOW_MARGIN * 2);
      const nextSize = {
        width: clamp(windowSize.width, MIN_WINDOW_WIDTH, maxWidth),
        height: clamp(windowSize.height, MIN_WINDOW_HEIGHT, maxHeight),
      };
      setWindowSize(nextSize);
      setPosition((current) => {
        const maxX = Math.max(WINDOW_MARGIN, window.innerWidth - nextSize.width - WINDOW_MARGIN);
        const maxY = Math.max(WINDOW_MARGIN, window.innerHeight - nextSize.height - WINDOW_MARGIN);
        return { x: clamp(current.x, WINDOW_MARGIN, maxX), y: clamp(current.y, WINDOW_MARGIN, maxY) };
      });
    }
    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [windowSize.height, windowSize.width]);

  useEffect(() => {
    const isInteracting = isDraggingWindow || isPanning || isResizing;
    const previousUserSelect = document.body.style.userSelect;
    if (isInteracting) document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isDraggingWindow, isPanning, isResizing]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement
      );
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || isTypingTarget(event.target)) return;
      event.preventDefault();
      setSpacePressed(true);
    }
    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      setSpacePressed(false);
      panRef.current = null;
      setIsPanning(false);
    }
    function handleBlur() {
      setSpacePressed(false);
      panRef.current = null;
      setIsPanning(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  function pushUndoSnapshot() {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    undoRef.current = [...undoRef.current, canvas.toDataURL("image/png")].slice(-HISTORY_LIMIT);
    redoRef.current = [];
    syncHistoryState();
  }

  function getCanvasCoordinates(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * canvas.width, 0, canvas.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * canvas.height, 0, canvas.height),
    };
  }

  function drawSegment(from: { x: number; y: number }, to: { x: number; y: number }) {
    const sourceCanvas = sourceCanvasRef.current;
    const displayCanvas = canvasRef.current;
    const sourceContext = sourceCanvas?.getContext("2d");
    const displayContext = displayCanvas?.getContext("2d");
    if (!sourceCanvas || !displayCanvas || !sourceContext || !displayContext) return;

    sourceContext.strokeStyle = tool === "eraser" ? bgFill : color;
    sourceContext.lineCap = "round";
    sourceContext.lineJoin = "round";
    sourceContext.lineWidth = size;
    sourceContext.beginPath();
    sourceContext.moveTo(from.x, from.y);
    sourceContext.lineTo(to.x, to.y);
    sourceContext.stroke();

    displayContext.strokeStyle = getDisplayStrokeColor();
    displayContext.lineCap = "round";
    displayContext.lineJoin = "round";
    displayContext.lineWidth = size;
    displayContext.beginPath();
    displayContext.moveTo(from.x, from.y);
    displayContext.lineTo(to.x, to.y);
    displayContext.stroke();
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (spacePressed || event.button === 1) {
      event.preventDefault();
      pointerIdRef.current = event.pointerId;
      panRef.current = { originX: viewOffset.x, originY: viewOffset.y, startX: event.clientX, startY: event.clientY };
      setIsPanning(true);
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    pushUndoSnapshot();
    drawingRef.current = true;
    pointerIdRef.current = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    const point = getCanvasCoordinates(event);
    lastPointRef.current = point;
    drawSegment(point, point);
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (panRef.current || !drawingRef.current) return;
    const point = getCanvasCoordinates(event);
    const lastPoint = lastPointRef.current ?? point;
    drawSegment(lastPoint, point);
    lastPointRef.current = point;
  }

  function finishStroke() {
    drawingRef.current = false;
    pointerIdRef.current = null;
    lastPointRef.current = null;
    panRef.current = null;
    setIsPanning(false);
  }

  function handleCanvasPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current === event.pointerId) finishStroke();
  }

  function handleUndo() {
    const canvas = sourceCanvasRef.current;
    if (!canvas || restoringRef.current || undoRef.current.length === 0) return;
    const snapshot = undoRef.current.pop();
    if (!snapshot) return;
    redoRef.current = [...redoRef.current, canvas.toDataURL("image/png")].slice(-HISTORY_LIMIT);
    restoringRef.current = true;
    loadSnapshot(canvas, snapshot, () => {
      restoringRef.current = false;
      syncDisplayCanvas();
    });
    syncHistoryState();
  }

  function handleRedo() {
    const canvas = sourceCanvasRef.current;
    if (!canvas || restoringRef.current || redoRef.current.length === 0) return;
    const snapshot = redoRef.current.pop();
    if (!snapshot) return;
    undoRef.current = [...undoRef.current, canvas.toDataURL("image/png")].slice(-HISTORY_LIMIT);
    restoringRef.current = true;
    loadSnapshot(canvas, snapshot, () => {
      restoringRef.current = false;
      syncDisplayCanvas();
    });
    syncHistoryState();
  }

  function handleClear() {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    pushUndoSnapshot();
    createBlankCanvas(canvas, bgFill);
    syncDisplayCanvas();
  }

  async function handleSave() {
    const canvas = sourceCanvasRef.current;
    if (!canvas || isSaving || saveLocked) return;
    setError("");
    setInternalSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const darkDataUrl = darkMapping ? createDarkVariantDataUrl(canvas) : undefined;
      if (onSave) {
        await onSave({ dataUrl, darkDataUrl });
      } else {
        const filename = `${title.replace(/\s+/g, "-").toLowerCase() || "drawing"}.png`;
        downloadDataUrl(darkDataUrl ?? dataUrl, filename);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save drawing.");
    } finally {
      setInternalSaving(false);
    }
  }

  const customColorSelected = !palette.some((c) => c.toLowerCase() === color.toLowerCase());

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex }}>
      <div
        ref={containerRef}
        data-drawing-window="true"
        className={cn(
          "pointer-events-auto fixed flex flex-col overflow-hidden border bg-black transition-[border-color]",
          active ? "border-white/30" : "border-white/10",
          className,
        )}
        style={{ height: windowSize.height, left: position.x, top: position.y, width: windowSize.width }}
        onPointerDownCapture={onFocus}
      >
        <div
          className={cn(
            "flex cursor-move items-center justify-between border-b border-white/10 px-4 py-3",
            active ? "bg-white/[0.04]" : "bg-white/[0.02]",
          )}
          onPointerDown={(event) => {
            if (resizeRef.current) return;
            if (event.target instanceof HTMLElement && event.target.closest("button")) return;
            event.preventDefault();
            dragRef.current = { originX: position.x, originY: position.y, startX: event.clientX, startY: event.clientY };
            setIsDraggingWindow(true);
          }}
        >
          <div>
            <p className="text-sm font-medium text-white">{title}</p>
            {subtitle ? <p className="text-xs text-white/50">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-white/20 px-3 py-1 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_240px]">
          <div className="min-h-0 border-b border-white/10 bg-stone-950 p-3 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex flex-wrap items-center gap-2 border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/70">
              <span className="text-white/50">view</span>
              <button type="button" onClick={() => adjustZoom(-0.25)} className="border border-white/20 px-2 py-0.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                -
              </button>
              <span className="min-w-12 text-center text-white">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => adjustZoom(0.25)} className="border border-white/20 px-2 py-0.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setViewOffset({ x: 0, y: 0 });
                }}
                className="border border-white/20 px-2 py-0.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                reset
              </button>
              <span className="ml-auto text-white/50">space / middle-drag to pan</span>
            </div>

            <div className="flex h-full min-h-[18rem] items-center justify-center overflow-hidden border border-white/10 bg-stone-950">
              <div style={{ transform: `translate(${viewOffset.x}px, ${viewOffset.y}px)` }}>
                <canvas
                  ref={canvasRef}
                  width={activePreset.width}
                  height={activePreset.height}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={finishStroke}
                  onPointerLeave={finishStroke}
                  className={cn(
                    "block max-h-[55vh] max-w-full touch-none select-none border border-stone-700 bg-black",
                    spacePressed || isPanning ? "cursor-grab" : "cursor-crosshair",
                  )}
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 space-y-5 overflow-y-auto bg-white/[0.02] p-4 pb-8 pr-6">
            <div>
              <label className="mb-1 block text-xs text-white/60">Canvas size</label>
              <select
                aria-label="Canvas size"
                value={canvasPreset}
                onChange={(event) => {
                  setCanvasPreset(event.target.value);
                  setZoom(1);
                  setViewOffset({ x: 0, y: 0 });
                }}
                className="w-full border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
              >
                {presets.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label} ({preset.width} × {preset.height})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-1 text-xs text-white/60">Tools</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTool("brush")}
                  aria-label="Brush"
                  title="Brush"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center border transition-colors",
                    tool === "brush"
                      ? "border-white bg-white text-black"
                      : "border-white/15 text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <BrushIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setTool("eraser")}
                  aria-label="Eraser"
                  title="Eraser"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center border transition-colors",
                    tool === "eraser"
                      ? "border-white bg-white text-black"
                      : "border-white/15 text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <EraserIcon />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-white/60">Color</label>
              <div className="flex items-center gap-2">
                {palette.map((presetColor) => {
                  const selected = color.toLowerCase() === presetColor.toLowerCase();
                  return (
                    <button
                      key={presetColor}
                      type="button"
                      aria-label={`Use color ${presetColor}`}
                      title={presetColor}
                      onClick={() => setColor(presetColor)}
                      className={cn(
                        "h-9 w-9 border transition-transform hover:scale-105",
                        selected ? "border-white ring-2 ring-white/30" : "border-white/15",
                      )}
                      style={{ backgroundColor: displayColor(presetColor) }}
                    >
                      <span className="sr-only">{presetColor}</span>
                    </button>
                  );
                })}
                <label
                  className={cn(
                    "relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden border bg-black text-white transition-transform hover:scale-105",
                    customColorSelected ? "border-white ring-2 ring-white/30" : "border-white/15",
                  )}
                  title="Custom color"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current text-white">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeWidth="1.8" />
                  </svg>
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Choose custom color"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-white/60">Brush size</label>
              <div className="flex gap-2">
                {brushSizes.map((brushSize) => (
                  <button
                    key={brushSize}
                    type="button"
                    onClick={() => setSize(brushSize)}
                    className={cn(
                      "flex h-10 min-w-12 items-center justify-center border px-3 transition-colors",
                      size === brushSize
                        ? "border-white bg-white text-black"
                        : "border-white/15 text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                    aria-label={`Use ${brushSize}px brush`}
                    title={`${brushSize}px`}
                  >
                    <span
                      className="rounded-full bg-current"
                      style={{ height: Math.max(4, Math.min(brushSize, 16)), width: Math.max(4, Math.min(brushSize, 16)) }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-white/60">History</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyState.undo === 0}
                  aria-label="Undo"
                  title="Undo"
                  className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <UndoIcon />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyState.redo === 0}
                  aria-label="Redo"
                  title="Redo"
                  className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <RedoIcon />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear canvas"
                  title="Clear canvas"
                  className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ClearIcon />
                </button>
              </div>
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <button
              type="button"
              disabled={isSaving || saveLocked}
              onClick={handleSave}
              className="w-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : saveLocked ? "Another window is saving..." : "Save image"}
            </button>
          </div>
        </div>

        <div
          className={cn(
            "absolute bottom-0 right-0 flex h-6 w-6 cursor-nwse-resize items-center justify-center border-l border-t border-white/15 bg-white/[0.04] text-white/50",
            isResizing ? "opacity-100" : "opacity-70",
          )}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            resizeRef.current = { originHeight: windowSize.height, originWidth: windowSize.width, startX: event.clientX, startY: event.clientY };
            setIsResizing(true);
          }}
        >
          <ResizeHandleIcon />
        </div>
      </div>
    </div>
  );
}
