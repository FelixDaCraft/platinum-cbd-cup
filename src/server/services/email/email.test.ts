import { describe, it, expect } from "vitest";

// Import direct des modules sans dépendance à `~/env` : `client.ts` et
// `send.ts` déclencheraient la validation de l'environnement au chargement.
import { escapeHtml, safeUrl } from "./escape";
import {
  renderButton,
  renderEmailLayout,
  renderFallbackLink,
  renderGreeting,
  renderQuote,
} from "./layout";
import { mapWithConcurrency } from "./batch";

describe("escapeHtml", () => {
  it("neutralise une balise injectée dans un nom saisi par un tiers", () => {
    const escaped = escapeHtml('<img src=x onerror="alert(1)">');

    expect(escaped).not.toContain("<img");
    expect(escaped).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("échappe l'esperluette en premier pour ne pas double-encoder", () => {
    // Un `&` traité après `<` produirait `&amp;lt;` et afficherait « &lt; ».
    expect(escapeHtml("Fleurs & Résines <CBD>")).toBe(
      "Fleurs &amp; Résines &lt;CBD&gt;"
    );
  });

  it("échappe les quotes qui casseraient un attribut", () => {
    expect(escapeHtml(`" onmouseover='x`)).toBe("&quot; onmouseover=&#39;x");
  });
});

describe("safeUrl", () => {
  it("laisse passer http et https", () => {
    expect(safeUrl("https://platinumcbdcup.eu/jury")).toBe(
      "https://platinumcbdcup.eu/jury"
    );
  });

  it("neutralise un schéma exécutable", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("neutralise une URL invalide", () => {
    expect(safeUrl("pas une url")).toBe("#");
  });
});

describe("renderEmailLayout", () => {
  it("échappe le titre", () => {
    const html = renderEmailLayout({
      title: 'Cup <script>alert("xss")</script>',
      body: "",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("porte le wrapper commun et la signature du concours", () => {
    const html = renderEmailLayout({ title: "Invitation jury", body: "<p>x</p>" });

    expect(html).toContain("max-width: 600px");
    expect(html).toContain("Platinum CBD Cup");
    expect(html).toContain("<p>x</p>");
  });

  it("accepte un pied de page sur mesure", () => {
    const html = renderEmailLayout({
      title: "Statut",
      body: "",
      footerHtml: '<a href="https://x.test/profile">Mes preferences</a>',
    });

    expect(html).toContain('href="https://x.test/profile"');
  });
});

describe("blocs de gabarit", () => {
  it("échappe le nom du destinataire", () => {
    expect(renderGreeting('<b>Jean</b>')).toContain("&lt;b&gt;Jean&lt;/b&gt;");
  });

  it("échappe le message libre de l'organisateur", () => {
    const html = renderQuote('<a href="https://evil.test">Cliquez ici</a>');

    expect(html).not.toContain("<a href=");
    expect(html).toContain("&lt;a href=");
  });

  it("rend un href inerte quand l'URL n'est pas navigable", () => {
    expect(renderButton("javascript:alert(1)", "Accepter")).toContain('href="#"');
    expect(renderFallbackLink("javascript:alert(1)")).toContain('href="#"');
  });
});

describe("mapWithConcurrency", () => {
  it("preserve l'ordre des resultats", async () => {
    const results = await mapWithConcurrency([5, 1, 3], 2, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, item));
      return item * 2;
    });

    expect(results).toEqual([10, 2, 6]);
  });

  it("ne dépasse jamais le parallélisme demandé", async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return null;
    });

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("traite une liste vide sans lancer de tâche", async () => {
    expect(await mapWithConcurrency([], 3, async () => "x")).toEqual([]);
  });
});
