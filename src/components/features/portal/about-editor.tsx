"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, User, Image as ImageIcon, Save, Loader2, Settings, BarChart3, FileText, Users, ImagePlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { TeamMember } from "~/server/db/schema/organization-about";
import type {
  HeroStyle,
  MissionStyle,
  ValuesDisplay,
  TeamCardSize,
  GalleryColumns,
  SectionStyle,
} from "~/server/db/schema/portal-about-settings";

export function AboutEditor() {
  const utils = api.useUtils();
  const { data: aboutContent, isLoading } = api.portal.getAboutContent.useQuery();
  const { data: aboutSettings, isLoading: isLoadingSettings } = api.portal.getAboutSettings.useQuery();

  const [history, setHistory] = useState("");
  const [mission, setMission] = useState("");
  const [values, setValues] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newMember, setNewMember] = useState({
    name: "",
    role: "",
    photo: "",
    bio: "",
  });

  // Settings state
  const [heroStyle, setHeroStyle] = useState<HeroStyle>("banner");
  const [heroTagline, setHeroTagline] = useState("");
  const [missionStyle, setMissionStyle] = useState<MissionStyle>("quote");
  const [valuesDisplay, setValuesDisplay] = useState<ValuesDisplay>("cards");
  const [teamCardSize, setTeamCardSize] = useState<TeamCardSize>("large");
  const [showTeamSocialLinks, setShowTeamSocialLinks] = useState(true);
  const [galleryColumns, setGalleryColumns] = useState<GalleryColumns>("3");
  const [enableGalleryLightbox, setEnableGalleryLightbox] = useState(true);
  const [sectionStyle, setSectionStyle] = useState<SectionStyle>("alternating");
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [statsYearFounded, setStatsYearFounded] = useState("");
  const [statsCupsOrganized, setStatsCupsOrganized] = useState("");
  const [statsJudgesCount, setStatsJudgesCount] = useState("");
  const [statsCustomLabel1, setStatsCustomLabel1] = useState("");
  const [statsCustomValue1, setStatsCustomValue1] = useState("");
  const [statsCustomLabel2, setStatsCustomLabel2] = useState("");
  const [statsCustomValue2, setStatsCustomValue2] = useState("");

  // Initialize form values when data loads
  useEffect(() => {
    if (aboutContent) {
      setHistory(aboutContent.history ?? "");
      setMission(aboutContent.mission ?? "");
      setValues(aboutContent.values ?? "");
    }
  }, [aboutContent]);

  // Initialize settings when data loads
  useEffect(() => {
    if (aboutSettings) {
      setHeroStyle(aboutSettings.heroStyle);
      setHeroTagline(aboutSettings.heroTagline ?? "");
      setMissionStyle(aboutSettings.missionStyle);
      setValuesDisplay(aboutSettings.valuesDisplay);
      setTeamCardSize(aboutSettings.teamCardSize);
      setShowTeamSocialLinks(aboutSettings.showTeamSocialLinks);
      setGalleryColumns(aboutSettings.galleryColumns);
      setEnableGalleryLightbox(aboutSettings.enableGalleryLightbox);
      setSectionStyle(aboutSettings.sectionStyle);
      setEnableAnimations(aboutSettings.enableAnimations);
      setShowStats(aboutSettings.showStats);
      setStatsYearFounded(aboutSettings.statsYearFounded ?? "");
      setStatsCupsOrganized(aboutSettings.statsCupsOrganized ?? "");
      setStatsJudgesCount(aboutSettings.statsJudgesCount ?? "");
      setStatsCustomLabel1(aboutSettings.statsCustomLabel1 ?? "");
      setStatsCustomValue1(aboutSettings.statsCustomValue1 ?? "");
      setStatsCustomLabel2(aboutSettings.statsCustomLabel2 ?? "");
      setStatsCustomValue2(aboutSettings.statsCustomValue2 ?? "");
    }
  }, [aboutSettings]);

  const updateContent = api.portal.updateAboutContent.useMutation({
    onSuccess: () => {
      toast.success("Contenu mis à jour");
      utils.portal.getAboutContent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addGalleryImage = api.portal.addGalleryImage.useMutation({
    onSuccess: () => {
      toast.success("Image ajoutée");
      setNewImageUrl("");
      utils.portal.getAboutContent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeGalleryImage = api.portal.removeGalleryImage.useMutation({
    onSuccess: () => {
      toast.success("Image supprimée");
      utils.portal.getAboutContent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addTeamMember = api.portal.addTeamMember.useMutation({
    onSuccess: () => {
      toast.success("Membre ajouté");
      setNewMember({ name: "", role: "", photo: "", bio: "" });
      utils.portal.getAboutContent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeTeamMember = api.portal.removeTeamMember.useMutation({
    onSuccess: () => {
      toast.success("Membre supprimé");
      utils.portal.getAboutContent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateSettings = api.portal.updateAboutSettings.useMutation({
    onSuccess: () => {
      toast.success("Personnalisation mise à jour");
      utils.portal.getAboutSettings.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSaveSettings = () => {
    updateSettings.mutate({
      heroStyle,
      heroTagline: heroTagline || null,
      missionStyle,
      valuesDisplay,
      teamCardSize,
      showTeamSocialLinks,
      galleryColumns,
      enableGalleryLightbox,
      sectionStyle,
      enableAnimations,
      showStats,
      statsYearFounded: statsYearFounded || null,
      statsCupsOrganized: statsCupsOrganized || null,
      statsJudgesCount: statsJudgesCount || null,
      statsCustomLabel1: statsCustomLabel1 || null,
      statsCustomValue1: statsCustomValue1 || null,
      statsCustomLabel2: statsCustomLabel2 || null,
      statsCustomValue2: statsCustomValue2 || null,
    });
  };

  const handleSaveContent = () => {
    updateContent.mutate({
      history: history || null,
      mission: mission || null,
      values: values || null,
    });
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    addGalleryImage.mutate({ imageUrl: newImageUrl.trim() });
  };

  const handleAddMember = () => {
    if (!newMember.name.trim() || !newMember.role.trim()) return;
    addTeamMember.mutate({
      name: newMember.name.trim(),
      role: newMember.role.trim(),
      photo: newMember.photo.trim() || null,
      bio: newMember.bio.trim() || null,
    });
  };

  if (isLoading || isLoadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="content" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="content" className="gap-2">
          <FileText className="h-4 w-4" />
          Contenu
        </TabsTrigger>
        <TabsTrigger value="gallery" className="gap-2">
          <ImagePlus className="h-4 w-4" />
          Galerie
        </TabsTrigger>
        <TabsTrigger value="team" className="gap-2">
          <Users className="h-4 w-4" />
          Équipe
        </TabsTrigger>
        <TabsTrigger value="settings" className="gap-2">
          <Settings className="h-4 w-4" />
          Personnalisation
        </TabsTrigger>
      </TabsList>

      {/* Content Tab */}
      <TabsContent value="content" className="space-y-6">
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="mb-4">
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Notre Histoire</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Racontez l&apos;histoire de votre organisation
            </p>
          </div>
          <Textarea
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            placeholder="Décrivez l'histoire de votre organisation..."
            rows={6}
          />
        </div>

        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="mb-4">
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Notre Mission</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Décrivez la mission de votre organisation
            </p>
          </div>
          <Textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="Quelle est la mission de votre organisation ?"
            rows={4}
          />
        </div>

        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="mb-4">
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Nos Valeurs</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Partagez les valeurs qui guident votre organisation
            </p>
          </div>
          <Textarea
            value={values}
            onChange={(e) => setValues(e.target.value)}
            placeholder="Quelles sont vos valeurs fondamentales ?"
            rows={4}
          />
        </div>

        <Button
          onClick={handleSaveContent}
          disabled={updateContent.isPending}
          className="w-full"
        >
          {updateContent.isPending ? (
            <>[LOADING...] Enregistrement...</>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer le contenu
            </>
          )}
        </Button>
      </TabsContent>

      {/* Gallery Tab */}
      <TabsContent value="gallery" className="space-y-6">
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="flex items-center gap-3 mb-4">
            <ImageIcon className="h-5 w-5" style={{ color: "var(--n-text-disabled)" }} />
            <div>
              <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Galerie Photos</h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Ajoutez des images pour illustrer votre page À Propos (max 20)
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="URL de l'image (https://...)"
                type="url"
              />
              <Button
                onClick={handleAddImage}
                disabled={!newImageUrl.trim() || addGalleryImage.isPending}
                variant="outline"
              >
                {addGalleryImage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {aboutContent?.galleryImages && aboutContent.galleryImages.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {aboutContent.galleryImages.map((imageUrl, index) => (
                  <div key={index} className="relative group rounded-xl overflow-hidden" style={{ border: "1px solid var(--n-border)" }}>
                    <img
                      src={imageUrl}
                      alt={`Image ${index + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeGalleryImage.mutate({ imageUrl })}
                      disabled={removeGalleryImage.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-xl" style={{ border: "1px solid var(--n-border)", color: "var(--n-text-disabled)" }}>
                <ImageIcon className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Aucune image dans la galerie</p>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      {/* Team Tab */}
      <TabsContent value="team" className="space-y-6">
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-5 w-5" style={{ color: "var(--n-text-disabled)" }} />
            <div>
              <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Notre Équipe</h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Présentez les membres de votre équipe (max 20)
              </p>
            </div>
          </div>
          <div className="space-y-6">
            {/* Add new member form */}
            <div className="grid gap-4 p-4 rounded-xl" style={{ border: "1px solid var(--n-border)" }}>
              <h4 className="font-medium" style={{ color: "var(--n-text-primary)" }}>Ajouter un membre</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Nom *</Label>
                  <Input
                    id="name"
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    placeholder="Nom du membre"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Rôle *</Label>
                  <Input
                    id="role"
                    value={newMember.role}
                    onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                    placeholder="Poste / Fonction"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="photo">URL de la photo</Label>
                <Input
                  id="photo"
                  value={newMember.photo}
                  onChange={(e) => setNewMember({ ...newMember, photo: e.target.value })}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <div>
                <Label htmlFor="bio">Biographie</Label>
                <Textarea
                  id="bio"
                  value={newMember.bio}
                  onChange={(e) => setNewMember({ ...newMember, bio: e.target.value })}
                  placeholder="Courte description..."
                  rows={2}
                />
              </div>
              <Button
                onClick={handleAddMember}
                disabled={!newMember.name.trim() || !newMember.role.trim() || addTeamMember.isPending}
              >
                {addTeamMember.isPending ? (
                  <>[LOADING...] Ajout...</>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter le membre
                  </>
                )}
              </Button>
            </div>

            {/* Existing team members */}
            {aboutContent?.teamMembers && aboutContent.teamMembers.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {aboutContent.teamMembers.map((member: TeamMember) => (
                  <div key={member.id} className="flex items-start gap-3 p-4 rounded-xl" style={{ border: "1px solid var(--n-border)" }}>
                    {member.photo ? (
                      <img
                        src={member.photo}
                        alt={member.name}
                        className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ border: "1px solid var(--n-border)" }}>
                        <User className="h-6 w-6" style={{ color: "var(--n-text-disabled)" }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate" style={{ color: "var(--n-text-primary)" }}>{member.name}</h4>
                      <p className="text-sm truncate" style={{ color: "var(--n-text-secondary)" }}>{member.role}</p>
                      {member.bio && (
                        <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--n-text-secondary)" }}>
                          {member.bio}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      style={{ color: "var(--n-accent)" }}
                      onClick={() => removeTeamMember.mutate({ id: member.id })}
                      disabled={removeTeamMember.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-xl" style={{ border: "1px solid var(--n-border)", color: "var(--n-text-disabled)" }}>
                <User className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Aucun membre dans l&apos;équipe</p>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="space-y-6">
        {/* Hero Section Settings */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="mb-4">
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Section Hero</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Personnalisez l&apos;en-tête de votre page À Propos
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Style du Hero</Label>
              <Select value={heroStyle} onValueChange={(v) => setHeroStyle(v as HeroStyle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">Bannière complète</SelectItem>
                  <SelectItem value="minimal">Minimaliste</SelectItem>
                  <SelectItem value="none">Aucun</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                {heroStyle === "banner" && "Grande bannière avec titre et accroche"}
                {heroStyle === "minimal" && "Titre simple sans bannière"}
                {heroStyle === "none" && "Pas de section hero"}
              </p>
            </div>

            {heroStyle !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="heroTagline">Accroche (optionnel)</Label>
                <Input
                  id="heroTagline"
                  value={heroTagline}
                  onChange={(e) => setHeroTagline(e.target.value)}
                  placeholder="Une phrase qui résume votre organisation..."
                  maxLength={200}
                />
              </div>
            )}
          </div>
        </div>

        {/* Mission Section Settings */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="mb-4">
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Section Mission</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Choisissez comment afficher votre mission
            </p>
          </div>
          <div className="space-y-2">
            <Label>Style d&apos;affichage</Label>
            <Select value={missionStyle} onValueChange={(v) => setMissionStyle(v as MissionStyle)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote">Citation stylisée</SelectItem>
                <SelectItem value="card">Carte mise en avant</SelectItem>
                <SelectItem value="simple">Texte simple</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              {missionStyle === "quote" && "Affichage en citation avec guillemets décoratifs"}
              {missionStyle === "card" && "Carte avec fond coloré et mise en avant"}
              {missionStyle === "simple" && "Affichage texte basique"}
            </p>
          </div>
        </div>

        {/* Values Section Settings */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="mb-4">
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Section Valeurs</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Choisissez comment afficher vos valeurs
            </p>
          </div>
          <div className="space-y-2">
            <Label>Type d&apos;affichage</Label>
            <Select value={valuesDisplay} onValueChange={(v) => setValuesDisplay(v as ValuesDisplay)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cards">Cartes avec icônes</SelectItem>
                <SelectItem value="grid">Grille compacte</SelectItem>
                <SelectItem value="list">Liste simple</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              {valuesDisplay === "cards" && "Cartes individuelles avec icônes et animations au survol"}
              {valuesDisplay === "grid" && "Grille compacte avec puces colorées"}
              {valuesDisplay === "list" && "Liste verticale simple"}
            </p>
          </div>
        </div>

        {/* Team Section Settings */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="mb-4">
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Section Équipe</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Personnalisez l&apos;affichage des membres
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Taille des cartes</Label>
              <Select value={teamCardSize} onValueChange={(v) => setTeamCardSize(v as TeamCardSize)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="large">Grandes cartes</SelectItem>
                  <SelectItem value="compact">Cartes compactes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                {teamCardSize === "large" && "Photos larges avec biographies complètes"}
                {teamCardSize === "compact" && "Affichage compact en grille"}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl p-4" style={{ border: "1px solid var(--n-border)" }}>
              <div className="space-y-0.5">
                <Label>Liens sociaux</Label>
                <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                  Afficher les liens vers les réseaux sociaux
                </p>
              </div>
              <Switch
                checked={showTeamSocialLinks}
                onCheckedChange={setShowTeamSocialLinks}
              />
            </div>
          </div>
        </div>

        {/* Gallery Section Settings */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="mb-4">
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Section Galerie</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Personnalisez l&apos;affichage de la galerie photos
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de colonnes</Label>
              <Select value={galleryColumns} onValueChange={(v) => setGalleryColumns(v as GalleryColumns)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 colonnes</SelectItem>
                  <SelectItem value="3">3 colonnes</SelectItem>
                  <SelectItem value="4">4 colonnes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl p-4" style={{ border: "1px solid var(--n-border)" }}>
              <div className="space-y-0.5">
                <Label>Lightbox</Label>
                <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                  Ouvrir les images en plein écran au clic
                </p>
              </div>
              <Switch
                checked={enableGalleryLightbox}
                onCheckedChange={setEnableGalleryLightbox}
              />
            </div>
          </div>
        </div>

        {/* General Settings */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="mb-4">
            <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Paramètres généraux</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Options globales de la page
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Style des sections</Label>
              <Select value={sectionStyle} onValueChange={(v) => setSectionStyle(v as SectionStyle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alternating">Fonds alternés</SelectItem>
                  <SelectItem value="uniform">Fond uniforme</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                {sectionStyle === "alternating" && "Alternance de sections claires et colorées (thème)"}
                {sectionStyle === "uniform" && "Toutes les sections avec le même fond"}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl p-4" style={{ border: "1px solid var(--n-border)" }}>
              <div className="space-y-0.5">
                <Label>Animations</Label>
                <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                  Activer les animations au défilement
                </p>
              </div>
              <Switch
                checked={enableAnimations}
                onCheckedChange={setEnableAnimations}
              />
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="h-5 w-5" style={{ color: "var(--n-text-disabled)" }} />
            <div>
              <h3 style={{ fontFamily: "'Doto', 'Space Mono', monospace", textTransform: "uppercase", color: "var(--n-text-display)" }} className="font-semibold">Section Statistiques</h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Affichez vos chiffres clés en haut de la page
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl p-4" style={{ border: "1px solid var(--n-border)" }}>
              <div className="space-y-0.5">
                <Label>Afficher les statistiques</Label>
                <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                  Section avec vos chiffres clés
                </p>
              </div>
              <Switch
                checked={showStats}
                onCheckedChange={setShowStats}
              />
            </div>

            {showStats && (
              <div className="space-y-4 pt-4" style={{ borderTop: "1px solid var(--n-border)" }}>
                <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                  Renseignez les statistiques à afficher (laissez vide pour masquer)
                </p>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="statsYearFounded">Année de création</Label>
                    <Input
                      id="statsYearFounded"
                      value={statsYearFounded}
                      onChange={(e) => setStatsYearFounded(e.target.value)}
                      placeholder="2015"
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="statsCupsOrganized">Concours organisés</Label>
                    <Input
                      id="statsCupsOrganized"
                      value={statsCupsOrganized}
                      onChange={(e) => setStatsCupsOrganized(e.target.value)}
                      placeholder="50+"
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="statsJudgesCount">Nombre de jurés</Label>
                    <Input
                      id="statsJudgesCount"
                      value={statsJudgesCount}
                      onChange={(e) => setStatsJudgesCount(e.target.value)}
                      placeholder="120"
                      maxLength={50}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-medium" style={{ color: "var(--n-text-primary)" }}>Statistiques personnalisées</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="statsCustomLabel1">Label personnalisé 1</Label>
                      <Input
                        id="statsCustomLabel1"
                        value={statsCustomLabel1}
                        onChange={(e) => setStatsCustomLabel1(e.target.value)}
                        placeholder="Participants"
                        maxLength={50}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="statsCustomValue1">Valeur 1</Label>
                      <Input
                        id="statsCustomValue1"
                        value={statsCustomValue1}
                        onChange={(e) => setStatsCustomValue1(e.target.value)}
                        placeholder="5000+"
                        maxLength={50}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="statsCustomLabel2">Label personnalisé 2</Label>
                      <Input
                        id="statsCustomLabel2"
                        value={statsCustomLabel2}
                        onChange={(e) => setStatsCustomLabel2(e.target.value)}
                        placeholder="Pays représentés"
                        maxLength={50}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="statsCustomValue2">Valeur 2</Label>
                      <Input
                        id="statsCustomValue2"
                        value={statsCustomValue2}
                        onChange={(e) => setStatsCustomValue2(e.target.value)}
                        placeholder="25"
                        maxLength={50}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={updateSettings.isPending}
          className="w-full"
        >
          {updateSettings.isPending ? (
            <>[LOADING...] Enregistrement...</>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer la personnalisation
            </>
          )}
        </Button>
      </TabsContent>
    </Tabs>
  );
}
