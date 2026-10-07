import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { baseUrl, imagePartage } from "../../_lib/seo";

interface Props {
  params: Promise<{ slug: string }>;
}

/** Une image stockée dans /uploads est relative : Open Graph exige un absolu. */
function absoluteUrl(url: string): string {
  return url.startsWith("http") ? url : `${baseUrl()}${url}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.slug, slug),
    columns: {
      title: true,
      excerpt: true,
      status: true,
      coverImage: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  // Brouillon ou article supprimé : la page renvoie un 404, le crawler ne
  // doit pas garder l'URL en mémoire.
  if (!article || article.status !== "published") {
    return { title: "Article introuvable", robots: { index: false, follow: false } };
  }

  const url = `${baseUrl()}/articles/${slug}`;
  const description =
    article.excerpt ?? `${article.title} — actualité de la Platinum CBD Cup.`;

  return {
    title: article.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
      images: imagePartage(article.coverImage, article.title),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      ...(article.coverImage ? { images: [absoluteUrl(article.coverImage)] } : {}),
    },
  };
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Les catégories sont souvent saisies en capitales : on les affiche en casse normale. */
function categoryLabel(category: string): string {
  if (category !== category.toUpperCase()) return category;
  const lower = category.toLocaleLowerCase("fr-FR");
  return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
}

/**
 * Renders TipTap JSON content as plain HTML-ish nodes.
 * Best-effort: covers paragraphs, headings, lists, marks (bold/italic/link),
 * images, code blocks. Anything unknown is rendered as text.
 */
function RenderTipTap({ content }: { content: unknown }): React.ReactNode {
  const node = content as {
    type?: string;
    content?: unknown[];
    text?: string;
    marks?: { type: string; attrs?: Record<string, string> }[];
    attrs?: Record<string, string>;
  };
  if (!node) return null;

  if (node.type === "doc" || !node.type) {
    return (
      <>
        {(node.content ?? []).map((c, i) => (
          <RenderTipTap key={i} content={c} />
        ))}
      </>
    );
  }

  if (node.type === "text") {
    let el: React.ReactNode = node.text ?? "";
    for (const m of node.marks ?? []) {
      if (m.type === "bold") el = <strong>{el}</strong>;
      else if (m.type === "italic") el = <em>{el}</em>;
      else if (m.type === "underline") el = <u>{el}</u>;
      else if (m.type === "link" && m.attrs?.href) {
        el = (
          <a href={m.attrs.href} target="_blank" rel="noreferrer">
            {el}
          </a>
        );
      }
    }
    return el;
  }

  const children = (node.content ?? []).map((c, i) => (
    <RenderTipTap key={i} content={c} />
  ));

  switch (node.type) {
    case "paragraph":
      return <p>{children}</p>;
    case "heading": {
      // Le titre de l'article occupe le h1 : les intertitres commencent à h2.
      const level = Number(node.attrs?.level ?? 2);
      return level <= 2 ? <h2>{children}</h2> : <h3>{children}</h3>;
    }
    case "bulletList":
      return <ul>{children}</ul>;
    case "orderedList":
      return <ol>{children}</ol>;
    case "listItem":
      return <li>{children}</li>;
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "horizontalRule":
      return <hr className="hr" />;
    case "image":
      if (node.attrs?.src) {
        // Une illustration en cours d'article s'affichait à hauteur nulle
        // puis poussait d'un coup tout le texte qui la suit : le lecteur
        // perdait sa ligne en plein paragraphe. Quand l'éditeur a enregistré
        // les dimensions, on les repasse au navigateur — avec height:auto il
        // en déduit le rapport et réserve la hauteur avant le chargement.
        const largeur = Number(node.attrs.width);
        const hauteur = Number(node.attrs.height);
        const dimensions =
          Number.isFinite(largeur) && largeur > 0 &&
          Number.isFinite(hauteur) && hauteur > 0
            ? { width: largeur, height: hauteur }
            : {};
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.attrs.src}
            alt={node.attrs.alt ?? ""}
            {...dimensions}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "auto" }}
          />
        );
      }
      return null;
    default:
      return <>{children}</>;
  }
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;

  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.slug, slug),
  });

  if (!article || article.status !== "published") notFound();

  return (
    <article className="pg pg--narrow">
      <header className="pg-head">
        <Link href="/articles" className="pg-link" style={{ fontSize: 15 }}>
          Tous les articles
        </Link>
        <span className="pg-meta">
          {article.category ? (
            <>
              <span style={{ color: "var(--accent-hi)", fontWeight: 600 }}>
                {categoryLabel(article.category)}
              </span>
              {" · "}
            </>
          ) : null}
          <time dateTime={article.publishedAt?.toISOString()}>
            {formatDate(article.publishedAt)}
          </time>
        </span>
        <h1 className="display" style={{ fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.08 }}>
          {article.title}
        </h1>
        {article.excerpt && <p className="pg-lede">{article.excerpt}</p>}
      </header>

      {article.coverImage && (
        <div
          style={{
            position: "relative",
            aspectRatio: "16/9",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 40,
          }}
        >
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            sizes="(max-width: 880px) 100vw, 760px"
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
      )}

      <div className="prose">
        <RenderTipTap content={article.content} />
      </div>
    </article>
  );
}
