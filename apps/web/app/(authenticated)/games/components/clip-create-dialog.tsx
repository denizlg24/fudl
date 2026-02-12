"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  createClipSchema,
  type CreateClipValues,
} from "@repo/types/validations";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Badge } from "@repo/ui/components/badge";
import { Spinner } from "@repo/ui/components/spinner";
import { clientEnv } from "@repo/env/web";
import type { ClipData } from "./clip-list";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 10);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

interface ClipCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markIn: number;
  markOut: number;
  videoId: string;
  orgId: string;
  existingClips: ClipData[];
  onClipCreated: (clip: ClipData) => void;
}

export function ClipCreateDialog({
  open,
  onOpenChange,
  markIn,
  markOut,
  videoId,
  orgId,
  existingClips,
  onClipCreated,
}: ClipCreateDialogProps) {
  const [saving, setSaving] = useState(false);

  // Compute available play numbers and smart default
  const { defaultPlayNumber, availableOptions } = useMemo(() => {
    // All play numbers across all angles
    const allPlayNumbers = Array.from(
      new Set(existingClips.map((c) => c.playNumber)),
    ).sort((a, b) => a - b);

    // Play numbers that already have a clip on this footage file
    const usedOnThisAngle = new Set(
      existingClips
        .filter((c) => c.videoId === videoId)
        .map((c) => c.playNumber),
    );

    // Existing plays that DON'T have a clip on this angle — available to link to
    const existingAvailable = allPlayNumbers.filter(
      (pn) => !usedOnThisAngle.has(pn),
    );

    // Next new play number
    const maxPlay = allPlayNumbers.length > 0 ? Math.max(...allPlayNumbers) : 0;
    const newPlayNumber = maxPlay + 1;

    // Smart default: sequential based on clips on this angle
    const clipsOnThisAngle = usedOnThisAngle.size;
    let smartDefault = clipsOnThisAngle + 1;
    // If smartDefault is already used on this angle, bump to new
    if (usedOnThisAngle.has(smartDefault)) {
      smartDefault = newPlayNumber;
    }

    const options: Array<{ value: number; label: string; isNew: boolean }> = [
      {
        value: newPlayNumber,
        label: `New play (Play ${newPlayNumber})`,
        isNew: true,
      },
    ];
    for (const pn of existingAvailable) {
      options.push({ value: pn, label: `Play ${pn}`, isNew: false });
    }

    return {
      defaultPlayNumber: smartDefault,
      availableOptions: options,
    };
  }, [existingClips, videoId]);

  const form = useForm<CreateClipValues>({
    resolver: standardSchemaResolver(createClipSchema),
    defaultValues: {
      videoId,
      playNumber: defaultPlayNumber,
      startTime: markIn,
      endTime: markOut,
      labels: [],
    },
  });

  const [labelsInput, setLabelsInput] = useState("");
  const [selectedPlayNumber, setSelectedPlayNumber] = useState(
    String(defaultPlayNumber),
  );

  const duration = markOut - markIn;

  async function onSubmit(values: CreateClipValues) {
    setSaving(true);

    // Parse comma-separated labels
    const labels = labelsInput
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`${API_URL}/orgs/${orgId}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          videoId: values.videoId,
          playNumber: values.playNumber,
          startTime: values.startTime,
          endTime: values.endTime,
          labels: labels.length > 0 ? labels : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || "Failed to save play",
        );
      }

      const data = await res.json();
      onClipCreated(data.clip);
      onOpenChange(false);
      form.reset();
      setLabelsInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Play</DialogTitle>
          <DialogDescription>
            Create a play from the marked time range.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Time range display */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm tabular-nums">
              {formatTime(markIn)}
            </span>
            <span className="text-muted-foreground">—</span>
            <span className="font-mono text-sm tabular-nums">
              {formatTime(markOut)}
            </span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {duration.toFixed(1)}s
            </Badge>
          </div>

          {/* Play number selector */}
          <div className="space-y-1.5">
            <Label>Play number</Label>
            <Select
              value={selectedPlayNumber}
              onValueChange={(v) => {
                setSelectedPlayNumber(v);
                form.setValue("playNumber", Number(v));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select play..." />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fine-tune start/end */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Start (seconds)</Label>
              <Input
                id="startTime"
                type="number"
                step={0.1}
                min={0}
                {...form.register("startTime", { valueAsNumber: true })}
              />
              {form.formState.errors.startTime && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startTime.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">End (seconds)</Label>
              <Input
                id="endTime"
                type="number"
                step={0.1}
                min={0}
                {...form.register("endTime", { valueAsNumber: true })}
              />
              {form.formState.errors.endTime && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.endTime.message}
                </p>
              )}
            </div>
          </div>

          {/* Labels */}
          <div className="space-y-1.5">
            <Label htmlFor="labels">Labels (comma-separated)</Label>
            <Input
              id="labels"
              placeholder="e.g. touchdown, pass, offense"
              value={labelsInput}
              onChange={(e) => setLabelsInput(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner className="size-4 mr-2" />}
              Save play
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
