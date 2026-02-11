/**
 * Client-side video thumbnail extraction.
 *
 * Uses an HTML5 <video> element + <canvas> to extract a frame from a video file.
 * The frame is captured at ~2 seconds (or at 10% of duration for very short videos).
 */

/** Default seek time in seconds for thumbnail capture. */
const DEFAULT_SEEK_TIME = 2;
/** Maximum dimension for the generated thumbnail. */
const MAX_THUMBNAIL_SIZE = 640;
/** JPEG quality for the thumbnail (0-1). */
const JPEG_QUALITY = 0.8;

export interface ThumbnailResult {
  /** Object URL for the thumbnail blob — call URL.revokeObjectURL() when done. */
  url: string;
  /** The thumbnail as a Blob. */
  blob: Blob;
  /** Width of the generated thumbnail. */
  width: number;
  /** Height of the generated thumbnail. */
  height: number;
}

/**
 * Extract a thumbnail frame from a video File.
 *
 * @param file - A video File object
 * @param seekTime - Time in seconds to seek to (default: 2s or 10% of duration)
 * @returns A ThumbnailResult with the captured frame
 */
export async function extractVideoThumbnail(
  file: File,
  seekTime?: number,
): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    // Cleanup helper
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.preload = "metadata";
    video.muted = true;
    // Required for cross-origin videos (shouldn't apply for local files, but be safe)
    video.crossOrigin = "anonymous";
    video.src = objectUrl;

    video.addEventListener("error", () => {
      cleanup();
      reject(new Error("Failed to load video for thumbnail extraction"));
    });

    video.addEventListener("loadedmetadata", () => {
      const duration = video.duration;
      if (!duration || !isFinite(duration)) {
        cleanup();
        reject(new Error("Could not determine video duration"));
        return;
      }

      // Decide seek time: use provided, or 2s, or 10% of duration for short videos
      const targetTime =
        seekTime ?? Math.min(DEFAULT_SEEK_TIME, duration * 0.1);
      video.currentTime = Math.min(targetTime, duration);
    });

    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("Failed to get canvas 2D context"));
          return;
        }

        // Calculate scaled dimensions (preserve aspect ratio)
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > MAX_THUMBNAIL_SIZE || height > MAX_THUMBNAIL_SIZE) {
          const scale = MAX_THUMBNAIL_SIZE / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              reject(new Error("Failed to generate thumbnail blob"));
              return;
            }
            const url = URL.createObjectURL(blob);
            resolve({ url, blob, width, height });
          },
          "image/jpeg",
          JPEG_QUALITY,
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  });
}
