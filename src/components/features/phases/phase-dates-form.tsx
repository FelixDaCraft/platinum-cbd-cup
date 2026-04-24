"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, AlertCircle, Lock, Clock } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { UpdatePhaseDatesInput } from "~/lib/validations/phases";
import type { CupStatus } from "~/server/db/schema/cups";

interface PhaseDatesFormProps {
  cupId: string;
  cupStatus: CupStatus;
  initialData: {
    registrationOpenAt: Date | null;
    registrationCloseAt: Date | null;
    ratingStartAt: Date | null;
    ratingEndAt: Date | null;
  };
  editableDates: string[];
  onSuccess?: () => void;
}

interface DateFieldProps {
  label: string;
  fieldName: keyof Omit<UpdatePhaseDatesInput, "cupId">;
  value: Date | null;
  onChange: (date: Date | null) => void;
  disabled: boolean;
  error?: string;
}

function DateTimeField({
  label,
  fieldName,
  value,
  onChange,
  disabled,
  error,
}: DateFieldProps) {
  const [time, setTime] = useState(
    value ? format(value, "HH:mm") : "09:00"
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      onChange(null);
      return;
    }
    const [hours, minutes] = time.split(":").map(Number);
    date.setHours(hours ?? 9, minutes ?? 0, 0, 0);
    onChange(date);
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (value) {
      const [hours, minutes] = newTime.split(":").map(Number);
      const newDate = new Date(value);
      newDate.setHours(hours ?? 9, minutes ?? 0, 0, 0);
      onChange(newDate);
    }
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={fieldName} className="flex items-center gap-2">
          {label}
          {disabled && <Lock className="h-3 w-3 text-muted-foreground" />}
        </Label>
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClear}
          >
            Effacer
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={fieldName}
              variant="outline"
              disabled={disabled}
              className={cn(
                "flex-1 justify-start text-left font-normal",
                !value && "text-muted-foreground",
                error && "border-destructive"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? (
                format(value, "PPP", { locale: fr })
              ) : (
                <span>Choisir une date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value ?? undefined}
              onSelect={handleDateSelect}
              locale={fr}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <div className="relative">
          <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
          <Input
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            disabled={disabled || !value}
            className={cn(
              "w-[130px] pl-9 text-foreground",
              "[color-scheme:dark]",
              "[&::-webkit-calendar-picker-indicator]:opacity-70",
              "[&::-webkit-calendar-picker-indicator]:hover:opacity-100",
              "[&::-webkit-calendar-picker-indicator]:cursor-pointer"
            )}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

export function PhaseDatesForm({
  cupId,
  cupStatus,
  initialData,
  editableDates,
  onSuccess,
}: PhaseDatesFormProps) {
  const [dates, setDates] = useState({
    registrationOpenAt: initialData.registrationOpenAt,
    registrationCloseAt: initialData.registrationCloseAt,
    ratingStartAt: initialData.ratingStartAt,
    ratingEndAt: initialData.ratingEndAt,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const utils = api.useUtils();

  const updatePhaseDates = api.cup.updatePhaseDates.useMutation({
    onSuccess: () => {
      toast.success("Dates des phases mises a jour");
      utils.cup.getPhaseDates.invalidate({ cupId });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const canEdit = (fieldName: string) => editableDates.includes(fieldName);

  const validateDates = () => {
    const errors: Record<string, string> = {};

    // Check registration dates order
    if (dates.registrationOpenAt && dates.registrationCloseAt) {
      if (dates.registrationOpenAt >= dates.registrationCloseAt) {
        errors.registrationCloseAt =
          "Doit etre apres l'ouverture des inscriptions";
      }
    }

    // Check rating dates order
    if (dates.ratingStartAt && dates.ratingEndAt) {
      if (dates.ratingStartAt >= dates.ratingEndAt) {
        errors.ratingEndAt = "Doit etre apres le debut de la notation";
      }
    }

    // Check registration close vs rating start
    if (dates.registrationCloseAt && dates.ratingStartAt) {
      if (dates.registrationCloseAt > dates.ratingStartAt) {
        errors.ratingStartAt =
          "Doit etre apres ou egal a la cloture des inscriptions";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateDates()) {
      toast.error("Veuillez corriger les erreurs de dates");
      return;
    }

    updatePhaseDates.mutate({
      cupId,
      registrationOpenAt: dates.registrationOpenAt,
      registrationCloseAt: dates.registrationCloseAt,
      ratingStartAt: dates.ratingStartAt,
      ratingEndAt: dates.ratingEndAt,
    });
  };

  const handleDateChange = (
    field: keyof typeof dates,
    value: Date | null
  ) => {
    setDates((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when it changes
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const hasChanges =
    dates.registrationOpenAt !== initialData.registrationOpenAt ||
    dates.registrationCloseAt !== initialData.registrationCloseAt ||
    dates.ratingStartAt !== initialData.ratingStartAt ||
    dates.ratingEndAt !== initialData.ratingEndAt;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <DateTimeField
          label="Ouverture des inscriptions"
          fieldName="registrationOpenAt"
          value={dates.registrationOpenAt}
          onChange={(date) => handleDateChange("registrationOpenAt", date)}
          disabled={!canEdit("registrationOpenAt")}
          error={validationErrors.registrationOpenAt}
        />

        <DateTimeField
          label="Cloture des inscriptions"
          fieldName="registrationCloseAt"
          value={dates.registrationCloseAt}
          onChange={(date) => handleDateChange("registrationCloseAt", date)}
          disabled={!canEdit("registrationCloseAt")}
          error={validationErrors.registrationCloseAt}
        />

        <DateTimeField
          label="Debut de la notation"
          fieldName="ratingStartAt"
          value={dates.ratingStartAt}
          onChange={(date) => handleDateChange("ratingStartAt", date)}
          disabled={!canEdit("ratingStartAt")}
          error={validationErrors.ratingStartAt}
        />

        <DateTimeField
          label="Fin de la notation"
          fieldName="ratingEndAt"
          value={dates.ratingEndAt}
          onChange={(date) => handleDateChange("ratingEndAt", date)}
          disabled={!canEdit("ratingEndAt")}
          error={validationErrors.ratingEndAt}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Laissez les dates vides pour gerer les transitions manuellement.
      </p>

      {cupStatus !== "draft" && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Certaines dates sont verrouillees car la cup n'est plus en brouillon.
          </span>
        </div>
      )}

      <Button
        type="submit"
        disabled={updatePhaseDates.isPending || !hasChanges}
        className="w-full sm:w-auto"
      >
        {updatePhaseDates.isPending
          ? "Enregistrement..."
          : "Enregistrer les dates"}
      </Button>
    </form>
  );
}
