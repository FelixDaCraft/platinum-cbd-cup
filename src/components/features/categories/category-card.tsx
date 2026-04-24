"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, ChevronRight, ListChecks } from "lucide-react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import type { Category } from "~/server/db/schema/categories";

interface CategoryCardProps {
  category: Category;
  cupId: string;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoryCard({ category, cupId, onEdit, onDelete }: CategoryCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const { data: criteriaCount = 0 } = api.criteria.count.useQuery({
    categoryId: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: "8px",
    overflow: "hidden",
    background: "var(--n-surface)",
    border: `1px solid ${isDragging ? "var(--n-border-visible)" : "var(--n-border)"}`,
    borderRadius: "8px",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-3 p-4">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab touch-none transition-colors"
          style={{ color: "var(--n-text-disabled)" }}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Category info - clickable to navigate to detail */}
        <Link
          href={`/dashboard/cups/${cupId}/config/categories/${category.id}/criteria`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h3
                className="n-font-body font-medium truncate"
                style={{ color: "var(--n-text-primary)" }}
              >
                {category.name}
              </h3>
              {category.description && (
                <p
                  className="text-sm truncate mt-0.5"
                  style={{ color: "var(--n-text-secondary)" }}
                >
                  {category.description}
                </p>
              )}
            </div>
            {/* Criteria count badge */}
            <span
              className="shrink-0"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "6px",
                fontSize: "12px",
                fontFamily: "'Space Mono', monospace",
                ...(criteriaCount > 0
                  ? { background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }
                  : { background: "rgba(212,168,67,0.1)", color: "var(--n-warning)", border: "1px solid rgba(212,168,67,0.3)" })
              }}
            >
              <ListChecks className="h-3 w-3" />
              {criteriaCount} critère{criteriaCount !== 1 ? "s" : ""}
            </span>
          </div>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(category)}
            className="h-8 w-8"
            style={{ color: "var(--n-text-disabled)" }}
            aria-label={`Modifier ${category.name}`}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Modifier</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(category)}
            className="h-8 w-8"
            style={{ color: "var(--n-text-disabled)" }}
            aria-label={`Supprimer ${category.name}`}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Supprimer</span>
          </Button>
          <Link href={`/dashboard/cups/${cupId}/config/categories/${category.id}/criteria`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              style={{ color: "var(--n-text-disabled)" }}
              aria-label={`Configurer ${category.name}`}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Configurer</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
