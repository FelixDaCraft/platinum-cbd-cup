"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Lock } from "lucide-react";
import { toast } from "sonner";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { api } from "~/trpc/react";
import { LATE_WARNING_DAYS } from "~/lib/parcel-shipment";

interface SamplesDeadlineFormProps {
  cupId: string;
  /** Jour civil « AAAA-MM-JJ », null si la cup n'annonce pas de date limite. */
  initialValue: string | null;
  disabled: boolean;
  onSuccess?: () => void;
}

/** « 2027-01-09 » ↔ Date locale à midi : le jour choisi ne bouge pas avec le fuseau. */
const toDay = (date: Date) => format(date, "yyyy-MM-dd");
const fromDay = (day: string) => new Date(`${day}T12:00:00`);

/**
 * Date limite de réception des colis d'échantillons. Ce n'est pas une
 * transition de phase : elle s'enregistre à part et alimente le suivi des
 * colis (état « En retard »), l'espace producteur et le site public.
 */
export function SamplesDeadlineForm({
  cupId,
  initialValue,
  disabled,
  onSuccess,
}: SamplesDeadlineFormProps) {
  const [value, setValue] = useState<string | null>(initialValue);
  const dirty = value !== initialValue;

  const save = api.cup.updateSamplesDeadline.useMutation({
    onSuccess: () => {
      toast.success("Date limite de réception enregistrée");
      onSuccess?.();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2 max-w-md">
        <div className="flex items-center justify-between">
          <Label htmlFor="samplesDeadline" className="flex items-center gap-2">
            Réception des échantillons, au plus tard le
            {disabled && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          {value && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => setValue(null)}
            >
              Effacer
            </Button>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="samplesDeadline"
              variant="outline"
              disabled={disabled}
              className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(fromDay(value), "PPP", { locale: fr }) : <span>Aucune date limite</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value ? fromDay(value) : undefined}
              onSelect={(date) => setValue(date ? toDay(date) : null)}
              locale={fr}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          Jusqu&apos;à 23 h 59 (heure de Paris). Affichée aux producteurs et sur le site public ;
          un colis non expédié {LATE_WARNING_DAYS} jours avant, ou non reçu après, passe « En retard ».
          Sans date, aucun colis n&apos;est en retard.
        </p>
      </div>

      <Button
        type="button"
        disabled={disabled || !dirty || save.isPending}
        onClick={() => save.mutate({ cupId, samplesDeadline: value })}
      >
        {save.isPending ? "Enregistrement…" : "Enregistrer la date limite"}
      </Button>
    </div>
  );
}
