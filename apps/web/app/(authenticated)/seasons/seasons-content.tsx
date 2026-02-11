"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { isCoachRole } from "@repo/types";
import {
  createSeasonSchema,
  type CreateSeasonValues,
} from "@repo/types/validations";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Separator } from "@repo/ui/components/separator";
import { Badge } from "@repo/ui/components/badge";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Plus, Calendar, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeasonData {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { games: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(
  startDate: string | null,
  endDate: string | null,
): string {
  if (!startDate && !endDate) return "";
  if (startDate && endDate)
    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  if (startDate) return `From ${formatDate(startDate)}`;
  return `Until ${formatDate(endDate)}`;
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

// ---------------------------------------------------------------------------
// Create Season Dialog
// ---------------------------------------------------------------------------

function CreateSeasonDialog({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: (season: SeasonData) => void;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateSeasonValues>({
    resolver: standardSchemaResolver(createSeasonSchema),
    defaultValues: { name: "", startDate: undefined, endDate: undefined },
  });

  const onSubmit = async (values: CreateSeasonValues) => {
    const body: Record<string, string> = { name: values.name };
    if (values.startDate) body.startDate = values.startDate;
    if (values.endDate) body.endDate = values.endDate;

    const res = await fetch(`${API_URL}/orgs/${orgId}/seasons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      const message = err?.message || err?.error || "Failed to create season";
      setError("root", { message });
      return;
    }

    const data = await res.json();
    onCreated(data.season);
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          <span className="hidden sm:inline">New season</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create season</DialogTitle>
            <DialogDescription>
              Add a new season to organize your games.
            </DialogDescription>
          </DialogHeader>

          {errors.root && (
            <p className="text-sm text-destructive px-1">
              {errors.root.message}
            </p>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                placeholder='e.g. "Spring 2026"'
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start date</Label>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker
                      value={parseDateString(field.value)}
                      onChange={(date) => {
                        field.onChange(dateToDateString(date) ?? "");
                      }}
                      placeholder="Start date"
                      dateFormat="MMM d, yyyy"
                    />
                  )}
                />
                {errors.startDate && (
                  <p className="text-sm text-destructive">
                    {errors.startDate.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>End date</Label>
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <DatePicker
                      value={parseDateString(field.value)}
                      onChange={(date) => {
                        field.onChange(dateToDateString(date) ?? "");
                      }}
                      placeholder="End date"
                      dateFormat="MMM d, yyyy"
                    />
                  )}
                />
                {errors.endDate && (
                  <p className="text-sm text-destructive">
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create season"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit Season Dialog
// ---------------------------------------------------------------------------

function EditSeasonDialog({
  season,
  orgId,
  onUpdated,
}: {
  season: SeasonData;
  orgId: string;
  onUpdated: (season: SeasonData) => void;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateSeasonValues>({
    resolver: standardSchemaResolver(createSeasonSchema),
    defaultValues: {
      name: season.name,
      startDate: dateToDateString(parseDateString(season.startDate)),
      endDate: dateToDateString(parseDateString(season.endDate)),
    },
  });

  const onSubmit = async (values: CreateSeasonValues) => {
    const body: Record<string, string | null> = { name: values.name };
    body.startDate = values.startDate || null;
    body.endDate = values.endDate || null;

    const res = await fetch(`${API_URL}/orgs/${orgId}/seasons/${season.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      const message = err?.message || err?.error || "Failed to update season";
      setError("root", { message });
      return;
    }

    const data = await res.json();
    onUpdated(data.season);
    setOpen(false);
  };

  // Reset form values when dialog opens (in case season prop changed)
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      reset({
        name: season.name,
        startDate: dateToDateString(parseDateString(season.startDate)),
        endDate: dateToDateString(parseDateString(season.endDate)),
      });
    }
    setOpen(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Pencil className="size-4 mr-2" />
          Edit
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit season</DialogTitle>
            <DialogDescription>Update the season details.</DialogDescription>
          </DialogHeader>

          {errors.root && (
            <p className="text-sm text-destructive px-1 pt-2">
              {errors.root.message}
            </p>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`edit-name-${season.id}`}>Name</Label>
              <Input id={`edit-name-${season.id}`} {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start date</Label>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker
                      value={parseDateString(field.value)}
                      onChange={(date) => {
                        field.onChange(dateToDateString(date) ?? "");
                      }}
                      placeholder="Start date"
                      dateFormat="MMM d, yyyy"
                    />
                  )}
                />
                {errors.startDate && (
                  <p className="text-sm text-destructive">
                    {errors.startDate.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>End date</Label>
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <DatePicker
                      value={parseDateString(field.value)}
                      onChange={(date) => {
                        field.onChange(dateToDateString(date) ?? "");
                      }}
                      placeholder="End date"
                      dateFormat="MMM d, yyyy"
                    />
                  )}
                />
                {errors.endDate && (
                  <p className="text-sm text-destructive">
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Season Row
// ---------------------------------------------------------------------------

function SeasonRow({
  season,
  orgId,
  isCoach,
  onUpdated,
  onDeleted,
}: {
  season: SeasonData;
  orgId: string;
  isCoach: boolean;
  onUpdated: (season: SeasonData) => void;
  onDeleted: (seasonId: string) => void;
}) {
  const router = useRouter();
  const dateRange = formatDateRange(season.startDate, season.endDate);
  const gameCount = season._count?.games ?? 0;

  return (
    <div
      className="flex items-center gap-4 py-3.5 px-3 -mx-3 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => router.push(`/seasons/${season.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/seasons/${season.id}`);
      }}
    >
      {/* Icon */}
      <div className="shrink-0 size-10 rounded-md bg-primary/10 flex items-center justify-center">
        <Calendar className="size-5 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{season.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {dateRange && (
            <span className="text-xs text-muted-foreground">{dateRange}</span>
          )}
          <Badge variant="secondary" className="text-xs">
            {gameCount} game{gameCount !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      {isCoach && (
        <div
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
                <span className="sr-only">Season options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <EditSeasonDialog
                season={season}
                orgId={orgId}
                onUpdated={onUpdated}
              />
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete &ldquo;{season.name}&rdquo;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {gameCount > 0
                        ? `This season has ${gameCount} game${gameCount !== 1 ? "s" : ""}. You must move or delete all games before deleting the season.`
                        : "This will permanently delete this season. This action cannot be undone."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleted(season.id)}
                      disabled={gameCount > 0}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SeasonsContent({
  initialSeasons,
  role,
  activeOrgId,
}: {
  initialSeasons: SeasonData[];
  role: string;
  activeOrgId: string;
}) {
  const [seasons, setSeasons] = useState<SeasonData[]>(initialSeasons);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isCoach = isCoachRole(role);

  const handleCreated = useCallback((season: SeasonData) => {
    setSeasons((prev) => [season, ...prev]);
  }, []);

  const handleUpdated = useCallback((updated: SeasonData) => {
    setSeasons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const handleDeleted = useCallback(
    async (seasonId: string) => {
      setDeleteError(null);
      const res = await fetch(
        `${API_URL}/orgs/${activeOrgId}/seasons/${seasonId}`,
        { method: "DELETE", credentials: "include" },
      );

      if (res.ok) {
        setSeasons((prev) => prev.filter((s) => s.id !== seasonId));
      } else {
        const err = await res.json().catch(() => null);
        setDeleteError(err?.message || err?.error || "Failed to delete season");
      }
    },
    [activeOrgId],
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seasons</h1>
          {seasons.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {seasons.length} season{seasons.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {isCoach && (
          <CreateSeasonDialog orgId={activeOrgId} onCreated={handleCreated} />
        )}
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div className="flex items-center justify-between gap-2 mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{deleteError}</p>
          <button
            type="button"
            className="shrink-0 text-destructive hover:text-destructive/80"
            onClick={() => setDeleteError(null)}
            aria-label="Dismiss error"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Season list */}
      {seasons.length === 0 ? (
        <Empty className="min-h-75">
          <EmptyMedia>
            <Calendar className="size-16 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No seasons yet</EmptyTitle>
            <EmptyDescription>
              {isCoach
                ? "Create your first season to start organizing games."
                : "Your coach hasn't created any seasons yet."}
            </EmptyDescription>
          </EmptyHeader>
          {isCoach && (
            <CreateSeasonDialog orgId={activeOrgId} onCreated={handleCreated} />
          )}
        </Empty>
      ) : (
        <div>
          <Separator className="mb-1" />
          {seasons.map((season) => (
            <SeasonRow
              key={season.id}
              season={season}
              orgId={activeOrgId}
              isCoach={isCoach}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
