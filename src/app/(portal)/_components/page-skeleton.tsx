/**
 * Squelette de chargement aux couleurs du design system Platinum.
 *
 * Sert de `loading.tsx` aux pages publiques qui interrogent la base (cup,
 * palmarès, articles) : sans lui, la navigation reste figée sur la page
 * précédente le temps des requêtes, ce qui se lit comme un clic perdu.
 *
 * L'animation est portée par un `<style>` local plutôt que par platinumCSS :
 * elle n'existe que pour ces trois routes et n'a pas à peser sur le CSS
 * injecté dans chaque document HTML.
 */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="pg" aria-busy="true">
      <style>{`
        .sk { background: var(--line); border-radius: 8px; animation: sk-pulse 1.4s ease-in-out infinite; }
        @keyframes sk-pulse { 50% { opacity: .38; } }
        @media (prefers-reduced-motion: reduce) { .sk { animation: none; opacity: .6; } }
      `}</style>

      <span className="sr-only">Chargement de la page…</span>

      {/* En-tête : mêmes marges que .pg-head, titre à la hauteur de .display,
          chapô sur deux lignes à la taille de .pg-lede. */}
      <div className="pg-head">
        <div
          className="sk"
          style={{ width: "min(520px, 85%)", height: "clamp(40px, 6vw, 76px)" }}
        />
        <div style={{ display: "grid", gap: 10, maxWidth: 640 }}>
          <div className="sk" style={{ width: "95%", height: 18 }} />
          <div className="sk" style={{ width: "70%", height: 18 }} />
        </div>
      </div>

      {/* Contenu : blocs de la taille d'une tuile ou d'une ligne de liste. */}
      <div style={{ display: "grid", gap: 14 }}>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="sk"
            style={{
              height: 72,
              borderRadius: 16,
              // Dégradé d'opacité : la page semble se remplir du haut.
              opacity: 1 - i * 0.1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
