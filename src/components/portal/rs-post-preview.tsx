"use client";

import { useState, useRef } from "react";
import { Download, Copy, Check, Instagram, Twitter } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { RS_POST_FORMATS } from "~/lib/portal/image-generator";
import type { RSTemplateStyle, RSTemplateColors } from "~/server/db/schema/rs-templates";

interface RSPostPreviewProps {
  sponsor: {
    name: string;
    logo: string | null;
    level: string;
  };
  cup: {
    name: string;
  };
  organization: {
    name: string;
    logo: string | null;
  };
  template: {
    style: RSTemplateStyle;
    colors: RSTemplateColors;
    textContent: string;
    captionContent: string;
  };
  format?: "instagram" | "twitter";
  onFormatChange?: (format: "instagram" | "twitter") => void;
}

function getStyleClasses(style: RSTemplateStyle) {
  const styles: Record<RSTemplateStyle, string> = {
    classic: "rounded-lg",
    modern: "rounded-2xl",
    minimal: "rounded-none",
    vibrant: "rounded-3xl",
    elegant: "rounded-sm",
  };
  return styles[style] ?? styles.classic;
}

export function RSPostPreview({
  sponsor,
  cup,
  organization,
  template,
  format = "instagram",
  onFormatChange,
}: RSPostPreviewProps) {
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const formatConfig = RS_POST_FORMATS[format];
  const aspectRatio = format === "instagram" ? "1/1" : "16/9";

  const handleCopyCaption = async () => {
    await navigator.clipboard.writeText(template.captionContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // Create a canvas from the preview and download as PNG
    // This is a simplified version - in production you'd use html2canvas or similar
    const previewEl = previewRef.current;
    if (!previewEl) return;

    // For now, we'll create a simple download trigger
    // In production, you'd generate the image server-side or use html2canvas
    const dataUrl = generateSimplePreview();
    const link = document.createElement("a");
    link.download = `sponsor-${sponsor.name.toLowerCase().replace(/\s+/g, "-")}-${format}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Simple SVG-based preview generation
  const generateSimplePreview = () => {
    const width = formatConfig.width;
    const height = formatConfig.height;
    const { colors, textContent } = template;

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${colors.background}"/>
        <text x="50%" y="40%" fill="${colors.text}" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle" dominant-baseline="middle">
          ${sponsor.name}
        </text>
        <text x="50%" y="55%" fill="${colors.accent}" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" dominant-baseline="middle">
          Sponsor ${sponsor.level}
        </text>
        <text x="50%" y="70%" fill="${colors.text}" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="middle" opacity="0.8">
          ${cup.name}
        </text>
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  return (
    <div className="space-y-6">
      {/* Format Selector */}
      <Tabs value={format} onValueChange={(v) => onFormatChange?.(v as "instagram" | "twitter")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="instagram" className="gap-2">
            <Instagram className="h-4 w-4" />
            Instagram / Facebook
          </TabsTrigger>
          <TabsTrigger value="twitter" className="gap-2">
            <Twitter className="h-4 w-4" />
            Twitter / LinkedIn
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Preview */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{formatConfig.width}x{formatConfig.height}</Badge>
              <Badge variant="secondary">{formatConfig.aspectRatio}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              T\u00e9l\u00e9charger PNG
            </Button>
          </div>

          {/* Visual Preview */}
          <div
            ref={previewRef}
            className={cn(
              "relative mx-auto overflow-hidden",
              getStyleClasses(template.style)
            )}
            style={{
              aspectRatio,
              maxWidth: format === "instagram" ? "400px" : "600px",
              backgroundColor: template.colors.background,
            }}
          >
            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              {/* Sponsor Logo */}
              {sponsor.logo && (
                <div className="mb-6">
                  <img
                    src={sponsor.logo}
                    alt={sponsor.name}
                    className="h-20 w-auto max-w-[200px] object-contain"
                  />
                </div>
              )}

              {/* Text Content */}
              <h2
                className="text-2xl md:text-3xl font-bold mb-2"
                style={{ color: template.colors.text }}
              >
                {sponsor.name}
              </h2>
              <p
                className="text-lg mb-4"
                style={{ color: template.colors.accent }}
              >
                Sponsor {sponsor.level}
              </p>
              <p
                className="text-sm opacity-80"
                style={{ color: template.colors.text }}
              >
                {cup.name}
              </p>

              {/* Organization Logo */}
              {organization.logo && (
                <div className="absolute bottom-4 right-4">
                  <img
                    src={organization.logo}
                    alt={organization.name}
                    className="h-8 w-auto object-contain opacity-70"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Caption */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">L\u00e9gende sugg\u00e9r\u00e9e</h3>
            <Button variant="ghost" size="sm" onClick={handleCopyCaption}>
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  Copi\u00e9 !
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copier
                </>
              )}
            </Button>
          </div>
          <Textarea
            value={template.captionContent}
            readOnly
            className="min-h-[120px] resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}
