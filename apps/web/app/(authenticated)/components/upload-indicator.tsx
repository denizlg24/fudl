"use client";

/**
 * Upload Indicator — floating bottom-right widget showing active upload progress.
 * Visible only when there are active uploads.
 * Collapsible: click header to expand/collapse the file list.
 *
 * Per-entry actions:
 * - Cancel: abort an in-progress upload
 * - Retry: re-start a failed upload using the stored file reference
 * - Dismiss: remove a completed/failed/cancelled entry from the list
 *
 * Global actions:
 * - Clear all: dismiss all entries when no uploads are active
 */

import { useState } from "react";
import { useUploads, useUploadActions } from "../../lib/upload-store";
import { Progress } from "@repo/ui/components/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import {
  Upload,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  AlertCircle,
  FileVideo,
  RotateCcw,
  Ban,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Small action button used inside each upload row. Uses div to avoid button nesting. */
function RowAction({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className="inline-flex items-center justify-center size-5 shrink-0 rounded hover:bg-accent cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }
          }}
        >
          {children}
          <span className="sr-only">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function UploadIndicator() {
  const uploads = useUploads();
  const { dismissUpload, cancelUpload, retryUpload } = useUploadActions();
  const [expanded, setExpanded] = useState(true);

  // Only show when there are uploads tracked
  if (uploads.length === 0) return null;

  const activeCount = uploads.filter(
    (u) =>
      u.progress.status === "uploading" ||
      u.progress.status === "initializing" ||
      u.progress.status === "completing",
  ).length;

  const completedCount = uploads.filter(
    (u) => u.progress.status === "completed",
  ).length;

  const failedCount = uploads.filter(
    (u) => u.progress.status === "failed",
  ).length;

  // Overall progress across all active uploads
  const totalBytes = uploads.reduce((sum, u) => sum + u.progress.totalBytes, 0);
  const uploadedBytes = uploads.reduce(
    (sum, u) => sum + u.progress.uploadedBytes,
    0,
  );
  const overallPercent =
    totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

  const allDone = activeCount === 0;

  // Header summary text
  let headerText: string;
  if (activeCount > 0) {
    headerText = `Uploading ${activeCount} file${activeCount !== 1 ? "s" : ""} — ${overallPercent}%`;
  } else if (failedCount > 0 && completedCount > 0) {
    headerText = `${completedCount} done, ${failedCount} failed`;
  } else if (failedCount > 0) {
    headerText = `${failedCount} upload${failedCount !== 1 ? "s" : ""} failed`;
  } else {
    headerText = `${completedCount} upload${completedCount !== 1 ? "s" : ""} complete`;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-background shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
          onClick={() => setExpanded((v) => !v)}
        >
          <Upload className="size-4 text-primary shrink-0" />
          <span className="text-sm font-medium flex-1 text-left truncate">
            {headerText}
          </span>
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronUp className="size-4 text-muted-foreground shrink-0" />
          )}
        </button>
        {allDone && (
          <button
            type="button"
            className="inline-flex items-center justify-center size-6 shrink-0 rounded-md hover:bg-accent cursor-pointer"
            onClick={() => {
              for (const u of uploads) {
                dismissUpload(u.videoId);
              }
            }}
          >
            <X className="size-3.5" />
            <span className="sr-only">Dismiss all</span>
          </button>
        )}
      </div>

      {/* Overall progress bar (always visible when uploading) */}
      {activeCount > 0 && (
        <Progress value={overallPercent} className="h-1 rounded-none" />
      )}

      {/* Expanded file list */}
      {expanded && (
        <div className="max-h-60 overflow-y-auto border-t border-border">
          {uploads.map((entry) => {
            const { progress } = entry;
            const percent =
              progress.totalBytes > 0
                ? Math.round(
                    (progress.uploadedBytes / progress.totalBytes) * 100,
                  )
                : 0;

            const isActive =
              progress.status === "uploading" ||
              progress.status === "initializing" ||
              progress.status === "completing";
            const isDone =
              progress.status === "completed" ||
              progress.status === "failed" ||
              progress.status === "cancelled";

            return (
              <div
                key={entry.videoId}
                className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-b-0"
              >
                <FileVideo className="size-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {progress.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(progress.uploadedBytes)} /{" "}
                    {formatBytes(progress.totalBytes)}
                  </p>
                </div>

                {/* Status icon */}
                {progress.status === "completed" && (
                  <Check className="size-3.5 text-primary shrink-0" />
                )}
                {progress.status === "failed" && (
                  <AlertCircle className="size-3.5 text-destructive shrink-0" />
                )}
                {progress.status === "cancelled" && (
                  <Ban className="size-3 text-muted-foreground shrink-0" />
                )}
                {isActive && (
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {percent}%
                  </span>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Cancel — only for active uploads */}
                  {isActive && (
                    <RowAction
                      onClick={() =>
                        cancelUpload(entry.organizationId, entry.videoId)
                      }
                      label="Cancel upload"
                    >
                      <X className="size-3" />
                    </RowAction>
                  )}

                  {/* Retry — only for failed uploads */}
                  {progress.status === "failed" && (
                    <RowAction
                      onClick={() => retryUpload(entry.videoId)}
                      label="Retry upload"
                    >
                      <RotateCcw className="size-3" />
                    </RowAction>
                  )}

                  {/* Dismiss — for completed, failed, or cancelled */}
                  {isDone && (
                    <RowAction
                      onClick={() => dismissUpload(entry.videoId)}
                      label="Dismiss"
                    >
                      <X className="size-3" />
                    </RowAction>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
