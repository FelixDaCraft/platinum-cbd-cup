"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const portalButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(var(--portal-primary))] text-white shadow hover:bg-[hsl(var(--portal-primary)/0.9)] focus-visible:ring-[hsl(var(--portal-primary))]",
        secondary:
          "bg-[hsl(var(--portal-secondary))] text-white shadow-sm hover:bg-[hsl(var(--portal-secondary)/0.9)]",
        outline:
          "border border-[hsl(var(--portal-border))] bg-transparent hover:bg-[hsl(var(--portal-muted))] text-[hsl(var(--portal-foreground))]",
        ghost:
          "hover:bg-[hsl(var(--portal-muted))] text-[hsl(var(--portal-foreground))]",
        link: "text-[hsl(var(--portal-primary))] underline-offset-4 hover:underline",
        success:
          "bg-green-600 text-white shadow hover:bg-green-700",
        danger:
          "bg-red-600 text-white shadow hover:bg-red-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-lg px-8",
        xl: "h-12 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface PortalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof portalButtonVariants> {
  asChild?: boolean;
}

const PortalButton = React.forwardRef<HTMLButtonElement, PortalButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(portalButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
PortalButton.displayName = "PortalButton";

export { PortalButton, portalButtonVariants };
