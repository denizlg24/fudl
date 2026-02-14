"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { Separator } from "@repo/ui/components/separator";
import { Kbd } from "@repo/ui/components/kbd";
import {
  MousePointer2,
  Pencil,
  MoveUpRight,
  Circle,
  Square,
  Type,
  Shapes,
  Palette,
  Undo2,
  Trash2,
  X,
  Save,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { AnnotationTool } from "@repo/types";

/** Tools always visible in the toolbar. */
const PRIMARY_TOOLS: {
  tool: AnnotationTool;
  icon: typeof Pencil;
  label: string;
}[] = [
  { tool: "select", icon: MousePointer2, label: "Select" },
  { tool: "pen", icon: Pencil, label: "Pen" },
];

/** Shape tools collapsed into a popover. */
const SHAPE_TOOLS: {
  tool: AnnotationTool;
  icon: typeof Pencil;
  label: string;
}[] = [
  { tool: "arrow", icon: MoveUpRight, label: "Arrow" },
  { tool: "circle", icon: Circle, label: "Circle" },
  { tool: "rectangle", icon: Square, label: "Rectangle" },
  { tool: "text", icon: Type, label: "Text" },
];

const SHAPE_TOOL_SET = new Set(SHAPE_TOOLS.map((t) => t.tool));

const COLOR_PRESETS = [
  { color: "#ef4444", label: "Red" },
  { color: "#3b82f6", label: "Blue" },
  { color: "#eab308", label: "Yellow" },
  { color: "#ffffff", label: "White" },
  { color: "#22c55e", label: "Green" },
];

const WIDTH_PRESETS = [
  { width: 2, label: "Thin" },
  { width: 4, label: "Medium" },
  { width: 6, label: "Thick" },
];

interface AnnotationToolbarProps {
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  lineWidth: number;
  onLineWidthChange: (w: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onSave: () => void;
  onCancel: () => void;
  isEmpty: boolean;
  isSaving: boolean;
  /** Whether an element is currently selected (enables delete button) */
  hasSelection?: boolean;
  /** Delete the selected element */
  onDeleteSelected?: () => void;
}

export function AnnotationToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  lineWidth,
  onLineWidthChange,
  onUndo,
  onClear,
  onSave,
  onCancel,
  isEmpty,
  isSaving,
  hasSelection = false,
  onDeleteSelected,
}: AnnotationToolbarProps) {
  const [shapesOpen, setShapesOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);

  // Determine which icon to show on the shapes trigger
  const activeShapeTool = SHAPE_TOOLS.find((s) => s.tool === tool);
  const ShapeTriggerIcon = activeShapeTool?.icon ?? Shapes;
  const isShapeActive = SHAPE_TOOL_SET.has(tool);

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg shadow-lg max-w-[calc(100vw-2rem)]">
      {/* Primary tools (select, pen) — always visible */}
      {PRIMARY_TOOLS.map(({ tool: t, icon: Icon, label }) => (
        <Tooltip key={t}>
          <TooltipTrigger asChild>
            <Button
              variant={tool === t ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => onToolChange(t)}
              aria-label={label}
              className="text-white hover:text-white"
            >
              <Icon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
      ))}

      {/* Shapes popover — arrow, circle, rectangle, text */}
      <Popover open={shapesOpen} onOpenChange={setShapesOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={isShapeActive ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Shapes"
                className="text-white hover:text-white"
              >
                <ShapeTriggerIcon className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {activeShapeTool?.label ?? "Shapes"}
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          side="bottom"
          align="center"
          className="w-auto p-1.5 bg-black/90 backdrop-blur-sm border-white/10"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            {SHAPE_TOOLS.map(({ tool: t, icon: Icon, label }) => (
              <Tooltip key={t}>
                <TooltipTrigger asChild>
                  <Button
                    variant={tool === t ? "secondary" : "ghost"}
                    size="icon-sm"
                    onClick={() => {
                      onToolChange(t);
                      setShapesOpen(false);
                    }}
                    aria-label={label}
                    className="text-white hover:text-white"
                  >
                    <Icon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-5 mx-0.5 bg-white/20" />

      {/* Style popover — colors + line widths */}
      <Popover open={styleOpen} onOpenChange={setStyleOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Style"
                className="text-white hover:text-white relative"
              >
                <Palette className="size-4" />
                {/* Active color indicator */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border border-black/50"
                  style={{ backgroundColor: color }}
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Style</TooltipContent>
        </Tooltip>
        <PopoverContent
          side="bottom"
          align="center"
          className="w-auto p-2 bg-black/90 backdrop-blur-sm border-white/10"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-2">
            {/* Colors */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/50 w-8 shrink-0">
                Color
              </span>
              {COLOR_PRESETS.map(({ color: c, label }) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onColorChange(c)}
                  className={cn(
                    "size-5 rounded-full border-2 shrink-0 transition-transform",
                    color === c
                      ? "border-white scale-110"
                      : "border-white/30 hover:border-white/60",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={label}
                />
              ))}
            </div>
            {/* Line widths */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/50 w-8 shrink-0">
                Size
              </span>
              {WIDTH_PRESETS.map(({ width: w, label }) => (
                <Button
                  key={w}
                  variant={lineWidth === w ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => onLineWidthChange(w)}
                  aria-label={label}
                  className="text-white hover:text-white"
                >
                  <div
                    className="rounded-full bg-current"
                    style={{ width: w + 2, height: w + 2 }}
                  />
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-5 mx-0.5 bg-white/20" />

      {/* Delete selected */}
      {hasSelection && onDeleteSelected && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDeleteSelected}
              aria-label="Delete selected"
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Delete <Kbd>Del</Kbd>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Undo */}
      {!hasSelection && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onUndo}
              disabled={isEmpty}
              aria-label="Undo"
              className="text-white hover:text-white"
            >
              <Undo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Undo <Kbd>Ctrl+Z</Kbd>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Clear */}
      {!hasSelection && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClear}
              disabled={isEmpty}
              aria-label="Clear all"
              className="text-white hover:text-white"
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Clear all</TooltipContent>
        </Tooltip>
      )}

      <Separator orientation="vertical" className="h-5 mx-0.5 bg-white/20" />

      {/* Cancel */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-white hover:text-white h-7 px-2 text-xs"
          >
            Cancel
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Cancel <Kbd>Esc</Kbd>
        </TooltipContent>
      </Tooltip>

      {/* Save */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isEmpty || isSaving}
            className="h-7 px-2 text-xs"
          >
            <Save className="size-3.5 mr-1" />
            {isSaving ? "..." : "Save"}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Save annotation</TooltipContent>
      </Tooltip>
    </div>
  );
}
