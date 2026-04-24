"use client";

import { use } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { ArticleForm } from "~/components/features/articles/article-form";

interface PageProps {
  params: Promise<{ articleId: string }>;
}

export default function EditArticlePage({ params }: PageProps) {
  const { articleId } = use(params);

  const { data: article, isLoading } = api.articles.get.useQuery({
    id: articleId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="n-font-data" style={{ color: "var(--n-text-secondary)" }}>[LOADING...]</span>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="n-card p-8 text-center max-w-md">
          <AlertCircle className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--n-accent)" }} />
          <h2 className="n-font-body text-xl font-semibold mb-2" style={{ color: "var(--n-text-display)" }}>Article non trouvé</h2>
          <p className="n-label mb-6" style={{ color: "var(--n-text-secondary)" }}>
            Cet article n&apos;existe pas ou a été supprimé.
          </p>
          <Button asChild>
            <Link href="/dashboard/articles">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux articles
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/articles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="n-font-body text-2xl font-semibold">Modifier l&apos;article</h1>
          <p className="n-label mt-1" style={{ color: "var(--n-text-secondary)" }}>
            Modifiez le contenu de votre article
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="n-card p-6">
        <ArticleForm article={article} />
      </div>
    </div>
  );
}
