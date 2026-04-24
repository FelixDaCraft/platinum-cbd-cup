"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { api } from "~/trpc/react";

const optionalUrl = z.union([z.string().url("URL invalide"), z.literal("")]).optional();

const formSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  logo: optionalUrl,
  description: z.string().optional(),
  website: optionalUrl,
  facebook: optionalUrl,
  twitter: optionalUrl,
  instagram: optionalUrl,
  linkedin: optionalUrl,
  youtube: optionalUrl,
});

type FormValues = z.infer<typeof formSchema>;

interface SponsorFormProps {
  sponsorId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SponsorForm({ sponsorId, onSuccess, onCancel }: SponsorFormProps) {
  const utils = api.useUtils();

  const { data: sponsor, isLoading: isLoadingSponsor } = api.sponsors.get.useQuery(
    { id: sponsorId! },
    { enabled: !!sponsorId }
  );

  const createMutation = api.sponsors.create.useMutation({
    onSuccess: () => {
      void utils.sponsors.list.invalidate();
      onSuccess();
    },
  });

  const updateMutation = api.sponsors.update.useMutation({
    onSuccess: () => {
      void utils.sponsors.list.invalidate();
      void utils.sponsors.get.invalidate({ id: sponsorId! });
      onSuccess();
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      logo: "",
      description: "",
      website: "",
      facebook: "",
      twitter: "",
      instagram: "",
      linkedin: "",
      youtube: "",
    },
  });

  // Load existing sponsor data
  useEffect(() => {
    if (sponsor) {
      const socialLinks = sponsor.socialLinks as Record<string, string> | null;
      form.reset({
        name: sponsor.name,
        logo: sponsor.logo ?? "",
        description: sponsor.description ?? "",
        website: sponsor.website ?? "",
        facebook: socialLinks?.facebook ?? "",
        twitter: socialLinks?.twitter ?? "",
        instagram: socialLinks?.instagram ?? "",
        linkedin: socialLinks?.linkedin ?? "",
        youtube: socialLinks?.youtube ?? "",
      });
    }
  }, [sponsor, form]);

  const onSubmit = (values: FormValues) => {
    const socialLinks = {
      facebook: values.facebook || undefined,
      twitter: values.twitter || undefined,
      instagram: values.instagram || undefined,
      linkedin: values.linkedin || undefined,
      youtube: values.youtube || undefined,
    };

    const data = {
      name: values.name,
      logo: values.logo || undefined,
      description: values.description || undefined,
      website: values.website || undefined,
      socialLinks,
    };

    if (sponsorId) {
      updateMutation.mutate({ id: sponsorId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  if (sponsorId && isLoadingSponsor) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom du sponsor *</FormLabel>
                <FormControl>
                  <Input placeholder="Nom de l'entreprise" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Logo (URL)</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormDescription>URL vers l'image du logo</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Présentation du sponsor..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site web</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Social Links Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="social">
            <AccordionTrigger>Réseaux sociaux</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="facebook"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facebook</FormLabel>
                    <FormControl>
                      <Input placeholder="https://facebook.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="twitter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Twitter / X</FormLabel>
                    <FormControl>
                      <Input placeholder="https://twitter.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instagram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram</FormLabel>
                    <FormControl>
                      <Input placeholder="https://instagram.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="linkedin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn</FormLabel>
                    <FormControl>
                      <Input placeholder="https://linkedin.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="youtube"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>YouTube</FormLabel>
                    <FormControl>
                      <Input placeholder="https://youtube.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sponsorId ? "Enregistrer" : "Créer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
