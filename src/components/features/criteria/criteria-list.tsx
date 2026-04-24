"use client";

import { Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { formatCoefficient } from "~/lib/validations/criteria";
import { cn } from "~/lib/utils";

interface Criterion {
  id: string;
  name: string;
  description: string | null;
  coefficient: number;
  sortOrder: number;
}

interface CriteriaListProps {
  criteria: Criterion[];
  canEdit: boolean;
  onEdit: (criterion: Criterion) => void;
  onDelete: (criterionId: string) => void;
  onMoveUp: (criterionId: string) => void;
  onMoveDown: (criterionId: string) => void;
}

export function CriteriaList({
  criteria,
  canEdit,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: CriteriaListProps) {
  if (criteria.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {criteria.map((criterion, index) => (
        <div
          key={criterion.id}
          className="rounded-lg bg-white/5 border border-white/10 overflow-hidden hover:border-white/20 transition-colors"
        >
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Coefficient badge */}
              <Badge
                variant="secondary"
                className="flex-shrink-0 font-mono text-sm bg-primary/10 text-primary border-0"
              >
                {formatCoefficient(criterion.coefficient)}
              </Badge>

              {/* Criterion info */}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{criterion.name}</p>
                {criterion.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {criterion.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Reorder buttons */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onMoveUp(criterion.id)}
                disabled={!canEdit || index === 0}
                title="Monter"
                aria-label={`Monter ${criterion.name}`}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onMoveDown(criterion.id)}
                disabled={!canEdit || index === criteria.length - 1}
                title="Descendre"
                aria-label={`Descendre ${criterion.name}`}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>

              {/* Edit button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(criterion)}
                disabled={!canEdit}
                title="Modifier"
                aria-label={`Modifier ${criterion.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  canEdit && "text-destructive hover:text-destructive"
                )}
                onClick={() => onDelete(criterion.id)}
                disabled={!canEdit}
                title="Supprimer"
                aria-label={`Supprimer ${criterion.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
