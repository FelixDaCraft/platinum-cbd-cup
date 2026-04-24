"use client";

import { Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { LABEL_COLOR_PALETTE } from "~/lib/validations/labels";

interface ColorPalettePickerProps {
  value: string | null;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPalettePicker({
  value,
  onChange,
  disabled = false,
}: ColorPalettePickerProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {LABEL_COLOR_PALETTE.map((color) => (
          <button
            key={color.hex}
            type="button"
            disabled={disabled}
            onClick={() => onChange(color.hex)}
            className={cn(
              "relative h-10 w-full rounded-md border-2 transition-all",
              "hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              value === color.hex
                ? "border-primary ring-2 ring-primary ring-offset-2"
                : "border-transparent",
              disabled && "cursor-not-allowed opacity-50"
            )}
            style={{ backgroundColor: color.hex }}
            title={color.name}
          >
            {value === color.hex && (
              <Check
                className={cn(
                  "absolute inset-0 m-auto h-5 w-5",
                  // Use white check for dark colors, dark check for light colors
                  ["#CD7F32", "#3B82F6", "#EF4444", "#8B5CF6", "#22C55E"].includes(
                    color.hex
                  )
                    ? "text-white"
                    : "text-gray-800"
                )}
              />
            )}
          </button>
        ))}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          Sélectionné:{" "}
          {LABEL_COLOR_PALETTE.find((c) => c.hex === value)?.name ?? value}
        </p>
      )}
    </div>
  );
}
