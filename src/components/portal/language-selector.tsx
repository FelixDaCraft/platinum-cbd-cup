"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  locales,
  localeNames,
  localeFlags,
  type Locale,
} from "~/i18n/config";

interface LanguageSelectorProps {
  currentLocale: Locale;
  availableLocales?: Locale[];
  variant?: "dropdown" | "buttons";
}

export function LanguageSelector({
  currentLocale,
  availableLocales = [...locales],
  variant = "dropdown",
}: LanguageSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (locale: Locale) => {
    // Set locale cookie
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`;

    // Refresh the page to apply new locale
    startTransition(() => {
      router.refresh();
    });
  };

  if (variant === "buttons") {
    return (
      <div className="flex items-center gap-1">
        {availableLocales.map((locale) => (
          <Button
            key={locale}
            variant={currentLocale === locale ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleLocaleChange(locale)}
            disabled={isPending || currentLocale === locale}
            className="text-xs"
          >
            {localeFlags[locale]} {locale.toUpperCase()}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending}>
          <Globe className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{localeFlags[currentLocale]}</span>
          <span className="ml-1">{currentLocale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableLocales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className="cursor-pointer"
          >
            <span className="mr-2">{localeFlags[locale]}</span>
            <span className="flex-1">{localeNames[locale]}</span>
            {currentLocale === locale && (
              <Check className="h-4 w-4 ml-2" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
