"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Layers } from "lucide-react";

import { CategoryCard } from "./category-card";
import type { Category } from "~/server/db/schema/categories";

interface CategoryListProps {
  categories: Category[];
  cupId: string;
  onReorder: (categoryIds: string[]) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoryList({
  categories,
  cupId,
  onReorder,
  onEdit,
  onDelete,
}: CategoryListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      const newOrder = arrayMove(categories, oldIndex, newIndex);
      onReorder(newOrder.map((c) => c.id));
    }
  };

  if (categories.length === 0) {
    return (
      <div
        style={{
          background: "var(--n-surface)",
          border: "1px solid var(--n-border)",
          borderRadius: "12px",
          padding: "48px 24px",
        }}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div
            className="flex items-center justify-center w-16 h-16 mb-4 rounded-xl"
            style={{ background: "var(--n-surface-raised)", border: "1px solid var(--n-border-visible)" }}
          >
            <Layers className="h-8 w-8" style={{ color: "var(--n-text-disabled)" }} strokeWidth={1.5} />
          </div>
          <h3
            className="n-font-body text-lg font-medium mb-2"
            style={{ color: "var(--n-text-display)" }}
          >
            Aucune catégorie
          </h3>
          <p
            className="text-sm max-w-sm"
            style={{ color: "var(--n-text-secondary)" }}
          >
            Les catégories permettent d&apos;organiser les produits de votre cup.
            Chaque catégorie aura ses propres critères de notation.
          </p>
          <p
            className="n-label mt-6"
          >
            Cliquez sur &quot;Nouvelle catégorie&quot; pour commencer
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={categories.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              cupId={cupId}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
