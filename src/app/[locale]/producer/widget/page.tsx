"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "~/i18n/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";

export default function ProducerWidgetPage() {
  const t = useTranslations("widget");
  const tr = useTranslations("producerResults");
  const tc = useTranslations("producerSpace");
  const {
    data: embedData,
    isLoading,
    isError,
    refetch,
  } = api.widget.getEmbedCode.useQuery();
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"iframe" | "script">("iframe");

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      toast.success(t("copied"));
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      toast.error(t("copyError"));
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        style={{ color: "var(--n-text-disabled)" }}
      >
        <span className="n-font-data text-sm tracking-widest">{tc("loading")}</span>
      </div>
    );
  }

  // Une requête en échec ne doit pas se confondre avec une liste vide :
  // « vous n'avez rien » est plausible et masquerait l'incident.
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <span role="alert" className="n-font-data text-sm tracking-widest" style={{ color: "var(--n-text-secondary)" }}>
          {t("error")}
        </span>
        <button type="button" className="n-btn-secondary text-xs" onClick={() => void refetch()}>
          {tc("retry")}
        </button>
      </div>
    );
  }

  if (!embedData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/producer/dashboard" className="n-btn-ghost text-xs" style={{ padding: "8px 12px" }}>
            {tr("back")}
          </Link>
          <div>
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              {tr("eyebrow")}
            </div>
            <h1
              className="n-font-data text-2xl font-bold"
              style={{ color: "var(--n-text-display)" }}
            >
              {t("title")}
            </h1>
          </div>
        </div>
        <div
          className="py-12 text-center"
          style={{
            border: "1px dashed var(--n-border-visible)",
            borderRadius: "12px",
          }}
        >
          <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>
            {t("loadError")}
          </p>
        </div>
      </div>
    );
  }

  const activeCode = activeTab === "iframe" ? embedData.iframeCode : embedData.scriptCode;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/producer/dashboard" className="n-btn-ghost text-xs" style={{ padding: "8px 12px" }}>
          {tr("back")}
        </Link>
        <div>
          <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
            {tr("eyebrow")}
          </div>
          <h1
            className="n-font-data text-2xl font-bold"
            style={{ color: "var(--n-text-display)" }}
          >
            {t("title")}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--n-text-secondary)" }}>
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Code Section */}
        <div className="n-card">
          <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
            {t("embedCode")}
          </div>
          <p className="text-sm mb-5" style={{ color: "var(--n-text-secondary)" }}>
            {t("embedText")}
          </p>

          {/* Tab switcher */}
          <div
            className="flex mb-4"
            style={{
              border: "1px solid var(--n-border-visible)",
              borderRadius: "999px",
              padding: "2px",
              gap: "2px",
              display: "inline-flex",
            }}
          >
            {(["iframe", "script"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="n-font-data text-xs px-5 py-2"
                style={{
                  borderRadius: "999px",
                  backgroundColor:
                    activeTab === tab ? "var(--n-text-display)" : "transparent",
                  color:
                    activeTab === tab ? "var(--n-black)" : "var(--n-text-secondary)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  transition: "all 200ms ease-out",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Description */}
          <p className="text-sm mb-3" style={{ color: "var(--n-text-secondary)" }}>
            {activeTab === "iframe"
              ? t("iframeDesc")
              : t("scriptDesc")}
          </p>

          {/* Code block */}
          <div className="relative mb-4">
            <pre
              className="p-4 overflow-x-auto text-xs leading-relaxed"
              style={{
                backgroundColor: "var(--n-surface-raised)",
                border: "1px solid var(--n-border)",
                borderRadius: "8px",
                fontFamily: "'Space Mono', monospace",
                color: "var(--n-text-primary)",
              }}
            >
              <code>{activeCode}</code>
            </pre>
            <button
              onClick={() => handleCopy(activeCode, activeTab)}
              className="n-btn-secondary absolute top-3 right-3 text-xs"
              style={{ padding: "6px 14px", minHeight: "32px" }}
            >
              {copiedType === activeTab ? t("copiedTag") : t("copy")}
            </button>
          </div>

          {/* Customization hints */}
          <div
            className="p-4"
            style={{
              backgroundColor: "var(--n-surface-raised)",
              border: "1px solid var(--n-border)",
              borderRadius: "8px",
            }}
          >
            <div className="n-label mb-3" style={{ color: "var(--n-text-disabled)" }}>
              {activeTab === "iframe" ? t("customization") : t("options")}
            </div>
            {activeTab === "iframe" ? (
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <span
                    className="n-font-data text-xs shrink-0"
                    style={{
                      color: "var(--n-text-display)",
                      backgroundColor: "var(--n-surface)",
                      border: "1px solid var(--n-border-visible)",
                      borderRadius: "4px",
                      padding: "2px 8px",
                    }}
                  >
                    width
                  </span>
                  <span className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
                    {t("width")}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span
                    className="n-font-data text-xs shrink-0"
                    style={{
                      color: "var(--n-text-display)",
                      backgroundColor: "var(--n-surface)",
                      border: "1px solid var(--n-border-visible)",
                      borderRadius: "4px",
                      padding: "2px 8px",
                    }}
                  >
                    height
                  </span>
                  <span className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
                    {t("height")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { attr: "data-width", desc: t("dataWidth") },
                  { attr: "data-height", desc: t("dataHeight") },
                  { attr: "data-theme", desc: t("dataTheme") },
                ].map(({ attr, desc }) => (
                  <div key={attr} className="flex items-start gap-3">
                    <span
                      className="n-font-data text-xs shrink-0"
                      style={{
                        color: "var(--n-text-display)",
                        backgroundColor: "var(--n-surface)",
                        border: "1px solid var(--n-border-visible)",
                        borderRadius: "4px",
                        padding: "2px 8px",
                      }}
                    >
                      {attr}
                    </span>
                    <span className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs mt-3" style={{ color: "var(--n-text-disabled)" }}>
              {t("language")}
            </p>
          </div>
        </div>

        {/* Preview Section */}
        <div className="n-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
                {t("preview")}
              </div>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                {t("previewText")}
              </p>
            </div>
            <a
              href={embedData.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="n-btn-ghost text-xs"
              style={{ padding: "8px 12px" }}
            >
              {t("fullscreen")}
            </a>
          </div>

          <div
            className="flex justify-center p-4"
            style={{
              backgroundColor: "var(--n-surface-raised)",
              border: "1px solid var(--n-border)",
              borderRadius: "8px",
            }}
          >
            <iframe
              src={embedData.previewUrl}
              width="350"
              height="400"
              frameBorder="0"
              style={{ borderRadius: "8px" }}
              title={t("previewTitle")}
            />
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="n-card">
        <div className="n-label mb-5" style={{ color: "var(--n-text-disabled)" }}>
          {t("how")}
        </div>
        <div
          className="grid grid-cols-1 gap-px sm:grid-cols-3"
          style={{ backgroundColor: "var(--n-border)" }}
        >
          {[
            {
              step: "01",
              title: t("step1"),
              desc: t("step1Text"),
            },
            {
              step: "02",
              title: t("step2"),
              desc: t("step2Text"),
            },
            {
              step: "03",
              title: t("step3"),
              desc: t("step3Text"),
            },
          ].map(({ step, title, desc }) => (
            <div
              key={step}
              className="p-6"
              style={{ backgroundColor: "var(--n-surface)" }}
            >
              <div
                className="n-font-data text-3xl font-bold leading-none mb-3"
                style={{ color: "var(--n-border-visible)" }}
              >
                {step}
              </div>
              <h3
                className="font-semibold mb-2"
                style={{ color: "var(--n-text-display)" }}
              >
                {title}
              </h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
