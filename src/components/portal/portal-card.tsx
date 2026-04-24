"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

/**
 * Portal-themed Card component
 * Uses portal CSS variables for consistent theming across jury/producer dashboards
 */
const PortalCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "highlight" | "stat" }
>(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border transition-all duration-200",
      variant === "default" && "bg-[hsl(var(--portal-card))] border-[hsl(var(--portal-border))]",
      variant === "highlight" && "bg-[hsl(var(--portal-primary)/0.05)] border-[hsl(var(--portal-primary)/0.2)]",
      variant === "stat" && "bg-[hsl(var(--portal-card))] border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-primary)/0.5)] hover:shadow-lg cursor-pointer",
      className
    )}
    {...props}
  />
));
PortalCard.displayName = "PortalCard";

const PortalCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5", className)}
    {...props}
  />
));
PortalCardHeader.displayName = "PortalCardHeader";

const PortalCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      "text-[hsl(var(--portal-foreground))]",
      className
    )}
    {...props}
  />
));
PortalCardTitle.displayName = "PortalCardTitle";

const PortalCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[hsl(var(--portal-muted-foreground))]", className)}
    {...props}
  />
));
PortalCardDescription.displayName = "PortalCardDescription";

const PortalCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
PortalCardContent.displayName = "PortalCardContent";

const PortalCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 pt-0", className)}
    {...props}
  />
));
PortalCardFooter.displayName = "PortalCardFooter";

/**
 * Portal stat card for displaying metrics
 */
interface PortalStatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  href?: string;
  onClick?: () => void;
}

const PortalStatCard = React.forwardRef<HTMLDivElement, PortalStatCardProps & React.HTMLAttributes<HTMLDivElement>>(
  ({ title, value, description, icon, trend, className, ...props }, ref) => (
    <PortalCard ref={ref} variant="stat" className={cn("", className)} {...props}>
      <PortalCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-sm font-medium text-[hsl(var(--portal-muted-foreground))]">
          {title}
        </span>
        {icon && (
          <span className="text-[hsl(var(--portal-muted-foreground))]">
            {icon}
          </span>
        )}
      </PortalCardHeader>
      <PortalCardContent>
        <div className="text-2xl font-bold text-[hsl(var(--portal-foreground))]">{value}</div>
        {description && (
          <p className="text-xs text-[hsl(var(--portal-muted-foreground))] mt-1">
            {description}
          </p>
        )}
      </PortalCardContent>
    </PortalCard>
  )
);
PortalStatCard.displayName = "PortalStatCard";

export {
  PortalCard,
  PortalCardHeader,
  PortalCardFooter,
  PortalCardTitle,
  PortalCardDescription,
  PortalCardContent,
  PortalStatCard,
};
