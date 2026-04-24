"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, useScroll, useSpring } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Share2,
  Twitter,
  Linkedin,
  Facebook,
  Link as LinkIcon,
  FileText,
  Sparkles,
  Tag,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getReadingTime } from "~/lib/utils/reading-time";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: Record<string, unknown>;
  coverImage: string | null;
  category: string | null;
  tags: string[] | null;
  publishedAt: Date | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
  sponsor: {
    id: string;
    name: string;
    logo: string | null;
  } | null;
}

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface ArticleContentProps {
  article: Article;
  relatedArticles: RelatedArticle[];
}

/**
 * Convert TipTap JSON content to HTML with full formatting support
 */
function renderContent(content: Record<string, unknown>): string {
  if (!content || typeof content !== "object") return "";

  const renderNode = (node: Record<string, unknown>): string => {
    if (!node.type) return "";

    const children = Array.isArray(node.content)
      ? node.content.map((child) => renderNode(child as Record<string, unknown>)).join("")
      : "";

    const attrs = node.attrs as Record<string, unknown> | undefined;
    const textAlign = attrs?.textAlign as string | undefined;
    const alignStyle = textAlign ? ` style="text-align: ${textAlign}"` : "";

    switch (node.type) {
      case "doc":
        return children;
      case "paragraph":
        return children ? `<p${alignStyle}>${children}</p>` : "<p><br></p>";
      case "heading": {
        const level = attrs?.level ?? 2;
        return `<h${level}${alignStyle}>${children}</h${level}>`;
      }
      case "text": {
        let text = escapeHtml((node.text as string) || "");
        const marks = (node.marks as Array<{ type: string; attrs?: Record<string, unknown> }>) || [];

        marks.forEach((mark) => {
          switch (mark.type) {
            case "bold":
              text = `<strong>${text}</strong>`;
              break;
            case "italic":
              text = `<em>${text}</em>`;
              break;
            case "underline":
              text = `<u>${text}</u>`;
              break;
            case "strike":
              text = `<s>${text}</s>`;
              break;
            case "link":
              text = `<a href="${mark.attrs?.href || "#"}" target="_blank" rel="noopener noreferrer" class="text-amber-500 hover:underline">${text}</a>`;
              break;
          }
        });
        return text;
      }
      case "bulletList":
        return `<ul class="list-disc pl-6 space-y-2 my-4">${children}</ul>`;
      case "orderedList":
        return `<ol class="list-decimal pl-6 space-y-2 my-4">${children}</ol>`;
      case "listItem":
        return `<li>${children}</li>`;
      case "blockquote":
        return `<blockquote class="border-l-4 border-amber-500 pl-4 py-2 my-4 italic text-muted-foreground bg-muted/30 rounded-r">${children}</blockquote>`;
      case "horizontalRule":
        return `<hr class="border-border my-8" />`;
      case "hardBreak":
        return "<br />";
      default:
        return children;
    }
  };

  return renderNode(content);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function ArticleContent({ article, relatedArticles }: ArticleContentProps) {
  // Reading progress bar
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Calculate reading time
  const readingTime = getReadingTime(article.content);

  // Get URL directly in handlers to ensure window is available (client-side only)
  const getArticleUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.href;
    }
    return "";
  };

  const shareOnTwitter = () => {
    const articleUrl = getArticleUrl();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(articleUrl)}`;
    window.open(url, "_blank", "noopener");
  };

  const shareOnLinkedIn = () => {
    const articleUrl = getArticleUrl();
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`;
    window.open(url, "_blank", "noopener");
  };

  const shareOnFacebook = () => {
    const articleUrl = getArticleUrl();
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`;
    window.open(url, "_blank", "noopener");
  };

  const copyLink = async () => {
    const articleUrl = getArticleUrl();
    if (!articleUrl) {
      toast.error("Impossible de récupérer l'URL");
      return;
    }
    try {
      await navigator.clipboard.writeText(articleUrl);
      toast.success("Lien copié !");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  const contentHtml = renderContent(article.content);

  return (
    <>
      {/* Reading Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-primary z-50 origin-left"
        style={{ scaleX }}
      />

      <main className="min-h-[60vh]">
        {/* Hero Image - Full Width */}
        {article.coverImage && (
          <div className="relative w-full h-[40vh] md:h-[50vh] overflow-hidden">
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

            {/* Back button on hero */}
            <div className="absolute top-4 left-4 md:top-6 md:left-6">
              <Link
                href="/articles"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm text-sm font-medium hover:bg-background transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Link>
            </div>

            {/* Sponsored badge on hero */}
            {article.sponsor && (
              <div className="absolute top-4 right-4 md:top-6 md:right-6">
                <Link
                  href={`/sponsors/${article.sponsor.id}`}
                  className="group relative block"
                >
                  <div className="animate-pulse-scale">
                    {article.sponsor.logo ? (
                      <img
                        src={article.sponsor.logo}
                        alt={article.sponsor.name}
                        className="h-16 w-16 object-contain drop-shadow-lg"
                      />
                    ) : (
                      <div className="h-16 w-16 flex items-center justify-center bg-amber-500 rounded-lg shadow-lg">
                        <Sparkles className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute top-full right-0 mt-2 px-3 py-1.5 rounded-lg bg-black/90 text-white text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Sponsorisé par {article.sponsor.name}
                  </div>
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <article className="max-w-4xl mx-auto">
            {/* Back link - only show if no hero image */}
            {!article.coverImage && (
              <Link
                href="/articles"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 mt-8"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux articles
              </Link>
            )}

            {/* Sponsored badge - only show if no hero image */}
            {article.sponsor && !article.coverImage && (
              <Link
                href={`/sponsors/${article.sponsor.id}`}
                className="group relative inline-flex items-center gap-4 mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mt-8 hover:bg-amber-500/15 hover:border-amber-500/30 transition-colors"
              >
                <div className="animate-pulse-scale">
                  {article.sponsor.logo ? (
                    <img
                      src={article.sponsor.logo}
                      alt={article.sponsor.name}
                      className="h-14 w-14 object-contain drop-shadow-md"
                    />
                  ) : (
                    <div className="h-14 w-14 flex items-center justify-center bg-amber-500 rounded-lg shadow-md">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Sponsorisé par</span>
                  <span className="font-semibold">{article.sponsor.name}</span>
                </div>
              </Link>
            )}

            {/* Header */}
            <header className={article.coverImage ? "-mt-20 relative z-10 bg-background rounded-t-3xl pt-8 px-6 md:px-10" : "mb-8"}>
              {/* Category + Reading time */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {article.category && (
                  <Link href={`/articles?category=${encodeURIComponent(article.category)}`}>
                    <Badge variant="outline" className="hover:bg-accent">
                      {article.category}
                    </Badge>
                  </Link>
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{readingTime}</span>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
                {article.title}
              </h1>

              {/* Excerpt */}
              {article.excerpt && (
                <p className="text-xl text-muted-foreground mb-6">{article.excerpt}</p>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-6 border-b">
                {/* Author */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-10 w-10 ring-2 ring-background">
                    <AvatarImage src={article.author.image ?? undefined} />
                    <AvatarFallback>
                      {article.author.name?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{article.author.name ?? "Anonyme"}</p>
                    {article.publishedAt && (
                      <time dateTime={article.publishedAt.toISOString()} className="text-xs">
                        {format(new Date(article.publishedAt), "d MMMM yyyy", {
                          locale: fr,
                        })}
                      </time>
                    )}
                  </div>
                </div>

                {/* Share */}
                <div className="ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Share2 className="mr-2 h-4 w-4" />
                        Partager
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={shareOnTwitter}>
                        <Twitter className="mr-2 h-4 w-4" />
                        Twitter / X
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={shareOnLinkedIn}>
                        <Linkedin className="mr-2 h-4 w-4" />
                        LinkedIn
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={shareOnFacebook}>
                        <Facebook className="mr-2 h-4 w-4" />
                        Facebook
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyLink}>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Copier le lien
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>

            {/* Floating Share Buttons - Desktop only */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="hidden xl:flex fixed left-8 top-1/2 -translate-y-1/2 flex-col gap-3 z-40"
            >
              <div className="bg-background/80 backdrop-blur-sm border rounded-full p-2 shadow-lg flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={shareOnTwitter}
                  title="Partager sur Twitter"
                >
                  <Twitter className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={shareOnLinkedIn}
                  title="Partager sur LinkedIn"
                >
                  <Linkedin className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={shareOnFacebook}
                  title="Partager sur Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </Button>
                <div className="w-full h-px bg-border" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={copyLink}
                  title="Copier le lien"
                >
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>

            {/* Content */}
            <div
              className={`prose prose-lg max-w-none dark:prose-invert mb-8 ${article.coverImage ? "px-6 md:px-10" : ""}`}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className={`flex flex-wrap items-center gap-2 mb-8 pb-8 border-b ${article.coverImage ? "px-6 md:px-10" : ""}`}>
                <Tag className="h-4 w-4 text-muted-foreground" />
                {article.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/articles?tag=${encodeURIComponent(tag)}`}
                  >
                    <Badge variant="secondary" className="hover:bg-accent">
                      {tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Share buttons */}
            <div className={`flex items-center justify-center gap-4 mb-12 p-6 rounded-2xl bg-muted/50 ${article.coverImage ? "mx-6 md:mx-10" : ""}`}>
              <span className="text-sm text-muted-foreground">Partager cet article :</span>
              <Button variant="outline" size="icon" className="rounded-full" onClick={shareOnTwitter}>
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full" onClick={shareOnLinkedIn}>
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full" onClick={shareOnFacebook}>
                <Facebook className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full" onClick={copyLink}>
                <LinkIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Related articles */}
            {relatedArticles.length > 0 && (
              <section className={`pb-12 ${article.coverImage ? "px-6 md:px-10" : ""}`}>
                <h2 className="text-2xl font-bold mb-6">Articles similaires</h2>
                <div className="grid gap-6 md:grid-cols-3">
                  {relatedArticles.map((related) => (
                    <Link key={related.id} href={`/articles/${related.slug}`}>
                      <Card className="h-full overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
                        {related.coverImage ? (
                          <div className="aspect-video overflow-hidden">
                            <img
                              src={related.coverImage}
                              alt={related.title}
                              className="w-full h-full object-cover transition-transform hover:scale-105"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video bg-muted flex items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                        <CardContent className="p-4">
                          <h3 className="font-semibold line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                            {related.title}
                          </h3>
                          {related.excerpt && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {related.excerpt}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>
        </div>
      </main>
    </>
  );
}
