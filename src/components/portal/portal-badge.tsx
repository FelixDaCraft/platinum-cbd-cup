"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const portalBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(var(--portal-primary))] text-white",
        secondary:
          "bg-[hsl(var(--portal-muted))] text-[hsl(var(--portal-foreground))]",
        outline:
          "border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-foreground))]",
        success:
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        warning:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        danger:
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        info:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface PortalBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof portalBadgeVariants> {}

const PortalBadge = React.forwardRef<HTMLDivElement, PortalBadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(portalBadgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
PortalBadge.displayName = "PortalBadge";

export { PortalBadge, portalBadgeVariants };
