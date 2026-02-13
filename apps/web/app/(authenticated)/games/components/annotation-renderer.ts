/**
 * Pure canvas 2D drawing functions for annotation elements.
 * All coordinates are stored normalized (0-1) and denormalized to canvas size for rendering.
 */

import type { AnnotationElement } from "@repo/types";

// ---- Hit-testing (normalized 0-1 coordinates) ----

/** Distance from a point to a line segment. */
function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const HIT_THRESHOLD = 0.02; // normalized distance threshold

/** Test if a normalized point (nx, ny) hits an element. Returns true if hit. */
export function hitTestElement(
  el: AnnotationElement,
  nx: number,
  ny: number,
): boolean {
  switch (el.type) {
    case "stroke": {
      for (let i = 1; i < el.points.length; i++) {
        const [x1, y1] = el.points[i - 1]!;
        const [x2, y2] = el.points[i]!;
        if (distToSegment(nx, ny, x1, y1, x2, y2) < HIT_THRESHOLD) return true;
      }
      return false;
    }
    case "arrow": {
      return (
        distToSegment(nx, ny, el.startX, el.startY, el.endX, el.endY) <
        HIT_THRESHOLD
      );
    }
    case "circle": {
      // Normalized distance from center, scaled by radii
      if (el.rx === 0 || el.ry === 0) return false;
      const dx = (nx - el.cx) / el.rx;
      const dy = (ny - el.cy) / el.ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      return Math.abs(d - 1) < HIT_THRESHOLD / Math.min(el.rx, el.ry);
    }
    case "rectangle": {
      const inside =
        nx >= el.x - HIT_THRESHOLD &&
        nx <= el.x + el.w + HIT_THRESHOLD &&
        ny >= el.y - HIT_THRESHOLD &&
        ny <= el.y + el.h + HIT_THRESHOLD;
      if (!inside) return false;
      // Near any edge?
      const nearLeft = Math.abs(nx - el.x) < HIT_THRESHOLD;
      const nearRight = Math.abs(nx - (el.x + el.w)) < HIT_THRESHOLD;
      const nearTop = Math.abs(ny - el.y) < HIT_THRESHOLD;
      const nearBottom = Math.abs(ny - (el.y + el.h)) < HIT_THRESHOLD;
      return nearLeft || nearRight || nearTop || nearBottom;
    }
    case "text": {
      return (
        nx >= el.x &&
        nx <= el.x + el.w &&
        ny >= el.y &&
        ny <= el.y + el.h
      );
    }
  }
}

/** Get the bounding box of an element (normalized 0-1). */
export function getElementBounds(
  el: AnnotationElement,
): { x: number; y: number; w: number; h: number } {
  switch (el.type) {
    case "stroke": {
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      for (const [px, py] of el.points) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case "arrow": {
      const x = Math.min(el.startX, el.endX);
      const y = Math.min(el.startY, el.endY);
      return {
        x,
        y,
        w: Math.abs(el.endX - el.startX),
        h: Math.abs(el.endY - el.startY),
      };
    }
    case "circle":
      return {
        x: el.cx - el.rx,
        y: el.cy - el.ry,
        w: el.rx * 2,
        h: el.ry * 2,
      };
    case "rectangle":
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "text":
      return { x: el.x, y: el.y, w: el.w, h: el.h };
  }
}

/** Draw a dashed selection rectangle around an element. */
export function renderSelection(
  ctx: CanvasRenderingContext2D,
  el: AnnotationElement,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const bounds = getElementBounds(el);
  const pad = 0.008; // normalized padding
  const bx = (bounds.x - pad) * canvasWidth;
  const by = (bounds.y - pad) * canvasHeight;
  const bw = (bounds.w + pad * 2) * canvasWidth;
  const bh = (bounds.h + pad * 2) * canvasHeight;

  ctx.save();
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.setLineDash([]);
  ctx.restore();
}

export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
}

export function renderAnnotation(
  ctx: CanvasRenderingContext2D,
  elements: AnnotationElement[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  for (const el of elements) {
    switch (el.type) {
      case "stroke":
        renderStroke(ctx, el, canvasWidth, canvasHeight);
        break;
      case "arrow":
        renderArrow(ctx, el, canvasWidth, canvasHeight);
        break;
      case "circle":
        renderCircle(ctx, el, canvasWidth, canvasHeight);
        break;
      case "rectangle":
        renderRectangle(ctx, el, canvasWidth, canvasHeight);
        break;
      case "text":
        renderText(ctx, el, canvasWidth, canvasHeight);
        break;
    }
  }
}

function renderStroke(
  ctx: CanvasRenderingContext2D,
  el: Extract<AnnotationElement, { type: "stroke" }>,
  w: number,
  h: number,
): void {
  if (el.points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const [startX, startY] = el.points[0]!;
  ctx.moveTo(startX * w, startY * h);
  for (let i = 1; i < el.points.length; i++) {
    const [px, py] = el.points[i]!;
    ctx.lineTo(px * w, py * h);
  }
  ctx.stroke();
}

function renderArrow(
  ctx: CanvasRenderingContext2D,
  el: Extract<AnnotationElement, { type: "arrow" }>,
  w: number,
  h: number,
): void {
  const x1 = el.startX * w;
  const y1 = el.startY * h;
  const x2 = el.endX * w;
  const y2 = el.endY * h;

  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.width;
  ctx.lineCap = "round";

  // Shaft
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = Math.max(12, el.width * 4);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

function renderCircle(
  ctx: CanvasRenderingContext2D,
  el: Extract<AnnotationElement, { type: "circle" }>,
  w: number,
  h: number,
): void {
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.width;
  ctx.beginPath();
  ctx.ellipse(el.cx * w, el.cy * h, el.rx * w, el.ry * h, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function renderRectangle(
  ctx: CanvasRenderingContext2D,
  el: Extract<AnnotationElement, { type: "rectangle" }>,
  w: number,
  h: number,
): void {
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.width;
  ctx.strokeRect(el.x * w, el.y * h, el.w * w, el.h * h);
}

/** Word-wrap text to fit within a max pixel width, breaking long words character-by-character. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (maxWidth <= 0) return [text];

  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }

      // If the current word alone exceeds maxWidth, break it character-by-character
      if (ctx.measureText(currentLine).width > maxWidth) {
        let broken = "";
        for (const char of currentLine) {
          const test = broken + char;
          if (ctx.measureText(test).width > maxWidth && broken) {
            lines.push(broken);
            broken = char;
          } else {
            broken = test;
          }
        }
        currentLine = broken;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

/** Orange outline color for speech bubbles. */
const BUBBLE_STROKE = "#f97316";

/**
 * Draw a speech-bubble path (rounded rect with a triangular tail).
 * The tail position depends on which corner the drag started from.
 */
function speechBubblePath(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  radius: number,
  tailHeight: number,
  tailOnTop: boolean,
  tailOnRight: boolean,
): void {
  // Tail base positions on the edge (as fraction of edge width)
  const baseStartFrac = tailOnRight ? 0.68 : 0.15;
  const baseEndFrac = tailOnRight ? 0.85 : 0.32;
  const tipFrac = tailOnRight ? 0.95 : 0.05;

  const tailBaseLeft = bx + bw * baseStartFrac;
  const tailBaseRight = bx + bw * baseEndFrac;
  const tailTipX = bx + bw * tipFrac;

  ctx.beginPath();

  // Top edge (left → right)
  ctx.moveTo(bx + radius, by);
  if (tailOnTop) {
    ctx.lineTo(tailBaseLeft, by);
    ctx.lineTo(tailTipX, by - tailHeight);
    ctx.lineTo(tailBaseRight, by);
  }
  ctx.lineTo(bx + bw - radius, by);

  // Top-right corner
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
  // Right edge
  ctx.lineTo(bx + bw, by + bh - radius);
  // Bottom-right corner
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);

  // Bottom edge (right → left)
  if (!tailOnTop) {
    ctx.lineTo(tailBaseRight, by + bh);
    ctx.lineTo(tailTipX, by + bh + tailHeight);
    ctx.lineTo(tailBaseLeft, by + bh);
  }
  ctx.lineTo(bx + radius, by + bh);

  // Bottom-left corner
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
  // Left edge
  ctx.lineTo(bx, by + radius);
  // Top-left corner
  ctx.quadraticCurveTo(bx, by, bx + radius, by);
  ctx.closePath();
}

function renderText(
  ctx: CanvasRenderingContext2D,
  el: Extract<AnnotationElement, { type: "text" }>,
  cw: number,
  ch: number,
): void {
  const bx = el.x * cw;
  const by = el.y * ch;
  const bw = el.w * cw;
  let bh = el.h * ch;

  const padding = 6;
  const maxWidth = bw - padding * 2;
  if (maxWidth <= 0) return;

  // Font size proportional to bubble height for visual consistency with the textarea
  const fontSize = Math.max(10, Math.min(bh * 0.28, 16));
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "top";

  // Auto-expand box height to fit wrapped text
  if (el.text) {
    const lines = wrapText(ctx, el.text, maxWidth);
    const lineHeight = fontSize * 1.35;
    const totalTextHeight = lines.length * lineHeight;
    const minHeight = totalTextHeight + padding * 2;
    if (minHeight > bh) {
      bh = minHeight;
    }
  }

  // Determine tail corner from drag start point
  const boxCenterX = el.x + el.w / 2;
  const boxCenterY = el.y + el.h / 2;
  const tailX = el.tailX ?? el.x;
  const tailY = el.tailY ?? (el.y + el.h);
  const tailOnTop = tailY <= boxCenterY;
  const tailOnRight = tailX > boxCenterX;

  const radius = Math.min(10, bw / 4, bh / 4);
  const tailHeight = Math.min(bh * 0.25, 16);

  // Draw speech bubble shape
  speechBubblePath(ctx, bx, by, bw, bh, radius, tailHeight, tailOnTop, tailOnRight);
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fill();
  ctx.strokeStyle = BUBBLE_STROKE;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw text inside the bubble (skip if empty — preview during typing)
  if (!el.text) return;

  // Clip to bubble shape so text never overflows
  ctx.save();
  speechBubblePath(ctx, bx, by, bw, bh, radius, tailHeight, tailOnTop, tailOnRight);
  ctx.clip();

  ctx.fillStyle = BUBBLE_STROKE;
  const lines = wrapText(ctx, el.text, maxWidth);
  const lineHeight = fontSize * 1.35;
  const totalTextHeight = lines.length * lineHeight;
  const startY = by + Math.max(padding, (bh - totalTextHeight) / 2);

  for (let i = 0; i < lines.length; i++) {
    const ly = startY + i * lineHeight;
    if (ly + fontSize > by + bh) break;
    ctx.fillText(lines[i]!, bx + padding, ly);
  }

  ctx.restore();
}
