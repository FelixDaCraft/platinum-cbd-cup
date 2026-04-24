"use client";

import { Pencil, Trash2, ChevronUp, ChevronDown, EyeOff } from "lucide-react";
import { Button } from "~/components/ui/button";
import { formatLabelRange } from "~/lib/validations/labels";

interface Label {
  id: string;
  name: string;
  minScore: number;
  maxScore: number | null;
  color: string | null;
  sortOrder: number;
  icon: string | null;
  condition: string | null;
  isPublic: boolean;
}

interface LabelsListProps {
  labels: Label[];
  canEdit: boolean;
  onEdit: (label: Label) => void;
  onDelete: (labelId: string) => void;
  onMoveUp: (labelId: string) => void;
  onMoveDown: (labelId: string) => void;
}

export function LabelsList({
  labels,
  canEdit,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: LabelsListProps) {
  if (labels.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {labels.map((label, index) => (
        <div
          key={label.id}
          className="flex items-center justify-between p-3"
          style={{
            background: "var(--n-surface)",
            border: "1px solid var(--n-border)",
            borderRadius: "8px",
          }}
        >
          <div className="flex items-center gap-3">
            {/* Color badge with optional icon */}
            <div
              className="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-base"
              style={{
                backgroundColor: label.color ?? "#888888",
                border: "2px solid var(--n-border-visible)",
              }}
            >
              {label.icon && !label.icon.startsWith("http") && (
                <span>{label.icon}</span>
              )}
            </div>

            {/* Label info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className="n-font-body font-medium truncate"
                  style={{ color: "var(--n-text-primary)" }}
                >
                  {label.name}
                </p>
                {!label.isPublic && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      background: "rgba(212,168,67,0.1)",
                      color: "var(--n-warning)",
                      border: "1px solid rgba(212,168,67,0.3)",
                    }}
                  >
                    <EyeOff className="h-3 w-3" />
                    Privé
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                {label.condition || formatLabelRange(label.minScore, label.maxScore)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              style={{ color: "var(--n-text-disabled)" }}
              onClick={() => onMoveUp(label.id)}
              disabled={!canEdit || index === 0}
              title="Monter"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              style={{ color: "var(--n-text-disabled)" }}
              onClick={() => onMoveDown(label.id)}
              disabled={!canEdit || index === labels.length - 1}
              title="Descendre"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              style={{ color: "var(--n-text-disabled)" }}
              onClick={() => onEdit(label)}
              disabled={!canEdit}
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              style={{ color: canEdit ? "var(--n-text-disabled)" : undefined }}
              onClick={() => onDelete(label.id)}
              disabled={!canEdit}
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
