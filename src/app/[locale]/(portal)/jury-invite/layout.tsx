import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * La page est un composant client : elle ne peut pas exporter `metadata`.
 * Ce layout de segment porte donc le titre et le `noindex` — une page de
 * compte n'a rien à faire dans un index, et son référencement dilue celui
 * des pages éditoriales (robots.ts la bloque aussi, ceinture et bretelles).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("authTitles");
  return { title: t("juryInvite"), robots: { index: false, follow: false } };
}

export default function AuthSegmentLayout({ children }: { children: ReactNode }) {
  return children;
}
