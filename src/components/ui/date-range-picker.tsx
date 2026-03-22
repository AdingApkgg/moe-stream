"use client";

import * as React from "react";
import { format, subDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRangeValue {
  from: Date;
  to: Date;
}

interface PresetOption {
  label: string;
  days: number;
}

const DEFAULT_PRESETS: PresetOption[] = [
  { label: "7天", days: 7 },
  { label: "14天", days: 14 },
  { label: "30天", days: 30 },
];

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  presets?: PresetOption[];
  maxDays?: number;
  className?: string;
}

function matchPreset(value: DateRangeValue, presets: PresetOption[]): number | null {
  const today = startOfDay(new Date());
  const to = startOfDay(value.to);
  if (to.getTime() !== today.getTime()) return null;

  const diff = differenceInDays(value.to, value.from) + 1;
  const match = presets.find((p) => p.days === diff);
  return match?.days ?? null;
}

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  maxDays = 90,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const activePreset = matchPreset(value, presets);

  const handlePreset = (days: number) => {
    const today = startOfDay(new Date());
    onChange({
      from: subDays(today, days - 1),
      to: today,
    });
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (!range?.from) return;
    if (range.from && range.to) {
      onChange({
        from: startOfDay(range.from),
        to: startOfDay(range.to),
      });
      setOpen(false);
    }
  };

  const calendarRange: DateRange = {
    from: value.from,
    to: value.to,
  };

  const formatRange = () => {
    return `${format(value.from, "M/d")} - ${format(value.to, "M/d")}`;
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {presets.map((preset) => (
        <Button
          key={preset.days}
          variant={activePreset === preset.days ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => handlePreset(preset.days)}
        >
          {preset.label}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activePreset === null ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 text-xs px-2 gap-1",
              activePreset === null && "min-w-[100px]"
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {activePreset === null ? formatRange() : "自定义"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={value.from}
            selected={calendarRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={zhCN}
            disabled={{
              after: new Date(),
              before: subDays(new Date(), maxDays),
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function createDateRange(days: number): DateRangeValue {
  const today = startOfDay(new Date());
  return {
    from: subDays(today, days - 1),
    to: today,
  };
}

export function dateRangeToApi(range: DateRangeValue) {
  return {
    from: startOfDay(range.from).toISOString(),
    to: endOfDay(range.to).toISOString(),
  };
}
