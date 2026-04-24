"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Code, RefreshCw, Lock, Sparkles } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Textarea } from "~/components/ui/textarea";

// Custom CSS form schema
const customCssSchema = z.object({
  customCss: z.string().max(50000, "CSS trop long (max 50000 caracteres)"),
});

type CustomCssValues = z.infer<typeof customCssSchema>;

/**
 * Custom CSS Section for Portal Appearance Settings
 * Enterprise-only feature for advanced portal customization
 */
export function CustomCssSection() {
  const utils = api.useUtils();

  // Fetch theme config
  const { data: themeConfig, isLoading: isLoadingConfig } =
    api.portal.getThemeConfig.useQuery();

  // Update custom CSS mutation
  const updateCustomCssMutation = api.portal.updateCustomCss.useMutation({
    onSuccess: () => {
      toast.success("CSS personnalise mis a jour");
      utils.portal.getThemeConfig.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Remove custom CSS mutation
  const removeCustomCssMutation = api.portal.removeCustomCss.useMutation({
    onSuccess: () => {
      toast.success("CSS personnalise supprime");
      utils.portal.getThemeConfig.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Custom CSS form
  const customCssForm = useForm<CustomCssValues>({
    resolver: zodResolver(customCssSchema),
    values: {
      customCss: themeConfig?.customCss ?? "",
    },
  });

  const handleCustomCssSubmit = (values: CustomCssValues) => {
    updateCustomCssMutation.mutate({
      customCss: values.customCss,
    });
  };

  const handleRemoveCustomCss = () => {
    removeCustomCssMutation.mutate();
    customCssForm.reset({ customCss: "" });
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  // TODO: Check if user has Enterprise plan
  const hasEnterprisePlan = true; // Placeholder - implement actual check

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Code className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">CSS Personnalise</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }}>
              <Sparkles className="h-3 w-3" />
              Enterprise
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Personnalisation avancee avec du code CSS pour votre portail
          </p>
        </div>
      </div>

      {!hasEnterprisePlan ? (
        // Locked state for non-Enterprise users
        <div className="p-8" style={{ border: "1px solid var(--n-border)", borderRadius: "12px" }}>
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 rounded-full" style={{ border: "1px solid var(--n-border)" }}>
              <Lock className="h-8 w-8" style={{ color: "var(--n-text-secondary)" }} />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Fonctionnalite Enterprise</h3>
              <p className="text-sm max-w-md" style={{ color: "var(--n-text-secondary)" }}>
                Le CSS personnalise est disponible avec le plan Enterprise.
                Passez a un plan superieur pour debloquer cette fonctionnalite
                et personnaliser entierement l&apos;apparence de votre portail.
              </p>
            </div>
            <Button variant="outline">
              <Sparkles className="h-4 w-4 mr-2" />
              Decouvrir Enterprise
            </Button>
          </div>
        </div>
      ) : (
        // CSS Editor for Enterprise users
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Code className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div className="flex-1">
              <h3 className="font-semibold">Editeur CSS</h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Ajoutez du CSS personnalise pour une personnalisation avancee de votre portail.
                Le CSS est automatiquement nettoye pour des raisons de securite.
              </p>
            </div>
          </div>

          <Form {...customCssForm}>
            <form
              onSubmit={customCssForm.handleSubmit(handleCustomCssSubmit)}
              className="space-y-4"
            >
              <FormField
                control={customCssForm.control}
                name="customCss"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code CSS</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={`/* Exemple de CSS personnalise */
.portal-header {
  background: linear-gradient(90deg, var(--portal-primary-hex), var(--portal-secondary-hex));
}

.portal-button {
  border-radius: 9999px;
}

/* Personnaliser les cartes */
.portal-card {
  border: 1px solid var(--portal-border);
}`}
                        className="min-h-[350px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Utilisez les variables CSS du portail pour une integration parfaite.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CSS Variables Reference */}
              <div className="rounded-lg p-4" style={{ border: "1px solid var(--n-border)" }}>
                <h4 className="text-sm font-medium mb-2">Variables CSS disponibles</h4>
                <div className="grid gap-2 sm:grid-cols-2 text-xs" style={{ color: "var(--n-text-secondary)", fontFamily: "'Space Mono', monospace" }}>
                  <div>--portal-primary-hex</div>
                  <div>--portal-secondary-hex</div>
                  <div>--portal-background-hex</div>
                  <div>--portal-text-hex</div>
                  <div>--portal-font-family</div>
                  <div>--portal-border-radius</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={updateCustomCssMutation.isPending}
                >
                  {updateCustomCssMutation.isPending ? "[LOADING...]" : "Enregistrer le CSS"}
                </Button>
                {themeConfig?.customCss && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveCustomCss}
                    disabled={removeCustomCssMutation.isPending}
                  >
                    {removeCustomCssMutation.isPending ? "[LOADING...]" : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reinitialiser
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      )}

      {/* Tips Card */}
      <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
        <div className="flex items-start gap-3">
          <Sparkles className="h-4 w-4 mt-0.5" style={{ color: "var(--n-text-secondary)" }} />
          <div>
            <h4 className="font-medium mb-1">Conseils CSS</h4>
            <ul className="text-sm space-y-1" style={{ color: "var(--n-text-secondary)" }}>
              <li>Utilisez les variables CSS pour respecter votre theme</li>
              <li>Testez vos modifications dans l&apos;apercu du portail</li>
              <li>Le CSS est nettoye pour empecher les scripts malveillants</li>
              <li>Privilegiez les selecteurs specifiques pour eviter les conflits</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
