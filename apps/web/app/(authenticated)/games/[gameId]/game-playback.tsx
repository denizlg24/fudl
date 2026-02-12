"use client";

import { useCallback, useMemo, useState } from "react";
import { isCoachRole } from "@repo/types";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Calendar, MapPin, Upload } from "lucide-react";
import Link from "next/link";
import { VideoPlayer } from "../components/video-player";
import { GameSidebar } from "../components/game-sidebar";
import type { VideoData } from "../components/video-player";
import type { SidebarGameData } from "../components/game-sidebar";

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
  role: string;
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

export function GamePlayback({ game, sidebarGames, role }: GamePlaybackProps) {
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

  const handleAngleChange = useCallback((videoId: string) => {
    setActiveVideoId(videoId);
  }, []);

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
            onAngleChange={handleAngleChange}
            role={role}
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
          onAngleChange={handleAngleChange}
          role={role}
          className="h-full"
        />
      </div>
    </div>
  );
}
