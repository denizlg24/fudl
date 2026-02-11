"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { clientEnv } from "@repo/env/web";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@repo/ui/components/command";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagOption {
  id: string;
  name: string;
  category: string;
}

interface TagComboboxProps {
  /** Tag category to filter by */
  category: "OPPONENT" | "FIELD" | "CAMERA_ANGLE" | "GENERAL";
  /** Organization ID for API calls */
  orgId: string;
  /** Currently selected tag IDs */
  selectedTagIds: string[];
  /** Callback when selection changes */
  onChange: (tagIds: string[]) => void;
  /** Placeholder text for the trigger button */
  placeholder?: string;
  /** Whether to allow multiple selections */
  multiple?: boolean;
  /** Optional className for the trigger */
  className?: string;
  /** Disable the combobox */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagCombobox({
  category,
  orgId,
  selectedTagIds,
  onChange,
  placeholder = "Select...",
  multiple = true,
  className,
  disabled = false,
}: TagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Fetch tags when popover opens
  const fetchTags = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/orgs/${orgId}/tags?category=${category}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } catch {
      // silent — will show empty list
    } finally {
      setLoading(false);
    }
  }, [orgId, category]);

  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchTags();
    }
    if (open) {
      setCreateError(null);
    }
  }, [open, fetchTags]);

  // Create a new tag
  const handleCreate = useCallback(
    async (name: string) => {
      if (!name.trim() || creating) return;
      setCreating(true);
      try {
        const res = await fetch(`${API_URL}/orgs/${orgId}/tags`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), category }),
        });
        if (res.ok) {
          const data = await res.json();
          const newTag: TagOption = data.tag;
          // Add to local list if not already present
          setTags((prev) =>
            prev.some((t) => t.id === newTag.id)
              ? prev
              : [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)),
          );
          // Auto-select the new tag
          if (multiple) {
            onChange([...selectedTagIds, newTag.id]);
          } else {
            onChange([newTag.id]);
            setOpen(false);
          }
          setSearch("");
        } else {
          setCreateError("Failed to create tag");
        }
      } catch {
        setCreateError("Failed to create tag");
      } finally {
        setCreating(false);
      }
    },
    [orgId, category, multiple, selectedTagIds, onChange, creating],
  );

  // Toggle a tag selection
  const handleSelect = useCallback(
    (tagId: string) => {
      if (multiple) {
        if (selectedTagIds.includes(tagId)) {
          onChange(selectedTagIds.filter((id) => id !== tagId));
        } else {
          onChange([...selectedTagIds, tagId]);
        }
      } else {
        if (selectedTagIds.includes(tagId)) {
          onChange([]);
        } else {
          onChange([tagId]);
        }
        setOpen(false);
      }
    },
    [multiple, selectedTagIds, onChange],
  );

  // Remove a tag from selection (badge X click)
  const handleRemove = useCallback(
    (tagId: string) => {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    },
    [selectedTagIds, onChange],
  );

  // Get selected tag objects
  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  // Check if search term already exists
  const searchTrimmed = search.trim();
  const exactMatch = tags.some(
    (t) => t.name.toLowerCase() === searchTrimmed.toLowerCase(),
  );

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal h-auto min-h-9"
            disabled={disabled}
          >
            {selectedTags.length > 0 ? (
              <span className="truncate text-sm">
                {selectedTags.map((t) => t.name).join(", ")}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">
                {placeholder}
              </span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={true}>
            <CommandInput
              placeholder={`Search ${category.toLowerCase().replace("_", " ")}s...`}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {searchTrimmed ? (
                      <span className="text-muted-foreground">
                        No matches found
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No tags yet</span>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {tags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => handleSelect(tag.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            selectedTagIds.includes(tag.id)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {tag.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {/* Create new option */}
                  {searchTrimmed && !exactMatch && (
                    <CommandGroup>
                      <CommandItem
                        value={`__create__${searchTrimmed}`}
                        onSelect={() => handleCreate(searchTrimmed)}
                        disabled={creating}
                      >
                        <Plus className="mr-2 size-4" />
                        Create &ldquo;{searchTrimmed}&rdquo;
                      </CommandItem>
                    </CommandGroup>
                  )}
                  {createError && (
                    <div className="px-3 py-2 text-sm text-destructive">
                      {createError}
                    </div>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected tags as badges */}
      {multiple && selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
              {tag.name}
              <button
                type="button"
                className="ml-0.5 rounded-full outline-none hover:bg-muted-foreground/20 p-0.5"
                onClick={() => handleRemove(tag.id)}
                aria-label={`Remove ${tag.name}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
