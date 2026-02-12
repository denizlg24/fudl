"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { Kbd } from "@repo/ui/components/kbd";
import { Scissors, X } from "lucide-react";
import { ClipCreateDialog } from "./clip-create-dialog";
import type { ClipData } from "./clip-list";

function formatTimeCompact(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ClipMarkControlsProps {
  markIn: number | null;
  markOut: number | null;
  onMarkIn: (time: number) => void;
  onMarkOut: (time: number) => void;
  onClearMarks: () => void;
  onClipCreated: (clip: ClipData) => void;
  currentTime: number;
  videoId: string;
  orgId: string;
  existingClips: ClipData[];
}

export function ClipMarkControls({
  markIn,
  markOut,
  onMarkIn,
  onMarkOut,
  onClearMarks,
  onClipCreated,
  currentTime,
  videoId,
  orgId,
  existingClips,
}: ClipMarkControlsProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const hasRange = markIn !== null && markOut !== null && markOut > markIn;

  return (
    <>
      <div className="flex items-center gap-0.5">
        {/* Mark In */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-xs font-mono"
              onClick={() => onMarkIn(currentTime)}
            >
              <span className={markIn !== null ? "text-green-400" : ""}>
                {markIn !== null ? formatTimeCompact(markIn) : "["}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Mark in <Kbd>I</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Mark Out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-xs font-mono"
              onClick={() => onMarkOut(currentTime)}
            >
              <span className={markOut !== null ? "text-red-400" : ""}>
                {markOut !== null ? formatTimeCompact(markOut) : "]"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Mark out <Kbd>O</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Save play button — visible when both marks are set */}
        {hasRange && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Scissors className="size-3.5 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Save play</TooltipContent>
          </Tooltip>
        )}

        {/* Clear marks */}
        {(markIn !== null || markOut !== null) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClearMarks}
              >
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Clear marks <Kbd>Esc</Kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Play creation dialog */}
      {hasRange && (
        <ClipCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          markIn={markIn!}
          markOut={markOut!}
          videoId={videoId}
          orgId={orgId}
          existingClips={existingClips}
          onClipCreated={onClipCreated}
        />
      )}
    </>
  );
}
