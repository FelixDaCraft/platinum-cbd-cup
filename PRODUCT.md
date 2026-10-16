# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Producteurs de CBD** (fermes, chanvriers, marques artisanales, surtout en France) : public prioritaire du site public. Ils viennent comprendre le concours, voir les catégories, les tarifs et les places restantes, puis inscrire et payer leurs produits pendant la période d'inscription.
- **Amateurs et consommateurs** : consultent le palmarès, édition après édition.
- **Jurés** : activent leur accès par code ou QR, puis notent depuis leur espace.
- **Presse et partenaires** : kit média, dossier sponsor, contacts.

## Product Purpose

La Platinum CBD Cup est un concours européen de CBD, organisé chaque année depuis 2023 par l'association Platinum CBD. Les produits sont jugés à l'aveugle par deux jurys : un jury professionnel (classement par catégorie) et un jury public (consommateurs qui notent chez eux à partir d'un coffret d'échantillons ; leur note décerne les labels Or, Argent et Bronze et le Prix du public). Réussite du site public : des producteurs qui s'inscrivent, un palmarès qui donne envie de concourir l'année suivante.

## Positioning

Notation à l'aveugle, avec un code d'anonymat différent pour chaque jury, et deux palmarès distincts (experts et consommateurs) : un produit est jugé sur ce qu'il est, pas sur son nom.

## Operating Context

- Édition 2027 = 5e édition. Inscriptions du 10 octobre au 31 décembre 2026, notation du 1er février au 21 mars 2027.
- Catégories 2027 : Fleurs Outdoor, Fleurs Greenhouse, Fleurs Indoor, Dry Hash, Water Hash (Ice-O-Lator) ; 200 € par produit inscrit, quotas de places par catégorie.
- Palmarès des éditions 2023 à 2026 en base, par jury et par catégorie.
- Communication réseaux sociaux : Instagram @platinum_cup_france, visuels « street » 2027 (participant, jury, sponsor).

## Capabilities and Constraints

- Next.js 15 (app router), tRPC, Drizzle/Postgres, déploiement sur homelab via push sur `main`.
- Paiement Viva, inscription multi-catégories en une commande, comptes producteur / juré / organisateur.
- Site en français.

## Brand Commitments

- Nom affiché : « Platinum CBD Cup » ; logo emblème doré (`public/brand/platinum-cbd-cup-logo.png`, modèle 3D `public/models/geometric-emblem.glb`).
- **Louize Display (Bold Italic)** est conservée pour le nom/logo dans l'en-tête (choix explicite de l'utilisateur, octobre 2026).
- **Couleurs conservées** : nuit `#0c0b09`, or `#d4af37`, or clair `#f5e6a8` (choix explicite de l'utilisateur, octobre 2026).
- Le site public s'aligne sur la DA « street » 2027 des visuels réseaux (choix explicite de l'utilisateur, octobre 2026) : source dans `~/Projects/platinum-visuels-2027` et `InstaPlanner/src/components/generator/previews/StreetElements.tsx`.

## Evidence on Hand

- Palmarès réels 2023–2026 (produits, producteurs, notes, labels) en base.
- Logos producteurs (`public/uploads/producer-logos`, ~124), quelques photos producteurs.
- Photos d'événement : `public/uploads/articles/img-1132-*.webp` (remise des prix), `public/uploads/articles/design-sans-titre--20-*.webp` (présentation devant le backdrop). L'utilisateur peut en fournir d'autres.
- Aucun témoignage, chiffre d'audience ou partenaire ne doit être inventé.

## Product Principles

1. Le producteur doit comprendre en quelques secondes comment participer, combien ça coûte et jusqu'à quand.
2. Le palmarès est la preuve : il montre de vrais produits, de vrais producteurs, de vraies notes.
3. L'anonymat et les deux jurys sont le cœur du concours ; le site l'explique sans jargon.
4. Une seule identité entre le site et les réseaux sociaux.

## Accessibility & Inclusion

WCAG AA pour le contraste du texte ; navigation au clavier et lien d'évitement conservés ; mobile soigné (barre de navigation basse existante).
