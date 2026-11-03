"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendu de remplacement. `null` par défaut : le contenu enveloppé ici est
   *  décoratif, son absence ne retire aucune information à la page. */
  fallback?: ReactNode;
  /** Préfixe de journal, pour distinguer les boundaries dans la console. */
  label?: string;
}

interface State {
  failed: boolean;
}

/**
 * Frontière d'erreur locale pour un fragment décoratif.
 *
 * `error.tsx` remplace la page entière : une exception dans un canvas WebGL
 * (pilote refusant le contexte, modèle GLB absent, `useGLTF` qui rejette)
 * effaçait donc tout le contenu éditorial d'un accueil ou d'un palmarès.
 * Ici l'erreur est contenue : la page perd son ornement et garde le reste.
 */
export class RenderBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.label ?? "RenderBoundary"}] Rendu abandonné`, error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
