"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  bufferedPercent: number;
  isWaiting: boolean;
}

export interface PlayerActions {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(time: number): void;
  skip(delta: number): void;
  setVolume(v: number): void;
  toggleMute(): void;
  setPlaybackRate(rate: number): void;
  toggleFullscreen(): void;
}

const INITIAL_STATE: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  isFullscreen: false,
  bufferedPercent: 0,
  isWaiting: false,
};

/**
 * Custom hook wrapping HTML5 <video> element API.
 * Manages playback state, volume, rate, fullscreen, buffering,
 * and keyboard shortcuts.
 */
export function usePlayer(
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>(INITIAL_STATE);

  // ---- Imperative actions ----

  const play = useCallback(() => {
    videoRef.current?.play().catch(() => {
      // Browser may block autoplay; silently ignore
    });
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(time, el.duration || 0));
  }, []);

  const skip = useCallback((delta: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(
      0,
      Math.min(el.currentTime + delta, el.duration || 0),
    );
  }, []);

  const setVolume = useCallback((v: number) => {
    const el = videoRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(1, v));
    el.volume = clamped;
    if (clamped > 0 && el.muted) {
      el.muted = false;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = rate;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      container.requestFullscreen().catch(() => {});
    }
  }, [containerRef]);

  // ---- Video element event listeners ----

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    function onPlay() {
      setState((s) => ({ ...s, isPlaying: true }));
    }
    function onPause() {
      setState((s) => ({ ...s, isPlaying: false }));
    }
    function onTimeUpdate() {
      setState((s) => ({ ...s, currentTime: el!.currentTime }));
    }
    function onLoadedMetadata() {
      setState((s) => ({
        ...s,
        duration: el!.duration,
        currentTime: el!.currentTime,
      }));
    }
    function onDurationChange() {
      setState((s) => ({ ...s, duration: el!.duration }));
    }
    function onVolumeChange() {
      setState((s) => ({
        ...s,
        volume: el!.volume,
        isMuted: el!.muted,
      }));
    }
    function onRateChange() {
      setState((s) => ({ ...s, playbackRate: el!.playbackRate }));
    }
    function onWaiting() {
      setState((s) => ({ ...s, isWaiting: true }));
    }
    function onCanPlay() {
      setState((s) => ({ ...s, isWaiting: false }));
    }
    function onProgress() {
      if (!el || el.duration === 0) return;
      const buffered = el.buffered;
      if (buffered.length > 0) {
        const end = buffered.end(buffered.length - 1);
        setState((s) => ({
          ...s,
          bufferedPercent: (end / el!.duration) * 100,
        }));
      }
    }
    function onEnded() {
      setState((s) => ({ ...s, isPlaying: false }));
    }

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("volumechange", onVolumeChange);
    el.addEventListener("ratechange", onRateChange);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("progress", onProgress);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("volumechange", onVolumeChange);
      el.removeEventListener("ratechange", onRateChange);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  // ---- Fullscreen change tracking ----

  useEffect(() => {
    function onFullscreenChange() {
      setState((s) => ({
        ...s,
        isFullscreen: !!document.fullscreenElement,
      }));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  // ---- Reset state when video source changes ----

  const resetState = useCallback(() => {
    setState((s) => ({
      ...INITIAL_STATE,
      volume: s.volume,
      isMuted: s.isMuted,
      playbackRate: s.playbackRate,
      isFullscreen: s.isFullscreen,
    }));
  }, []);

  // ---- Keyboard shortcuts ----

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't handle shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const el = videoRef.current;
      if (!el) return;

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          if (el.paused) {
            el.play().catch(() => {});
          } else {
            el.pause();
          }
          break;

        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Left reserved for future clip navigation
            return;
          }
          el.currentTime = Math.max(0, el.currentTime - 5);
          break;

        case "j":
        case "J":
          e.preventDefault();
          el.currentTime = Math.max(0, el.currentTime - 5);
          break;

        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Right reserved for future clip navigation
            return;
          }
          el.currentTime = Math.min(el.duration || 0, el.currentTime + 5);
          break;

        case "l":
        case "L":
          e.preventDefault();
          el.currentTime = Math.min(el.duration || 0, el.currentTime + 5);
          break;

        case "ArrowUp":
          e.preventDefault();
          el.volume = Math.min(1, el.volume + 0.05);
          break;

        case "ArrowDown":
          e.preventDefault();
          el.volume = Math.max(0, el.volume - 0.05);
          break;

        case "m":
        case "M":
          e.preventDefault();
          el.muted = !el.muted;
          break;

        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toggleFullscreen]);

  const actions: PlayerActions = useMemo(
    () => ({
      play,
      pause,
      togglePlay,
      seek,
      skip,
      setVolume,
      toggleMute,
      setPlaybackRate,
      toggleFullscreen,
    }),
    [play, pause, togglePlay, seek, skip, setVolume, toggleMute, setPlaybackRate, toggleFullscreen],
  );

  return { videoRef, state, actions, resetState };
}
