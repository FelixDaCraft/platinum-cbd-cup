import { PortalHeader } from "~/components/portal/portal-header";
import { PortalFooter } from "~/components/portal/portal-footer";

interface LayoutProps {
  children: React.ReactNode;
}

export default function RegisterLayout({ children }: LayoutProps) {
  return (
    <>
      <PortalHeader />
      <main className="min-h-[60vh]">{children}</main>
      <PortalFooter />
    </>
  );
}
