"use client";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { CupStatus } from "~/server/db/schema/cups";

interface CupConfigAlertsProps {
  status: CupStatus;
  hasCategories: boolean;
  hasCriteria: boolean;
  hasPhaseDates: boolean;
}

interface AlertItem {
  condition: boolean;
  title: string;
  description: string;
}

export function CupConfigAlerts({
  status,
  hasCategories,
  hasCriteria,
  hasPhaseDates,
}: CupConfigAlertsProps) {
  // Only show alerts for draft cups
  if (status !== "draft") {
    return null;
  }

  const alerts: AlertItem[] = [
    {
      condition: !hasCategories,
      title: "Catégories manquantes",
      description: "Ajoutez au moins une catégorie pour pouvoir publier la cup.",
    },
    {
      condition: hasCategories && !hasCriteria,
      title: "Critères de notation manquants",
      description: "Ajoutez au moins un critère de notation dans une catégorie.",
    },
    {
      condition: !hasPhaseDates,
      title: "Dates non configurées",
      description: "Configurez les dates des phases pour automatiser les transitions.",
    },
  ];

  const activeAlerts = alerts.filter((alert) => alert.condition);

  if (activeAlerts.length === 0) {
    // All configured - show success message
    if (hasCategories && hasCriteria) {
      return (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700 dark:text-green-400">
            Prêt à publier
          </AlertTitle>
          <AlertDescription className="text-green-600 dark:text-green-400/80">
            La configuration de base est complète. Vous pouvez publier la cup.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }

  return (
    <div className="space-y-3">
      {activeAlerts.map((alert) => (
        <Alert key={alert.title} variant="destructive" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">
            {alert.title}
          </AlertTitle>
          <AlertDescription className="text-amber-600 dark:text-amber-400/80">
            {alert.description}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
