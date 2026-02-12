"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  updateClipSchema,
  type UpdateClipValues,
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
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import { clientEnv } from "@repo/env/web";
import type { ClipData } from "./clip-list";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

interface ClipEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clip: ClipData;
  orgId: string;
  onClipUpdated: (clip: ClipData) => void;
}

export function ClipEditDialog({
  open,
  onOpenChange,
  clip,
  orgId,
  onClipUpdated,
}: ClipEditDialogProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<UpdateClipValues>({
    resolver: standardSchemaResolver(updateClipSchema),
    defaultValues: {
      startTime: clip.startTime,
      endTime: clip.endTime,
      labels: clip.labels,
    },
  });

  const [labelsInput, setLabelsInput] = useState(clip.labels.join(", "));

  // Reset form when clip changes
  useEffect(() => {
    form.reset({
      startTime: clip.startTime,
      endTime: clip.endTime,
      labels: clip.labels,
    });
    setLabelsInput(clip.labels.join(", "));
  }, [clip, form]);

  async function onSubmit(values: UpdateClipValues) {
    setSaving(true);

    const labels = labelsInput
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`${API_URL}/orgs/${orgId}/clips/${clip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          startTime: values.startTime,
          endTime: values.endTime,
          labels,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || "Failed to update play",
        );
      }

      const data = await res.json();
      onClipUpdated(data.clip);
      onOpenChange(false);
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
          <DialogTitle>Edit Play {clip.playNumber}</DialogTitle>
          <DialogDescription>Update play details.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Fine-tune start/end */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="editStartTime">Start (seconds)</Label>
              <Input
                id="editStartTime"
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
              <Label htmlFor="editEndTime">End (seconds)</Label>
              <Input
                id="editEndTime"
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
            <Label htmlFor="editLabels">Labels (comma-separated)</Label>
            <Input
              id="editLabels"
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
