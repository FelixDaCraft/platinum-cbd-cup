"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "~/components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <TRPCReactProvider>
        {children}
        <Toaster richColors position="top-right" />
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
