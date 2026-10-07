"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  categoryFormSchema,
  type CategoryFormData,
  type CategoryFormInput,
} from "~/lib/validations/category";
import type { Category } from "~/server/db/schema/categories";

interface CategoryFormProps {
  category?: Category;
  onSubmit: (data: CategoryFormData) => void;
  isSubmitting?: boolean;
}

export function CategoryForm({
  category,
  onSubmit,
  isSubmitting = false,
}: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryFormInput, unknown, CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      maxProducts: category?.maxProducts ?? "",
      maxProductsPerProducer: category?.maxProductsPerProducer ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom de la catégorie</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Ex: Fleurs Indoor"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Décrivez cette catégorie..."
          rows={3}
          disabled={isSubmitting}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxProducts">Places dans la catégorie</Label>
          <Input
            id="maxProducts"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            {...register("maxProducts")}
            placeholder="Illimité"
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            Produits au total, tous producteurs confondus.
          </p>
          {errors.maxProducts && (
            <p className="text-sm text-destructive">{errors.maxProducts.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxProductsPerProducer">Maximum par producteur</Label>
          <Input
            id="maxProductsPerProducer"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            {...register("maxProductsPerProducer")}
            placeholder="Illimité"
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            Produits qu&apos;un même producteur peut inscrire ici.
          </p>
          {errors.maxProductsPerProducer && (
            <p className="text-sm text-destructive">
              {errors.maxProductsPerProducer.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {category ? "Modifier" : "Créer"}
      </Button>
    </form>
  );
}
