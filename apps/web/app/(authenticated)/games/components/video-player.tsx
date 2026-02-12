"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { Spinner } from "@repo/ui/components/spinner";
import { PlayerControls } from "./player-controls";
import { usePlayer } from "./use-player";
import type { AngleOption } from "./player-controls";

export interface VideoData {
  id: string;
  title: string;
  status: string;
  mimeType: string | null;
  fileSize: string | null;
  durationSecs: number | null;
  createdAt: string;
  thumbnailUrl: string | null;
  storageUrl: string | null;
  tags: Array<{ id: string; name: string; category: string }>;
}

interface VideoPlayerProps {
  /** All playable footage files for this game (each is a full recording from a different angle) */
  footageFiles: VideoData[];
  /** ID of the currently active footage file */
  activeVideoId: string;
  /** Called when the user switches camera angle (passes the video ID of the new angle) */
  onAngleChange: (videoId: string) => void;
  /** Ref for the canvas overlay (for future drawing) */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

const CONTROLS_HIDE_DELAY = 3000;

export function VideoPlayer({
  footageFiles,
  activeVideoId,
  onAngleChange,
  canvasRef: externalCanvasRef,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const resolvedCanvasRef = externalCanvasRef ?? internalCanvasRef;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { videoRef, state, actions, resetState } = usePlayer(containerRef);

  const [showControls, setShowControls] = useState(true);

  // Find the active footage file by ID
  const activeVideo = useMemo(
    () => footageFiles.find((v) => v.id === activeVideoId) ?? footageFiles[0],
    [footageFiles, activeVideoId],
  );

  const src = activeVideo?.storageUrl ?? "";
  const poster = activeVideo?.thumbnailUrl ?? undefined;

  // ---- Compute camera angles from footage files ----
  // Each footage file is a different angle/view of the same game
  const angles: AngleOption[] = useMemo(() => {
    const result: AngleOption[] = [];
    for (const video of footageFiles) {
      const angleTag = video.tags.find((t) => t.category === "CAMERA_ANGLE");
      result.push({
        videoId: video.id,
        tagId: angleTag?.id ?? null,
        tagName: angleTag?.name ?? video.title,
      });
    }
    return result;
  }, [footageFiles]);

  const activeAngle = useMemo(
    () => angles.find((a) => a.videoId === activeVideoId) ?? angles[0],
    [angles, activeVideoId],
  );

  // ---- Handle angle change (sync playback time across footage files) ----
  const pendingSeekRef = useRef<number | null>(null);

  const handleAngleChange = useCallback(
    (videoId: string) => {
      // Store current time before switching so we can seek to the same position
      const currentTime = videoRef.current?.currentTime ?? 0;
      pendingSeekRef.current = currentTime;
      onAngleChange(videoId);
    },
    [onAngleChange, videoRef],
  );

  // ---- Reset state and apply pending seek when source changes ----
  useEffect(() => {
    resetState();
    const el = videoRef.current;
    if (!el) return;

    function onLoaded() {
      if (pendingSeekRef.current !== null) {
        el!.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      }
    }

    el.addEventListener("loadedmetadata", onLoaded);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
    };
    // Re-run when the video src changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ---- Auto-hide controls ----
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (state.isPlaying) {
        setShowControls(false);
      }
    }, CONTROLS_HIDE_DELAY);
  }, [state.isPlaying]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  // Show controls when paused, start hide timer when playing
  useEffect(() => {
    if (!state.isPlaying) {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      scheduleHide();
    }
  }, [state.isPlaying, scheduleHide]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // ---- Canvas resize sync ----
  useEffect(() => {
    const container = containerRef.current;
    const canvas = resolvedCanvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [resolvedCanvasRef]);

  // ---- Click handlers ----
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContainerClick = useCallback(() => {
    // Single click = toggle play, double click = fullscreen
    // Use a timer to differentiate
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      actions.toggleFullscreen();
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        actions.togglePlay();
      }, 250);
    }
  }, [actions]);

  if (!activeVideo) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black rounded-lg overflow-hidden select-none group/player",
        state.isFullscreen && "rounded-none",
      )}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (state.isPlaying) setShowControls(false);
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full aspect-video object-contain bg-black"
        playsInline
        preload="metadata"
      />

      {/* Canvas overlay for future drawing annotations */}
      <canvas
        ref={resolvedCanvasRef}
        className="absolute inset-0 z-10 pointer-events-none"
      />

      {/* Interaction layer (click to play/pause, double-click fullscreen) */}
      <div
        className="absolute inset-0 z-20"
        onClick={handleContainerClick}
        role="button"
        tabIndex={-1}
        aria-label="Toggle playback"
      />

      {/* Loading spinner */}
      {state.isWaiting && (
        <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
          <Spinner className="size-10 text-white" />
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-30",
          "bg-gradient-to-t from-black/80 via-black/40 to-transparent",
          "pt-12 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onMouseMove={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <PlayerControls
          state={state}
          actions={actions}
          angles={angles}
          activeAngle={activeAngle ?? null}
          onAngleChange={handleAngleChange}
        />
      </div>
    </div>
  );
}
