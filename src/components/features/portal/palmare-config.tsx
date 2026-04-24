"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  LayoutGrid,
  List,
  Clock,
  Filter,
  CreditCard,
  Rows3,
  Blend,
  Trophy,
  Eye,
  Tag,
  FolderOpen,
} from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";

// Layout options
const layoutOptions = [
  {
    id: "masonry",
    name: "Grid Masonry",
    description: "Grille Pinterest avec cartes de tailles variées",
    icon: LayoutGrid,
    preview: "masonry",
  },
  {
    id: "list",
    name: "Liste",
    description: "Tableau compact avec tri par colonnes",
    icon: List,
    preview: "list",
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Chronologie verticale par cup",
    icon: Clock,
    preview: "timeline",
  },
] as const;

// Filter style options
const filterOptions = [
  {
    id: "chips",
    name: "Chips",
    description: "Tags cliquables modernes",
    icon: Tag,
  },
  {
    id: "dropdown",
    name: "Dropdown",
    description: "Menus déroulants compacts",
    icon: Filter,
  },
  {
    id: "sidebar",
    name: "Sidebar",
    description: "Barre latérale fixe",
    icon: FolderOpen,
  },
] as const;

// Display style options
const displayOptions = [
  {
    id: "cards",
    name: "Cards Premium",
    description: "Cartes élégantes",
    icon: CreditCard,
  },
  {
    id: "rows",
    name: "Rows Compactes",
    description: "Lignes denses et efficaces",
    icon: Rows3,
  },
  {
    id: "hybrid",
    name: "Hybrid",
    description: "Cards pour top 3, rows pour le reste",
    icon: Blend,
  },
] as const;

// Form schema
const palmareConfigSchema = z.object({
  palmareLayout: z.enum(["masonry", "list", "timeline"]),
  palmareFilterStyle: z.enum(["chips", "dropdown", "sidebar"]),
  palmareDisplayStyle: z.enum(["cards", "rows", "hybrid"]),
  palmareShowScore: z.boolean(),
  palmareShowCategory: z.boolean(),
});

type PalmareConfigValues = z.infer<typeof palmareConfigSchema>;

/**
 * Option Card Component
 */
function OptionCard({
  option,
  isSelected,
  onSelect,
}: {
  option: {
    id: string;
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  };
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex flex-col items-start gap-3 rounded-xl p-4 text-left transition-colors"
      style={{
        border: isSelected ? "1px solid var(--n-accent)" : "1px solid var(--n-border)",
        background: isSelected ? "var(--n-surface-raised)" : "transparent",
      }}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--n-accent)" }}>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: "var(--n-black)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}

      {/* Icon */}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ border: isSelected ? "1px solid var(--n-accent)" : "1px solid var(--n-border)" }}
      >
        <Icon
          className="h-5 w-5"
          style={{ color: isSelected ? "var(--n-accent)" : "var(--n-text-secondary)" }}
        />
      </div>

      {/* Content */}
      <div className="space-y-1">
        <h4 className="font-medium">{option.name}</h4>
        <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>{option.description}</p>
      </div>
    </button>
  );
}

/**
 * Layout Preview Component
 */
function LayoutPreview({ layout }: { layout: string }) {
  return (
    <div className="rounded-xl p-4" style={{ border: "1px solid var(--n-border)" }}>
      <div className="mb-3 flex items-center gap-2">
        <Eye className="h-3 w-3" style={{ color: "var(--n-text-disabled)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--n-text-secondary)" }}>Apercu du layout</span>
      </div>
      <div className="h-32 rounded-lg p-2" style={{ border: "1px solid var(--n-border)" }}>
        {layout === "masonry" && (
          <div className="grid h-full grid-cols-3 gap-1.5">
            <div className="row-span-2 rounded-md" style={{ background: "rgba(212,168,67,0.4)", border: "1px solid rgba(212,168,67,0.3)" }} />
            <div className="rounded-md" style={{ background: "rgba(212,168,67,0.3)", border: "1px solid rgba(212,168,67,0.2)" }} />
            <div className="rounded-md" style={{ background: "rgba(212,168,67,0.2)", border: "1px solid rgba(212,168,67,0.15)" }} />
            <div className="rounded-md" style={{ background: "rgba(212,168,67,0.3)", border: "1px solid rgba(212,168,67,0.2)" }} />
            <div className="row-span-2 rounded-md" style={{ background: "rgba(212,168,67,0.4)", border: "1px solid rgba(212,168,67,0.3)" }} />
            <div className="rounded-md" style={{ background: "rgba(212,168,67,0.2)", border: "1px solid rgba(212,168,67,0.15)" }} />
            <div className="rounded-md" style={{ background: "rgba(212,168,67,0.3)", border: "1px solid rgba(212,168,67,0.2)" }} />
          </div>
        )}
        {layout === "list" && (
          <div className="flex h-full flex-col gap-1.5">
            <div className="flex h-6 items-center gap-2 rounded-md px-2" style={{ border: "1px solid var(--n-border)" }}>
              <div className="h-3 w-3 rounded-full" style={{ background: "var(--n-warning)" }} />
              <div className="h-2 flex-1 rounded" style={{ background: "var(--n-border-visible)" }} />
            </div>
            <div className="flex h-6 items-center gap-2 rounded-md px-2" style={{ border: "1px solid var(--n-border)" }}>
              <div className="h-3 w-3 rounded-full" style={{ background: "var(--n-text-disabled)" }} />
              <div className="h-2 flex-1 rounded" style={{ background: "var(--n-border)" }} />
            </div>
            <div className="flex h-6 items-center gap-2 rounded-md px-2" style={{ border: "1px solid var(--n-border)" }}>
              <div className="h-3 w-3 rounded-full" style={{ background: "rgba(212,168,67,0.6)" }} />
              <div className="h-2 flex-1 rounded" style={{ background: "var(--n-border)" }} />
            </div>
            <div className="flex h-6 items-center gap-2 rounded-md px-2" style={{ border: "1px solid var(--n-border)" }}>
              <div className="h-3 w-3 rounded-full" style={{ background: "var(--n-border-visible)" }} />
              <div className="h-2 flex-1 rounded" style={{ background: "var(--n-border)" }} />
            </div>
          </div>
        )}
        {layout === "timeline" && (
          <div className="flex h-full gap-3">
            <div className="flex w-1.5 flex-col items-center">
              <div className="h-3 w-3 rounded-full" style={{ background: "var(--n-warning)" }} />
              <div className="flex-1 w-0.5" style={{ background: "rgba(212,168,67,0.5)" }} />
              <div className="h-3 w-3 rounded-full" style={{ background: "rgba(212,168,67,0.7)" }} />
              <div className="flex-1 w-0.5" style={{ background: "rgba(212,168,67,0.3)" }} />
              <div className="h-3 w-3 rounded-full" style={{ background: "rgba(212,168,67,0.5)" }} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-8 rounded-md px-2 py-1" style={{ border: "1px solid var(--n-border)" }}>
                <div className="h-2 w-20 rounded" style={{ background: "var(--n-border-visible)" }} />
              </div>
              <div className="h-8 rounded-md px-2 py-1" style={{ border: "1px solid var(--n-border)" }}>
                <div className="h-2 w-16 rounded" style={{ background: "var(--n-border)" }} />
              </div>
              <div className="h-8 rounded-md px-2 py-1" style={{ border: "1px solid var(--n-border)" }}>
                <div className="h-2 w-14 rounded" style={{ background: "var(--n-border)" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Palmare Configuration Component
 */
export function PalmareConfig() {
  const utils = api.useUtils();

  // Get current config
  const { data: themeConfig, isLoading } = api.portal.getThemeConfig.useQuery();

  // Update mutation
  const updateConfig = api.portal.updatePalmareConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration du palmarès mise à jour");
      void utils.portal.getThemeConfig.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  // Form
  const form = useForm<PalmareConfigValues>({
    resolver: zodResolver(palmareConfigSchema),
    defaultValues: {
      palmareLayout: "masonry",
      palmareFilterStyle: "chips",
      palmareDisplayStyle: "cards",
      palmareShowScore: true,
      palmareShowCategory: true,
    },
    values: themeConfig
      ? {
          palmareLayout: themeConfig.palmareLayout as PalmareConfigValues["palmareLayout"],
          palmareFilterStyle: themeConfig.palmareFilterStyle as PalmareConfigValues["palmareFilterStyle"],
          palmareDisplayStyle: themeConfig.palmareDisplayStyle as PalmareConfigValues["palmareDisplayStyle"],
          palmareShowScore: themeConfig.palmareShowScore,
          palmareShowCategory: themeConfig.palmareShowCategory,
        }
      : undefined,
  });

  const watchedLayout = form.watch("palmareLayout");

  const onSubmit = (values: PalmareConfigValues) => {
    updateConfig.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm text-muted-foreground">[LOADING...]</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-5">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="font-semibold text-lg">Page Palmares</h3>
          <p className="text-sm text-muted-foreground">
            Configurez l&apos;affichage de la page des resultats et laureats
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Layout Selection */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Layout</h3>
              <p className="text-xs text-muted-foreground">
                Choisissez la disposition generale de la page
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="palmareLayout"
                render={({ field }) => (
                  <>
                    {layoutOptions.map((option) => (
                      <OptionCard
                        key={option.id}
                        option={option}
                        isSelected={field.value === option.id}
                        onSelect={() => field.onChange(option.id)}
                      />
                    ))}
                  </>
                )}
              />
            </div>

            {/* Layout Preview */}
            <LayoutPreview layout={watchedLayout} />
          </div>

          <Separator />

          {/* Filter Style Selection */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Style des filtres</h3>
              <p className="text-xs text-muted-foreground">
                Comment les visiteurs filtrent les resultats
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="palmareFilterStyle"
                render={({ field }) => (
                  <>
                    {filterOptions.map((option) => (
                      <OptionCard
                        key={option.id}
                        option={option}
                        isSelected={field.value === option.id}
                        onSelect={() => field.onChange(option.id)}
                      />
                    ))}
                  </>
                )}
              />
            </div>
          </div>

          <Separator />

          {/* Display Style Selection */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Affichage des resultats</h3>
              <p className="text-xs text-muted-foreground">
                Le style visuel des produits laureats
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="palmareDisplayStyle"
                render={({ field }) => (
                  <>
                    {displayOptions.map((option) => (
                      <OptionCard
                        key={option.id}
                        option={option}
                        isSelected={field.value === option.id}
                        onSelect={() => field.onChange(option.id)}
                      />
                    ))}
                  </>
                )}
              />
            </div>
          </div>

          <Separator />

          {/* Additional Options */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Options d&apos;affichage</h3>
              <p className="text-xs text-muted-foreground">
                Informations additionnelles a afficher
              </p>
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="palmareShowScore"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Afficher les scores
                      </FormLabel>
                      <FormDescription>
                        Montrer le score obtenu par chaque produit
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="palmareShowCategory"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        Afficher les categories
                      </FormLabel>
                      <FormDescription>
                        Montrer la categorie de chaque produit
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending ? "[LOADING...]" : "Enregistrer les modifications"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
