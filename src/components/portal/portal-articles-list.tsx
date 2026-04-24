"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Tag,
  FolderOpen,
  Sparkles,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string | null;
  categoryColor: string | null;
  computedCategoryColor: string | null;
  tags: string[] | null;
  isFeatured: boolean;
  publishedAt: Date | null;
  readingTime: number;
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

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface Filters {
  categories: string[];
  tags: string[];
}

interface PortalArticlesListProps {
  articles: Article[];
  featuredArticle?: Article | null;
  pagination: Pagination;
  filters: Filters;
  currentFilters: {
    category?: string;
    tag?: string;
    search?: string;
  };
}

export function PortalArticlesList({
  articles,
  featuredArticle,
  pagination,
  filters,
  currentFilters,
}: PortalArticlesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(currentFilters.search ?? "");

  const updateFilters = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // Reset to page 1 when filters change
    if (key !== "page") {
      params.delete("page");
    }

    router.push(`/articles?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters("search", searchQuery || null);
  };

  const clearFilters = () => {
    router.push("/articles");
    setSearchQuery("");
  };

  const hasActiveFilters =
    currentFilters.category || currentFilters.tag || currentFilters.search;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Rechercher un article..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Rechercher
          </Button>
        </form>

        {/* Category filter */}
        {filters.categories.length > 0 && (
          <Select
            value={currentFilters.category ?? "_all"}
            onValueChange={(value) =>
              updateFilters("category", value === "_all" ? null : value)
            }
          >
            <SelectTrigger className="w-[180px]">
              <FolderOpen className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Toutes les catégories</SelectItem>
              {filters.categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Tag filter */}
        {filters.tags.length > 0 && (
          <Select
            value={currentFilters.tag ?? "_all"}
            onValueChange={(value) => updateFilters("tag", value === "_all" ? null : value)}
          >
            <SelectTrigger className="w-[180px]">
              <Tag className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tous les tags</SelectItem>
              {filters.tags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="mr-2 h-4 w-4" />
            Effacer les filtres
          </Button>
        )}
      </div>

      {/* Active filters badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {currentFilters.search && (
            <Badge variant="secondary">
              Recherche: {currentFilters.search}
              <button
                onClick={() => {
                  setSearchQuery("");
                  updateFilters("search", null);
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {currentFilters.category && (
            <Badge variant="secondary">
              Catégorie: {currentFilters.category}
              <button
                onClick={() => updateFilters("category", null)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {currentFilters.tag && (
            <Badge variant="secondary">
              Tag: {currentFilters.tag}
              <button
                onClick={() => updateFilters("tag", null)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Featured Article - Article à la Une */}
      {featuredArticle && (
        <FeaturedArticleCard article={featuredArticle} />
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {pagination.totalCount} article{pagination.totalCount !== 1 ? "s" : ""} trouvé
        {pagination.totalCount !== 1 ? "s" : ""}
      </p>

      {/* Articles grid */}
      {articles.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </motion.div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Aucun article</h3>
            <p className="mt-2 text-muted-foreground">
              {hasActiveFilters
                ? "Aucun article ne correspond à vos critères de recherche."
                : "Aucun article n'a encore été publié."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Effacer les filtres
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={!pagination.hasPrevPage}
            onClick={() =>
              updateFilters("page", String(pagination.currentPage - 1))
            }
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {pagination.currentPage} sur {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={!pagination.hasNextPage}
            onClick={() =>
              updateFilters("page", String(pagination.currentPage + 1))
            }
          >
            Suivant
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Featured article card - displayed as full-width hero "Article à la Une"
 */
function FeaturedArticleCard({ article }: { article: Article }) {
  const categoryColor = article.computedCategoryColor;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-10"
    >
      {/* Section title */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold">À la Une</h2>
      </div>

      {/* Hero Card */}
      <Link href={`/articles/${article.slug}`} className="block group">
        <div className="relative rounded-2xl overflow-hidden bg-muted">
          {/* Background image */}
          <div className="relative h-[350px] md:h-[450px]">
            {article.coverImage ? (
              <img
                src={article.coverImage}
                alt={article.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <FileText className="h-20 w-20 text-muted-foreground/30" />
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            {/* Sponsored badge */}
            {article.sponsor && (
              <div className="absolute top-4 right-4">
                <Link
                  href={`/sponsors/${article.sponsor.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="group relative block"
                >
                  <div className="animate-pulse-scale">
                    {article.sponsor.logo ? (
                      <img
                        src={article.sponsor.logo}
                        alt={article.sponsor.name}
                        className="h-14 w-14 object-contain drop-shadow-lg"
                      />
                    ) : (
                      <div className="h-14 w-14 flex items-center justify-center bg-amber-500 rounded-lg shadow-lg">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute top-full right-0 mt-2 px-3 py-1.5 rounded-lg bg-black/90 text-white text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Sponsorisé par {article.sponsor.name}
                  </div>
                </Link>
              </div>
            )}

            {/* Content overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
              {/* Category + Reading time */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {article.category && (
                  <Badge
                    variant="outline"
                    className="text-xs font-medium border-white/30 text-white bg-white/10 backdrop-blur-sm"
                  >
                    {article.category}
                  </Badge>
                )}
                <div className="flex items-center gap-1 text-xs text-white/80">
                  <Clock className="h-3 w-3" />
                  <span>{article.readingTime} min de lecture</span>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-2xl md:text-4xl font-bold text-white mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                {article.title}
              </h3>

              {/* Excerpt */}
              {article.excerpt && (
                <p className="text-white/80 mb-4 line-clamp-2 max-w-2xl text-sm md:text-base">
                  {article.excerpt}
                </p>
              )}

              {/* Author and CTA */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-white/20">
                    <AvatarImage src={article.author.image ?? undefined} />
                    <AvatarFallback className="bg-white/10 text-white">
                      {article.author.name?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-white">{article.author.name ?? "Anonyme"}</p>
                    {article.publishedAt && (
                      <p className="text-xs text-white/60">
                        {formatDistanceToNow(new Date(article.publishedAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* CTA Button */}
                <Button
                  variant="secondary"
                  className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                >
                  Lire l'article
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.section>
  );
}

/**
 * Standard article card with premium glassmorphism design
 * Inspired by Apple/Puffco aesthetic
 */
function ArticleCard({ article }: { article: Article }) {
  const categoryColor = article.computedCategoryColor ?? "#6366f1";

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Link href={`/articles/${article.slug}`} className="block h-full">
        <div
          className="group relative h-full rounded-2xl overflow-hidden backdrop-blur-md border border-white/10 transition-all duration-300"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 8px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 30px ${categoryColor}20`;
            e.currentTarget.style.borderColor = `${categoryColor}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
          }}
        >
          {/* Cover image with overlay */}
          <div className="relative aspect-[16/10] overflow-hidden">
            {article.coverImage ? (
              <>
                <img
                  src={article.coverImage}
                  alt={article.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <FileText className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}

            {/* Category badge - positioned on image */}
            {article.category && (
              <div
                className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md"
                style={{
                  backgroundColor: `${categoryColor}25`,
                  color: "white",
                  border: `1px solid ${categoryColor}40`,
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                }}
              >
                <FolderOpen className="h-3 w-3" />
                <span>{article.category}</span>
              </div>
            )}

            {/* Reading time badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md bg-black/30 text-white/90 border border-white/10">
              <Clock className="h-3 w-3" />
              <span>{article.readingTime} min</span>
            </div>

            {/* Sponsor badge - no Link to avoid nested <a> */}
            {article.sponsor && (
              <div className="absolute bottom-4 right-4 group/sponsor">
                <div className="animate-pulse-scale">
                  {article.sponsor.logo ? (
                    <img
                      src={article.sponsor.logo}
                      alt={article.sponsor.name}
                      className="h-10 w-10 object-contain drop-shadow-lg rounded-lg bg-white/10 backdrop-blur-sm p-1"
                    />
                  ) : (
                    <div className="h-10 w-10 flex items-center justify-center bg-amber-500/80 backdrop-blur-sm rounded-lg shadow-lg">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
                <div className="absolute bottom-full right-0 mb-2 px-2 py-1 rounded-lg bg-black/90 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover/sponsor:opacity-100 transition-opacity pointer-events-none z-10">
                  Sponsorisé par {article.sponsor.name}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Title */}
            <h2 className="text-lg font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {article.title}
            </h2>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {article.excerpt}
              </p>
            )}

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {article.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10"
                  >
                    #{tag}
                  </span>
                ))}
                {article.tags.length > 3 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10">
                    +{article.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Author section with separator */}
            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 ring-2 ring-white/10">
                    <AvatarImage src={article.author.image ?? undefined} />
                    <AvatarFallback className="text-xs bg-primary/20 text-primary">
                      {article.author.name?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      {article.author.name ?? "Anonyme"}
                    </span>
                    {article.publishedAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(article.publishedAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
