import { describe, expect, it } from "vitest";
import { catalog } from "../../messages";
import { buildMessages, mergeMessages, type MessageTree } from "./messages";
import { locales } from "./locales";

function flatten(tree: MessageTree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

/** Arguments ICU de premier niveau : {name}, {count, plural, …}. */
function icuArgs(message: string): string[] {
  const args = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const c = message[i];
    if (c === "{") {
      if (depth === 0) {
        const m = /^\{\s*([a-zA-Z0-9_]+)/.exec(message.slice(i));
        if (m?.[1]) args.add(m[1]);
      }
      depth++;
    } else if (c === "}") depth--;
  }
  return [...args].sort();
}

/** Balises de texte enrichi : <b>…</b>, <link>…</link>. */
function tags(message: string): string[] {
  return [...message.matchAll(/<([a-zA-Z0-9]+)>/g)].map((m) => m[1]!).sort();
}

describe("mergeMessages / buildMessages", () => {
  it("la traduction l'emporte, le français comble les clés manquantes", () => {
    const merged = mergeMessages({ a: "A", b: { c: "C", d: "D" } }, { b: { c: "X" } });
    expect(merged).toEqual({ a: "A", b: { c: "X", d: "D" } });
  });

  it("une langue sans fichier retombe entièrement sur le français", () => {
    const messages = buildMessages("cs", { demo: { fr: { hello: "Bonjour" } } });
    expect(messages).toEqual({ demo: { hello: "Bonjour" } });
  });
});

describe("catalogue complet", () => {
  for (const [namespace, byLocale] of Object.entries(catalog)) {
    const fr = flatten((byLocale as Record<string, MessageTree>).fr ?? {});

    for (const locale of locales.filter((l) => l !== "fr")) {
      it(`${namespace} : ${locale} a toutes les clés du français, et rien de plus`, () => {
        const translated = flatten((byLocale as Record<string, MessageTree>)[locale] ?? {});
        expect(Object.keys(translated).sort()).toEqual(Object.keys(fr).sort());
      });

      it(`${namespace} : ${locale} garde les mêmes variables et balises`, () => {
        const translated = flatten((byLocale as Record<string, MessageTree>)[locale] ?? {});
        for (const [key, source] of Object.entries(fr)) {
          const target = translated[key];
          if (target === undefined) continue;
          expect(icuArgs(target), `${namespace}.${key}`).toEqual(icuArgs(source));
          expect(tags(target), `${namespace}.${key}`).toEqual(tags(source));
        }
      });
    }

    it(`${namespace} : aucune traduction vide`, () => {
      for (const locale of locales) {
        const values = flatten((byLocale as Record<string, MessageTree>)[locale] ?? {});
        for (const [key, value] of Object.entries(values)) {
          expect(value.trim(), `${namespace}.${key} (${locale})`).not.toBe("");
        }
      }
    });
  }
});
