"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Save,
  Eye,
  EyeOff,
  Tag,
  Star,
} from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ImageUpload } from "~/components/ui/image-upload";
import { RichTextEditor } from "~/components/ui/rich-text-editor";
import { api } from "~/trpc/react";
import type { Article } from "~/server/db/schema";

const articleSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  excerpt: z.string().optional(),
  content: z.string().min(1, "Le contenu est requis"),
  coverImage: z.string().optional(), // Accepte URL complète ou chemin relatif (/uploads/...)
  category: z.string().optional(),
  tags: z.string().optional(),
  sponsorId: z.string().optional(),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

interface ArticleFormProps {
  article?: Article & {
    author: { id: string; name: string | null; image: string | null };
    sponsor: { id: string; name: string; logo: string | null } | null;
  };
}

// Slug generation helper
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// Convert stored content to editor format
function getInitialContent(content: Record<string, unknown> | null): string {
  if (!content) return "";
  return JSON.stringify(content);
}

// Constantes pour les catégories d'articles
const ARTICLE_CATEGORIES = [
  { value: "actualites", label: "Actualités" },
  { value: "resultats", label: "Résultats" },
  { value: "interview", label: "Interview" },
] as const;

export function ArticleForm({ article }: ArticleFormProps) {
  const router = useRouter();
  const isEditing = !!article;
  const utils = api.useUtils();

  const { data: sponsors } = api.sponsors.list.useQuery();

  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: article?.title ?? "",
      excerpt: article?.excerpt ?? "",
      content: getInitialContent(article?.content as Record<string, unknown> | null),
      coverImage: article?.coverImage ?? "",
      category: article?.category ?? "",
      tags: (article?.tags as string[] | null)?.join(", ") ?? "",
      sponsorId: article?.sponsorId ?? "",
    },
  });

  const createMutation = api.articles.create.useMutation({
    onSuccess: (data) => {
      toast.success("Article créé !");
      router.push(`/dashboard/articles/${data?.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = api.articles.update.useMutation({
    onSuccess: () => {
      toast.success("Article mis à jour");
      void utils.articles.get.invalidate({ id: article?.id });
      void utils.articles.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const publishMutation = api.articles.publish.useMutation({
    onSuccess: () => {
      toast.success("Article publié !");
      void utils.articles.get.invalidate({ id: article?.id });
      void utils.articles.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unpublishMutation = api.articles.unpublish.useMutation({
    onSuccess: () => {
      toast.success("Article dépublié");
      void utils.articles.get.invalidate({ id: article?.id });
      void utils.articles.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: ArticleFormValues) => {
    const tags = values.tags
      ?.split(",")
      .map((t) => t.trim())
      .filter(Boolean) ?? [];

    // Parse TipTap JSON content
    let contentJson: Record<string, unknown>;
    try {
      contentJson = JSON.parse(values.content) as Record<string, unknown>;
    } catch {
      // Fallback for empty or invalid content
      contentJson = { type: "doc", content: [] };
    }

    // Auto-generate slug from title
    const slug = generateSlug(values.title);

    const data = {
      title: values.title,
      slug,
      excerpt: values.excerpt || undefined,
      content: contentJson,
      coverImage: values.coverImage || undefined,
      category: values.category || undefined,
      tags,
      sponsorId: values.sponsorId || undefined,
    };

    if (isEditing && article) {
      updateMutation.mutate({ id: article.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Actions bar */}
        <div className="flex items-center justify-between gap-4 pb-4" style={{ borderBottom: "1px solid var(--n-border)" }}>
          <div className="flex items-center gap-2">
            {isEditing && article && (
              article.status === "published" ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", background: "rgba(56,161,105,0.1)", color: "var(--n-success)", border: "1px solid rgba(56,161,105,0.3)" }}>
                  <Eye className="h-3 w-3" />
                  Publié
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }}>
                  <EyeOff className="h-3 w-3" />
                  Brouillon
                </span>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing && article && (
              <>
                {article.status === "draft" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => publishMutation.mutate({ id: article.id })}
                    disabled={publishMutation.isPending}
                  >
                    {publishMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    Publier
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => unpublishMutation.mutate({ id: article.id })}
                    disabled={unpublishMutation.isPending}
                  >
                    {unpublishMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <EyeOff className="mr-2 h-4 w-4" />
                    )}
                    Dépublier
                  </Button>
                )}
              </>
            )}

            <Button
              type="submit"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="space-y-6">
          {/* Titre */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Titre de l'article</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: Les résultats du concours 2024"
                    className="text-lg"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Image de couverture */}
          <FormField
            control={form.control}
            name="coverImage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Image de couverture</FormLabel>
                <FormControl>
                  <ImageUpload
                    value={field.value}
                    onChange={field.onChange}
                    folder="articles"
                    placeholder="Glissez une image ou cliquez pour sélectionner"
                    aspectRatio="video"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Contenu */}
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Contenu</FormLabel>
                <FormControl>
                  <RichTextEditor
                    content={field.value}
                    onChange={field.onChange}
                    placeholder="Rédigez votre article ici..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Extrait */}
          <FormField
            control={form.control}
            name="excerpt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Extrait (résumé)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Un court résumé qui apparaîtra dans la liste des articles..."
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Si vide, les premières lignes du contenu seront utilisées.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Catégorie et Tags */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catégorie</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ARTICLE_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Tag className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                    Tags
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="concours, 2024, résultats" {...field} />
                  </FormControl>
                  <FormDescription>Séparés par des virgules</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Sponsor - Mise en avant */}
          {sponsors && sponsors.length > 0 && (
            <FormField
              control={form.control}
              name="sponsorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Star className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                    Sponsor
                  </FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Aucun sponsor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun sponsor</SelectItem>
                      {sponsors.map((sponsor) => (
                        <SelectItem key={sponsor.id} value={sponsor.id}>
                          <div className="flex items-center gap-2">
                            {sponsor.logo && (
                              <img
                                src={sponsor.logo}
                                alt=""
                                className="h-4 w-4 object-contain"
                              />
                            )}
                            {sponsor.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Les articles avec un sponsor sont mis en avant sur la page d'accueil
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </form>
    </Form>
  );
}
