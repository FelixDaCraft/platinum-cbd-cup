# Historical results import — review document

**Source de vérité** : `scripts/historical-import/plan.ts`. Ce fichier MD est un récap pour la review.

## Structure

Chaque édition est splittée en **2 cups** (PRO + Public), comme le modèle 2026 déjà en DB.
La cup Public ne contient que le **1er par catégorie** (= "Prix du public").
**2023 n'a pas de cup Public** (pas de prix du public cette année-là).

→ Total : **5 cups · 60 produits**.

## Légende

- ✅ **LINK** — produit rattaché à un producteur **existant** dans la DB
- 🆕 **CREATE** — créera un producteur stub (placeholder user, pas de login). Dédup par `companyName` normalisé : un même nom dans plusieurs cups = un seul record producteur.

---

## 📅 Édition 01 · 2023 — Jury PRO (Nantes · 20 mai 2023)

| Cat | Rg | Produit | Producteur | Action |
|---|---|---|---|---|
| Indoor | 🥇 | S56 | Leaf District | 🆕 |
| Indoor | 🥈 | Agrume Haze | Hakuna Sativa | 🆕 |
| Indoor | 🥉 | Rez Kush | IznoFarm | 🆕 |
| Outdoor | 🥇 | Lemon Pie | Les Botanistes | 🆕 |
| Outdoor | 🥈 | Berry x Cherry Berry | Les Frères Canna | 🆕 |
| Outdoor | 🥉 | Shao K | IznoFarm | 🆕 |
| Greenhouse | 🥇 | Banana Cake | Les Botanistes | 🆕 |
| Greenhouse | 🥈 | Shao x Pink Panther | IznoFarm | 🆕 |
| Greenhouse | 🥉 | Orange Buddha | UtoPlantes | 🆕 |
| CBG Outdoor | 🥇 | IznoKush CBG | IznoFarm | 🆕 |
| CBG Outdoor | 🥈 | Mad Dog | La Ferme en Herbe | ✅ |
| CBG Outdoor | 🥉 | White CBG | French Bio Farmers | 🆕 |
| Hash | 🥇 | Frutti | Le Spliff Français | ✅ |
| Hash | 🥈 | Bubble Hash Cherry Berry | Hemp of Champ | 🆕 |
| Hash | 🥉 | Ancestral Bud | UtoPlantes | 🆕 |
| Edibles | 🥇 | Miel Infusé au Chanvre | Charent'Haze | ✅ |
| Edibles | 🥈 | Gummies Full-spectrum Passion | FrenchFarm.ac | 🆕 |
| Edibles | 🥉 | Bonbons Miel et Chanvre | Cannapoitou | 🆕 |

**18 produits · 3 LINK · 15 CREATE (10 producteurs distincts)**

---

## 📅 Édition 02 · 2024 — Jury PRO (Cann'Agri Expo · Nantes · 7 mai 2024)

> Pas de catégorie Indoor cette année-là (confirmé).

| Cat | Rg | Produit | Producteur | Action |
|---|---|---|---|---|
| Outdoor | 🥇 | Legendary Platinum OG Diesel Edition | Pinnacle Solutions | 🆕 |
| Outdoor | 🥈 | Cannapunch | CBD en Provence | ✅ |
| Outdoor | 🥉 | Siesta | Le Chanvre des Combrailles | 🆕 |
| Greenhouse | 🥇 | Purple Cake CBD | La Ferme en Herbe | ✅ |
| Greenhouse | 🥈 | TropiCake | UtoPlantes | 🆕 |
| Greenhouse | 🥉 | Harlequin | Chanvre Périgord | ✅ |
| Hash | 🥇 | Sapphire Hash | UtoPlantes | 🆕 |
| Hash | 🥈 | Pollen CBD | Charent'Haze | ✅ |
| Hash | 🥉 | BZ1 | BZHash Maker | ✅ |
| Edibles | 🥇 | CannaRilax | UtoPlantes | 🆕 |
| Edibles | 🥈 | Crousti-Chanvre | Le Chanvre du Griffoul | 🆕 |
| Edibles | 🥉 | Miel et résine | Cannevyre | 🆕 |

**12 produits · 5 LINK · 7 CREATE (5 producteurs distincts)**

## 📅 Édition 02 · 2024 — Jury Public

| Cat | Rg | Produit | Producteur | Action |
|---|---|---|---|---|
| Outdoor | 🥇 | Pink Panther | UtoPlantes | 🆕 |
| Greenhouse | 🥇 | Moonlight | Au Coin du Parc | 🆕 |
| Edibles | 🥇 | Miel et CBD | Cannevyre | 🆕 |

**3 produits · 0 LINK · 3 CREATE (3 producteurs distincts, dont 2 partagés avec PRO)**

---

## 📅 Édition 03 · 2025 — Jury PRO (Cann'Agri Expo · Nantes · 19-20 avril 2025)

| Cat | Rg | Produit | Producteur | Action |
|---|---|---|---|---|
| Indoor (FR) | 🥇 | Lemon Grace | Happy Pousse | ✅ |
| Indoor (FR) | 🥈 | Blue Meringue | Les Botanistes | 🆕 |
| Indoor (FR) | 🥉 | MB Gum | La Fleur Vendéenne | ✅ |
| Indoor (EU) | 🥇 | Tangie Juice | Chanvre DC | 🆕 |
| Indoor (EU) | 🥈 | Fear of Fog | Weneed | 🆕 |
| Indoor (EU) | 🥉 | Master of Disaster | CR Performance | 🆕 |
| Outdoor (EU) | 🥇 | Lemon Grace | Happy Pousse | ✅ |
| Outdoor (EU) | 🥈 | Island Kush | Art'izane | ✅ |
| Outdoor (EU) | 🥉 | Cheese Cake | L'Herbe Enchantée | 🆕 |
| Greenhouse (EU) | 🥇 | Sapphire Kush | Smellz | 🆕 |
| Greenhouse (EU) | 🥈 | Afghan Berry | Hera CBD | ✅ |
| Greenhouse (EU) | 🥉 | Dark Saphir | Happy Pousse | ✅ |
| Hash Dry | 🥇 | Blue Blood | Le Spliff Français | ✅ |
| Hash Dry | 🥈 | DrySift OZK 120-70 | Les Frères Canna | 🆕 |
| Hash Dry | 🥉 | BZI Bananas | BZHash Maker | ✅ |
| Hash Ice-O-Lator | 🥇 | WPFF Macaron Crush | Hashishin Art | 🆕 |
| Hash Ice-O-Lator | 🥈 | Ice Moon | Chanvre Périgord | ✅ |
| Hash Ice-O-Lator | 🥉 | Mr Ice | CBuddy | ✅ |
| Edibles | 🥇 | Miel au CBD | Les Botanistes en Herbe | 🆕 |
| Edibles | 🥈 | Chocolat Blanc | Cannevyre | 🆕 |
| Edibles | 🥉 | Miel Charass | La Ferme du Rial | ✅ |

**21 produits · 11 LINK · 10 CREATE (8 producteurs distincts)**

## 📅 Édition 03 · 2025 — Jury Public

| Cat | Rg | Produit | Producteur | Action |
|---|---|---|---|---|
| Indoor (EU) | 🥇 | Master of Disaster | CR Performance | 🆕 (réutilisé PRO) |
| Outdoor (EU) | 🥇 | Alpenrose | Cannafleur | 🆕 |
| Greenhouse (EU) | 🥇 | Sapphire Kush | Smellz | 🆕 (réutilisé PRO) |
| Hash Dry | 🥇 | LavenderZ 105μ | Hashishin Art | 🆕 (réutilisé PRO) |
| Hash Ice-O-Lator | 🥇 | WPFF Macaron Crush | Hashishin Art | 🆕 (réutilisé PRO) |
| Edibles | 🥇 | Miel au CBD | Les Botanistes en Herbe | 🆕 (réutilisé PRO) |

**6 produits · 0 LINK · 6 CREATE (5 producteurs distincts, 4 partagés avec PRO + Cannafleur unique au Public)**

---

## 📊 Synthèse globale

| Cup | Produits | LINK | CREATE | type |
|---|---|---|---|---|
| 2023 PRO | 18 | 3 | 15 | pro |
| 2024 PRO | 12 | 5 | 7 | pro |
| 2024 Public | 3 | 0 | 3 | public |
| 2025 PRO | 21 | 11 | 10 | pro |
| 2025 Public | 6 | 0 | 6 | public |
| **Total** | **60** | **19** | **41 lignes CREATE** | |

Après dédup `companyName` (case-insensitive, normalisé) → **~22 producteurs stub réellement créés**.

### Producteurs `CREATE` distincts à valider

**Récurrents (apparaissent dans plusieurs cups)** :
- IznoFarm — 2023 ×3 (Indoor 3e, Outdoor 3e, Greenhouse 2e, CBG Outdoor 1er)
- Les Botanistes — 2023 ×2 (Outdoor 1er, Greenhouse 1er), 2025 PRO Indoor-FR 2e
- UtoPlantes — 2023 ×2, 2024 PRO ×3, 2024 Public ×1 → 1 seul stub avec 6 produits
- Les Frères Canna — 2023 Outdoor 2e, 2025 PRO Hash Dry 2e
- Cannevyre — 2024 PRO Edibles 3e, 2024 Public Edibles 1er, 2025 PRO Edibles 2e
- CR Performance — 2025 PRO Indoor-EU 3e, 2025 Public Indoor-EU 1er
- Smellz — 2025 PRO Greenhouse 1er, 2025 Public Greenhouse 1er
- Hashishin Art — 2025 PRO Hash IOL 1er, 2025 Public Hash Dry 1er, 2025 Public Hash IOL 1er
- Les Botanistes en Herbe — 2025 PRO Edibles 1er, 2025 Public Edibles 1er

**Apparaissent une seule fois** (12 producteurs) :
- 2023 : Leaf District, Hakuna Sativa, French Bio Farmers, Hemp of Champ, FrenchFarm.ac, Cannapoitou
- 2024 : Pinnacle Solutions, Le Chanvre des Combrailles, Au Coin du Parc, Le Chanvre du Griffoul
- 2025 : Chanvre DC, Weneed, L'Herbe Enchantée, Cannafleur

---

## ⚙️ Conventions d'import

- **Cup naming** : `PlatinumCBD CUP YYYY - Jury PRO` / `PlatinumCBD CUP YYYY - Jury Public` (mirroir 2026)
- **`cups.type`** : `"pro"` ou `"public"`
- **`cups.status`** : `"completed"` partout
- **Score synthétique** : 1er=18.5 / 2e=17.8 / 3e=17.2 (palmarès trie par `final_score DESC`)
- **Labels** : PLATINUM (≥18) → 1er · GOLD (≥17.5) → 2e · SILVER (≥17) → 3e
- **Anonymous codes** : générés à l'import (`<CAT_KEY_UPPER>-<NN>` ex `INDOOR-01`)
- **Producteur placeholder (CREATE)** : 1 user dummy + 1 producer record. Email = `historic-<slug>@platinum-cbd-cup.local`. Pas de password.
- **Idempotence** :
  - Cup déjà créée (match par `name`) → re-run skip (ne dédouble pas)
  - Producer stub (match par `company_name` normalisé) → réutilisé entre cups

---

## 🟢 Prochaine étape

Je crée `scripts/historical-import/run.ts` qui exécute le plan. Lancement :

```bash
pnpm tsx scripts/historical-import/run.ts          # dry-run, affiche le plan
pnpm tsx scripts/historical-import/run.ts --apply  # écrit en DB
```

**Tu valides ?**
