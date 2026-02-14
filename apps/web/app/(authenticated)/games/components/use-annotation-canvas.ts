/**
 * Hook managing the drawing state machine for annotation mode.
 * Handles pointer events, coordinate normalization, tool-specific drawing logic,
 * drag-to-move with the select tool, and undo/clear operations.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnnotationElement, AnnotationTool } from "@repo/types";
import {
  clearCanvas,
  renderAnnotation,
  renderSelection,
  hitTestElement,
} from "./annotation-renderer";

interface UseAnnotationCanvasOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
}

interface TextInputBox {
  x: number;
  y: number;
  w: number;
  h: number;
  tailX: number;
  tailY: number;
}

interface DragState {
  index: number;
  startNx: number;
  startNy: number;
  original: AnnotationElement;
}

interface UseAnnotationCanvasReturn {
  tool: AnnotationTool;
  setTool: (tool: AnnotationTool) => void;
  color: string;
  setColor: (color: string) => void;
  lineWidth: number;
  setLineWidth: (w: number) => void;
  elements: AnnotationElement[];
  undo: () => void;
  clear: () => void;
  isEmpty: boolean;
  /** Active text input box (drag-defined area for the speech bubble) */
  textInput: TextInputBox | null;
  /** Commit text at the current position */
  commitText: (text: string) => void;
  /** Cancel text input */
  cancelText: () => void;
  /** Index of the currently selected element (select tool) */
  selectedIndex: number | null;
  /** Delete the currently selected element */
  deleteSelected: () => void;
}

// ---- Element movement helper (normalized coords) ----

function moveElement(
  el: AnnotationElement,
  dx: number,
  dy: number,
): AnnotationElement {
  switch (el.type) {
    case "stroke":
      return {
        ...el,
        points: el.points.map(
          ([x, y]) => [x + dx, y + dy] as [number, number],
        ),
      };
    case "arrow":
      return {
        ...el,
        startX: el.startX + dx,
        startY: el.startY + dy,
        endX: el.endX + dx,
        endY: el.endY + dy,
      };
    case "circle":
      return { ...el, cx: el.cx + dx, cy: el.cy + dy };
    case "rectangle":
      return { ...el, x: el.x + dx, y: el.y + dy };
    case "text":
      return {
        ...el,
        x: el.x + dx,
        y: el.y + dy,
        tailX: el.tailX + dx,
        tailY: el.tailY + dy,
      };
  }
}

export function useAnnotationCanvas({
  canvasRef,
  enabled,
}: UseAnnotationCanvasOptions): UseAnnotationCanvasReturn {
  const [tool, setTool] = useState<AnnotationTool>("pen");
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(4);
  const [elements, setElements] = useState<AnnotationElement[]>([]);
  const [textInput, setTextInput] = useState<TextInputBox | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Drawing state refs (don't need re-renders)
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<[number, number][]>([]);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Drag state for select tool (canvas-only rendering during drag, commit on up)
  const dragRef = useRef<DragState | null>(null);
  const dragPreviewRef = useRef<{
    index: number;
    element: AnnotationElement;
  } | null>(null);

  // Stable refs for current tool settings
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const lineWidthRef = useRef(lineWidth);
  const elementsRef = useRef(elements);
  const textInputRef = useRef(textInput);
  const selectedIndexRef = useRef(selectedIndex);

  toolRef.current = tool;
  colorRef.current = color;
  lineWidthRef.current = lineWidth;
  elementsRef.current = elements;
  textInputRef.current = textInput;
  selectedIndexRef.current = selectedIndex;

  const getNormalized = useCallback(
    (e: PointerEvent): { nx: number; ny: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      return {
        nx: Math.max(0, Math.min(1, nx)),
        ny: Math.max(0, Math.min(1, ny)),
      };
    },
    [canvasRef],
  );

  const redraw = useCallback(
    (extraElements?: AnnotationElement[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      clearCanvas(ctx, canvas.width, canvas.height);

      // Build the elements array, substituting the drag preview if active
      const dp = dragPreviewRef.current;
      const all: AnnotationElement[] = elementsRef.current.map((el, i) =>
        dp && dp.index === i ? dp.element : el,
      );
      if (extraElements) all.push(...extraElements);

      // Draw empty speech bubble preview while the text input is open
      const ti = textInputRef.current;
      if (ti && !extraElements) {
        all.push({
          type: "text",
          x: ti.x,
          y: ti.y,
          w: ti.w,
          h: ti.h,
          tailX: ti.tailX,
          tailY: ti.tailY,
          text: "",
          color: colorRef.current,
          fontSize: 0.02,
        });
      }

      renderAnnotation(ctx, all, canvas.width, canvas.height);

      // Draw selection highlight (use drag preview bounds if dragging)
      const si = selectedIndexRef.current;
      if (si !== null && si < all.length) {
        renderSelection(ctx, all[si]!, canvas.width, canvas.height);
      }
    },
    [canvasRef],
  );

  // Redraw when elements, textInput, or selection changes
  useEffect(() => {
    redraw();
  }, [elements, textInput, selectedIndex, redraw]);

  // Clear canvas and state when disabled
  useEffect(() => {
    if (!enabled) {
      setElements([]);
      setTextInput(null);
      setSelectedIndex(null);
      isDrawingRef.current = false;
      currentStrokeRef.current = [];
      shapeStartRef.current = null;
      dragRef.current = null;
      dragPreviewRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) clearCanvas(ctx, canvas.width, canvas.height);
      }
    }
  }, [enabled, canvasRef]);

  // Pointer event handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    function onPointerDown(e: PointerEvent) {
      const pos = getNormalized(e);
      if (!pos) return;

      const currentTool = toolRef.current;

      // Select tool: hit-test, then start drag if hit
      if (currentTool === "select") {
        const els = elementsRef.current;
        // Search from top (last) to bottom (first) for intuitive selection
        let hitIdx: number | null = null;
        for (let i = els.length - 1; i >= 0; i--) {
          if (hitTestElement(els[i]!, pos.nx, pos.ny)) {
            hitIdx = i;
            break;
          }
        }
        setSelectedIndex(hitIdx);

        if (hitIdx !== null) {
          // Start drag
          dragRef.current = {
            index: hitIdx,
            startNx: pos.nx,
            startNy: pos.ny,
            original: structuredClone(els[hitIdx]!),
          };
          isDrawingRef.current = true;
          canvas!.setPointerCapture(e.pointerId);
        }
        return;
      }

      // Clear selection when switching to a drawing tool
      if (selectedIndexRef.current !== null) {
        setSelectedIndex(null);
      }

      isDrawingRef.current = true;
      canvas!.setPointerCapture(e.pointerId);

      if (currentTool === "pen") {
        currentStrokeRef.current = [[pos.nx, pos.ny]];
      } else {
        // arrow, circle, rectangle, and text all start with a drag origin
        shapeStartRef.current = { x: pos.nx, y: pos.ny };
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDrawingRef.current) return;
      const pos = getNormalized(e);
      if (!pos) return;

      const currentTool = toolRef.current;

      // Select tool: drag move
      if (currentTool === "select" && dragRef.current) {
        const { index, startNx, startNy, original } = dragRef.current;
        const dx = pos.nx - startNx;
        const dy = pos.ny - startNy;
        dragPreviewRef.current = {
          index,
          element: moveElement(original, dx, dy),
        };
        redraw();
        return;
      }

      const c = colorRef.current;
      const w = lineWidthRef.current;

      if (currentTool === "pen") {
        currentStrokeRef.current.push([pos.nx, pos.ny]);
        const previewElement: AnnotationElement = {
          type: "stroke",
          points: [...currentStrokeRef.current],
          color: c,
          width: w,
        };
        redraw([previewElement]);
      } else if (shapeStartRef.current) {
        const start = shapeStartRef.current;
        let preview: AnnotationElement;

        if (currentTool === "arrow") {
          preview = {
            type: "arrow",
            startX: start.x,
            startY: start.y,
            endX: pos.nx,
            endY: pos.ny,
            color: c,
            width: w,
          };
        } else if (currentTool === "circle") {
          preview = {
            type: "circle",
            cx: start.x,
            cy: start.y,
            rx: Math.abs(pos.nx - start.x),
            ry: Math.abs(pos.ny - start.y),
            color: c,
            width: w,
          };
        } else if (currentTool === "text") {
          // Preview speech bubble shape during drag
          const x = Math.min(start.x, pos.nx);
          const y = Math.min(start.y, pos.ny);
          preview = {
            type: "text",
            x,
            y,
            w: Math.abs(pos.nx - start.x),
            h: Math.abs(pos.ny - start.y),
            tailX: start.x,
            tailY: start.y,
            text: "",
            color: c,
            fontSize: 0.02,
          };
        } else {
          // rectangle
          const x = Math.min(start.x, pos.nx);
          const y = Math.min(start.y, pos.ny);
          preview = {
            type: "rectangle",
            x,
            y,
            w: Math.abs(pos.nx - start.x),
            h: Math.abs(pos.ny - start.y),
            color: c,
            width: w,
          };
        }

        redraw([preview]);
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      canvas!.releasePointerCapture(e.pointerId);

      const currentTool = toolRef.current;

      // Select tool: commit drag
      if (currentTool === "select") {
        if (dragRef.current && dragPreviewRef.current) {
          const { index, element } = dragPreviewRef.current;
          setElements((prev) =>
            prev.map((el, i) => (i === index ? element : el)),
          );
        }
        dragRef.current = null;
        dragPreviewRef.current = null;
        return;
      }

      const pos = getNormalized(e);
      if (!pos) return;

      const c = colorRef.current;
      const w = lineWidthRef.current;

      if (currentTool === "pen") {
        if (currentStrokeRef.current.length >= 2) {
          const newElement: AnnotationElement = {
            type: "stroke",
            points: [...currentStrokeRef.current],
            color: c,
            width: w,
          };
          setElements((prev) => [...prev, newElement]);
        }
        currentStrokeRef.current = [];
      } else if (shapeStartRef.current) {
        const start = shapeStartRef.current;

        // Ignore tiny accidental drags
        const dx = Math.abs(pos.nx - start.x);
        const dy = Math.abs(pos.ny - start.y);
        if (dx < 0.005 && dy < 0.005) {
          shapeStartRef.current = null;
          redraw();
          return;
        }

        if (currentTool === "text") {
          // Text tool: open the text input overlay instead of creating an element
          const bx = Math.min(start.x, pos.nx);
          const by = Math.min(start.y, pos.ny);
          // Enforce a minimum bubble size
          const bw = Math.max(dx, 0.12);
          const bh = Math.max(dy, 0.06);
          setTextInput({
            x: bx,
            y: by,
            w: bw,
            h: bh,
            tailX: start.x,
            tailY: start.y,
          });
          shapeStartRef.current = null;
          return;
        }

        let newElement: AnnotationElement;

        if (currentTool === "arrow") {
          newElement = {
            type: "arrow",
            startX: start.x,
            startY: start.y,
            endX: pos.nx,
            endY: pos.ny,
            color: c,
            width: w,
          };
        } else if (currentTool === "circle") {
          newElement = {
            type: "circle",
            cx: start.x,
            cy: start.y,
            rx: Math.abs(pos.nx - start.x),
            ry: Math.abs(pos.ny - start.y),
            color: c,
            width: w,
          };
        } else {
          // rectangle
          const x = Math.min(start.x, pos.nx);
          const y = Math.min(start.y, pos.ny);
          newElement = {
            type: "rectangle",
            x,
            y,
            w: Math.abs(pos.nx - start.x),
            h: Math.abs(pos.ny - start.y),
            color: c,
            width: w,
          };
        }

        setElements((prev) => [...prev, newElement]);
        shapeStartRef.current = null;
      }
    }

    function onPointerCancel(e: PointerEvent) {
      onPointerUp(e);
    }

    function onLostPointerCapture(e: PointerEvent) {
      onPointerUp(e);
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("lostpointercapture", onLostPointerCapture);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("lostpointercapture", onLostPointerCapture);
    };
  }, [enabled, canvasRef, getNormalized, redraw]);

  const undo = useCallback(() => {
    setElements((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setElements([]);
    setTextInput(null);
  }, []);

  const commitText = useCallback(
    (text: string) => {
      if (!textInput || !text.trim()) {
        setTextInput(null);
        return;
      }
      const newElement: AnnotationElement = {
        type: "text",
        x: textInput.x,
        y: textInput.y,
        w: textInput.w,
        h: textInput.h,
        tailX: textInput.tailX,
        tailY: textInput.tailY,
        text: text.trim(),
        color: colorRef.current,
        fontSize: 0.02,
      };
      setElements((prev) => [...prev, newElement]);
      setTextInput(null);
    },
    [textInput],
  );

  const cancelText = useCallback(() => {
    setTextInput(null);
  }, []);

  const deleteSelected = useCallback(() => {
    setElements((prev) => {
      const si = selectedIndexRef.current;
      if (si === null || si >= prev.length) return prev;
      return prev.filter((_, i) => i !== si);
    });
    setSelectedIndex(null);
  }, []);

  // Clear selection when tool changes away from select
  const handleSetTool = useCallback((newTool: AnnotationTool) => {
    if (newTool !== "select") {
      setSelectedIndex(null);
    }
    setTool(newTool);
  }, []);

  return {
    tool,
    setTool: handleSetTool,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    elements,
    undo,
    clear,
    isEmpty: elements.length === 0,
    textInput,
    commitText,
    cancelText,
    selectedIndex,
    deleteSelected,
  };
}
