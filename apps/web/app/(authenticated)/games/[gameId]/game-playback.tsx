"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCoachRole } from "@repo/types";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Calendar, MapPin, Upload } from "lucide-react";
import Link from "next/link";
import { VideoPlayer } from "../components/video-player";
import { GameSidebar } from "../components/game-sidebar";
import type { VideoData } from "../components/video-player";
import type { SidebarGameData } from "../components/game-sidebar";
import type { ClipData } from "../components/clip-list";

interface GameDetailData {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  notes: string | null;
  seasonId: string;
  season: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string; category: string }>;
  videos: VideoData[];
  _count: { videos: number };
}

interface GamePlaybackProps {
  game: GameDetailData;
  sidebarGames: SidebarGameData[];
  initialClips: ClipData[];
  role: string;
  orgId: string;
}

function formatGameDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function GamePlayback({
  game,
  sidebarGames,
  initialClips,
  role,
  orgId,
}: GamePlaybackProps) {
  const isCoach = isCoachRole(role);

  // Filter to playable footage files (full game recordings from different angles)
  const footageFiles = useMemo(
    () =>
      game.videos.filter(
        (v) =>
          v.storageUrl && (v.status === "UPLOADED" || v.status === "COMPLETED"),
      ),
    [game.videos],
  );

  // Track which footage file is active by video ID (not index)
  const [activeVideoId, setActiveVideoId] = useState<string>(
    () => footageFiles[0]?.id ?? "",
  );

  // Derive the active footage file from the ID
  const activeVideo = useMemo(
    () => footageFiles.find((v) => v.id === activeVideoId) ?? footageFiles[0],
    [footageFiles, activeVideoId],
  );

  const handleAngleChange = useCallback(
    (videoId: string) => {
      setActiveVideoId(videoId);
      // activePlayNumber stays set — activeClip derivation recomputes automatically
      // If new angle has no variant for current play, exit play mode
    },
    [],
  );

  // Sidebar footage click — exits play mode so the user returns to full footage view
  const handleFootageSelect = useCallback((videoId: string) => {
    setActiveVideoId(videoId);
    setActivePlayNumber(null);
    setMarkIn(null);
    setMarkOut(null);
  }, []);

  // ---- Clip state ----
  const [clips, setClips] = useState<ClipData[]>(initialClips);
  // Default to first play if clips exist, otherwise full footage mode
  const [activePlayNumber, setActivePlayNumber] = useState<number | null>(
    () => {
      if (initialClips.length === 0) return null;
      const playNumbers = Array.from(new Set(initialClips.map((c) => c.playNumber)));
      playNumbers.sort((a, b) => a - b);
      return playNumbers[0] ?? null;
    },
  );
  const [markIn, setMarkIn] = useState<number | null>(null);
  const [markOut, setMarkOut] = useState<number | null>(null);

  // Round to 1 decimal place for clean values in number inputs
  const handleMarkIn = useCallback((time: number) => {
    setMarkIn(Math.round(time * 10) / 10);
  }, []);
  const handleMarkOut = useCallback((time: number) => {
    setMarkOut(Math.round(time * 10) / 10);
  }, []);

  // Derive active clip from activePlayNumber + activeVideoId
  const activeClip = useMemo(() => {
    if (!activePlayNumber) return null;
    // Prefer clip on current angle
    const onCurrentAngle = clips.find(
      (c) => c.playNumber === activePlayNumber && c.videoId === activeVideoId,
    );
    if (onCurrentAngle) return onCurrentAngle;
    // Fall back to first available angle
    return clips.find((c) => c.playNumber === activePlayNumber) ?? null;
  }, [clips, activePlayNumber, activeVideoId]);

  // Derive activeClipId for VideoPlayer's seek tracking
  const activeClipId = activeClip?.id ?? null;

  // Current time ref — updated by VideoPlayer via onTimeUpdate callback
  const currentTimeRef = useRef<number>(0);
  const handleTimeUpdate = useCallback((time: number) => {
    currentTimeRef.current = time;
  }, []);

  // ---- Unique sorted play numbers for navigation ----
  const sortedPlayNumbers = useMemo(() => {
    const nums = Array.from(new Set(clips.map((c) => c.playNumber)));
    nums.sort((a, b) => a - b);
    return nums;
  }, [clips]);

  // ---- Prev/next play navigation ----
  const hasPrevPlay = useMemo(() => {
    if (!activePlayNumber) return false;
    const idx = sortedPlayNumbers.indexOf(activePlayNumber);
    return idx > 0;
  }, [activePlayNumber, sortedPlayNumbers]);

  const hasNextPlay = useMemo(() => {
    if (!activePlayNumber) return false;
    const idx = sortedPlayNumbers.indexOf(activePlayNumber);
    return idx >= 0 && idx < sortedPlayNumbers.length - 1;
  }, [activePlayNumber, sortedPlayNumbers]);

  const navigatePlay = useCallback(
    (direction: "prev" | "next") => {
      if (sortedPlayNumbers.length === 0) return;

      if (!activePlayNumber) {
        // Select first or last
        const target =
          direction === "next"
            ? sortedPlayNumbers[0]
            : sortedPlayNumbers[sortedPlayNumbers.length - 1];
        if (target !== undefined) setActivePlayNumber(target);
        return;
      }

      const idx = sortedPlayNumbers.indexOf(activePlayNumber);
      if (idx === -1) return;

      const nextIdx = direction === "next" ? idx + 1 : idx - 1;
      const target = sortedPlayNumbers[nextIdx];
      if (target !== undefined) {
        setActivePlayNumber(target);
        // Check if we need to switch angle
        const onCurrentAngle = clips.find(
          (c) => c.playNumber === target && c.videoId === activeVideoId,
        );
        if (!onCurrentAngle) {
          // Switch to first angle that has this play
          const anyVariant = clips.find((c) => c.playNumber === target);
          if (anyVariant) {
            setActiveVideoId(anyVariant.videoId);
          }
        }
      }
    },
    [sortedPlayNumbers, activePlayNumber, clips, activeVideoId],
  );

  // ---- Clip mutation handlers (optimistic) ----
  const handleClipCreated = useCallback((clip: ClipData) => {
    setClips((prev) => {
      const next = [...prev, clip];
      next.sort((a, b) => a.playNumber - b.playNumber || a.startTime - b.startTime);
      return next;
    });
    // Clear marks after creation
    setMarkIn(null);
    setMarkOut(null);
  }, []);

  const handleClipUpdated = useCallback((updated: ClipData) => {
    setClips((prev) => {
      const next = prev.map((c) => (c.id === updated.id ? updated : c));
      next.sort((a, b) => a.playNumber - b.playNumber || a.startTime - b.startTime);
      return next;
    });
  }, []);

  const handleClipDeleted = useCallback(
    (clipId: string) => {
      setClips((prev) => {
        const next = prev.filter((c) => c.id !== clipId);
        // If deleting the last variant of the active play, clear
        if (activePlayNumber !== null) {
          const remainingForPlay = next.filter(
            (c) => c.playNumber === activePlayNumber,
          );
          if (remainingForPlay.length === 0) {
            // Schedule clearing outside of setState
            setTimeout(() => setActivePlayNumber(null), 0);
          }
        }
        return next;
      });
    },
    [activePlayNumber],
  );

  // ---- Play selection ----
  const handlePlaySelect = useCallback(
    (playNumber: number) => {
      // Find variant for this play on current angle
      const onCurrentAngle = clips.find(
        (c) => c.playNumber === playNumber && c.videoId === activeVideoId,
      );
      if (onCurrentAngle) {
        setActivePlayNumber(playNumber);
        return;
      }
      // Switch to first angle that has this play
      const anyVariant = clips.find((c) => c.playNumber === playNumber);
      if (anyVariant) {
        setActiveVideoId(anyVariant.videoId);
        setActivePlayNumber(playNumber);
      }
    },
    [clips, activeVideoId],
  );

  // ---- Keyboard shortcuts for clips ----
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "i":
        case "I":
          if (!isCoach) return;
          e.preventDefault();
          handleMarkIn(currentTimeRef.current);
          break;

        case "o":
        case "O":
          if (!isCoach) return;
          e.preventDefault();
          handleMarkOut(currentTimeRef.current);
          break;

        case "Escape":
          e.preventDefault();
          if (activePlayNumber) {
            setActivePlayNumber(null);
          }
          setMarkIn(null);
          setMarkOut(null);
          break;

        case "ArrowLeft":
          if (e.shiftKey) {
            e.preventDefault();
            navigatePlay("prev");
          }
          break;

        case "ArrowRight":
          if (e.shiftKey) {
            e.preventDefault();
            navigatePlay("next");
          }
          break;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isCoach, activePlayNumber, navigatePlay, handleMarkIn, handleMarkOut]);

  // ---- Seek bar click exits play mode if outside range ----
  const handleSeek = useCallback(
    (time: number) => {
      if (
        activeClip &&
        (time < activeClip.startTime || time > activeClip.endTime)
      ) {
        setActivePlayNumber(null);
      }
    },
    [activeClip],
  );

  // ---- When angle changes and no variant exists for current play, exit play mode ----
  useEffect(() => {
    if (!activePlayNumber) return;
    const hasVariant = clips.some(
      (c) => c.playNumber === activePlayNumber && c.videoId === activeVideoId,
    );
    const hasAnyVariant = clips.some(
      (c) => c.playNumber === activePlayNumber,
    );
    if (!hasVariant && !hasAnyVariant) {
      setActivePlayNumber(null);
    }
    // If variant exists on another angle but not current, activeClip derivation
    // handles the fallback — we don't exit play mode
  }, [activePlayNumber, activeVideoId, clips]);

  const opponentTag = game.tags.find((t) => t.category === "OPPONENT");
  const fieldTag = game.tags.find((t) => t.category === "FIELD");
  const displayTitle = opponentTag ? `vs. ${opponentTag.name}` : game.title;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Main player area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* Game info header */}
        <div className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-semibold">{displayTitle}</h1>
            {game.season && (
              <Badge variant="secondary" className="text-xs">
                {game.season.name}
              </Badge>
            )}
            <div className="flex-1" />
            {isCoach && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/upload?gameId=${game.id}`}>
                  <Upload className="size-3.5 mr-1.5" />
                  Upload footage
                </Link>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {game.date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {formatGameDate(game.date)}
              </span>
            )}
            {game.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {game.location}
              </span>
            )}
            {fieldTag && (
              <Badge variant="outline" className="text-xs">
                {fieldTag.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Video player */}
        <div className="flex items-center justify-center p-4 bg-black/5 dark:bg-black/20 shrink-0">
          {footageFiles.length > 0 && activeVideo ? (
            <div className="w-full max-w-5xl">
              <VideoPlayer
                footageFiles={footageFiles}
                activeVideoId={activeVideo.id}
                onAngleChange={handleAngleChange}
                onTimeUpdate={handleTimeUpdate}
                onSeek={handleSeek}
                activeClip={activeClip}
                markIn={markIn}
                markOut={markOut}
                clips={clips}
                activeClipId={activeClipId}
                isCoach={isCoach}
                orgId={orgId}
                activeVideoIdForClip={activeVideoId}
                onMarkIn={handleMarkIn}
                onMarkOut={handleMarkOut}
                onClipCreated={handleClipCreated}
                onClearMarks={() => {
                  setMarkIn(null);
                  setMarkOut(null);
                }}
                hasPrevPlay={hasPrevPlay}
                hasNextPlay={hasNextPlay}
                onPrevPlay={() => navigatePlay("prev")}
                onNextPlay={() => navigatePlay("next")}
              />
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-20">
              <p className="text-lg font-medium">No playable footage</p>
              <p className="text-sm mt-1">
                {game.videos.length > 0
                  ? "Footage is still uploading or processing."
                  : "No footage has been uploaded for this game yet."}
              </p>
              {isCoach && game.videos.length === 0 && (
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href={`/upload?gameId=${game.id}`}>
                    <Upload className="size-3.5 mr-1.5" />
                    Upload footage
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Mobile sidebar — rendered below the player on small screens */}
        <div className="lg:hidden shrink-0">
          <GameSidebar
            allGames={sidebarGames}
            currentGameId={game.id}
            footageFiles={footageFiles}
            activeVideoId={activeVideo?.id ?? null}
            onAngleChange={handleFootageSelect}
            role={role}
            clips={clips}
            activePlayNumber={activePlayNumber}
            onPlaySelect={handlePlaySelect}
            onClipUpdated={handleClipUpdated}
            onClipDeleted={handleClipDeleted}
            orgId={orgId}
            className="border-l-0 border-t"
          />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-80 shrink-0">
        <GameSidebar
          allGames={sidebarGames}
          currentGameId={game.id}
          footageFiles={footageFiles}
          activeVideoId={activeVideo?.id ?? null}
          onAngleChange={handleFootageSelect}
          role={role}
          clips={clips}
          activePlayNumber={activePlayNumber}
          onPlaySelect={handlePlaySelect}
          onClipUpdated={handleClipUpdated}
          onClipDeleted={handleClipDeleted}
          orgId={orgId}
          className="h-full"
        />
      </div>
    </div>
  );
}
