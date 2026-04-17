"use client";

import {
  useCallback,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { OperatorImageAsset } from "@/lib/operator-content";
import { useTheme as useNextTheme } from "next-themes";

function useTheme() {
  const { resolvedTheme } = useNextTheme();
  const theme = (resolvedTheme === "light" ? "light" : "dark") as "light" | "dark";
  return { theme };
}
import { saveDrawingAction } from "./content-actions";

const HISTORY_LIMIT = 24;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const MIN_WINDOW_HEIGHT = 520;
const MIN_WINDOW_WIDTH = 620;
const WINDOW_MARGIN = 16;

type Tool = "brush" | "eraser";

const PRESET_COLORS = [
  { dark: "#ffffff", light: "#000000", source: "#000000" },
  { dark: "#4ade80", light: "#15803d", source: "#15803d" },
  { dark: "#f87171", light: "#b91c1c", source: "#b91c1c" },
  { dark: "#60a5fa", light: "#1d4ed8", source: "#1d4ed8" },
] as const;
const BRUSH_SIZES = [4, 10, 18] as const;

const CANVAS_PRESETS = [
  { height: 1024, key: "square", label: "Square", width: 1024 },
  { height: 720, key: "landscape", label: "Wide", width: 1280 },
  { height: 1280, key: "portrait", label: "Tall", width: 720 },
] as const;

type CanvasPresetKey = (typeof CANVAS_PRESETS)[number]["key"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function loadSnapshot(
  canvas: HTMLCanvasElement,
  snapshot: string,
  onLoad?: () => void
) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const image = new Image();
  image.onload = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    onLoad?.();
  };
  image.src = snapshot;
}

function createBlankCanvas(canvas: HTMLCanvasElement, fill = "#ffffff") {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.fillStyle = fill;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, l: lightness, s: 0 };
  }

  const saturation =
    lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);
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

  return {
    h: hue / 6,
    l: lightness,
    s: saturation,
  };
}

function hueToRgb(p: number, q: number, t: number) {
  let next = t;

  if (next < 0) {
    next += 1;
  }

  if (next > 1) {
    next -= 1;
  }

  if (next < 1 / 6) {
    return p + (q - p) * 6 * next;
  }

  if (next < 1 / 2) {
    return q;
  }

  if (next < 2 / 3) {
    return p + (q - p) * (2 / 3 - next) * 6;
  }

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

  if (min >= 245) {
    return { b: 0, g: 0, r: 0 };
  }

  if (max <= 40) {
    return { b: 255, g: 255, r: 255 };
  }

  const { h, l, s } = rgbToHsl(red, green, blue);
  return hslToRgb(
    h,
    clamp(s + 0.2, 0.55, 1),
    clamp(l + 0.18, 0.45, 0.72)
  );
}

function hexToRgb(value: string) {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return null;
  }

  return {
    b: Number.parseInt(normalized.slice(4, 6), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    r: Number.parseInt(normalized.slice(0, 2), 16),
  };
}

function rgbToHex({
  b,
  g,
  r,
}: {
  b: number;
  g: number;
  r: number;
}) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mapHexForDarkVariant(value: string) {
  const rgb = hexToRgb(value);
  if (!rgb) {
    return value;
  }

  return rgbToHex(mapPixelForDarkVariant(rgb.r, rgb.g, rgb.b));
}

function renderDisplayCanvas(
  sourceCanvas: HTMLCanvasElement,
  displayCanvas: HTMLCanvasElement,
  theme: "light" | "dark"
) {
  const displayContext = displayCanvas.getContext("2d", {
    willReadFrequently: theme === "dark",
  });
  if (!displayContext) {
    return;
  }

  displayContext.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

  if (theme === "light") {
    displayContext.drawImage(sourceCanvas, 0, 0);
    return;
  }

  displayContext.fillStyle = "#000000";
  displayContext.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
  displayContext.drawImage(sourceCanvas, 0, 0);

  const imageData = displayContext.getImageData(
    0,
    0,
    displayCanvas.width,
    displayCanvas.height
  );
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) {
      continue;
    }

    const next = mapPixelForDarkVariant(
      data[index],
      data[index + 1],
      data[index + 2]
    );

    data[index] = next.r;
    data[index + 1] = next.g;
    data[index + 2] = next.b;
  }

  displayContext.putImageData(imageData, 0, 0);
}

function createDarkVariantDataUrl(canvas: HTMLCanvasElement) {
  const clone = document.createElement("canvas");
  clone.width = canvas.width;
  clone.height = canvas.height;

  const context = clone.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas.toDataURL("image/png");
  }

  context.drawImage(canvas, 0, 0);
  const imageData = context.getImageData(0, 0, clone.width, clone.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) {
      continue;
    }

    const next = mapPixelForDarkVariant(
      data[index],
      data[index + 1],
      data[index + 2]
    );

    data[index] = next.r;
    data[index + 1] = next.g;
    data[index + 2] = next.b;
  }

  context.putImageData(imageData, 0, 0);
  return clone.toDataURL("image/png");
}

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current">
      <path
        d="M14.5 5.5 18.5 9.5M6.5 17.5l4.3-1.2 7.2-7.2a1.8 1.8 0 0 0 0-2.6l-.5-.5a1.8 1.8 0 0 0-2.6 0l-7.2 7.2-1.2 4.3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M5 19.2c.9-.1 1.6.1 2.2.7.6.6.8 1.3.7 2.1"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current">
      <path
        d="m8.5 6.5 8.7 8.7M6.9 17.4l6.8-6.8a2 2 0 0 1 2.8 0l2.1 2.1a2 2 0 0 1 0 2.8l-1.8 1.8a2 2 0 0 1-1.4.6H9.1a2 2 0 0 1-1.4-.6l-.8-.8a2 2 0 0 1 0-2.8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
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
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px] fill-none stroke-current"
    >
      <path d="M9 7H4v5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path
        d="M20 17a7 7 0 0 0-12-5L4 12"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px] fill-none stroke-current"
    >
      <path d="M15 7h5v5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path
        d="M4 17a7 7 0 0 1 12-5l4 0"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px] fill-none stroke-current"
    >
      <path
        d="M5 7h14M9 7V5.8c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8V7M8 10v6M12 10v6M16 10v6M7 7l.7 10.1c0 .9.7 1.6 1.6 1.6h5.4c.9 0 1.6-.7 1.6-1.6L17 7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function OperatorDrawingWindow({
  active,
  articlePath,
  disableSave,
  initialPosition,
  onAssetCreated,
  onClose,
  onFocus,
  onSaveEnd,
  onSaveStart,
  windowId,
  zIndex,
}: {
  active: boolean;
  articlePath: string[];
  disableSave: boolean;
  initialPosition: { x: number; y: number };
  onAssetCreated: (asset: OperatorImageAsset) => void;
  onClose: () => void;
  onFocus: () => void;
  onSaveEnd: () => void;
  onSaveStart: () => void;
  windowId: number;
  zIndex: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const drawingRef = useRef(false);
  const redoRef = useRef<string[]>([]);
  const undoRef = useRef<string[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const panRef = useRef<{
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const resizeRef = useRef<{
    originHeight: number;
    originWidth: number;
    startX: number;
    startY: number;
  } | null>(null);
  const sizeRef = useRef({ height: 720, width: 780 });
  const pointerIdRef = useRef<number | null>(null);

  const [canvasPreset, setCanvasPreset] = useState<CanvasPresetKey>("landscape");
  const [color, setColor] = useState("#1c1917");
  const [error, setError] = useState("");
  const [historyState, setHistoryState] = useState({ redo: 0, undo: 0 });
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [spacePressed, setSpacePressed] = useState(false);
  const [size, setSize] = useState(10);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ height: 720, width: 780 });
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>("brush");
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  const articleLabel = articlePath.join(" / ");
  const activePreset = useMemo(
    () => CANVAS_PRESETS.find((preset) => preset.key === canvasPreset) ?? CANVAS_PRESETS[1],
    [canvasPreset]
  );

  const saveLocked = disableSave && !isSaving;

  function getSourceCanvas() {
    if (!sourceCanvasRef.current) {
      sourceCanvasRef.current = document.createElement("canvas");
    }

    return sourceCanvasRef.current;
  }

  const syncDisplayCanvas = useCallback(() => {
    const displayCanvas = canvasRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    if (!displayCanvas || !sourceCanvas) {
      return;
    }

    renderDisplayCanvas(sourceCanvas, displayCanvas, themeRef.current);
  }, []);

  const displayedPresetColors = useMemo(
    () =>
      PRESET_COLORS.map((preset) => ({
        display: theme === "dark" ? preset.dark : preset.light,
        source: preset.source,
      })),
    [theme]
  );

  function getDisplayStrokeColor() {
    if (tool === "eraser") {
      return theme === "dark" ? "#000000" : "#ffffff";
    }

    const preset = PRESET_COLORS.find((option) => option.source === color.toLowerCase());
    if (preset) {
      return theme === "dark" ? preset.dark : preset.light;
    }

    return theme === "dark" ? mapHexForDarkVariant(color) : color;
  }

  function adjustZoom(delta: number) {
    setZoom((current) => clamp(current + delta, MIN_ZOOM, MAX_ZOOM));
  }

  function syncHistoryState() {
    setHistoryState({
      redo: redoRef.current.length,
      undo: undoRef.current.length,
    });
  }

  useEffect(() => {
    sizeRef.current = windowSize;
  }, [windowSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function handleWheel(event: WheelEvent) {
      if (!active) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setZoom((current) =>
        clamp(current + (event.deltaY < 0 ? 0.1 : -0.1), MIN_ZOOM, MAX_ZOOM)
      );
    }

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const sourceCanvas = getSourceCanvas();
    sourceCanvas.width = activePreset.width;
    sourceCanvas.height = activePreset.height;
    canvas.width = activePreset.width;
    canvas.height = activePreset.height;
    createBlankCanvas(sourceCanvas);
    syncDisplayCanvas();
    undoRef.current = [];
    redoRef.current = [];
    syncHistoryState();
  }, [activePreset, syncDisplayCanvas]);

  useEffect(() => {
    themeRef.current = theme;
    syncDisplayCanvas();
  }, [theme, syncDisplayCanvas]);

  useEffect(() => {
    function clampWindowBounds(
      nextPosition: { x: number; y: number },
      nextSize = sizeRef.current
    ) {
      const maxX = Math.max(WINDOW_MARGIN, window.innerWidth - nextSize.width - WINDOW_MARGIN);
      const maxY = Math.max(
        WINDOW_MARGIN,
        window.innerHeight - nextSize.height - WINDOW_MARGIN
      );

      return {
        x: clamp(nextPosition.x, WINDOW_MARGIN, maxX),
        y: clamp(nextPosition.y, WINDOW_MARGIN, maxY),
      };
    }

    function handlePointerMove(event: PointerEvent) {
      const resize = resizeRef.current;
      if (resize) {
        const maxWidth = window.innerWidth - position.x - WINDOW_MARGIN;
        const maxHeight = window.innerHeight - position.y - WINDOW_MARGIN;
        const nextWidth = clamp(
          resize.originWidth + event.clientX - resize.startX,
          MIN_WINDOW_WIDTH,
          Math.max(MIN_WINDOW_WIDTH, maxWidth)
        );
        const nextHeight = clamp(
          resize.originHeight + event.clientY - resize.startY,
          MIN_WINDOW_HEIGHT,
          Math.max(MIN_WINDOW_HEIGHT, maxHeight)
        );

        setWindowSize({
          height: nextHeight,
          width: nextWidth,
        });
        return;
      }

      const pan = panRef.current;
      if (pan) {
        setViewOffset({
          x: pan.originX + event.clientX - pan.startX,
          y: pan.originY + event.clientY - pan.startY,
        });
        return;
      }

      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      setPosition(
        clampWindowBounds({
          x: drag.originX + event.clientX - drag.startX,
          y: drag.originY + event.clientY - drag.startY,
        })
      );
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
      const maxWidth = Math.max(
        MIN_WINDOW_WIDTH,
        window.innerWidth - WINDOW_MARGIN * 2
      );
      const maxHeight = Math.max(
        MIN_WINDOW_HEIGHT,
        window.innerHeight - WINDOW_MARGIN * 2
      );

      const nextSize = {
        width: clamp(windowSize.width, MIN_WINDOW_WIDTH, maxWidth),
        height: clamp(windowSize.height, MIN_WINDOW_HEIGHT, maxHeight),
      };

      setWindowSize(nextSize);
      setPosition((current) => {
        const maxX = Math.max(WINDOW_MARGIN, window.innerWidth - nextSize.width - WINDOW_MARGIN);
        const maxY = Math.max(
          WINDOW_MARGIN,
          window.innerHeight - nextSize.height - WINDOW_MARGIN
        );

        return {
          x: clamp(current.x, WINDOW_MARGIN, maxX),
          y: clamp(current.y, WINDOW_MARGIN, maxY),
        };
      });
    }

    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [windowSize.height, windowSize.width]);

  useEffect(() => {
    const isInteracting = isDraggingWindow || isPanning || isResizing;
    const previousUserSelect = document.body.style.userSelect;

    if (isInteracting) {
      document.body.style.userSelect = "none";
    }

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
      if (event.code !== "Space" || isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setSpacePressed(true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }

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
    if (!canvas) {
      return;
    }

    const nextUndo = [...undoRef.current, canvas.toDataURL("image/png")];
    undoRef.current = nextUndo.slice(-HISTORY_LIMIT);
    redoRef.current = [];
    syncHistoryState();
  }

  function getCanvasCoordinates(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * canvas.width, 0, canvas.width),
      y: clamp(
        ((event.clientY - rect.top) / rect.height) * canvas.height,
        0,
        canvas.height
      ),
    };
  }

  function drawSegment(
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) {
    const sourceCanvas = sourceCanvasRef.current;
    const displayCanvas = canvasRef.current;
    const sourceContext = sourceCanvas?.getContext("2d");
    const displayContext = displayCanvas?.getContext("2d");
    if (!sourceCanvas || !displayCanvas || !sourceContext || !displayContext) {
      return;
    }

    sourceContext.strokeStyle = tool === "eraser" ? "#ffffff" : color;
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
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (spacePressed || event.button === 1) {
      event.preventDefault();
      pointerIdRef.current = event.pointerId;
      panRef.current = {
        originX: viewOffset.x,
        originY: viewOffset.y,
        startX: event.clientX,
        startY: event.clientY,
      };
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
    if (panRef.current) {
      return;
    }

    if (!drawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

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
    if (pointerIdRef.current === event.pointerId) {
      finishStroke();
    }
  }

  function handleUndo() {
    const canvas = sourceCanvasRef.current;
    if (!canvas || undoRef.current.length === 0) {
      return;
    }

    const snapshot = undoRef.current.pop();
    if (!snapshot) {
      return;
    }

    const nextRedo = [...redoRef.current, canvas.toDataURL("image/png")];
    redoRef.current = nextRedo.slice(-HISTORY_LIMIT);
    loadSnapshot(canvas, snapshot, syncDisplayCanvas);
    syncHistoryState();
  }

  function handleRedo() {
    const canvas = sourceCanvasRef.current;
    if (!canvas || redoRef.current.length === 0) {
      return;
    }

    const snapshot = redoRef.current.pop();
    if (!snapshot) {
      return;
    }

    const nextUndo = [...undoRef.current, canvas.toDataURL("image/png")];
    undoRef.current = nextUndo.slice(-HISTORY_LIMIT);
    loadSnapshot(canvas, snapshot, syncDisplayCanvas);
    syncHistoryState();
  }

  function handleClear() {
    const canvas = sourceCanvasRef.current;
    if (!canvas) {
      return;
    }

    pushUndoSnapshot();
    createBlankCanvas(canvas);
    syncDisplayCanvas();
  }

  function handleSave() {
    const canvas = sourceCanvasRef.current;
    if (!canvas || isSaving || saveLocked) {
      return;
    }

    setError("");
    setIsSaving(true);
    onSaveStart();

    startTransition(async () => {
      try {
        const result = await saveDrawingAction({
          articlePath,
          darkDataUrl: createDarkVariantDataUrl(canvas),
          lightDataUrl: canvas.toDataURL("image/png"),
        });

        onAssetCreated(result);
        onClose();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Unable to save drawing."
        );
      } finally {
        setIsSaving(false);
        onSaveEnd();
      }
    });
  }

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex }}>
      <div
        ref={containerRef}
        data-drawing-window="true"
        className={`pointer-events-auto fixed flex flex-col overflow-hidden border shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition-[background-color,border-color,box-shadow] ${
          theme === "dark"
            ? active
              ? "border-stone-700 bg-stone-950 shadow-[0_18px_40px_rgba(0,0,0,0.42)]"
              : "border-stone-800 bg-stone-900 shadow-[0_14px_28px_rgba(0,0,0,0.34)]"
            : active
              ? "border-border bg-[#efede7]"
              : "border-stone-300 bg-stone-100 shadow-[0_14px_28px_rgba(0,0,0,0.12)]"
        }`}
        style={{
          height: windowSize.height,
          left: position.x,
          top: position.y,
          width: windowSize.width,
        }}
        onPointerDownCapture={onFocus}
      >
        <div
          className={`flex cursor-move items-center justify-between border-b border-border px-4 py-3 ${
            theme === "dark"
              ? active
                ? "bg-stone-900"
                : "bg-stone-800"
              : active
                ? "bg-surface-alt"
                : "bg-stone-200"
          }`}
          onPointerDown={(event) => {
            if (resizeRef.current) {
              return;
            }
            if (
              event.target instanceof HTMLElement &&
              event.target.closest("button")
            ) {
              return;
            }
            event.preventDefault();
            dragRef.current = {
              originX: position.x,
              originY: position.y,
              startX: event.clientX,
              startY: event.clientY,
            };
            setIsDraggingWindow(true);
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Drawing Window #{windowId}
            </p>
            <p className="text-sm text-foreground">{articleLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-background"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_240px]">
          <div
            className={`min-h-0 border-b border-border p-3 lg:border-b-0 lg:border-r ${
              theme === "dark" ? "bg-stone-950" : "bg-[#efede7]"
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 border border-border bg-surface px-3 py-2 text-xs text-muted">
              <span className="font-semibold uppercase tracking-wider">
                View
              </span>
              <button
                type="button"
                onClick={() => adjustZoom(-0.25)}
                className="border border-border px-2 py-1 text-foreground transition-colors hover:bg-surface-alt"
              >
                -
              </button>
              <span className="min-w-12 text-center text-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => adjustZoom(0.25)}
                className="border border-border px-2 py-1 text-foreground transition-colors hover:bg-surface-alt"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setViewOffset({ x: 0, y: 0 });
                }}
                className="border border-border px-2 py-1 text-foreground transition-colors hover:bg-surface-alt"
              >
                Reset view
              </button>
              <span className="ml-auto">
                Hold space or middle-drag to pan
              </span>
            </div>

            <div
              className={`flex h-full min-h-[18rem] items-center justify-center overflow-hidden border border-border ${
                theme === "dark" ? "bg-stone-950" : "bg-[#efede7]"
              }`}
            >
              <div
                style={{
                  transform: `translate(${viewOffset.x}px, ${viewOffset.y}px)`,
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={activePreset.width}
                  height={activePreset.height}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={finishStroke}
                  onPointerLeave={finishStroke}
                  className={`block max-h-[55vh] max-w-full select-none border touch-none ${
                    theme === "dark"
                      ? "border-stone-700 bg-black"
                      : "border-border bg-white"
                  } ${
                    spacePressed || isPanning ? "cursor-grab" : "cursor-crosshair"
                  }`}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 space-y-5 overflow-hidden bg-surface p-4 pb-8 pr-6">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                Canvas Size
              </label>
              <select
                value={canvasPreset}
                onChange={(event) =>
                  {
                    setCanvasPreset(event.target.value as CanvasPresetKey);
                    setZoom(1);
                    setViewOffset({ x: 0, y: 0 });
                  }
                }
                className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {CANVAS_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label} ({preset.width} x {preset.height})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Tools
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTool("brush")}
                  aria-label="Brush"
                  title="Brush"
                  className={`flex h-11 w-11 items-center justify-center border transition-colors ${
                    tool === "brush"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-surface-alt"
                  }`}
                >
                  <BrushIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setTool("eraser")}
                  aria-label="Eraser"
                  title="Eraser"
                  className={`flex h-11 w-11 items-center justify-center border transition-colors ${
                    tool === "eraser"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-surface-alt"
                  }`}
                >
                  <EraserIcon />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                Color
              </label>
              <div className="flex items-center gap-2">
                {displayedPresetColors.map((presetColor) => {
                  const selected = color.toLowerCase() === presetColor.source;
                  return (
                    <button
                      key={presetColor.source}
                      type="button"
                      aria-label={`Use color ${presetColor.display}`}
                      title={presetColor.display}
                      onClick={() => setColor(presetColor.source)}
                      className={`relative h-9 w-9 rounded-full border transition-transform hover:scale-105 ${
                        selected
                          ? "border-foreground ring-2 ring-foreground/20"
                          : "border-border"
                      }`}
                      style={{ backgroundColor: presetColor.display }}
                    >
                      <span className="sr-only">{presetColor.display}</span>
                    </button>
                  );
                })}
                <label
                  className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-transform hover:scale-105 ${
                    theme === "dark"
                      ? "bg-black text-white"
                      : "bg-white text-foreground"
                  } ${
                    !PRESET_COLORS.some((preset) => preset.source === color.toLowerCase())
                      ? "border-foreground ring-2 ring-foreground/20"
                      : "border-border"
                  }`}
                  title="Custom color"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4 fill-none stroke-current text-foreground"
                  >
                    <path
                      d="M12 5v14M5 12h14"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
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
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                Brush Size
              </label>
              <div className="flex gap-2">
                {BRUSH_SIZES.map((brushSize) => (
                  <button
                    key={brushSize}
                    type="button"
                    onClick={() => setSize(brushSize)}
                    className={`flex h-10 min-w-12 items-center justify-center border px-3 transition-colors ${
                      size === brushSize
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-surface-alt"
                    }`}
                    aria-label={`Use ${brushSize}px brush`}
                    title={`${brushSize}px`}
                  >
                    <span
                      className="rounded-full bg-current"
                      style={{
                        height: Math.max(4, Math.min(brushSize, 16)),
                        width: Math.max(4, Math.min(brushSize, 16)),
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                History
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyState.undo === 0}
                  aria-label="Undo"
                  title="Undo"
                  className="flex h-10 w-10 items-center justify-center border border-border bg-background text-foreground transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UndoIcon />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyState.redo === 0}
                  aria-label="Redo"
                  title="Redo"
                  className="flex h-10 w-10 items-center justify-center border border-border bg-background text-foreground transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RedoIcon />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear canvas"
                  title="Clear canvas"
                  className="flex h-10 w-10 items-center justify-center border border-border bg-background text-foreground transition-colors hover:bg-surface-alt"
                >
                  <ClearIcon />
                </button>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}

            <button
              type="button"
              disabled={isSaving || saveLocked}
              onClick={handleSave}
              className="w-full border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving
                ? "Saving image..."
                : saveLocked
                  ? "Another window is saving..."
                  : "Save image"}
            </button>
          </div>
        </div>

        <div
          className={`absolute bottom-0 right-0 flex h-6 w-6 cursor-nwse-resize items-center justify-center border-l border-t border-border bg-surface-alt text-muted ${
            isResizing ? "opacity-100" : "opacity-70"
          }`}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            resizeRef.current = {
              originHeight: windowSize.height,
              originWidth: windowSize.width,
              startX: event.clientX,
              startY: event.clientY,
            };
            setIsResizing(true);
          }}
        >
          <ResizeHandleIcon />
        </div>
      </div>
    </div>
  );
}
