"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Plus,
  FileText,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { api } from "~/trpc/react";

export default function ArticlesPage() {
  const [tab, setTab] = useState<"all" | "draft" | "published">("all");

  const utils = api.useUtils();

  const { data: articles, isLoading } = api.articles.list.useQuery({
    status: tab,
  });

  const publishMutation = api.articles.publish.useMutation({
    onSuccess: () => {
      toast.success("Article publié");
      void utils.articles.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unpublishMutation = api.articles.unpublish.useMutation({
    onSuccess: () => {
      toast.success("Article dépublié");
      void utils.articles.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = api.articles.delete.useMutation({
    onSuccess: () => {
      toast.success("Article supprimé");
      void utils.articles.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const draftCount = articles?.filter((a) => a.status === "draft").length ?? 0;
  const publishedCount = articles?.filter((a) => a.status === "published").length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="n-font-data" style={{ color: "var(--n-text-secondary)" }}>[LOADING...]</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="n-font-body text-2xl font-semibold">Actualités</h1>
          <p className="n-label mt-1" style={{ color: "var(--n-text-secondary)" }}>
            Créez et gérez vos articles pour le portail public
          </p>
        </div>
        <Button asChild className="n-btn-primary">
          <Link href="/dashboard/articles/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvel article
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">
            Tous
            <span className="n-font-data ml-2 text-xs">{articles?.length ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="draft">
            Brouillons
            <span className="n-font-data ml-2 text-xs">{draftCount}</span>
          </TabsTrigger>
          <TabsTrigger value="published">
            Publiés
            <span className="n-font-data ml-2 text-xs">{publishedCount}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {articles && articles.length > 0 ? (
            <div className="space-y-4">
              {articles.map((article) => (
                <div key={article.id} className="n-card p-6">
                  <div className="flex flex-col sm:flex-row gap-6">
                    {/* Cover image */}
                    {article.coverImage ? (
                      <img
                        src={article.coverImage}
                        alt={article.title}
                        className="h-24 w-36 rounded object-cover flex-shrink-0"
                        style={{ border: "1px solid var(--n-border)" }}
                      />
                    ) : (
                      <div className="h-24 w-36 rounded flex items-center justify-center flex-shrink-0" style={{ background: "var(--n-surface-raised)", border: "1px solid var(--n-border)" }}>
                        <FileText className="h-8 w-8" style={{ color: "var(--n-text-disabled)" }} />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Link
                              href={`/dashboard/articles/${article.id}`}
                              className="n-font-body text-lg font-semibold transition-colors"
                              style={{ color: "var(--n-text-primary)" }}
                            >
                              {article.title}
                            </Link>
                            {article.status === "draft" ? (
                              <span className="n-tag">Brouillon</span>
                            ) : (
                              <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-success)", color: "var(--n-success)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Publié
                              </span>
                            )}
                            {article.sponsor && (
                              <span className="n-tag">Sponsorisé</span>
                            )}
                          </div>
                          <p className="n-font-data text-xs mb-2" style={{ color: "var(--n-text-secondary)" }}>
                            /{article.slug}
                          </p>
                          {article.excerpt && (
                            <p className="n-label line-clamp-2" style={{ color: "var(--n-text-secondary)" }}>
                              {article.excerpt}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/articles/${article.id}`}>
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Modifier
                            </Link>
                          </Button>

                          {article.status === "published" && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/articles/${article.slug}`} target="_blank">
                                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                Voir
                              </Link>
                            </Button>
                          )}

                          {article.status === "draft" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => publishMutation.mutate({ id: article.id })}
                              disabled={publishMutation.isPending}
                            >
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              Publier
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unpublishMutation.mutate({ id: article.id })}
                              disabled={unpublishMutation.isPending}
                            >
                              <EyeOff className="mr-2 h-3.5 w-3.5" />
                              Dépublier
                            </Button>
                          )}

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                style={{ borderColor: "color-mix(in srgb, var(--n-accent) 50%, transparent)", color: "var(--n-accent)" }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="n-font-body font-bold" style={{ color: "var(--n-text-display)" }}>
                                  Supprimer cet article ?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                                  Cette action est irréversible. L&apos;article
                                  &quot;{article.title}&quot; sera définitivement supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate({ id: article.id })}
                                  className="n-label"
                                  style={{ background: "var(--n-accent)", color: "var(--n-black)" }}
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={article.author.image ?? undefined} />
                            <AvatarFallback className="text-xs" style={{ background: "var(--n-surface-raised)", color: "var(--n-text-secondary)" }}>
                              {article.author.name?.charAt(0) ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                            {article.author.name}
                          </span>
                        </div>
                        <span className="n-font-data text-xs" style={{ color: "var(--n-text-secondary)" }}>
                          Modifié{" "}
                          {formatDistanceToNow(new Date(article.updatedAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </span>
                        {article.category && (
                          <span className="n-tag">{article.category}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="n-card p-12 text-center">
              <FileText className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--n-text-disabled)" }} />
              <h3 className="n-font-body text-lg font-semibold mb-2" style={{ color: "var(--n-text-primary)" }}>Aucun article</h3>
              <p className="n-label mb-6 max-w-sm mx-auto" style={{ color: "var(--n-text-secondary)" }}>
                Créez votre premier article pour commencer à publier du contenu
              </p>
              <Button asChild className="n-btn-primary">
                <Link href="/dashboard/articles/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer mon premier article
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
