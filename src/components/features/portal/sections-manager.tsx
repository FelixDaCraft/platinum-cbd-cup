"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Eye,
  EyeOff,
  Save,
  Trophy,
  Megaphone,
  Award,
  BarChart3,
  MessageSquare,
  MousePointer,
  CalendarDays,
  Layers,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";

/**
 * Homepage Section Configuration
 */
interface SectionConfig {
  id: string;
  enabled: boolean;
  order: number;
}

/**
 * Available homepage sections with metadata
 */
const AVAILABLE_SECTIONS = [
  {
    id: "current-cup",
    name: "Cup En Cours",
    description: "Met en avant la cup active avec inscriptions ouvertes",
    icon: Trophy,
    defaultEnabled: true,
  },
  {
    id: "sponsors-marquee",
    name: "Bandeau Sponsors",
    description: "Bandeau défilant avec les logos des sponsors",
    icon: Megaphone,
    defaultEnabled: true,
  },
  {
    id: "hall-of-fame",
    name: "Derniers Lauréats",
    description: "Showcase des produits primés récemment",
    icon: Award,
    defaultEnabled: true,
  },
  {
    id: "stats",
    name: "Chiffres Clés",
    description: "Statistiques animées (cups, produits, jurys)",
    icon: BarChart3,
    defaultEnabled: true,
  },
  {
    id: "cups",
    name: "Nos Cups",
    description: "Liste des cups en cours et à venir",
    icon: CalendarDays,
    defaultEnabled: true,
  },
  {
    id: "testimonials",
    name: "Témoignages",
    description: "Carousel de témoignages participants",
    icon: MessageSquare,
    defaultEnabled: false,
  },
  {
    id: "cta",
    name: "Call-to-Action Final",
    description: "Section CTA avant le footer",
    icon: MousePointer,
    defaultEnabled: true,
  },
] as const;

/**
 * Sortable Section Item Component
 */
function SortableSectionItem({
  section,
  config,
  onToggle,
}: {
  section: (typeof AVAILABLE_SECTIONS)[number];
  config: SectionConfig;
  onToggle: (enabled: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = section.icon;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        border: isDragging ? "2px solid var(--n-accent)" : "1px solid var(--n-border)",
        borderRadius: "12px",
        opacity: isDragging ? 0.5 : !config.enabled ? 0.6 : 1,
        transition: style.transition,
      }}
      className="flex items-center gap-4 p-4"
    >
      {/* Drag Handle */}
      <button
        className="cursor-grab active:cursor-grabbing p-1 rounded-lg"
        style={{ color: "var(--n-text-disabled)" }}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Icon */}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ border: config.enabled ? "1px solid var(--n-accent)" : "1px solid var(--n-border)" }}
      >
        <Icon
          className="h-5 w-5"
          style={{ color: config.enabled ? "var(--n-accent)" : "var(--n-text-secondary)" }}
        />
      </div>

      {/* Section Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{section.name}</h4>
          {config.enabled ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", background: "var(--n-accent)", color: "var(--n-black)" }}>
              <Eye className="h-3 w-3" />
              Visible
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }}>
              <EyeOff className="h-3 w-3" />
              Masquee
            </span>
          )}
        </div>
        <p className="text-sm truncate" style={{ color: "var(--n-text-secondary)" }}>
          {section.description}
        </p>
      </div>

      {/* Toggle */}
      <Switch
        checked={config.enabled}
        onCheckedChange={onToggle}
        aria-label={`Activer ${section.name}`}
      />
    </div>
  );
}

/**
 * Sections Manager Component - Story 12.18
 * Drag & drop interface to manage homepage sections
 */
export function SectionsManager() {
  const utils = api.useUtils();
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch current theme config
  const { data: themeConfig, isLoading } = api.portal.getThemeConfig.useQuery();

  // Update mutation
  const updateMutation = api.portal.updateHomepageSections.useMutation({
    onSuccess: () => {
      setSaveMessage({ type: "success", text: "Configuration sauvegardée avec succès" });
      utils.portal.getThemeConfig.invalidate();
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: (error) => {
      setSaveMessage({ type: "error", text: error.message });
      setTimeout(() => setSaveMessage(null), 5000);
    },
  });

  // Local state for sections
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize sections from config or defaults
  useEffect(() => {
    if (themeConfig?.homepageSections) {
      try {
        const parsed = JSON.parse(themeConfig.homepageSections) as SectionConfig[];
        // Ensure all available sections are present
        const existingIds = new Set(parsed.map((s) => s.id));
        const mergedSections = [...parsed];

        AVAILABLE_SECTIONS.forEach((section, idx) => {
          if (!existingIds.has(section.id)) {
            mergedSections.push({
              id: section.id,
              enabled: section.defaultEnabled,
              order: parsed.length + idx,
            });
          }
        });

        setSections(mergedSections.sort((a, b) => a.order - b.order));
      } catch {
        // Invalid JSON, use defaults
        initializeDefaults();
      }
    } else {
      initializeDefaults();
    }
  }, [themeConfig?.homepageSections]);

  const initializeDefaults = () => {
    setSections(
      AVAILABLE_SECTIONS.map((section, idx) => ({
        id: section.id,
        enabled: section.defaultEnabled,
        order: idx,
      }))
    );
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);

      const newSections = arrayMove(sections, oldIndex, newIndex).map(
        (section, idx) => ({
          ...section,
          order: idx,
        })
      );

      setSections(newSections);
      setHasChanges(true);
    }
  };

  // Handle toggle
  const handleToggle = (sectionId: string, enabled: boolean) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, enabled } : s))
    );
    setHasChanges(true);
  };

  // Save changes
  const handleSave = () => {
    updateMutation.mutate({
      sections: sections.map((s) => ({
        id: s.id,
        enabled: s.enabled,
        order: s.order,
      })),
    });
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
          <div>
            <h3 className="font-semibold">Sections de la Homepage</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Glissez-deposez pour reordonner les sections. Activez ou desactivez
              chaque section selon vos besoins.
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            "[LOADING...]"
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Sauvegarder
            </>
          )}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {sections.map((config) => {
              const section = AVAILABLE_SECTIONS.find((s) => s.id === config.id);
              if (!section) return null;

              return (
                <SortableSectionItem
                  key={config.id}
                  section={section}
                  config={config}
                  onToggle={(enabled) => handleToggle(config.id, enabled)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {hasChanges && (
        <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.3)", color: "var(--n-warning)" }}>
          Vous avez des modifications non sauvegardees.
        </div>
      )}

      {saveMessage && (
        <div
          className="mt-4 p-3 rounded-xl text-sm"
          style={saveMessage.type === "success"
            ? { background: "rgba(56,161,105,0.1)", border: "1px solid rgba(56,161,105,0.3)", color: "var(--n-success)" }
            : { background: "rgba(229,62,62,0.1)", border: "1px solid rgba(229,62,62,0.3)", color: "var(--n-accent)" }
          }
        >
          {saveMessage.text}
        </div>
      )}
    </div>
  );
}
