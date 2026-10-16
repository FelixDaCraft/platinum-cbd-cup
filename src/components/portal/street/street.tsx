import { Fragment, type ReactNode } from "react";
import { LiquidText } from "./liquid-text";

/**
 * Briques de la DA « street » 2027, reprises des visuels Instagram
 * (InstaPlanner StreetElements.tsx, platinum-visuels-2027) : étoile, liste
 * dorée, barre d'édition entre deux filets, ruban qui défile, bichromie or
 * (avatars), en-tête de page.
 */

export { LiquidText };

/** Longueur du mot le plus long d'un titre, pour LiquidText `fit`. */
export function longestWord(...lines: (string | number)[]): number {
  return Math.max(
    1,
    ...lines.flatMap((l) => String(l).split(/\s+/)).map((w) => [...w].length),
  );
}

/**
 * Étoile à quatre branches des visuels 2027. Elle sépare souvent deux mots :
 * les lecteurs d'écran entendent alors « · » (sans quoi « 5e édition2027 »).
 * `decorative` la rend muette quand la structure sépare déjà les éléments.
 */
export function Sparkle({
  size = 16,
  className,
  decorative = false,
}: {
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const star = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`st-sparkle${className ? ` ${className}` : ""}`}
    >
      <path
        d="M12 0C12.8 7.6 16.4 11.2 24 12C16.4 12.8 12.8 16.4 12 24C11.2 16.4 7.6 12.8 0 12C7.6 11.2 11.2 7.6 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
  if (decorative) return star;
  return (
    <>
      {star}
      <span className="sr-only"> · </span>
    </>
  );
}

/**
 * Mots en capitales dorées séparés par des étoiles. L'étoile suit le mot :
 * au retour à la ligne, elle termine une ligne au lieu d'en ouvrir une.
 */
export function GoldList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={`st-goldlist${className ? ` ${className}` : ""}`}>
      {items.map((item, i) => (
        <li key={item}>
          <span>{item}</span>
          {i < items.length - 1 && <Sparkle size={14} decorative />}
        </li>
      ))}
    </ul>
  );
}

/** Barre « 5e édition · 2027 » entre deux filets blancs. */
export function EditionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`st-edition${className ? ` ${className}` : ""}`}>{children}</p>;
}

/**
 * Ruban or incliné qui défile, façon ruban de chantier (visuel sponsor
 * « OR ✦ OR ✦ »). La suite est dupliquée pour une boucle sans couture ; la
 * copie est cachée aux lecteurs d'écran.
 */
export function Tape({ items }: { items: string[] }) {
  const run = (hidden: boolean) => (
    <span className="st-tape-run" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <Fragment key={`${item}-${i}`}>
          <span>{item}</span>
          <Sparkle size={18} decorative={hidden || i === items.length - 1} />
        </Fragment>
      ))}
    </span>
  );
  return (
    <div className="st-tape">
      <div className="st-tape-track">
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}

/**
 * Filtres SVG partagés, posés une fois dans la coquille : bichromie
 * nuit → or → or clair des photos des visuels 2027.
 */
export function StreetDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="st-defs">
      <filter id="st-duotone" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
        />
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.047 0.831 0.961" />
          <feFuncG type="table" tableValues="0.043 0.686 0.902" />
          <feFuncB type="table" tableValues="0.035 0.216 0.659" />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}

/**
 * En-tête des pages du portail : barre d'édition, titre liquéfié, chapô.
 * `title` est le mot affiché en grand ; `children` reçoit le chapô ou les
 * actions.
 */
export function PageHead({
  edition,
  title,
  lede,
  children,
  seed,
  className,
}: {
  edition?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  seed?: number;
  className?: string;
}) {
  return (
    <header className={`st-head${className ? ` ${className}` : ""}`}>
      {edition && <EditionBar>{edition}</EditionBar>}
      <LiquidText
        as="h1"
        className="st-head-title"
        seed={seed}
        fit={typeof title === "string" ? longestWord(title) : undefined}
      >
        {title}
      </LiquidText>
      {lede && <p className="st-head-lede">{lede}</p>}
      {children}
    </header>
  );
}
