"use client";

import { isCoachRole } from "@repo/types";
import type { AnnotationData } from "@repo/types";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { Diamond, Trash2, Pencil } from "lucide-react";

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AnnotationListProps {
  annotations: AnnotationData[];
  onDelete: (annotationId: string) => void;
  onSeek: (timestamp: number) => void;
  role: string;
  userId: string;
  className?: string;
}

export function AnnotationList({
  annotations,
  onDelete,
  onSeek,
  role,
  userId,
  className,
}: AnnotationListProps) {
  const isCoach = isCoachRole(role);

  if (annotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
        <Pencil className="size-5" />
        <p className="text-sm text-center px-4">
          No annotations yet. Press <kbd className="text-xs bg-muted px-1 py-0.5 rounded">A</kbd> to annotate.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("max-h-[30vh]", className)}>
      <div className="flex flex-col gap-0.5 p-1">
        {annotations.map((ann) => {
          const canDelete =
            ann.isPrivate
              ? ann.createdById === userId
              : isCoach;

          return (
            <div
              key={ann.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer",
                "hover:bg-accent",
              )}
              onClick={() => onSeek(ann.timestamp)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSeek(ann.timestamp);
                }
              }}
            >
              {/* Keyframe diamond icon */}
              <Diamond className="size-3 text-amber-400 shrink-0 fill-amber-400" />

              {/* Timestamp */}
              <span className="font-mono text-xs tabular-nums text-muted-foreground shrink-0">
                {formatTimestamp(ann.timestamp)}
              </span>

              {/* Creator name */}
              <span className="flex-1 min-w-0 truncate text-xs">
                {ann.createdById === userId ? "You" : (ann.createdByName ?? "Unknown")}
              </span>

              {/* Privacy badge */}
              {ann.isPrivate && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 shrink-0">
                  Private
                </Badge>
              )}

              {/* Delete button */}
              {canDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(ann.id);
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Delete annotation</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
