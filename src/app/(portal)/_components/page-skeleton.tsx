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
    <div style={{ paddingTop: 40, paddingBottom: 40 }} aria-busy="true">
      <style>{`
        .sk { background: var(--line); border-radius: 8px; animation: sk-pulse 1.4s ease-in-out infinite; }
        @keyframes sk-pulse { 50% { opacity: .38; } }
        @media (prefers-reduced-motion: reduce) { .sk { animation: none; opacity: .6; } }
      `}</style>

      <span className="sr-only">Chargement de la page…</span>

      {/* Eyebrow + titre + chapô */}
      <div className="sk" style={{ width: 160, height: 10, marginBottom: 22 }} />
      <div className="sk" style={{ width: "min(420px, 80%)", height: 44, marginBottom: 18 }} />
      <div className="sk" style={{ width: "min(560px, 95%)", height: 14, marginBottom: 8 }} />
      <div className="sk" style={{ width: "min(400px, 70%)", height: 14 }} />

      {/* Lignes de contenu */}
      <div style={{ marginTop: 44, display: "grid", gap: 12 }}>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="sk"
            style={{
              height: 56,
              borderRadius: "var(--radius)",
              // Dégradé d'opacité : la page semble se remplir du haut.
              opacity: 1 - i * 0.1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
