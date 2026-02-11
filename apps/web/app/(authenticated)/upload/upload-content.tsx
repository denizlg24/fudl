"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  createGameSchema,
  type CreateSeasonValues,
} from "@repo/types/validations";
import { useUploadActions } from "../../lib/upload-store";
import {
  extractVideoThumbnail,
  type ThumbnailResult,
} from "../../lib/video-thumbnail";
import { clientEnv } from "@repo/env/web";
import { TagCombobox } from "../components/tag-combobox";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Separator } from "@repo/ui/components/separator";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Progress } from "@repo/ui/components/progress";
import {
  ArrowLeft,
  Upload,
  Film,
  X,
  FileVideo,
  Plus,
  Check,
} from "lucide-react";
import Image from "next/image";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagData {
  id: string;
  name: string;
  category: string;
}

interface GameOption {
  id: string;
  title: string;
  tags?: TagData[];
  date?: string | null;
  season?: { id: string; name: string } | null;
}

interface SeasonOption {
  id: string;
  name: string;
}

interface FileWithPreview {
  file: File;
  id: string;
  thumbnail: ThumbnailResult | null;
  thumbnailLoading: boolean;
  /** Camera angle tag IDs for this specific file */
  cameraAngleTagIds: string[];
}

type Step = "select-files" | "game-info" | "uploading";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Parse a date string (ISO or YYYY-MM-DD) into a Date, or null if invalid/empty. */
function parseDateString(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/** Convert a Date to a YYYY-MM-DD string for the API, or undefined if null. */
function dateToDateString(date: Date | null): string | undefined {
  if (!date) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Get display text for a game option */
function getGameDisplayText(game: GameOption): string {
  const opponentTag = game.tags?.find((t) => t.category === "OPPONENT");
  const label = opponentTag ? `vs. ${opponentTag.name}` : game.title;
  return game.date ? `${label} — ${formatDate(game.date)}` : label;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UploadContent({
  activeOrgId,
  games,
  seasons,
  preselectedGameId,
}: {
  activeOrgId: string;
  games: GameOption[];
  seasons: SeasonOption[];
  preselectedGameId: string | null;
}) {
  const router = useRouter();
  const { startUpload } = useUploadActions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [step, setStep] = useState<Step>("select-files");

  // File selection state
  const [files, setFiles] = useState<FileWithPreview[]>([]);

  // Game selection state
  const [gameMode, setGameMode] = useState<"existing" | "new">(
    preselectedGameId ? "existing" : "new",
  );
  const [selectedGameId, setSelectedGameId] = useState<string>(
    preselectedGameId ?? "",
  );

  // Tag state for new game form (managed outside react-hook-form)
  const [opponentTagIds, setOpponentTagIds] = useState<string[]>([]);
  const [fieldTagIds, setFieldTagIds] = useState<string[]>([]);
  const [generalTagIds, setGeneralTagIds] = useState<string[]>([]);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<
    Map<string, { progress: number; status: string; errorMessage?: string }>
  >(new Map());

  // Error states
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [gameSelectError, setGameSelectError] = useState<string | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);

  // New game form
  const form = useForm({
    resolver: standardSchemaResolver(createGameSchema),
    defaultValues: {
      title: "",
      date: "",
      location: "",
      seasonId: "",
    },
  });

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const handleFileSelect = useCallback(
    async (selectedFiles: FileList | null) => {
      if (!selectedFiles) return;

      const newFiles: FileWithPreview[] = [];
      const errors: string[] = [];
      for (const file of Array.from(selectedFiles)) {
        if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
          errors.push(`${file.name}: unsupported file type`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: file too large (max 10 GB)`);
          continue;
        }
        newFiles.push({
          file,
          id: crypto.randomUUID(),
          thumbnail: null,
          thumbnailLoading: true,
          cameraAngleTagIds: [],
        });
      }

      if (errors.length > 0) {
        setFileErrors(errors);
      }

      setFiles((prev) => [...prev, ...newFiles]);

      // Extract thumbnails in background
      for (const entry of newFiles) {
        try {
          const thumb = await extractVideoThumbnail(entry.file);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id
                ? { ...f, thumbnail: thumb, thumbnailLoading: false }
                : f,
            ),
          );
        } catch {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id ? { ...f, thumbnailLoading: false } : f,
            ),
          );
        }
      }
    },
    [],
  );

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => {
      const removed = prev.find((f) => f.id === fileId);
      if (removed?.thumbnail) {
        URL.revokeObjectURL(removed.thumbnail.url);
      }
      return prev.filter((f) => f.id !== fileId);
    });
  }, []);

  // Update camera angle tags for a specific file
  const updateFileCameraAngles = useCallback(
    (fileId: string, tagIds: string[]) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, cameraAngleTagIds: tagIds } : f,
        ),
      );
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Drag & drop
  // -------------------------------------------------------------------------

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  // -------------------------------------------------------------------------
  // Upload flow
  // -------------------------------------------------------------------------

  const handleStartUploads = useCallback(
    async (gameId: string) => {
      setStep("uploading");
      setUploading(true);

      for (const entry of files) {
        try {
          // 1. Create video metadata record with camera angle tags
          const videoRes = await fetch(
            `${API_URL}/orgs/${activeOrgId}/videos`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: entry.file.name.replace(/\.[^.]+$/, ""),
                gameId: gameId || undefined,
                mimeType: entry.file.type,
                fileSize: entry.file.size,
                tagIds:
                  entry.cameraAngleTagIds.length > 0
                    ? entry.cameraAngleTagIds
                    : undefined,
              }),
            },
          );

          if (!videoRes.ok) {
            const errBody = await videoRes.json().catch(() => ({}));
            const errorMsg = `Failed to create video record: ${(errBody as Record<string, string>).error || (errBody as Record<string, string>).message || "Unknown error"}`;
            setUploadStatuses((prev) => {
              const next = new Map(prev);
              next.set(entry.id, {
                progress: 0,
                status: "failed",
                errorMessage: errorMsg,
              });
              return next;
            });
            continue;
          }

          const { video } = (await videoRes.json()) as {
            video: { id: string };
          };

          // Capture the thumbnail blob for this entry to upload after video completes
          const thumbnailBlob = entry.thumbnail?.blob ?? null;

          // 2. Start the upload via the global upload store
          startUpload(activeOrgId, video.id, entry.file, {
            onProgress(progress) {
              const percent =
                progress.totalBytes > 0
                  ? Math.round(
                      (progress.uploadedBytes / progress.totalBytes) * 100,
                    )
                  : 0;
              setUploadStatuses((prev) => {
                const next = new Map(prev);
                next.set(entry.id, {
                  progress: percent,
                  status: progress.status,
                });
                return next;
              });
            },
            onComplete() {
              setUploadStatuses((prev) => {
                const next = new Map(prev);
                next.set(entry.id, { progress: 100, status: "completed" });
                return next;
              });

              // Upload thumbnail to S3 in the background (fire and forget)
              if (thumbnailBlob) {
                const formData = new FormData();
                formData.append("file", thumbnailBlob, "thumbnail.jpg");
                fetch(
                  `${API_URL}/orgs/${activeOrgId}/videos/${video.id}/upload/thumbnail`,
                  {
                    method: "POST",
                    credentials: "include",
                    body: formData,
                  },
                )
                  .then(async (res) => {
                    if (!res.ok) {
                      const text = await res.text().catch(() => "");
                      console.error(
                        `Thumbnail upload failed (${res.status}):`,
                        text,
                      );
                    }
                  })
                  .catch((err) => {
                    console.error("Thumbnail upload network error:", err);
                  });
              }
            },
            onError(_vid, error) {
              setUploadStatuses((prev) => {
                const next = new Map(prev);
                next.set(entry.id, {
                  progress: 0,
                  status: "failed",
                  errorMessage: error,
                });
                return next;
              });
            },
          });

          // Set initial status
          setUploadStatuses((prev) => {
            const next = new Map(prev);
            next.set(entry.id, { progress: 0, status: "initializing" });
            return next;
          });
        } catch (err) {
          const errorMsg = `Error starting upload: ${err instanceof Error ? err.message : "Unknown error"}`;
          setUploadStatuses((prev) => {
            const next = new Map(prev);
            next.set(entry.id, {
              progress: 0,
              status: "failed",
              errorMessage: errorMsg,
            });
            return next;
          });
        }
      }
    },
    [files, activeOrgId, startUpload],
  );

  const handleSubmit = useCallback(async () => {
    setGameSelectError(null);
    setGameError(null);

    if (gameMode === "existing") {
      if (!selectedGameId) {
        setGameSelectError("Please select a game");
        return;
      }
      await handleStartUploads(selectedGameId);
    } else {
      // Trigger form validation manually
      const isValid = await form.trigger();
      if (!isValid) return;

      const values = form.getValues();

      // Collect all tag IDs for the new game
      const allTagIds = [...opponentTagIds, ...fieldTagIds, ...generalTagIds];

      try {
        const res = await fetch(`${API_URL}/orgs/${activeOrgId}/games`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: values.title,
            seasonId: values.seasonId,
            date: values.date ? new Date(values.date).toISOString() : undefined,
            location: values.location || undefined,
            tagIds: allTagIds.length > 0 ? allTagIds : undefined,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setGameError(
            `Failed to create game: ${(body as Record<string, string>).message || "Unknown error"}`,
          );
          return;
        }

        const { game } = (await res.json()) as { game: { id: string } };
        await handleStartUploads(game.id);
      } catch (err) {
        setGameError(
          `Error creating game: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }
  }, [
    gameMode,
    selectedGameId,
    form,
    activeOrgId,
    handleStartUploads,
    opponentTagIds,
    fieldTagIds,
    generalTagIds,
  ]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const allDone =
    uploadStatuses.size > 0 &&
    files.every((f) => {
      const s = uploadStatuses.get(f.id);
      return s && (s.status === "completed" || s.status === "failed");
    });

  // -------------------------------------------------------------------------
  // Step 1: File Selection
  // -------------------------------------------------------------------------

  if (step === "select-files") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Upload footage
          </h1>
        </div>

        {/* Drop zone */}
        <div
          className={`relative rounded-lg border-2 border-dashed transition-colors p-8 text-center cursor-pointer ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_VIDEO_TYPES.join(",")}
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <Upload className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-base font-medium mb-1">
            Drop video files here or click to browse
          </p>
          <p className="text-sm text-muted-foreground">
            MP4, WebM, MOV, AVI, MKV up to 10 GB each
          </p>
        </div>

        {/* File validation errors */}
        {fileErrors.length > 0 && (
          <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 space-y-1">
            {fileErrors.map((err, i) => (
              <p key={i} className="text-sm text-destructive">
                {err}
              </p>
            ))}
            <button
              type="button"
              onClick={() => setFileErrors([])}
              className="text-xs text-destructive/70 hover:text-destructive underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Selected files list */}
        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </h2>
            {files.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                {/* Thumbnail */}
                <div className="shrink-0 w-16 h-10 rounded bg-muted overflow-hidden flex items-center justify-center">
                  {entry.thumbnailLoading ? (
                    <div className="size-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  ) : entry.thumbnail ? (
                    <Image
                      src={entry.thumbnail.url}
                      alt={entry.file.name}
                      width={entry.thumbnail.width}
                      height={entry.thumbnail.height}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileVideo className="size-5 text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {entry.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(entry.file.size)}
                  </p>
                </div>

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => removeFile(entry.id)}
                >
                  <X className="size-4" />
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            ))}

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Plus className="size-4" />
                Add more
              </Button>
              <Button
                onClick={() => setStep("game-info")}
                disabled={files.length === 0}
                className="gap-2"
              >
                Continue
                <ArrowLeft className="size-4 rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Step 2: Game info
  // -------------------------------------------------------------------------

  if (step === "game-info") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStep("select-files")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Game details
          </h1>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Associate this footage with an existing game or create a new one.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={gameMode === "new" ? "default" : "outline"}
            size="sm"
            onClick={() => setGameMode("new")}
          >
            New game
          </Button>
          {games.length > 0 && (
            <Button
              variant={gameMode === "existing" ? "default" : "outline"}
              size="sm"
              onClick={() => setGameMode("existing")}
            >
              Existing game
            </Button>
          )}
        </div>

        {gameMode === "existing" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select a game</CardTitle>
              <CardDescription>
                Choose which game this footage belongs to.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a game..." />
                </SelectTrigger>
                <SelectContent>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span className="truncate">{getGameDisplayText(g)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {gameSelectError && (
                <p className="text-sm text-destructive mt-2">
                  {gameSelectError}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New game</CardTitle>
              <CardDescription>
                Create a new game record for this footage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Game title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Week 3 vs Panthers"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Opponent tag combobox */}
                  <div className="space-y-2">
                    <Label>Opponent</Label>
                    <TagCombobox
                      category="OPPONENT"
                      orgId={activeOrgId}
                      selectedTagIds={opponentTagIds}
                      onChange={setOpponentTagIds}
                      placeholder="Select or create opponent..."
                      multiple={false}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Controller
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Game date</FormLabel>
                          <FormControl>
                            <DatePicker
                              value={parseDateString(field.value)}
                              onChange={(date) => {
                                field.onChange(dateToDateString(date) ?? "");
                              }}
                              placeholder="Game date"
                              dateFormat="MMM d, yyyy"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Field tag combobox (replaces plain location text input) */}
                    <div className="space-y-2">
                      <Label>Field / Location</Label>
                      <TagCombobox
                        category="FIELD"
                        orgId={activeOrgId}
                        selectedTagIds={fieldTagIds}
                        onChange={setFieldTagIds}
                        placeholder="Select or create field..."
                        multiple={false}
                      />
                    </div>
                  </div>
                  {seasons.length > 0 ? (
                    <FormField
                      control={form.control}
                      name="seasonId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Season <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a season" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {seasons.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-3">
                      <p className="text-sm text-muted-foreground">
                        No seasons yet. Create a season on the{" "}
                        <Link
                          href="/seasons"
                          className="text-primary hover:underline"
                        >
                          Seasons page
                        </Link>{" "}
                        first.
                      </p>
                    </div>
                  )}

                  {/* General tags */}
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <TagCombobox
                      category="GENERAL"
                      orgId={activeOrgId}
                      selectedTagIds={generalTagIds}
                      onChange={setGeneralTagIds}
                      placeholder="Add tags..."
                      multiple={true}
                    />
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Per-file camera angle tagging */}
        <div className="mt-6">
          <h2 className="text-sm font-medium mb-3">
            Camera angles ({files.length} file{files.length !== 1 ? "s" : ""})
          </h2>
          <div className="space-y-3">
            {files.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                {/* Thumbnail */}
                <div className="shrink-0 w-12 h-8 rounded bg-muted overflow-hidden flex items-center justify-center mt-0.5">
                  {entry.thumbnail ? (
                    <Image
                      src={entry.thumbnail.url}
                      alt={entry.file.name}
                      width={entry.thumbnail.width}
                      height={entry.thumbnail.height}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileVideo className="size-4 text-muted-foreground" />
                  )}
                </div>

                {/* Info + Camera angle */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <p className="text-sm font-medium truncate">
                      {entry.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(entry.file.size)}
                    </p>
                  </div>
                  <TagCombobox
                    category="CAMERA_ANGLE"
                    orgId={activeOrgId}
                    selectedTagIds={entry.cameraAngleTagIds}
                    onChange={(tagIds) =>
                      updateFileCameraAngles(entry.id, tagIds)
                    }
                    placeholder="Camera angle..."
                    multiple={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {gameError && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">{gameError}</p>
          </div>
        )}

        <div className="flex justify-between items-center mt-6">
          <Button variant="outline" onClick={() => setStep("select-files")}>
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              uploading ||
              (gameMode === "existing" && !selectedGameId) ||
              (gameMode === "new" && seasons.length === 0)
            }
            className="gap-2"
          >
            <Upload className="size-4" />
            Start upload
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Step 3: Upload progress
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
      <div className="flex items-center gap-3 mb-6">
        <Film className="size-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">
          {allDone ? "Uploads complete" : "Uploading..."}
        </h1>
      </div>

      {!allDone && (
        <p className="text-sm text-muted-foreground mb-6">
          You can navigate away — uploads will continue in the background. Check
          progress from the indicator in the nav bar.
        </p>
      )}

      <div className="space-y-3">
        {files.map((entry) => {
          const status = uploadStatuses.get(entry.id);
          const progress = status?.progress ?? 0;
          const statusText = status?.status ?? "queued";

          return (
            <div key={entry.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3 mb-2">
                {/* Thumbnail */}
                <div className="shrink-0 w-12 h-8 rounded bg-muted overflow-hidden flex items-center justify-center">
                  {entry.thumbnail ? (
                    <Image
                      src={entry.thumbnail.url}
                      alt={entry.file.name}
                      width={entry.thumbnail.width}
                      height={entry.thumbnail.height}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileVideo className="size-4 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {entry.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(entry.file.size)}
                  </p>
                </div>

                {/* Status indicator */}
                <div className="shrink-0">
                  {statusText === "completed" ? (
                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="size-3.5 text-primary" />
                    </div>
                  ) : statusText === "failed" ? (
                    <span className="text-xs text-destructive font-medium">
                      Failed
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {progress}%
                    </span>
                  )}
                </div>
              </div>

              {statusText !== "completed" && statusText !== "failed" && (
                <Progress value={progress} className="h-1.5" />
              )}

              {statusText === "failed" && status?.errorMessage && (
                <p className="text-xs text-destructive mt-1">
                  {status.errorMessage}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="flex gap-3 mt-6">
          <Button asChild>
            <Link href="/dashboard">Back to games</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStep("select-files");
              setFiles([]);
              setUploadStatuses(new Map());
              setUploading(false);
              setOpponentTagIds([]);
              setFieldTagIds([]);
              setGeneralTagIds([]);
              form.reset();
            }}
          >
            Upload more
          </Button>
        </div>
      )}
    </div>
  );
}
