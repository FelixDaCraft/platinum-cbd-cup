"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Lock, Info } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  currencyEnum,
  currencySymbols,
  formatPriceForInput,
  parsePriceInput,
  type Currency,
} from "~/lib/validations/pricing";

const formSchema = z.object({
  priceInput: z.string().optional(),
  currency: z.enum(currencyEnum),
});

type FormData = z.infer<typeof formSchema>;

interface PricingFormProps {
  defaultPricePerProduct: number | null;
  currency: Currency;
  cupStatus: string;
  onSubmit: (data: { defaultPricePerProduct: number | null; currency: Currency }) => void;
  isSubmitting: boolean;
}

export function PricingForm({
  defaultPricePerProduct,
  currency,
  cupStatus,
  onSubmit,
  isSubmitting,
}: PricingFormProps) {
  const isLocked = cupStatus !== "draft";

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      priceInput: formatPriceForInput(defaultPricePerProduct),
      currency: currency,
    },
  });

  const handleSubmit = (data: FormData) => {
    const priceInCents = parsePriceInput(data.priceInput ?? "");
    onSubmit({
      defaultPricePerProduct: priceInCents,
      currency: data.currency,
    });
  };

  const watchCurrency = form.watch("currency");
  const symbol = currencySymbols[watchCurrency];

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priceInput" className="text-sm font-medium">
            Prix par défaut par produit
          </Label>
          <div className="relative">
            <Input
              id="priceInput"
              type="text"
              placeholder="0,00"
              {...form.register("priceInput")}
              className="pr-10 h-11"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              {symbol}
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            Laissez vide pour une participation gratuite
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="currency" className="text-sm font-medium">
              Devise
            </Label>
            {isLocked && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ border: "1px solid var(--n-border-visible)", color: "var(--n-text-secondary)" }}>
                <Lock className="h-3 w-3" />
                <span>Verrouillé</span>
              </div>
            )}
          </div>
          <Select
            value={form.watch("currency")}
            onValueChange={(value) => form.setValue("currency", value as Currency)}
            disabled={isLocked}
          >
            <SelectTrigger id="currency" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencyEnum.map((curr) => (
                <SelectItem key={curr} value={curr}>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{curr}</span>
                    <span className="text-muted-foreground">({currencySymbols[curr]})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLocked && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              La devise ne peut pas être modifiée après publication
            </p>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer les modifications
        </Button>
      </div>
    </form>
  );
}
