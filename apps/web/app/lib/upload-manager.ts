/**
 * Custom multipart upload manager for S3 presigned URL uploads.
 *
 * Handles:
 * - Chunking files into parts
 * - Concurrent part uploads (configurable parallelism)
 * - Per-part and overall progress tracking
 * - Retry with exponential backoff on failed parts
 * - Resume from server-side upload state
 * - Cancel/abort support
 */

import { clientEnv } from "@repo/env/web";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadProgress {
  videoId: string;
  fileName: string;
  totalBytes: number;
  uploadedBytes: number;
  completedParts: number;
  totalParts: number;
  status:
    | "initializing"
    | "uploading"
    | "completing"
    | "completed"
    | "failed"
    | "cancelled";
  error?: string;
}

export interface UploadCallbacks {
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (videoId: string) => void;
  onError?: (videoId: string, error: string) => void;
}

interface PartInfo {
  partNumber: number;
  start: number;
  end: number;
  uploaded: boolean;
  etag?: string;
}

interface InitResponse {
  uploadSessionId: string;
  s3UploadId: string;
  s3Key: string;
  partSize: number;
  totalParts: number;
  expiresAt: string;
}

interface UploadStatusResponse {
  active: boolean;
  expired?: boolean;
  uploadSessionId?: string;
  s3UploadId?: string;
  s3Key?: string;
  partSize?: number;
  totalParts?: number;
  completedParts?: number[];
  completedCount?: number;
  totalBytes?: string;
  uploadedBytes?: string;
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_PARTS = 4;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Upload Manager
// ---------------------------------------------------------------------------

export class UploadManager {
  private activeUploads = new Map<string, AbortController>();
  private apiBase: string;
  private cookie: string;

  constructor() {
    this.apiBase = clientEnv.NEXT_PUBLIC_API_URL;
    this.cookie = "";
  }

  /** Check if there's an in-progress upload for a video. */
  async checkResumable(
    organizationId: string,
    videoId: string,
  ): Promise<UploadStatusResponse> {
    const res = await this.apiFetch(
      `/orgs/${organizationId}/videos/${videoId}/upload/status`,
    );
    return res;
  }

  /**
   * Start or resume an upload for a video.
   *
   * @param organizationId - The org that owns the video
   * @param videoId - The video record ID (must exist in DB with PENDING status)
   * @param file - The File object to upload
   * @param callbacks - Progress/completion/error callbacks
   */
  async upload(
    organizationId: string,
    videoId: string,
    file: File,
    callbacks: UploadCallbacks = {},
  ): Promise<void> {
    const controller = new AbortController();
    this.activeUploads.set(videoId, controller);

    const progress: UploadProgress = {
      videoId,
      fileName: file.name,
      totalBytes: file.size,
      uploadedBytes: 0,
      completedParts: 0,
      totalParts: 0,
      status: "initializing",
    };

    const emitProgress = () => callbacks.onProgress?.({ ...progress });

    try {
      emitProgress();

      // Check for existing upload session (resume support)
      const status = await this.checkResumable(organizationId, videoId);

      let partSize: number;
      let totalParts: number;
      let alreadyCompletedParts: Set<number>;

      if (status.active && status.partSize && status.totalParts) {
        // Resume existing upload
        partSize = status.partSize;
        totalParts = status.totalParts;
        alreadyCompletedParts = new Set(status.completedParts ?? []);
        progress.uploadedBytes = parseInt(status.uploadedBytes ?? "0", 10);
        progress.completedParts = status.completedCount ?? 0;
      } else {
        // Initialize new upload
        const initRes: InitResponse = await this.apiFetch(
          `/orgs/${organizationId}/videos/${videoId}/upload/init`,
          {
            method: "POST",
            body: JSON.stringify({
              fileSize: String(file.size),
              mimeType: file.type,
              fileName: file.name,
            }),
          },
        );

        partSize = initRes.partSize;
        totalParts = initRes.totalParts;
        alreadyCompletedParts = new Set<number>();
      }

      progress.totalParts = totalParts;
      progress.status = "uploading";
      emitProgress();

      // Build part list
      const parts: PartInfo[] = [];
      for (let i = 1; i <= totalParts; i++) {
        const start = (i - 1) * partSize;
        const end = Math.min(i * partSize, file.size);
        parts.push({
          partNumber: i,
          start,
          end,
          uploaded: alreadyCompletedParts.has(i),
        });
      }

      // Upload remaining parts with concurrency control
      const pendingParts = parts.filter((p) => !p.uploaded);

      await this.uploadPartsWithConcurrency(
        organizationId,
        videoId,
        file,
        pendingParts,
        partSize,
        progress,
        emitProgress,
        controller.signal,
      );

      if (controller.signal.aborted) {
        progress.status = "cancelled";
        emitProgress();
        return;
      }

      // Complete the upload
      progress.status = "completing";
      emitProgress();

      await this.apiFetch(
        `/orgs/${organizationId}/videos/${videoId}/upload/complete`,
        { method: "POST" },
      );

      progress.status = "completed";
      emitProgress();
      callbacks.onComplete?.(videoId);
    } catch (err) {
      if (controller.signal.aborted) {
        progress.status = "cancelled";
        emitProgress();
        return;
      }

      const errorMsg =
        err instanceof Error ? err.message : "Upload failed unexpectedly";
      progress.status = "failed";
      progress.error = errorMsg;
      emitProgress();
      callbacks.onError?.(videoId, errorMsg);
    } finally {
      this.activeUploads.delete(videoId);
    }
  }

  /** Cancel an in-progress upload. */
  cancel(videoId: string): void {
    const controller = this.activeUploads.get(videoId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(videoId);
    }
  }

  /** Abort and clean up an upload on the server. */
  async abort(organizationId: string, videoId: string): Promise<void> {
    this.cancel(videoId);
    await this.apiFetch(
      `/orgs/${organizationId}/videos/${videoId}/upload/abort`,
      { method: "POST" },
    ).catch(() => {});
  }

  /** Check if a video has an active upload. */
  isUploading(videoId: string): boolean {
    return this.activeUploads.has(videoId);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async uploadPartsWithConcurrency(
    organizationId: string,
    videoId: string,
    file: File,
    parts: PartInfo[],
    _partSize: number,
    progress: UploadProgress,
    emitProgress: () => void,
    signal: AbortSignal,
  ): Promise<void> {
    let index = 0;

    const uploadNext = async (): Promise<void> => {
      while (index < parts.length) {
        if (signal.aborted) return;

        const part = parts[index++]!;
        await this.uploadSinglePart(
          organizationId,
          videoId,
          file,
          part,
          progress,
          emitProgress,
          signal,
        );
      }
    };

    // Launch concurrent workers
    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT_PARTS, parts.length) },
      () => uploadNext(),
    );

    await Promise.all(workers);
  }

  private async uploadSinglePart(
    organizationId: string,
    videoId: string,
    file: File,
    part: PartInfo,
    progress: UploadProgress,
    emitProgress: () => void,
    signal: AbortSignal,
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (signal.aborted) return;

      try {
        // Get presigned URL
        const { presignedUrl } = await this.apiFetch(
          `/orgs/${organizationId}/videos/${videoId}/upload/sign-part`,
          {
            method: "POST",
            body: JSON.stringify({ partNumber: part.partNumber }),
          },
        );

        // Slice the file for this part
        const blob = file.slice(part.start, part.end);

        // Upload directly to S3
        const uploadRes = await fetch(presignedUrl, {
          method: "PUT",
          body: blob,
          signal,
        });

        if (!uploadRes.ok) {
          throw new Error(`S3 upload failed with status ${uploadRes.status}`);
        }

        const etag = uploadRes.headers.get("ETag");
        if (!etag) {
          throw new Error("S3 did not return an ETag");
        }

        // Record the completed part on the server
        await this.apiFetch(
          `/orgs/${organizationId}/videos/${videoId}/upload/complete-part`,
          {
            method: "POST",
            body: JSON.stringify({
              partNumber: part.partNumber,
              etag: etag.replace(/"/g, ""),
            }),
          },
        );

        // Update progress
        const partBytes = part.end - part.start;
        progress.uploadedBytes += partBytes;
        progress.completedParts += 1;
        emitProgress();

        return; // Success
      } catch (err) {
        if (signal.aborted) return;
        lastError = err instanceof Error ? err : new Error(String(err));

        // Exponential backoff before retry
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error(`Failed to upload part ${part.partNumber}`);
  }

  private async apiFetch(path: string, init?: RequestInit): Promise<any> {
    const res = await fetch(`${this.apiBase}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as Record<string, string>).error ??
          (body as Record<string, string>).message ??
          `API error ${res.status}`,
      );
    }

    return res.json();
  }
}

/** Singleton upload manager instance. */
export const uploadManager = new UploadManager();
