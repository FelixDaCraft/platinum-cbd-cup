"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

interface PortalProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Portal-themed progress bar
 */
const PortalProgress = React.forwardRef<HTMLDivElement, PortalProgressProps>(
  ({ value, max = 100, showLabel = false, size = "md", className, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {showLabel && (
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-[hsl(var(--portal-foreground))]">
              Progression
            </span>
            <span className="text-sm font-medium text-[hsl(var(--portal-primary))]">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
        <div
          className={cn(
            "w-full rounded-full bg-[hsl(var(--portal-muted))]",
            size === "sm" && "h-1.5",
            size === "md" && "h-2.5",
            size === "lg" && "h-4"
          )}
        >
          <div
            className={cn(
              "rounded-full bg-[hsl(var(--portal-primary))] transition-all duration-500 ease-out",
              size === "sm" && "h-1.5",
              size === "md" && "h-2.5",
              size === "lg" && "h-4"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);
PortalProgress.displayName = "PortalProgress";

/**
 * Circular progress indicator
 */
interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  className?: string;
}

const CircularProgress = React.forwardRef<SVGSVGElement, CircularProgressProps>(
  ({ value, max = 100, size = 120, strokeWidth = 8, showValue = true, className }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className={cn("relative inline-flex items-center justify-center", className)}>
        <svg ref={ref} width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--portal-muted))"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--portal-primary))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-[hsl(var(--portal-foreground))]">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
    );
  }
);
CircularProgress.displayName = "CircularProgress";

export { PortalProgress, CircularProgress };
