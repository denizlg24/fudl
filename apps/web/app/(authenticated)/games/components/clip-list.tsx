"use client";

import { useMemo, useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { MoreHorizontal, Pencil, Trash2, Scissors } from "lucide-react";
import { clientEnv } from "@repo/env/web";
import { ClipEditDialog } from "./clip-edit-dialog";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

export interface ClipData {
  id: string;
  title: string | null;
  startTime: number;
  endTime: number;
  videoId: string;
  playNumber: number;
  thumbnailUrl: string | null;
  labels: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

interface PlayGroup {
  playNumber: number;
  variants: ClipData[];
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ClipListProps {
  clips: ClipData[];
  activePlayNumber: number | null;
  activeVideoId: string | null;
  onPlaySelect: (playNumber: number) => void;
  onClipUpdated?: (clip: ClipData) => void;
  onClipDeleted?: (clipId: string) => void;
  isCoach?: boolean;
  orgId?: string;
  className?: string;
}

export function ClipList({
  clips,
  activePlayNumber,
  activeVideoId,
  onPlaySelect,
  onClipUpdated,
  onClipDeleted,
  isCoach = false,
  orgId,
  className,
}: ClipListProps) {
  const [editClip, setEditClip] = useState<ClipData | null>(null);
  const [deletePlayNumber, setDeletePlayNumber] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Group clips by playNumber
  const plays: PlayGroup[] = useMemo(() => {
    const map = new Map<number, ClipData[]>();
    for (const clip of clips) {
      const arr = map.get(clip.playNumber) ?? [];
      arr.push(clip);
      map.set(clip.playNumber, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([playNumber, variants]) => ({ playNumber, variants }));
  }, [clips]);

  if (clips.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground",
          className,
        )}
      >
        <Scissors className="size-5" />
        <p className="text-sm">No plays yet</p>
        <p className="text-xs text-center px-4">
          {isCoach
            ? "Press I to mark in and O to mark out while watching footage."
            : "Plays will appear here once footage is analyzed."}
        </p>
      </div>
    );
  }

  async function handleDeletePlay(playNumber: number) {
    if (!orgId || !onClipDeleted) return;
    setDeleting(true);
    try {
      // Delete all variants for this play
      const variants = clips.filter((c) => c.playNumber === playNumber);
      await Promise.all(
        variants.map((clip) =>
          fetch(`${API_URL}/orgs/${orgId}/clips/${clip.id}`, {
            method: "DELETE",
            credentials: "include",
          }),
        ),
      );
      for (const clip of variants) {
        onClipDeleted(clip.id);
      }
    } finally {
      setDeleting(false);
      setDeletePlayNumber(null);
    }
  }

  return (
    <>
      <ScrollArea className={cn("", className)}>
        <div className="flex flex-col gap-0.5 p-1">
          {plays.map((play) => {
            const isActive = play.playNumber === activePlayNumber;
            // Prefer variant on current angle, fall back to first
            const displayVariant =
              play.variants.find((v) => v.videoId === activeVideoId) ??
              play.variants[0]!;
            const duration = displayVariant.endTime - displayVariant.startTime;
            const maxLabelsShown = 3;
            const shownLabels = displayVariant.labels.slice(0, maxLabelsShown);
            const overflowCount = displayVariant.labels.length - maxLabelsShown;

            return (
              <div
                key={play.playNumber}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer",
                  "hover:bg-accent",
                  isActive && "bg-accent ring-1 ring-primary/50",
                )}
                onClick={() => onPlaySelect(play.playNumber)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPlaySelect(play.playNumber);
                  }
                }}
              >
                {/* Index badge */}
                <span className="shrink-0 w-6 h-6 rounded flex items-center justify-center bg-muted text-xs font-mono tabular-nums">
                  {play.playNumber}
                </span>

                {/* Play info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    Play {play.playNumber}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      {formatTime(displayVariant.startTime)} —{" "}
                      {formatTime(displayVariant.endTime)}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1 h-4"
                    >
                      {duration.toFixed(1)}s
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {play.variants.length > 1 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] py-0 px-1.5 h-4"
                      >
                        {play.variants.length} angles
                      </Badge>
                    )}
                    {shownLabels.map((label) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="text-[10px] py-0 px-1.5 h-4"
                      >
                        {label}
                      </Badge>
                    ))}
                    {overflowCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{overflowCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Coach actions */}
                {isCoach && orgId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-3.5" />
                        <span className="sr-only">Play actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditClip(displayVariant);
                        }}
                      >
                        <Pencil className="size-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletePlayNumber(play.playNumber);
                        }}
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Edit dialog */}
      {editClip && orgId && onClipUpdated && (
        <ClipEditDialog
          open={!!editClip}
          onOpenChange={(open) => {
            if (!open) setEditClip(null);
          }}
          clip={editClip}
          orgId={orgId}
          onClipUpdated={onClipUpdated}
        />
      )}

      {/* Delete confirmation — deletes ALL variants for the play */}
      <AlertDialog
        open={deletePlayNumber !== null}
        onOpenChange={(open) => {
          if (!open) setDeletePlayNumber(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete play?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete Play {deletePlayNumber}
              {(() => {
                const variants = clips.filter(
                  (c) => c.playNumber === deletePlayNumber,
                );
                if (variants.length > 1) {
                  return ` and all ${variants.length} angle variants`;
                }
                return "";
              })()}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                if (deletePlayNumber !== null)
                  handleDeletePlay(deletePlayNumber);
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
