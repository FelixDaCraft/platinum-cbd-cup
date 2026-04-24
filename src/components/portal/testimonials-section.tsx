"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";

interface Testimonial {
  id: string;
  author: string;
  role: string;
  company?: string;
  content: string;
  rating?: number;
  avatarUrl?: string | null;
}

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

// Labels by locale
const sectionLabels = {
  fr: {
    title: "Ils nous font confiance",
    subtitle: "Ce que nos participants disent de nous",
  },
  en: {
    title: "They trust us",
    subtitle: "What our participants say about us",
  },
} as const;

/**
 * Testimonials Carousel Section - Story 12.8
 */
export function TestimonialsSection({
  testimonials,
  autoPlay = true,
  autoPlayInterval = 5000,
}: TestimonialsSectionProps) {
  const { theme, locale } = usePortal();
  const labels = sectionLabels[locale] ?? sectionLabels.fr;
  const [currentIndex, setCurrentIndex] = useState(0);

  // Don't render if no testimonials
  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  // Auto-play carousel
  useEffect(() => {
    if (!autoPlay || testimonials.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, testimonials.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? testimonials.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const currentTestimonial = testimonials[currentIndex];

  if (!currentTestimonial) {
    return null;
  }

  return (
    <section className="py-16 md:py-24 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            {labels.title}
          </h2>
          <p className="text-muted-foreground">{labels.subtitle}</p>
        </motion.div>

        {/* Carousel */}
        <div className="relative max-w-4xl mx-auto">
          {/* Quote Icon */}
          <div
            className="absolute -top-8 left-1/2 -translate-x-1/2 flex h-16 w-16 items-center justify-center rounded-full z-10"
            style={{ backgroundColor: `${theme.primaryColor}15` }}
          >
            <Quote className="h-8 w-8" style={{ color: theme.primaryColor }} />
          </div>

          {/* Testimonial Card */}
          <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12 pt-12 md:pt-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                {/* Rating */}
                {currentTestimonial.rating && (
                  <div className="flex justify-center gap-1 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-5 w-5",
                          i < currentTestimonial.rating!
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        )}
                      />
                    ))}
                  </div>
                )}

                {/* Content */}
                <blockquote className="text-lg md:text-xl text-foreground leading-relaxed mb-8">
                  &ldquo;{currentTestimonial.content}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="flex items-center justify-center gap-4">
                  {currentTestimonial.avatarUrl ? (
                    <img
                      src={currentTestimonial.avatarUrl}
                      alt={currentTestimonial.author}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: theme.primaryColor }}
                    >
                      {currentTestimonial.author.charAt(0)}
                    </div>
                  )}
                  <div className="text-left">
                    <p className="font-semibold">{currentTestimonial.author}</p>
                    <p className="text-sm text-muted-foreground">
                      {currentTestimonial.role}
                      {currentTestimonial.company && (
                        <span> \u2022 {currentTestimonial.company}</span>
                      )}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Arrows */}
          {testimonials.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-16 rounded-full shadow-lg bg-background"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-16 rounded-full shadow-lg bg-background"
                onClick={goToNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Dots Navigation */}
        {testimonials.length > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  index === currentIndex
                    ? "w-8"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                style={
                  index === currentIndex
                    ? { backgroundColor: theme.primaryColor }
                    : undefined
                }
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
