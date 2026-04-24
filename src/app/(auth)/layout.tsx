import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion",
};

/**
 * Portal auth layout
 * Simple centered layout for login/register pages
 */
export default function PortalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {children}
    </div>
  );
}
