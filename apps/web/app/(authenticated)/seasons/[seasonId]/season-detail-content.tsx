"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { isCoachRole } from "@repo/types";
import {
  updateSeasonSchema,
  type UpdateSeasonValues,
} from "@repo/types/validations";
import { useActiveUploadCount } from "../../../lib/upload-store";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Separator } from "@repo/ui/components/separator";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Progress } from "@repo/ui/components/progress";
import {
  ArrowLeft,
  Calendar,
  Check,
  Film,
  Layers,
  MoreVertical,
  Pencil,
  Play,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GameVideo {
  id: string;
  status: string;
  thumbnailUrl?: string | null;
}

interface TagData {
  id: string;
  name: string;
  category: string;
}

interface GameData {
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

interface SeasonDetailData {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  games: GameData[];
  _count: { games: number };
}

type GroupBy = "none" | "opponent";

interface GameGroup {
  key: string;
  label: string;
  games: GameData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOpponentName(game: GameData): string | null {
  const opponentTag = game.tags?.find((tag) => tag.category === "OPPONENT");
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

function formatDateRange(
  startDate: string | null,
  endDate: string | null,
): string {
  if (!startDate && !endDate) return "";
  if (startDate && endDate)
    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  if (startDate) return `From ${formatDate(startDate)}`;
  return `Until ${formatDate(endDate)}`;
}

function parseDateString(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function dateToDateString(date: Date | null): string | undefined {
  if (!date) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupGames(games: GameData[], groupBy: GroupBy): GameGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "", games }];
  }

  // Group by opponent
  const groups = new Map<string, GameData[]>();

  for (const game of games) {
    const opponent = getOpponentName(game) ?? "No Opponent";
    if (!groups.has(opponent)) {
      groups.set(opponent, []);
    }
    groups.get(opponent)!.push(game);
  }

  return Array.from(groups.entries()).map(([opponent, groupedGames]) => ({
    key: opponent,
    label: `vs. ${opponent}`,
    games: groupedGames,
  }));
}

// ---------------------------------------------------------------------------
// Edit Season Dialog
// ---------------------------------------------------------------------------

function EditSeasonDialog({
  season,
  orgId,
  onUpdated,
}: {
  season: SeasonDetailData;
  orgId: string;
  onUpdated: (season: SeasonDetailData) => void;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateSeasonValues>({
    resolver: standardSchemaResolver(updateSeasonSchema),
    defaultValues: {
      name: season.name,
      startDate: dateToDateString(parseDateString(season.startDate)),
      endDate: dateToDateString(parseDateString(season.endDate)),
    },
  });

  const onSubmit = async (values: UpdateSeasonValues) => {
    const body: Record<string, string | null> = {};
    if (values.name !== undefined) body.name = values.name ?? null;
    body.startDate = values.startDate || null;
    body.endDate = values.endDate || null;

    const res = await fetch(`${API_URL}/orgs/${orgId}/seasons/${season.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      const message = err?.message || err?.error || "Failed to update season";
      setError("root", { message });
      return;
    }

    const data = await res.json();
    onUpdated({ ...season, ...data.season });
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      reset({
        name: season.name,
        startDate: dateToDateString(parseDateString(season.startDate)),
        endDate: dateToDateString(parseDateString(season.endDate)),
      });
    }
    setOpen(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit season</DialogTitle>
            <DialogDescription>Update the season details.</DialogDescription>
          </DialogHeader>

          {errors.root && (
            <p className="text-sm text-destructive px-1 pt-2">
              {errors.root.message}
            </p>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-season-name">Name</Label>
              <Input id="edit-season-name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start date</Label>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker
                      value={parseDateString(field.value)}
                      onChange={(date) => {
                        field.onChange(dateToDateString(date) ?? "");
                      }}
                      placeholder="Start date"
                      dateFormat="MMM d, yyyy"
                    />
                  )}
                />
              </div>
              <div className="grid gap-2">
                <Label>End date</Label>
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <DatePicker
                      value={parseDateString(field.value)}
                      onChange={(date) => {
                        field.onChange(dateToDateString(date) ?? "");
                      }}
                      placeholder="End date"
                      dateFormat="MMM d, yyyy"
                    />
                  )}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Game sub-components (match dashboard pattern)
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
          alt="Game thumbnail"
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
// Main Component
// ---------------------------------------------------------------------------

export function SeasonDetailContent({
  season: initialSeason,
  role,
  activeOrgId,
}: {
  season: SeasonDetailData;
  role: string;
  activeOrgId: string;
}) {
  const router = useRouter();
  const [season, setSeason] = useState<SeasonDetailData>(initialSeason);
  const [games, setGames] = useState<GameData[]>(initialSeason.games);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isCoach = isCoachRole(role);
  const activeUploadCount = useActiveUploadCount();
  const prevActiveCountRef = useRef(activeUploadCount);

  const dateRange = formatDateRange(season.startDate, season.endDate);
  const gameCount = games.length;

  // Reload season data from API
  const reloadSeason = useCallback(async () => {
    const res = await fetch(
      `${API_URL}/orgs/${activeOrgId}/seasons/${season.id}`,
      { credentials: "include" },
    );
    if (res.ok) {
      const data = await res.json();
      if (data.season) {
        setSeason(data.season);
        setGames(data.season.games || []);
      }
    }
  }, [activeOrgId, season.id]);

  // Refresh when all uploads complete
  useEffect(() => {
    const prevCount = prevActiveCountRef.current;
    prevActiveCountRef.current = activeUploadCount;

    if (prevCount > 0 && activeUploadCount === 0) {
      reloadSeason();
    }
  }, [activeUploadCount, reloadSeason]);

  const handleSeasonUpdated = useCallback((updated: SeasonDetailData) => {
    setSeason(updated);
  }, []);

  const handleDeleteSeason = useCallback(async () => {
    const res = await fetch(
      `${API_URL}/orgs/${activeOrgId}/seasons/${season.id}`,
      { method: "DELETE", credentials: "include" },
    );

    if (res.ok) {
      router.push("/seasons");
    } else {
      const err = await res.json().catch(() => null);
      setDeleteError(err?.message || err?.error || "Failed to delete season");
    }
  }, [activeOrgId, season.id, router]);

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

  // Grouped games
  const groups = useMemo(() => groupGames(games, groupBy), [games, groupBy]);

  // Quick stats
  const totalFootage = games.reduce(
    (sum, g) => sum + (g.videos?.length || 0),
    0,
  );
  const analyzedCount = games.filter((g) =>
    g.videos?.some((v) => v.status === "COMPLETED"),
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-16">
      {/* Back link */}
      <Link
        href="/seasons"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="size-3.5" />
        All seasons
      </Link>

      {/* Season header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="shrink-0 size-10 rounded-md bg-primary/10 flex items-center justify-center">
              <Calendar className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight truncate">
                {season.name}
              </h1>
              {dateRange && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {dateRange}
                </p>
              )}
            </div>
          </div>
        </div>

        {isCoach && (
          <div className="flex items-center gap-2 shrink-0">
            <EditSeasonDialog
              season={season}
              orgId={activeOrgId}
              onUpdated={handleSeasonUpdated}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={gameCount > 0}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete &ldquo;{season.name}&rdquo;?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {gameCount > 0
                      ? `This season has ${gameCount} game${gameCount !== 1 ? "s" : ""}. You must move or delete all games before deleting the season.`
                      : "This will permanently delete this season. This action cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteSeason}
                    disabled={gameCount > 0}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="text-sm text-muted-foreground mb-6">
        {gameCount} game{gameCount !== 1 ? "s" : ""}
        {totalFootage > 0 && (
          <>
            {" \u00B7 "}
            {totalFootage} footage file{totalFootage !== 1 ? "s" : ""}
          </>
        )}
        {analyzedCount > 0 && (
          <>
            {" \u00B7 "}
            {analyzedCount} analyzed
          </>
        )}
      </div>

      <Separator className="mb-6" />

      {/* Delete error banner */}
      {deleteError && (
        <div className="flex items-center justify-between gap-2 mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{deleteError}</p>
          <button
            type="button"
            className="shrink-0 text-destructive hover:text-destructive/80"
            onClick={() => setDeleteError(null)}
            aria-label="Dismiss error"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Games section header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-medium">Games</h2>

        <div className="flex items-center gap-2">
          {games.length > 1 && (
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
                <SelectItem value="opponent">By opponent</SelectItem>
              </SelectContent>
            </Select>
          )}

          {isCoach && (
            <Button
              size="sm"
              onClick={() => router.push("/upload")}
              className="gap-1.5"
            >
              <Upload className="size-3.5" />
              <span className="hidden sm:inline">Upload footage</span>
            </Button>
          )}
        </div>
      </div>

      {/* Game list */}
      {games.length === 0 ? (
        <Empty className="min-h-75">
          <EmptyMedia>
            <Video className="size-16 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No games in this season</EmptyTitle>
            <EmptyDescription>
              {isCoach
                ? "Upload game footage to add games to this season."
                : "Your coach hasn't added any games to this season yet."}
            </EmptyDescription>
          </EmptyHeader>
          {isCoach && (
            <EmptyContent>
              <Button onClick={() => router.push("/upload")} className="gap-2">
                <Upload className="size-4" />
                Upload video
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              {groupBy !== "none" && (
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {group.label}
                  </h3>
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
