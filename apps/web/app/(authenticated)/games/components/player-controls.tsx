"use client";

import { useCallback, useRef, useState } from "react";
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
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Gauge,
  Camera,
} from "lucide-react";
import type { PlayerState, PlayerActions } from "./use-player";

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
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function PlayerControls({
  state,
  actions,
  angles,
  activeAngle,
  onAngleChange,
}: PlayerControlsProps) {
  const [isSeekDragging, setIsSeekDragging] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  const displayTime = seekPreview ?? state.currentTime;

  const onSeekChange = useCallback(
    (values: number[]) => {
      const value = values[0] ?? 0;
      setSeekPreview(value);
      if (!isSeekDragging) {
        actions.seek(value);
        setSeekPreview(null);
      }
    },
    [actions, isSeekDragging],
  );

  const onSeekCommit = useCallback(
    (values: number[]) => {
      const value = values[0] ?? 0;
      actions.seek(value);
      setSeekPreview(null);
      setIsSeekDragging(false);
    },
    [actions],
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
            style={{ width: `${state.bufferedPercent}%` }}
          />
        </div>
        <Slider
          value={[displayTime]}
          min={0}
          max={state.duration || 1}
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
        {/* Left group: skip + play/pause */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => actions.skip(-5)}
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
                onClick={() => actions.skip(5)}
                aria-label="Forward 5 seconds"
              >
                <RotateCw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              +5s <Kbd>L</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Time display */}
        <span className="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap ml-1 select-none">
          {formatTime(displayTime)} / {formatTime(state.duration)}
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
