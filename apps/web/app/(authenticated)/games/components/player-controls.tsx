"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@repo/ui/components/button";
import { Slider } from "@repo/ui/components/slider";
import { Separator } from "@repo/ui/components/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { Kbd } from "@repo/ui/components/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Gauge,
  Camera,
} from "lucide-react";
import type { PlayerState, PlayerActions } from "./use-player";
import type { ClipData } from "./clip-list";
import type { AnnotationData } from "@repo/types";

/** Format seconds to mm:ss or h:mm:ss */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface AngleOption {
  /** Video (footage file) ID */
  videoId: string;
  /** Camera angle tag ID, or null if no angle tag is assigned */
  tagId: string | null;
  /** Display name — camera angle tag name, or video title as fallback */
  tagName: string;
}

interface PlayerControlsProps {
  state: PlayerState;
  actions: PlayerActions;
  /** Available camera angles (one per footage file) */
  angles: AngleOption[];
  /** Currently active angle, or null */
  activeAngle: AngleOption | null;
  /** Called when angle is changed — passes the video ID */
  onAngleChange: (videoId: string) => void;
  /** Called when the user seeks via the seek bar */
  onSeek?: (time: number) => void;
  /** Mark-in position (for seek bar indicator) */
  markIn: number | null;
  /** Mark-out position (for seek bar indicator) */
  markOut: number | null;
  /** All clips (for seek bar indicators) */
  clips: ClipData[];
  /** Active clip ID (for highlighting in seek bar) */
  activeClipId: string | null;
  /** Active clip boundaries for scoped playback */
  activeClip: { startTime: number; endTime: number } | null;
  /** Whether there is a previous play to navigate to */
  hasPrevPlay: boolean;
  /** Whether there is a next play to navigate to */
  hasNextPlay: boolean;
  /** Navigate to previous play */
  onPrevPlay: () => void;
  /** Navigate to next play */
  onNextPlay: () => void;
  /** Slot for clip mark controls (rendered between play controls and time) */
  clipMarkControls?: ReactNode;
  /** Annotations for the current video (displayed as keyframe markers on seek bar) */
  annotations?: AnnotationData[];
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function PlayerControls({
  state,
  actions,
  angles,
  activeAngle,
  onAngleChange,
  onSeek,
  markIn,
  markOut,
  clips,
  activeClipId,
  activeClip,
  hasPrevPlay,
  hasNextPlay,
  onPrevPlay,
  onNextPlay,
  clipMarkControls,
  annotations,
}: PlayerControlsProps) {
  const [isSeekDragging, setIsSeekDragging] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  // In clip mode, show clip-relative time and seek bar
  const inClipMode = !!activeClip;
  const clipDuration = inClipMode
    ? activeClip.endTime - activeClip.startTime
    : 0;

  const rawDisplayTime = seekPreview ?? state.currentTime;
  const duration = state.duration || 1;

  // Clip-relative values
  const clipCurrentTime = inClipMode
    ? Math.max(0, Math.min(rawDisplayTime - activeClip.startTime, clipDuration))
    : 0;

  // Display values: clip-scoped or full video
  const displayTime = inClipMode ? clipCurrentTime : rawDisplayTime;
  const displayDuration = inClipMode ? clipDuration : state.duration;
  const seekMin = 0;
  const seekMax = inClipMode ? clipDuration : state.duration || 1;
  const seekValue = inClipMode ? clipCurrentTime : rawDisplayTime;

  // Buffer bar in clip mode: map to clip-relative range
  const bufferPercent = inClipMode
    ? (() => {
        const bufferedAbs = (state.bufferedPercent / 100) * duration;
        const bufferedInClip = Math.max(
          0,
          Math.min(bufferedAbs - activeClip.startTime, clipDuration),
        );
        return clipDuration > 0
          ? (bufferedInClip / clipDuration) * 100
          : 0;
      })()
    : state.bufferedPercent;

  const onSeekChange = useCallback(
    (values: number[]) => {
      const value = values[0] ?? 0;
      if (inClipMode) {
        // Translate clip-relative to absolute
        const absTime = activeClip!.startTime + value;
        setSeekPreview(absTime);
        if (!isSeekDragging) {
          if (onSeek) onSeek(absTime); else actions.seek(absTime);
          setSeekPreview(null);
        }
      } else {
        setSeekPreview(value);
        if (!isSeekDragging) {
          if (onSeek) onSeek(value); else actions.seek(value);
          setSeekPreview(null);
        }
      }
    },
    [actions, isSeekDragging, onSeek, inClipMode, activeClip],
  );

  const onSeekCommit = useCallback(
    (values: number[]) => {
      const value = values[0] ?? 0;
      if (inClipMode) {
        const absTime = activeClip!.startTime + value;
        if (onSeek) onSeek(absTime); else actions.seek(absTime);
      } else {
        if (onSeek) onSeek(value); else actions.seek(value);
      }
      setSeekPreview(null);
      setIsSeekDragging(false);
    },
    [actions, onSeek, inClipMode, activeClip],
  );

  const handleSkip = useCallback(
    (seconds: number) => {
      if (inClipMode) {
        // Clamp skip within clip boundaries
        const current = state.currentTime;
        const target = Math.max(
          activeClip!.startTime,
          Math.min(current + seconds, activeClip!.endTime),
        );
        actions.seek(target);
      } else {
        actions.skip(seconds);
      }
    },
    [actions, state.currentTime, inClipMode, activeClip],
  );

  const VolumeIcon =
    state.isMuted || state.volume === 0
      ? VolumeX
      : state.volume < 0.5
        ? Volume1
        : Volume2;

  return (
    <div className="flex flex-col w-full gap-1">
      {/* Seek bar row */}
      <div className="group/seek relative px-2" ref={seekBarRef}>
        {/* Buffer bar (behind the seek bar) */}
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-muted overflow-hidden pointer-events-none">
          <div
            className="h-full bg-muted-foreground/30 transition-[width] duration-300 ease-out"
            style={{ width: `${bufferPercent}%` }}
          />
        </div>

        {/* In non-clip mode: show clip range indicators, mark indicators */}
        {!inClipMode && (
          <>
            {/* Clip range indicators (behind slider) */}
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-1.5 pointer-events-none">
              {clips.map((clip) => {
                const left = (clip.startTime / duration) * 100;
                const width =
                  ((clip.endTime - clip.startTime) / duration) * 100;
                const isActive = clip.id === activeClipId;
                return (
                  <div
                    key={clip.id}
                    className={
                      isActive
                        ? "absolute h-full bg-primary/50 rounded-full"
                        : "absolute h-full bg-muted-foreground/20 rounded-full"
                    }
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                );
              })}
            </div>

            {/* Mark range preview */}
            {markIn !== null && markOut !== null && markOut > markIn && (
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-1.5 pointer-events-none">
                <div
                  className="absolute h-full bg-primary/30 rounded-full"
                  style={{
                    left: `${(markIn / duration) * 100}%`,
                    width: `${((markOut - markIn) / duration) * 100}%`,
                  }}
                />
              </div>
            )}

            {/* Mark-in indicator (green line) */}
            {markIn !== null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-green-400 rounded-full pointer-events-none z-10"
                style={{
                  left: `calc(${(markIn / duration) * 100}% + 0.5rem)`,
                }}
              />
            )}

            {/* Mark-out indicator (red line) */}
            {markOut !== null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-red-400 rounded-full pointer-events-none z-10"
                style={{
                  left: `calc(${(markOut / duration) * 100}% + 0.5rem)`,
                }}
              />
            )}

            {/* Annotation keyframe diamond markers */}
            {annotations?.map((ann) => {
              const left = (ann.timestamp / duration) * 100;
              return (
                <div
                  key={ann.id}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2 rotate-45 bg-amber-400 rounded-[1px] pointer-events-none z-10"
                  style={{ left: `calc(${left}% + 0.5rem)` }}
                />
              );
            })}
          </>
        )}

        {/* Annotation keyframe markers in clip mode */}
        {inClipMode &&
          annotations
            ?.filter(
              (ann) =>
                ann.timestamp >= activeClip!.startTime &&
                ann.timestamp <= activeClip!.endTime,
            )
            .map((ann) => {
              const clipRelative = ann.timestamp - activeClip!.startTime;
              const left = (clipRelative / clipDuration) * 100;
              return (
                <div
                  key={ann.id}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2 rotate-45 bg-amber-400 rounded-[1px] pointer-events-none z-10"
                  style={{ left: `calc(${left}% + 0.5rem)` }}
                />
              );
            })}

        <Slider
          value={[seekValue]}
          min={seekMin}
          max={seekMax}
          step={0.1}
          onValueChange={onSeekChange}
          onValueCommit={onSeekCommit}
          onPointerDown={() => setIsSeekDragging(true)}
          className="relative z-10"
          aria-label="Seek"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-1 px-2 pb-1">
        {/* Left group: prev play + skip + play/pause + skip + next play */}
        <div className="flex items-center gap-0.5">
          {/* Prev play — only shown in clip mode */}
          {inClipMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onPrevPlay}
                  disabled={!hasPrevPlay}
                  aria-label="Previous play"
                >
                  <SkipBack className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Previous play <Kbd>Shift+←</Kbd>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleSkip(-5)}
                aria-label="Rewind 5 seconds"
              >
                <RotateCcw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              -5s <Kbd>J</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={actions.togglePlay}
                aria-label={state.isPlaying ? "Pause" : "Play"}
              >
                {state.isPlaying ? (
                  <Pause className="size-5" />
                ) : (
                  <Play className="size-5 ml-0.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {state.isPlaying ? "Pause" : "Play"} <Kbd>Space</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleSkip(5)}
                aria-label="Forward 5 seconds"
              >
                <RotateCw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              +5s <Kbd>L</Kbd>
            </TooltipContent>
          </Tooltip>

          {/* Next play — only shown in clip mode */}
          {inClipMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onNextPlay}
                  disabled={!hasNextPlay}
                  aria-label="Next play"
                >
                  <SkipForward className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Next play <Kbd>Shift+→</Kbd>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Clip mark controls slot (coach-only, hidden in clip mode) */}
        {!inClipMode && clipMarkControls}

        {/* Time display */}
        <span className="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap ml-1 select-none">
          {formatTime(displayTime)} / {formatTime(displayDuration)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right group: angle, speed, volume, fullscreen */}
        <div className="flex items-center gap-0.5">
          {/* Camera angle switcher — always visible when footage files exist */}
          {angles.length >= 1 && (
            <>
              {angles.length > 1 ? (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          aria-label="Camera angle"
                        >
                          <Camera className="size-3.5 mr-1" />
                          {activeAngle?.tagName ?? "Angle"}
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">Camera angle</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Camera Angle</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={activeAngle?.videoId ?? ""}
                      onValueChange={onAngleChange}
                    >
                      {angles.map((angle) => (
                        <DropdownMenuRadioItem
                          key={angle.videoId}
                          value={angle.videoId}
                        >
                          {angle.tagName}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs pointer-events-none"
                      aria-label="Camera angle"
                    >
                      <Camera className="size-3.5 mr-1" />
                      {angles[0]?.tagName ?? "Angle"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Camera angle</TooltipContent>
                </Tooltip>
              )}
              <Separator orientation="vertical" className="h-5 mx-0.5" />
            </>
          )}

          {/* Playback speed */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 font-mono text-xs tabular-nums"
                    aria-label="Playback speed"
                  >
                    <Gauge className="size-3.5 mr-1" />
                    {state.playbackRate}x
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">Playback speed</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Playback Speed</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={String(state.playbackRate)}
                onValueChange={(v) => actions.setPlaybackRate(Number(v))}
              >
                {PLAYBACK_RATES.map((rate) => (
                  <DropdownMenuRadioItem key={rate} value={String(rate)}>
                    {rate}x
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {/* Volume */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      // Alt+click toggles mute without opening popover
                      if (e.altKey) {
                        e.preventDefault();
                        actions.toggleMute();
                      }
                    }}
                    aria-label={state.isMuted ? "Unmute" : "Mute"}
                  >
                    <VolumeIcon className="size-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                Volume <Kbd>M</Kbd>
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              side="top"
              align="center"
              className="w-10 p-2 flex flex-col items-center gap-2"
            >
              <Slider
                orientation="vertical"
                value={[state.isMuted ? 0 : state.volume * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={(values) =>
                  actions.setVolume((values[0] ?? 0) / 100)
                }
                className="h-24"
                aria-label="Volume"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={actions.toggleMute}
                aria-label={state.isMuted ? "Unmute" : "Mute"}
              >
                <VolumeIcon className="size-3.5" />
              </Button>
            </PopoverContent>
          </Popover>

          {/* Fullscreen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={actions.toggleFullscreen}
                aria-label={
                  state.isFullscreen ? "Exit fullscreen" : "Fullscreen"
                }
              >
                {state.isFullscreen ? (
                  <Minimize className="size-4" />
                ) : (
                  <Maximize className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {state.isFullscreen ? "Exit fullscreen" : "Fullscreen"}{" "}
              <Kbd>F</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
