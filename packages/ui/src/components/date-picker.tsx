"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";

interface DatePickerProps {
  /** The currently selected date. */
  value?: Date | null;
  /** Callback when the date changes. Receives the Date or null if cleared. */
  onChange?: (date: Date | null) => void;
  /** Placeholder text when no date is selected. */
  placeholder?: string;
  /** Whether the picker is disabled. */
  disabled?: boolean;
  /** Optional className for the trigger button. */
  className?: string;
  /** Date format string (date-fns). Defaults to "PPP" (e.g. "January 1, 2026"). */
  dateFormat?: string;
  /** Minimum selectable date. */
  fromDate?: Date;
  /** Maximum selectable date. */
  toDate?: Date;
  /** Optional id for the trigger button (for label association). */
  id?: string;
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  dateFormat = "PPP",
  fromDate,
  toDate,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, dateFormat) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            onChange?.(date ?? null);
            setOpen(false);
          }}
          defaultMonth={value ?? undefined}
          fromDate={fromDate}
          toDate={toDate}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
export type { DatePickerProps };
