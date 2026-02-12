"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isCoachRole } from "@repo/types";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Separator } from "@repo/ui/components/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  ChevronDown,
  ChevronLeft,
  Calendar,
  Layers,
  Camera,
  Video,
  PlayCircle,
  Upload,
} from "lucide-react";
import { ClipList } from "./clip-list";
import type { ClipData } from "./clip-list";
import type { VideoData } from "./video-player";
import Image from "next/image";

export interface SidebarGameData {
  id: string;
  title: string;
  date: string | null;
  seasonId: string;
  season?: { id: string; name: string } | null;
  tags?: Array<{ id: string; name: string; category: string }>;
  videoCount: number;
}

type GroupBy = "none" | "season" | "opponent" | "both";

interface GameGroup {
  key: string;
  label: string;
  games: SidebarGameData[];
}

function getOpponentName(game: SidebarGameData): string | null {
  const opponentTag = game.tags?.find((t) => t.category === "OPPONENT");
  return opponentTag?.name ?? null;
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupGames(games: SidebarGameData[], groupBy: GroupBy): GameGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "", games }];
  }

  if (groupBy === "season") {
    const groups = new Map<string, SidebarGameData[]>();
    for (const game of games) {
      const key = game.seasonId;
      const existing = groups.get(key) ?? [];
      existing.push(game);
      groups.set(key, existing);
    }
    return Array.from(groups.entries()).map(([key, groupGames]) => ({
      key,
      label: groupGames[0]?.season?.name ?? "Unknown Season",
      games: groupGames,
    }));
  }

  if (groupBy === "opponent") {
    const groups = new Map<string, SidebarGameData[]>();
    for (const game of games) {
      const opponent = getOpponentName(game) ?? "No opponent";
      const existing = groups.get(opponent) ?? [];
      existing.push(game);
      groups.set(opponent, existing);
    }
    return Array.from(groups.entries()).map(([key, groupGames]) => ({
      key,
      label: key === "No opponent" ? key : `vs. ${key}`,
      games: groupGames,
    }));
  }

  // "both" — season first, then opponent
  const groups = new Map<string, SidebarGameData[]>();
  for (const game of games) {
    const seasonName = game.season?.name ?? "Unknown Season";
    const opponent = getOpponentName(game) ?? "No opponent";
    const key = `${seasonName}__${opponent}`;
    const existing = groups.get(key) ?? [];
    existing.push(game);
    groups.set(key, existing);
  }
  return Array.from(groups.entries()).map(([key, groupGames]) => {
    const [season, opponent] = key.split("__");
    const label =
      opponent === "No opponent" ? `${season}` : `${season} — vs. ${opponent}`;
    return { key, label, games: groupGames };
  });
}

interface GameSidebarProps {
  /** All games for the org (for the directory) */
  allGames: SidebarGameData[];
  /** Current game being viewed */
  currentGameId: string;
  /** Playable footage files for the current game */
  footageFiles: VideoData[];
  /** ID of the currently active footage file (angle), or null */
  activeVideoId: string | null;
  /** Called when a footage file / angle is selected */
  onAngleChange: (videoId: string) => void;
  /** User's role in the org (for coach-gating actions) */
  role: string;
  /** Clips for the current game */
  clips: ClipData[];
  /** Currently active play number */
  activePlayNumber: number | null;
  /** Called when a play is selected */
  onPlaySelect: (playNumber: number) => void;
  /** Called when a clip is updated */
  onClipUpdated: (clip: ClipData) => void;
  /** Called when a clip is deleted */
  onClipDeleted: (clipId: string) => void;
  /** Organization ID */
  orgId: string;
  className?: string;
}

export function GameSidebar({
  allGames,
  currentGameId,
  footageFiles,
  activeVideoId,
  onAngleChange,
  role,
  clips,
  activePlayNumber,
  onPlaySelect,
  onClipUpdated,
  onClipDeleted,
  orgId,
  className,
}: GameSidebarProps) {
  const isCoach = isCoachRole(role);
  const [groupBy, setGroupBy] = useState<GroupBy>("opponent");
  const [gamesOpen, setGamesOpen] = useState(true);
  const [footageOpen, setFootageOpen] = useState(true);
  const [clipsOpen, setClipsOpen] = useState(clips.length > 0);

  const groups = useMemo(
    () => groupGames(allGames, groupBy),
    [allGames, groupBy],
  );

  return (
    <div
      className={cn("flex flex-col h-full bg-background border-l", className)}
    >
      {/* Back link */}
      <div className="px-3 pt-3 pb-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Dashboard
        </Link>
      </div>

      <Separator />

      {/* Game directory section */}
      <Collapsible
        open={gamesOpen}
        onOpenChange={setGamesOpen}
        className="flex-1 min-h-0 flex flex-col"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors">
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                !gamesOpen && "-rotate-90",
              )}
            />
            Games
          </CollapsibleTrigger>

          <Select
            value={groupBy}
            onValueChange={(v) => setGroupBy(v as GroupBy)}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-auto gap-1.5 text-xs px-2"
            >
              <Layers className="size-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="none">No grouping</SelectItem>
              <SelectItem value="season">By season</SelectItem>
              <SelectItem value="opponent">By opponent</SelectItem>
              <SelectItem value="both">Season + opponent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CollapsibleContent className="flex-1 min-h-0">
          <ScrollArea className="h-full max-h-[50vh]">
            <div className={cn("px-2 pb-2", groupBy === "none" && "pt-2")}>
              {groups.map((group) => (
                <div key={group.key}>
                  {/* Group header */}
                  {group.label && (
                    <div className="flex items-center gap-2 px-2 py-1.5 mt-1">
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {group.label}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] py-0 px-1.5 h-4 shrink-0"
                      >
                        {group.games.length}
                      </Badge>
                      <Separator className="flex-1" />
                    </div>
                  )}

                  {/* Game items */}
                  {group.games.map((game) => {
                    const isActive = game.id === currentGameId;
                    const opponent = getOpponentName(game);

                    return (
                      <Link
                        key={game.id}
                        href={`/games/${game.id}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          "hover:bg-accent",
                          isActive &&
                            "bg-accent ring-1 ring-primary/50 font-medium",
                        )}
                      >
                        <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">
                            {opponent ? `vs. ${opponent}` : game.title}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          {formatShortDate(game.date)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Plays section — shows time-segmented plays (above footage) */}
      <Collapsible
        open={clipsOpen}
        onOpenChange={setClipsOpen}
        className="shrink-0"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors">
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                !clipsOpen && "-rotate-90",
              )}
            />
            Plays
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
              {new Set(clips.map((c) => c.playNumber)).size}
            </Badge>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <ClipList
            clips={clips}
            activePlayNumber={activePlayNumber}
            activeVideoId={activeVideoId}
            onPlaySelect={onPlaySelect}
            onClipUpdated={onClipUpdated}
            onClipDeleted={onClipDeleted}
            isCoach={isCoach}
            orgId={orgId}
            className="max-h-[30vh]"
          />
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Footage section — shows uploaded footage files (camera angles) */}
      <Collapsible
        open={footageOpen}
        onOpenChange={setFootageOpen}
        className="shrink-0"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors">
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                !footageOpen && "-rotate-90",
              )}
            />
            Footage
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
              {footageFiles.length}
            </Badge>
          </CollapsibleTrigger>
          {isCoach && (
            <Button variant="ghost" size="icon" className="size-7" asChild>
              <Link href={`/upload?gameId=${currentGameId}`}>
                <Upload className="size-3.5" />
                <span className="sr-only">Upload footage</span>
              </Link>
            </Button>
          )}
        </div>

        <CollapsibleContent>
          {footageFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
              <Video className="size-5" />
              <p className="text-sm">No footage uploaded</p>
              {isCoach && (
                <Button variant="outline" size="sm" className="mt-1" asChild>
                  <Link href={`/upload?gameId=${currentGameId}`}>
                    <Upload className="size-3.5 mr-1.5" />
                    Upload
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="max-h-[30vh]">
              <div className="flex flex-col gap-1 p-1">
                {footageFiles.map((video) => {
                  const isActive = video.id === activeVideoId;
                  const angleTag = video.tags.find(
                    (t) => t.category === "CAMERA_ANGLE",
                  );
                  const displayName = angleTag?.name ?? video.title;

                  return (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() => onAngleChange(video.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors w-full",
                        "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        isActive && "bg-accent ring-1 ring-primary/50",
                      )}
                    >
                      {/* Thumbnail or placeholder */}
                      <div className="relative shrink-0 w-16 aspect-video rounded overflow-hidden bg-muted">
                        {video.thumbnailUrl ? (
                          <Image
                            src={video.thumbnailUrl}
                            alt={displayName}
                            className="w-full h-full object-cover"
                            width={128}
                            height={72}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        {isActive && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <PlayCircle className="size-5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {displayName}
                        </p>
                        {angleTag && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 h-4 mt-0.5"
                          >
                            {angleTag.name}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
