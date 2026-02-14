// ---------------------------------------------------------------------------
// Annotation types — shared between API and frontend
// ---------------------------------------------------------------------------

export type AnnotationTool = "select" | "pen" | "arrow" | "circle" | "rectangle" | "text";

export type AnnotationElement =
  | { type: "stroke"; points: [number, number][]; color: string; width: number }
  | {
      type: "arrow";
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      color: string;
      width: number;
    }
  | {
      type: "circle";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      color: string;
      width: number;
    }
  | {
      type: "rectangle";
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      width: number;
    }
  | {
      type: "text";
      x: number;
      y: number;
      w: number;
      h: number;
      /** Drag start point — determines which corner the tail points toward */
      tailX: number;
      tailY: number;
      text: string;
      color: string;
      fontSize: number;
    };

export interface AnnotationData {
  id: string;
  videoId: string;
  timestamp: number;
  data: { elements: AnnotationElement[] };
  isPrivate: boolean;
  createdById: string;
  createdByName: string | null;
  createdAt: string;
}
