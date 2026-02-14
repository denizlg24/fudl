"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { Spinner } from "@repo/ui/components/spinner";
import { Separator } from "@repo/ui/components/separator";
import { PlayerControls } from "./player-controls";
import { ClipMarkControls } from "./clip-mark-controls";
import { usePlayer } from "./use-player";
import { renderAnnotation, clearCanvas } from "./annotation-renderer";
import type { AngleOption } from "./player-controls";
import type { ClipData } from "./clip-list";
import type { AnnotationData, AnnotationElement } from "@repo/types";

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
  /** Called on every timeupdate — reports current playback time */
  onTimeUpdate?: (time: number) => void;
  /** Called when the user seeks — used to exit clip mode if seeking outside range */
  onSeek?: (time: number) => void;
  /** Currently active clip for playback constraints (seek-to-start, auto-pause-at-end) */
  activeClip?: { startTime: number; endTime: number } | null;
  /** Mark-in time for clip creation */
  markIn?: number | null;
  /** Mark-out time for clip creation */
  markOut?: number | null;
  /** All clips for the game (displayed as indicators on the seek bar) */
  clips?: ClipData[];
  /** ID of the currently active clip */
  activeClipId?: string | null;
  /** Whether the user is a coach (enables mark controls) */
  isCoach?: boolean;
  /** Organization ID (for clip creation API calls) */
  orgId?: string;
  /** Active video ID for clip creation */
  activeVideoIdForClip?: string;
  /** Set mark-in callback */
  onMarkIn?: (time: number) => void;
  /** Set mark-out callback */
  onMarkOut?: (time: number) => void;
  /** Called when a clip is created */
  onClipCreated?: (clip: ClipData) => void;
  /** Clear marks callback */
  onClearMarks?: () => void;
  /** Whether there is a previous play to navigate to */
  hasPrevPlay?: boolean;
  /** Whether there is a next play to navigate to */
  hasNextPlay?: boolean;
  /** Navigate to previous play */
  onPrevPlay?: () => void;
  /** Navigate to next play */
  onNextPlay?: () => void;
  /** Ref for the canvas overlay (for future drawing) */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Whether annotation drawing mode is active */
  annotationMode?: boolean;
  /** Annotations for the current video (for keyframe indicators on seek bar) */
  annotations?: AnnotationData[];
  /** Currently displayed saved annotation (paused at keyframe) */
  activeAnnotation?: AnnotationData | null;
  /** Called when the active annotation should be cleared (e.g. user resumes playback) */
  onDismissAnnotation?: () => void;
  /** Slot for the annotation toolbar (rendered above controls when in annotation mode) */
  annotationToolbar?: React.ReactNode;
  /** Slot for text input overlay during annotation (positioned over canvas) */
  annotationTextInput?: React.ReactNode;
  /** Imperative ref — VideoPlayer writes its seek function here so the parent can trigger programmatic seeks */
  seekRef?: React.MutableRefObject<((time: number) => void) | null>;
}

const CONTROLS_HIDE_DELAY = 3000;

export function VideoPlayer({
  footageFiles,
  activeVideoId,
  onAngleChange,
  onTimeUpdate,
  onSeek,
  activeClip,
  markIn,
  markOut,
  clips,
  activeClipId,
  isCoach,
  orgId,
  activeVideoIdForClip,
  onMarkIn,
  onMarkOut,
  onClipCreated,
  onClearMarks,
  hasPrevPlay = false,
  hasNextPlay = false,
  onPrevPlay,
  onNextPlay,
  canvasRef: externalCanvasRef,
  annotationMode = false,
  annotations,
  activeAnnotation,
  onDismissAnnotation,
  annotationToolbar,
  annotationTextInput,
  seekRef,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const resolvedCanvasRef = externalCanvasRef ?? internalCanvasRef;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { videoRef, state, actions, resetState } = usePlayer(containerRef);

  const [showControls, setShowControls] = useState(true);
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);

  // Find the active footage file by ID
  const activeVideo = useMemo(
    () => footageFiles.find((v) => v.id === activeVideoId) ?? footageFiles[0],
    [footageFiles, activeVideoId],
  );

  const src = activeVideo?.storageUrl ?? "";
  const poster = activeVideo?.thumbnailUrl ?? undefined;

  // ---- Expose imperative seek to parent ----
  useEffect(() => {
    if (!seekRef) {
      return;
    }

    seekRef.current = actions.seek;

    return () => {
      if (seekRef) {
        seekRef.current = null;
      }
    };
  }, [seekRef, actions.seek]);

  // ---- Report time updates to parent via direct event listener ----
  // Using a ref + native listener avoids cascading re-renders from useEffect on state.currentTime
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    function handleTime() {
      onTimeUpdateRef.current?.(el!.currentTime);
    }

    el.addEventListener("timeupdate", handleTime);
    return () => el.removeEventListener("timeupdate", handleTime);
  }, [videoRef, src]); // re-attach when video source changes

  // ---- Compute camera angles from footage files ----
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
  const autoPlayOnLoadRef = useRef(false);

  const handleAngleChange = useCallback(
    (videoId: string) => {
      // In play mode, seek to clip start on the new angle;
      // in free mode, sync current playback position
      pendingSeekRef.current = activeClip
        ? activeClip.startTime
        : (videoRef.current?.currentTime ?? 0);
      autoPlayOnLoadRef.current = !!activeClip;
      setIsSwitchingSource(true);
      onAngleChange(videoId);
    },
    [onAngleChange, videoRef, activeClip],
  );

  // ---- Reset state and apply pending seek when source changes ----
  useEffect(() => {
    resetState();
    const el = videoRef.current;
    if (!el) return;

    function onSeeked() {
      setIsSwitchingSource(false);
      el!.removeEventListener("seeked", onSeeked);
    }

    function onLoaded() {
      if (pendingSeekRef.current !== null) {
        el!.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
        // Wait for the seek to complete before showing the video
        el!.addEventListener("seeked", onSeeked);
      } else {
        setIsSwitchingSource(false);
      }
      if (autoPlayOnLoadRef.current) {
        el!.play().catch(() => {});
        autoPlayOnLoadRef.current = false;
      }
    }

    el.addEventListener("loadedmetadata", onLoaded);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("seeked", onSeeked);
    };
    // Re-run when the video src changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ---- Clip playback: seek to clip start when active clip changes ----
  const prevClipIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeClip || activeClipId === prevClipIdRef.current) return;
    prevClipIdRef.current = activeClipId ?? null;

    const el = videoRef.current;
    if (!el) return;

    if (el.readyState >= 1) {
      // Video already loaded — seek directly
      el.currentTime = activeClip.startTime;
      el.play().catch(() => {});
    } else {
      // Video still loading (angle switch) — override pending seek
      pendingSeekRef.current = activeClip.startTime;
      autoPlayOnLoadRef.current = true;
    }
  }, [activeClip, activeClipId, videoRef]);

  // ---- Clip playback: auto-pause at clip end ----
  useEffect(() => {
    if (
      activeClip &&
      state.isPlaying &&
      state.currentTime >= activeClip.endTime
    ) {
      actions.pause();
    }
  }, [activeClip, state.isPlaying, state.currentTime, actions]);

  // ---- Seek callback wrapper ----
  const handleSeekChange = useCallback(
    (time: number) => {
      actions.seek(time);
      onSeek?.(time);
    },
    [actions, onSeek],
  );

  // ---- Pause when annotation mode activates ----
  useEffect(() => {
    if (annotationMode && state.isPlaying) {
      actions.pause();
    }
  }, [annotationMode, state.isPlaying, actions]);

  // ---- Pause and render when activeAnnotation is set (playback hit keyframe) ----
  const prevAnnotationIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newId = activeAnnotation?.id ?? null;
    // Only act when the annotation actually changes
    if (newId === prevAnnotationIdRef.current) return;
    prevAnnotationIdRef.current = newId;

    if (activeAnnotation) {
      actions.pause();
      // Render the saved annotation on the canvas
      const canvas = resolvedCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          clearCanvas(ctx, canvas.width, canvas.height);
          renderAnnotation(
            ctx,
            activeAnnotation.data.elements as AnnotationElement[],
            canvas.width,
            canvas.height,
          );
        }
      }
    } else {
      // Clear canvas when annotation is dismissed (unless annotation mode is active)
      if (!annotationMode) {
        const canvas = resolvedCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) clearCanvas(ctx, canvas.width, canvas.height);
        }
      }
    }
  }, [activeAnnotation, annotationMode, actions, resolvedCanvasRef]);

  // ---- Clear active annotation when user resumes playback ----
  const prevIsPlayingRef = useRef(false);
  useEffect(() => {
    // Detect transition from paused → playing while an annotation is shown
    if (state.isPlaying && !prevIsPlayingRef.current && activeAnnotation) {
      onDismissAnnotation?.();
    }
    prevIsPlayingRef.current = state.isPlaying;
  }, [state.isPlaying, activeAnnotation, onDismissAnnotation]);

  // ---- Auto-hide controls ----
  // Keep controls pinned while the user is marking a clip (markIn is set)
  const isMarking = markIn != null;

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isMarking || annotationMode || activeAnnotation) return;
    hideTimerRef.current = setTimeout(() => {
      if (state.isPlaying) {
        setShowControls(false);
      }
    }, CONTROLS_HIDE_DELAY);
  }, [state.isPlaying, isMarking, annotationMode, activeAnnotation]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  // Show controls when paused, marking, annotating, or showing annotation
  useEffect(() => {
    if (!state.isPlaying || isMarking || annotationMode || activeAnnotation) {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      scheduleHide();
    }
  }, [state.isPlaying, isMarking, annotationMode, activeAnnotation, scheduleHide]);

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
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, [actions]);

  // ---- Build clip mark controls slot ----
  const clipMarkControlsNode =
    isCoach && orgId && activeVideoIdForClip && onMarkIn && onMarkOut && onClipCreated && onClearMarks ? (
      <>
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ClipMarkControls
          markIn={markIn ?? null}
          markOut={markOut ?? null}
          onMarkIn={onMarkIn}
          onMarkOut={onMarkOut}
          onClearMarks={onClearMarks}
          onClipCreated={onClipCreated}
          currentTime={state.currentTime}
          videoId={activeVideoIdForClip}
          orgId={orgId}
          existingClips={clips ?? []}
        />
      </>
    ) : null;

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
        className={cn(
          "w-full aspect-video object-contain bg-black",
          isSwitchingSource && "invisible",
        )}
        playsInline
        preload="metadata"
      />

      {/* Canvas overlay for annotations/drawing */}
      <canvas
        ref={resolvedCanvasRef}
        className={cn(
          "absolute inset-0",
          annotationMode
            ? annotationTextInput
              ? "z-30 pointer-events-none"
              : "z-30 pointer-events-auto cursor-crosshair"
            : "z-10 pointer-events-none",
        )}
      />

      {/* Annotation text input overlay (positioned above canvas in annotation mode) */}
      {annotationMode && annotationTextInput}

      {/* Interaction layer (click to play/pause, double-click fullscreen) */}
      <div
        className={cn(
          "absolute inset-0 z-20",
          annotationMode && "pointer-events-none",
        )}
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

      {/* Annotation toolbar — above controls when in annotation mode */}
      {annotationMode && annotationToolbar && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-40"
          onClick={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
        >
          {annotationToolbar}
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
          onSeek={handleSeekChange}
          markIn={markIn ?? null}
          markOut={markOut ?? null}
          clips={clips ?? []}
          activeClipId={activeClipId ?? null}
          activeClip={activeClip ?? null}
          hasPrevPlay={hasPrevPlay}
          hasNextPlay={hasNextPlay}
          onPrevPlay={onPrevPlay ?? (() => {})}
          onNextPlay={onNextPlay ?? (() => {})}
          clipMarkControls={clipMarkControlsNode}
          annotations={annotations}
        />
      </div>
    </div>
  );
}
