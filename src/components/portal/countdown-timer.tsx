"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  targetDate: Date;
  label?: string;
  className?: string;
  onExpired?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();
  const difference = target - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((difference % (1000 * 60)) / 1000),
    expired: false,
  };
}

function formatTimeLeft(timeLeft: TimeLeft): string {
  if (timeLeft.expired) {
    return "Terminé";
  }

  if (timeLeft.days > 0) {
    return `J-${timeLeft.days}`;
  }

  if (timeLeft.hours > 0) {
    return `${timeLeft.hours}h ${timeLeft.minutes}min`;
  }

  return `${timeLeft.minutes}min ${timeLeft.seconds}s`;
}

export function CountdownTimer({
  targetDate,
  label = "Temps restant",
  className = "",
  onExpired,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(targetDate)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(targetDate);
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.expired && onExpired) {
        onExpired();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onExpired]);

  if (timeLeft.expired) {
    return null;
  }

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 24;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
        isUrgent
          ? "bg-red-500/20 text-red-600 dark:text-red-400"
          : "bg-orange-500/20 text-orange-600 dark:text-orange-400"
      } ${className}`}
    >
      <Clock className="h-4 w-4" />
      <span>{label}:</span>
      <span className="font-bold tabular-nums">{formatTimeLeft(timeLeft)}</span>
    </div>
  );
}

/**
 * Compact version for cards
 */
export function CountdownBadge({
  targetDate,
  className = "",
}: {
  targetDate: Date;
  className?: string;
}) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(targetDate)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.expired) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${className}`}
    >
      <Clock className="h-3 w-3" />
      {formatTimeLeft(timeLeft)}
    </span>
  );
}
