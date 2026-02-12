"use client";

/**
 * Upload Store — React context for tracking active video uploads across pages.
 *
 * Provides:
 * - Global upload state accessible from any component
 * - Persistent tracking across page navigation (state lives in context, not per-page)
 * - Integration with the UploadManager singleton
 *
 * Note: localStorage is used to store active upload IDs for diagnostic purposes
 * only. Upload state is not restored from localStorage on reload — resuming
 * interrupted uploads requires calling the /upload/status API endpoint.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  uploadManager,
  type UploadProgress,
  type UploadCallbacks,
} from "./upload-manager";
import { extractVideoThumbnail } from "./video-thumbnail";
import { clientEnv } from "@repo/env/web";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadEntry {
  videoId: string;
  organizationId: string;
  /** The original file reference — set by startUpload, used by retryUpload. May be undefined for entries created via progress updates only. */
  file?: File;
  progress: UploadProgress;
}

interface UploadStore {
  /** Start uploading a file for a video. */
  startUpload: (
    organizationId: string,
    videoId: string,
    file: File,
    callbacks?: UploadCallbacks,
  ) => void;
  /** Cancel an in-progress upload. */
  cancelUpload: (organizationId: string, videoId: string) => void;
  /** Retry a failed upload using the stored file reference. */
  retryUpload: (videoId: string) => void;
  /** Remove a completed/failed/cancelled upload from the list. */
  dismissUpload: (videoId: string) => void;
  /** Get all upload entries. */
  getUploads: () => UploadEntry[];
  /** Subscribe to upload state changes. */
  subscribe: (callback: () => void) => () => void;
}

// ---------------------------------------------------------------------------
// Store implementation (external store for useSyncExternalStore)
// ---------------------------------------------------------------------------

function createUploadStore(): UploadStore {
  let uploads = new Map<string, UploadEntry>();
  let listeners = new Set<() => void>();
  // Cached snapshot — only recreated when the map changes
  let cachedSnapshot: UploadEntry[] = [];

  function emitChange() {
    // Rebuild the cached snapshot whenever state changes
    cachedSnapshot = Array.from(uploads.values());
    for (const listener of listeners) {
      listener();
    }
  }

  function persistActiveIds() {
    if (typeof window === "undefined") return;
    const activeIds: Array<{ videoId: string; organizationId: string }> = [];
    for (const entry of uploads.values()) {
      if (
        entry.progress.status === "uploading" ||
        entry.progress.status === "initializing"
      ) {
        activeIds.push({
          videoId: entry.videoId,
          organizationId: entry.organizationId,
        });
      }
    }
    try {
      if (activeIds.length > 0) {
        localStorage.setItem("fudl:active-uploads", JSON.stringify(activeIds));
      } else {
        localStorage.removeItem("fudl:active-uploads");
      }
    } catch {
      // localStorage may be unavailable
    }
  }

  function updateProgress(
    videoId: string,
    organizationId: string,
    progress: UploadProgress,
  ) {
    uploads = new Map(uploads);
    const existing = uploads.get(videoId);
    uploads.set(videoId, {
      videoId,
      organizationId,
      file: existing?.file,
      progress,
    });
    persistActiveIds();
    emitChange();
  }

  return {
    startUpload(
      organizationId: string,
      videoId: string,
      file: File,
      callbacks?: UploadCallbacks,
    ) {
      // Store the file reference immediately so retry can access it
      uploads = new Map(uploads);
      uploads.set(videoId, {
        videoId,
        organizationId,
        file,
        progress: {
          videoId,
          fileName: file.name,
          totalBytes: file.size,
          uploadedBytes: 0,
          completedParts: 0,
          totalParts: 0,
          status: "initializing",
        },
      });
      emitChange();

      uploadManager.upload(organizationId, videoId, file, {
        onProgress(progress) {
          updateProgress(videoId, organizationId, progress);
          callbacks?.onProgress?.(progress);
        },
        onComplete(vid) {
          callbacks?.onComplete?.(vid);
        },
        onError(vid, error) {
          callbacks?.onError?.(vid, error);
        },
      });
    },

    cancelUpload(organizationId: string, videoId: string) {
      uploadManager.abort(organizationId, videoId);
      const entry = uploads.get(videoId);
      if (entry) {
        uploads = new Map(uploads);
        uploads.set(videoId, {
          ...entry,
          progress: { ...entry.progress, status: "cancelled" },
        });
        persistActiveIds();
        emitChange();
      }
    },

    retryUpload(videoId: string) {
      const entry = uploads.get(videoId);
      if (!entry || !entry.file) return;

      const { organizationId, file } = entry;

      // Re-invoke the upload manager with the stored file reference
      // The upload manager's resume logic will check server-side state
      uploadManager.upload(organizationId, videoId, file, {
        onProgress(progress) {
          updateProgress(videoId, organizationId, progress);
        },
        onComplete() {
          // Re-extract thumbnail from stored file and upload to S3
          extractVideoThumbnail(file)
            .then((thumb) => {
              const formData = new FormData();
              formData.append("file", thumb.blob, "thumbnail.jpg");
              URL.revokeObjectURL(thumb.url);
              return fetch(
                `${clientEnv.NEXT_PUBLIC_API_URL}/orgs/${organizationId}/videos/${videoId}/upload/thumbnail`,
                {
                  method: "POST",
                  credentials: "include",
                  body: formData,
                },
              );
            })
            .then(async (res) => {
              if (!res.ok) {
                const text = await res.text().catch(() => "");
                console.error(
                  `Thumbnail upload failed on retry (${res.status}):`,
                  text,
                );
              }
            })
            .catch((err) => {
              console.error("Thumbnail upload error on retry:", err);
            });
        },
        onError(_vid, error) {
          console.error(`Retry upload failed for ${videoId}:`, error);
        },
      });
    },

    dismissUpload(videoId: string) {
      uploads = new Map(uploads);
      uploads.delete(videoId);
      persistActiveIds();
      emitChange();
    },

    getUploads() {
      return cachedSnapshot;
    },

    subscribe(callback: () => void) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const UploadStoreContext = createContext<UploadStore | null>(null);

export function UploadStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Stable reference — store is created once and never recreated
  const storeRef = useRef<UploadStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createUploadStore();
  }

  return (
    <UploadStoreContext.Provider value={storeRef.current}>
      {children}
    </UploadStoreContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useUploadStoreInstance() {
  const store = useContext(UploadStoreContext);
  if (!store) {
    throw new Error("useUploadStore must be used within UploadStoreProvider");
  }
  return store;
}

/** Stable empty array for the server snapshot (avoids infinite loop). */
const EMPTY_UPLOADS: UploadEntry[] = [];

/** Returns the list of all upload entries (reactive). */
export function useUploads(): UploadEntry[] {
  const store = useUploadStoreInstance();
  return useSyncExternalStore(
    store.subscribe,
    store.getUploads,
    // Server snapshot: stable empty array
    () => EMPTY_UPLOADS,
  );
}

/** Returns upload action methods (stable references). */
export function useUploadActions() {
  const store = useUploadStoreInstance();

  const startUpload = useCallback(
    (
      organizationId: string,
      videoId: string,
      file: File,
      callbacks?: UploadCallbacks,
    ) => {
      store.startUpload(organizationId, videoId, file, callbacks);
    },
    [store],
  );

  const cancelUpload = useCallback(
    (organizationId: string, videoId: string) => {
      store.cancelUpload(organizationId, videoId);
    },
    [store],
  );

  const dismissUpload = useCallback(
    (videoId: string) => {
      store.dismissUpload(videoId);
    },
    [store],
  );

  const retryUpload = useCallback(
    (videoId: string) => {
      store.retryUpload(videoId);
    },
    [store],
  );

  return useMemo(
    () => ({ startUpload, cancelUpload, dismissUpload, retryUpload }),
    [startUpload, cancelUpload, dismissUpload, retryUpload],
  );
}

/** Returns the count of active uploads (uploading or initializing). */
export function useActiveUploadCount(): number {
  const uploads = useUploads();
  return uploads.filter(
    (u) =>
      u.progress.status === "uploading" ||
      u.progress.status === "initializing" ||
      u.progress.status === "completing",
  ).length;
}
