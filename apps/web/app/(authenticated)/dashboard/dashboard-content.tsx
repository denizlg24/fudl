"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { isCoachRole } from "@repo/types";
import { useActiveUploadCount } from "../../lib/upload-store";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Progress } from "@repo/ui/components/progress";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import {
  Upload,
  Film,
  Video,
  MoreVertical,
  Play,
  Check,
  Plus,
  Layers,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameVideo {
  id: string;
  status: string;
  thumbnailUrl?: string | null;
}

export interface TagData {
  id: string;
  name: string;
  category: string;
}

export interface GameData {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  notes: string | null;
  seasonId: string;
  season?: { id: string; name: string } | null;
  tags?: TagData[];
  videos?: GameVideo[];
  createdAt: string;
}

export interface SeasonData {
  id: string;
  name: string;
}

type GroupBy = "none" | "season" | "opponent" | "both";

interface GameGroup {
  key: string;
  label: string;
  games: GameData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOpponentName(game: GameData): string | null {
  const opponentTag = game.tags?.find((t) => t.category === "OPPONENT");
  return opponentTag?.name ?? null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupGames(games: GameData[], groupBy: GroupBy): GameGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "", games }];
  }

  if (groupBy === "season") {
    const groups = new Map<string, GameData[]>();
    const labelMap = new Map<string, string>();

    for (const game of games) {
      const key = game.seasonId;
      const label = game.season?.name ?? "Unknown Season";
      if (!groups.has(key)) {
        groups.set(key, []);
        labelMap.set(key, label);
      }
      groups.get(key)!.push(game);
    }

    return Array.from(groups.entries()).map(([key, groupGames]) => ({
      key,
      label: labelMap.get(key) ?? "Unknown Season",
      games: groupGames,
    }));
  }

  if (groupBy === "opponent") {
    const groups = new Map<string, GameData[]>();

    for (const game of games) {
      const opponent = getOpponentName(game) ?? "No Opponent";
      if (!groups.has(opponent)) {
        groups.set(opponent, []);
      }
      groups.get(opponent)!.push(game);
    }

    return Array.from(groups.entries()).map(([opponent, groupGames]) => ({
      key: opponent,
      label: `vs. ${opponent}`,
      games: groupGames,
    }));
  }

  // "both" — group by season first, then by opponent within each season
  const seasonGroups = new Map<
    string,
    { label: string; opponentGroups: Map<string, GameData[]> }
  >();

  for (const game of games) {
    const seasonKey = game.seasonId;
    const seasonLabel = game.season?.name ?? "Unknown Season";
    const opponent = getOpponentName(game) ?? "No Opponent";

    if (!seasonGroups.has(seasonKey)) {
      seasonGroups.set(seasonKey, {
        label: seasonLabel,
        opponentGroups: new Map(),
      });
    }

    const season = seasonGroups.get(seasonKey)!;
    if (!season.opponentGroups.has(opponent)) {
      season.opponentGroups.set(opponent, []);
    }
    season.opponentGroups.get(opponent)!.push(game);
  }

  const result: GameGroup[] = [];
  for (const [seasonKey, season] of seasonGroups) {
    for (const [opponent, groupGames] of season.opponentGroups) {
      result.push({
        key: `${seasonKey}__${opponent}`,
        label: `${season.label} — vs. ${opponent}`,
        games: groupGames,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GameThumbnail({ videos }: { videos?: GameVideo[] }) {
  const hasVideo = videos && videos.length > 0;
  const thumbnailUrl = hasVideo
    ? videos.find((v) => v.thumbnailUrl)?.thumbnailUrl
    : null;

  if (thumbnailUrl) {
    return (
      <div className="relative rounded-lg overflow-hidden bg-muted shrink-0 w-32 h-18 sm:w-40 sm:h-22.5 group">
        <Image
          src={thumbnailUrl}
          alt={"Game thumbnail"}
          width={640}
          height={360}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="size-8 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="size-4 text-black fill-black ml-0.5" />
          </div>
        </div>
      </div>
    );
  }

  if (hasVideo) {
    return (
      <div className="relative rounded-lg overflow-hidden bg-muted shrink-0 w-32 h-18 sm:w-40 sm:h-22.5 flex items-center justify-center group">
        <Film className="size-6 text-muted-foreground" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="size-8 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="size-4 text-black fill-black ml-0.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/50 shrink-0 w-32 h-18 sm:w-40 sm:h-22.5 flex items-center justify-center">
      <Video className="size-6 text-muted-foreground" />
    </div>
  );
}

function VideoStatusLine({
  videos,
  isCoach,
  gameId,
}: {
  videos?: GameVideo[];
  isCoach: boolean;
  gameId: string;
}) {
  if (!videos || videos.length === 0) {
    if (!isCoach) {
      return (
        <span className="text-sm text-muted-foreground">No footage yet</span>
      );
    }
    return (
      <span className="text-sm text-muted-foreground">
        No footage yet{" "}
        <Link
          href={`/upload?gameId=${gameId}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Upload
        </Link>
      </span>
    );
  }

  const completedCount = videos.filter((v) => v.status === "COMPLETED").length;
  const processingVideo = videos.find((v) => v.status === "PROCESSING");
  const hasAiAnalysis = completedCount > 0;

  if (processingVideo) {
    return (
      <div className="space-y-1.5">
        <span className="text-sm text-muted-foreground">Processing...</span>
        <Progress value={65} className="h-1.5 w-48" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">
        {videos.length} clip{videos.length !== 1 ? "s" : ""}
      </span>
      {hasAiAnalysis && (
        <span className="flex items-center gap-1 text-primary">
          <Check className="size-3.5" />
          AI analysis complete
        </span>
      )}
    </div>
  );
}

function GameCard({
  game,
  onDelete,
  isCoach,
}: {
  game: GameData;
  onDelete: (gameId: string) => void;
  isCoach: boolean;
}) {
  const router = useRouter();
  const hasCompletedVideo = game.videos?.some((v) => v.status === "COMPLETED");

  const metaParts: string[] = [];
  if (game.date) metaParts.push(formatDate(game.date));
  if (game.location) metaParts.push(game.location);
  if (game.season?.name) metaParts.push(game.season.name);

  return (
    <div
      className="flex gap-4 py-4 rounded-b-none hover:rounded-b-sm border-b border-border hover:bg-accent/50 transition-colors duration-150 cursor-pointer px-1 -mx-1 rounded-sm"
      onClick={() => router.push(`/games/${game.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/games/${game.id}`);
      }}
    >
      <GameThumbnail videos={game.videos} />

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <span className="text-base font-medium text-foreground truncate">
          {getOpponentName(game)
            ? `vs. ${getOpponentName(game)}`
            : game.title || (
                <span className="text-muted-foreground italic">
                  Untitled game
                </span>
              )}
        </span>

        {metaParts.length > 0 && (
          <span className="text-sm text-muted-foreground truncate">
            {metaParts.join(" \u00B7 ")}
          </span>
        )}

        <VideoStatusLine
          videos={game.videos}
          isCoach={isCoach}
          gameId={game.id}
        />
      </div>

      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {hasCompletedVideo && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full size-9"
            onClick={() => router.push(`/games/${game.id}`)}
          >
            <Play className="size-4" />
            <span className="sr-only">Play</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9">
              <MoreVertical className="size-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/games/${game.id}`)}>
              View game
            </DropdownMenuItem>
            {isCoach && (
              <>
                <DropdownMenuItem
                  onClick={() => router.push(`/upload?gameId=${game.id}`)}
                >
                  Upload video
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete game
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this game?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the game
                        {getOpponentName(game)
                          ? ` vs. ${getOpponentName(game)}`
                          : ` "${game.title}"`}{" "}
                        and all associated videos and analysis data. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(game.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardContent({
  initialGames,
  seasons,
  role,
  activeOrgId,
  seasonFilter,
}: {
  initialGames: GameData[];
  seasons: SeasonData[];
  role: string;
  activeOrgId: string;
  seasonFilter: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [games, setGames] = useState(initialGames);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const isCoach = isCoachRole(role);
  const activeUploadCount = useActiveUploadCount();
  const prevActiveCountRef = useRef(activeUploadCount);

  // Reload games from the API
  const reloadGames = useCallback(async () => {
    const seasonParam =
      seasonFilter !== "all" ? `?seasonId=${seasonFilter}` : "";
    const res = await fetch(
      `${API_URL}/orgs/${activeOrgId}/games${seasonParam}`,
      { credentials: "include" },
    );
    if (res.ok) {
      const data = await res.json();
      setGames(data.games || []);
    }
  }, [activeOrgId, seasonFilter]);

  // Refresh games when all uploads complete (active count drops to 0)
  useEffect(() => {
    const prevCount = prevActiveCountRef.current;
    prevActiveCountRef.current = activeUploadCount;

    if (prevCount > 0 && activeUploadCount === 0) {
      reloadGames();
    }
  }, [activeUploadCount, reloadGames]);

  // Sync with server-rendered data when initialGames changes
  useEffect(() => {
    setGames(initialGames);
  }, [initialGames]);

  const handleSeasonChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("season");
    } else {
      params.set("season", value);
    }
    router.push(`/dashboard?${params.toString()}`);
  };

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteGame = useCallback(
    async (gameId: string) => {
      setDeleteError(null);
      const res = await fetch(
        `${API_URL}/orgs/${activeOrgId}/games/${gameId}`,
        { method: "DELETE", credentials: "include" },
      );

      if (res.ok) {
        setGames((prev) => prev.filter((g) => g.id !== gameId));
      } else {
        setDeleteError("Failed to delete game. Please try again.");
      }
    },
    [activeOrgId],
  );

  // Grouped games (memoized to avoid recomputation on every render)
  const groups = useMemo(() => groupGames(games, groupBy), [games, groupBy]);

  // Quick stats
  const totalGames = games.length;
  const totalClips = games.reduce((sum, g) => sum + (g.videos?.length || 0), 0);
  const analyzedCount = games.filter((g) =>
    g.videos?.some((v) => v.status === "COMPLETED"),
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Games</h1>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Group by selector */}
          {games.length > 0 && (
            <Select
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as GroupBy)}
            >
              <SelectTrigger className="w-36 h-9">
                <Layers className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group</SelectItem>
                <SelectItem value="season">By season</SelectItem>
                <SelectItem value="opponent">By opponent</SelectItem>
                <SelectItem value="both">Season + opponent</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Season filter */}
          {seasons.length > 0 && (
            <Select value={seasonFilter} onValueChange={handleSeasonChange}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="All seasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All seasons</SelectItem>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isCoach && (
            <Button onClick={() => router.push("/upload")} className="gap-2">
              <Upload className="size-4" />
              <span className="hidden sm:inline">Upload video</span>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats Bar */}
      {totalGames > 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          {totalGames} game{totalGames !== 1 ? "s" : ""}
          {totalClips > 0 && (
            <>
              {" \u00B7 "}
              {totalClips} clip{totalClips !== 1 ? "s" : ""}
            </>
          )}
          {analyzedCount > 0 && (
            <>
              {" \u00B7 "}
              {analyzedCount} analyzed
            </>
          )}
        </p>
      )}

      {/* Delete Error Banner */}
      {deleteError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="ml-4 text-destructive/70 hover:text-destructive"
            aria-label="Dismiss error"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Game List */}
      {games.length === 0 ? (
        <Empty className="min-h-100">
          <EmptyMedia>
            <Video className="size-16 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No games yet</EmptyTitle>
            {isCoach && (
              <EmptyDescription>
                Upload your first game footage to get started. FUDL will provide
                you with AI-powered analysis.
              </EmptyDescription>
            )}
          </EmptyHeader>
          <EmptyContent>
            {isCoach ? (
              <>
                <Button
                  onClick={() => router.push("/upload")}
                  className="gap-2"
                >
                  <Upload className="size-4" />
                  Upload video
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/upload")}
                  className="gap-2"
                >
                  <Plus className="size-4" />
                  Create a game
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your coach hasn&apos;t uploaded any game footage yet.
              </p>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              {/* Section header (only shown when grouping is active) */}
              {groupBy !== "none" && (
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {group.label}
                  </h2>
                  <span className="text-xs text-muted-foreground/60">
                    {group.games.length} game
                    {group.games.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div>
                {group.games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onDelete={handleDeleteGame}
                    isCoach={isCoach}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
