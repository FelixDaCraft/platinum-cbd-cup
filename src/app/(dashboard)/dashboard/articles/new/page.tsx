"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ArticleForm } from "~/components/features/articles/article-form";

export default function NewArticlePage() {
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
          <h1 className="n-font-body text-2xl font-semibold">Nouvel article</h1>
          <p className="n-label mt-1" style={{ color: "var(--n-text-secondary)" }}>
            Créez un nouvel article pour votre blog
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="n-card p-6">
        <ArticleForm />
      </div>
    </div>
  );
}
