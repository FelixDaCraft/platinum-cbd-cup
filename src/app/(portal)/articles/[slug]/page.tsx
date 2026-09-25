import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { Eyebrow } from "~/components/portal/platinum";
import { getCategoryColor } from "~/server/db/schema/articles";
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
          <a
            href={m.attrs.href}
            style={{ color: "var(--accent)" }}
            target="_blank"
            rel="noreferrer"
          >
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
      return (
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.7,
            color: "var(--fg-2)",
            margin: "1em 0",
          }}
        >
          {children}
        </p>
      );
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const sizes = [0, 36, 28, 22, 18, 16, 14];
      const fontSize = sizes[Math.min(Math.max(level, 1), 6)] ?? 22;
      return (
        <div
          className="mono"
          style={{
            fontSize,
            fontWeight: 400,
            margin: "1.5em 0 .6em",
            color: "var(--fg)",
            letterSpacing: "-.01em",
          }}
        >
          {children}
        </div>
      );
    }
    case "bulletList":
      return (
        <ul style={{ paddingLeft: 24, margin: "1em 0", color: "var(--fg-2)" }}>
          {children}
        </ul>
      );
    case "orderedList":
      return (
        <ol style={{ paddingLeft: 24, margin: "1em 0", color: "var(--fg-2)" }}>
          {children}
        </ol>
      );
    case "listItem":
      return <li style={{ margin: ".4em 0" }}>{children}</li>;
    case "blockquote":
      return (
        <blockquote
          style={{
            borderLeft: "2px solid var(--accent)",
            paddingLeft: 16,
            margin: "1.2em 0",
            color: "var(--fg)",
            fontStyle: "italic",
          }}
        >
          {children}
        </blockquote>
      );
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
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 10,
              border: "1px solid var(--line)",
              margin: "1.5em 0",
            }}
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

  const categoryColor =
    article.categoryColor ??
    getCategoryColor(article.category) ??
    "var(--accent)";

  return (
    <article className="page-enter" style={{ maxWidth: 820, margin: "0 auto" }}>
      <section style={{ paddingTop: 40, paddingBottom: 24 }}>
        <Link
          href="/articles"
          className="mono fg3"
          style={{
            fontSize: 11,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          ← Articles
        </Link>
        {article.category && (
          <div style={{ marginTop: 16 }}>
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: ".15em",
                textTransform: "uppercase",
                padding: "5px 10px",
                borderRadius: 999,
                border: `1px solid ${categoryColor}`,
                color: categoryColor,
              }}
            >
              {article.category}
            </span>
          </div>
        )}
        <Eyebrow>{formatDate(article.publishedAt)}</Eyebrow>
        <h1 className="display" style={{ marginTop: 14, marginBottom: 14 }}>
          {article.title}
        </h1>
        {article.excerpt && <p className="lede">{article.excerpt}</p>}
      </section>

      {article.coverImage && (
        <div
          style={{
            position: "relative",
            aspectRatio: "16/9",
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid var(--line)",
            marginBottom: 32,
          }}
        >
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            sizes="(max-width: 880px) 100vw, 820px"
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
      )}

      <div style={{ paddingBottom: 60 }}>
        <RenderTipTap content={article.content} />
      </div>
    </article>
  );
}
