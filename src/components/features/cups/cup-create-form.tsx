"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { api } from "~/trpc/react";
import { createCupSchema, type CreateCupInput, ratingScaleEnum, ratingScaleLabels } from "~/lib/validations/cup";

interface CupCreateFormProps {
  onSuccess?: () => void;
}

export function CupCreateForm({ onSuccess }: CupCreateFormProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const createCup = api.cup.create.useMutation({
    onSuccess: (cup) => {
      // Invalidate the cups list to ensure fresh data when navigating back
      void utils.cup.list.invalidate();
      toast.success("Cup créée avec succès");
      onSuccess?.();
      // cup is guaranteed to exist on success, use non-null assertion
      router.push(`/dashboard/cups/${cup!.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateCupInput>({
    resolver: zodResolver(createCupSchema),
    defaultValues: {
      type: "public",
      ratingScale: "0-20",
    },
  });

  const onSubmit = (data: CreateCupInput) => {
    createCup.mutate(data);
  };

  const isSubmitting = createCup.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nom de la cup</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Ma Cup 2026"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Type de cup</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              disabled={isSubmitting}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label htmlFor="public" className="font-normal cursor-pointer">
                  Public - Jurys amateurs, vote public
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pro" id="pro" />
                <Label htmlFor="pro" className="font-normal cursor-pointer">
                  Pro - Jurys professionnels uniquement
                </Label>
              </div>
            </RadioGroup>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>Échelle de notation</Label>
        <Controller
          control={control}
          name="ratingScale"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              disabled={isSubmitting}
              className="space-y-2"
            >
              {ratingScaleEnum.map((scale) => (
                <div key={scale} className="flex items-center space-x-2">
                  <RadioGroupItem value={scale} id={`scale-${scale}`} />
                  <Label htmlFor={`scale-${scale}`} className="font-normal cursor-pointer">
                    {ratingScaleLabels[scale]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
        <p className="text-sm text-muted-foreground">
          L&apos;échelle s&apos;applique à tous les critères de notation de cette cup
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Décrivez votre compétition..."
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Créer la cup
      </Button>
    </form>
  );
}
