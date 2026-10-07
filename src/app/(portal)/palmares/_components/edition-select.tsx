"use client";

import { useRouter } from "next/navigation";

interface EditionSelectProps {
  options: { value: string; label: string }[];
  current: string;
}

/**
 * Sélecteur d'édition du palmarès. Un formulaire GET classique : sans
 * JavaScript, le bouton « Afficher » soumet le choix ; avec, le changement
 * de valeur navigue directement.
 */
export function EditionSelect({ options, current }: EditionSelectProps) {
  const router = useRouter();
  return (
    <form method="get" action="/palmares" className="pal-edition">
      <label>
        Édition
        <select
          name="edition"
          defaultValue={current}
          onChange={(e) => router.push(`/palmares?edition=${e.target.value}`, { scroll: false })}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="btn ghost">
          Afficher
        </button>
      </noscript>
    </form>
  );
}
