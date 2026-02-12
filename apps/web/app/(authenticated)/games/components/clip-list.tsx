"use client";

import { cn } from "@repo/ui/lib/utils";
import { Scissors } from "lucide-react";

/**
 * ClipList displays time-segmented clips from analyzed footage.
 *
 * Clips are created when footage is split into plays/segments (future feature).
 * Each clip has a startTime/endTime referencing its parent Video.
 * Clips across different camera angles are associated (same play, different view).
 *
 * For now, no clips exist — the component shows an empty state.
 */

export interface ClipData {
  id: string;
  title: string | null;
  startTime: number;
  endTime: number;
  videoId: string;
  thumbnailUrl: string | null;
  labels: string[];
}

interface ClipListProps {
  clips: ClipData[];
  activeClipId: string | null;
  onClipSelect: (clipId: string) => void;
  className?: string;
}

export function ClipList({
  clips,
  activeClipId: _activeClipId,
  onClipSelect: _onClipSelect,
  className,
}: ClipListProps) {
  if (clips.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground",
          className,
        )}
      >
        <Scissors className="size-5" />
        <p className="text-sm">No clips yet</p>
        <p className="text-xs text-center px-4">
          Clips will appear here once footage is analyzed and split into plays.
        </p>
      </div>
    );
  }

  // Future: render clip items with thumbnails, time ranges, labels
  // For now this branch is unreachable since no clips are created yet
  return null;
}
