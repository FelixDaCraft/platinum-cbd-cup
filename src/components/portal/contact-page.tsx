"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  Building2,
  Users,
  HelpCircle,
  CheckCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { ContactSubject } from "~/server/db/schema/contact-messages";

interface ContactInfo {
  email: string | null;
  phone: string | null;
  address: string | null;
  hours: string | null;
}

interface ContactPageProps {
  contactInfo: ContactInfo;
}

// Labels by locale
const contactLabels = {
  fr: {
    title: "Contactez-nous",
    subtitle: "Notre équipe est à votre disposition pour répondre à vos questions",
    formTitle: "Envoyez-nous un message",
    formSubtitle: "Remplissez le formulaire ci-dessous et nous vous répondrons dans les plus brefs délais",
    name: "Nom complet",
    namePlaceholder: "Jean Dupont",
    email: "Email",
    emailPlaceholder: "jean@example.com",
    subject: "Sujet",
    subjectPlaceholder: "Choisissez un sujet",
    message: "Message",
    messagePlaceholder: "Décrivez votre demande en détail...",
    send: "Envoyer le message",
    sending: "Envoi en cours...",
    sent: "Message envoyé !",
    sentDesc: "Nous vous répondrons dans les plus brefs délais.",
    subjects: {
      general: "Question générale",
      registration: "Inscription à un concours",
      results: "Questions sur les résultats",
      sponsorship: "Partenariat / Sponsoring",
      press: "Demande presse",
      technical: "Support technique",
      other: "Autre",
    },
    contactInfo: "Informations de contact",
    emailLabel: "Email",
    phoneLabel: "Téléphone",
    addressLabel: "Adresse",
    hoursLabel: "Horaires",
    faqTitle: "Questions fréquentes",
    faqItems: [
      {
        question: "Comment participer à un concours ?",
        answer: "Créez un compte producteur, inscrivez vos produits et réglez les frais d'inscription avant la date limite.",
      },
      {
        question: "Quand les résultats sont-ils publiés ?",
        answer: "Les résultats sont publiés après la clôture de la notation, généralement quelques jours après l'événement.",
      },
      {
        question: "Comment devenir sponsor ?",
        answer: "Contactez-nous via le formulaire en sélectionnant 'Partenariat / Sponsoring' pour recevoir notre dossier de sponsoring.",
      },
    ],
  },
  en: {
    title: "Contact Us",
    subtitle: "Our team is available to answer your questions",
    formTitle: "Send us a message",
    formSubtitle: "Fill out the form below and we'll get back to you as soon as possible",
    name: "Full Name",
    namePlaceholder: "John Doe",
    email: "Email",
    emailPlaceholder: "john@example.com",
    subject: "Subject",
    subjectPlaceholder: "Choose a subject",
    message: "Message",
    messagePlaceholder: "Describe your request in detail...",
    send: "Send Message",
    sending: "Sending...",
    sent: "Message Sent!",
    sentDesc: "We'll get back to you as soon as possible.",
    subjects: {
      general: "General Question",
      registration: "Competition Registration",
      results: "Questions about Results",
      sponsorship: "Partnership / Sponsorship",
      press: "Press Request",
      technical: "Technical Support",
      other: "Other",
    },
    contactInfo: "Contact Information",
    emailLabel: "Email",
    phoneLabel: "Phone",
    addressLabel: "Address",
    hoursLabel: "Hours",
    faqTitle: "Frequently Asked Questions",
    faqItems: [
      {
        question: "How do I participate in a competition?",
        answer: "Create a producer account, register your products, and pay the registration fees before the deadline.",
      },
      {
        question: "When are results published?",
        answer: "Results are published after the rating period closes, usually a few days after the event.",
      },
      {
        question: "How do I become a sponsor?",
        answer: "Contact us via the form by selecting 'Partnership / Sponsorship' to receive our sponsorship package.",
      },
    ],
  },
} as const;

/**
 * Contact Info Card
 */
function ContactInfoCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
}) {
  const { theme } = usePortal();

  const content = (
    <div className="flex items-start gap-4">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full shrink-0"
        style={{ backgroundColor: `${theme.primaryColor}15` }}
      >
        <Icon className="h-6 w-6" style={{ color: theme.primaryColor }} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block p-4 rounded-lg border hover:shadow-md transition-shadow"
      >
        {content}
      </a>
    );
  }

  return <div className="p-4 rounded-lg border">{content}</div>;
}

/**
 * FAQ Item
 */
function FAQItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const { theme } = usePortal();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="border rounded-lg overflow-hidden"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <HelpCircle
            className="h-5 w-5 shrink-0"
            style={{ color: theme.primaryColor }}
          />
          <span className="font-medium">{question}</span>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="text-muted-foreground"
        >
          ▼
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0 }}
        className="overflow-hidden"
      >
        <p className="px-4 pb-4 text-muted-foreground pl-12">{answer}</p>
      </motion.div>
    </motion.div>
  );
}

/**
 * Contact Page Component - Story 12.14
 */
export function ContactPage({ contactInfo }: ContactPageProps) {
  const { theme, organization, locale } = usePortal();
  const labels = contactLabels[locale] ?? contactLabels.fr;

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "" as ContactSubject | "",
    message: "",
  });

  // API mutation for submitting contact message
  const submitMutation = api.contactMessages.submit.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
      toast.success(labels.sent);
    },
    onError: (error) => {
      toast.error(error.message || "Une erreur est survenue");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject) {
      toast.error("Veuillez sélectionner un sujet");
      return;
    }

    submitMutation.mutate({
      senderName: formData.name,
      senderEmail: formData.email,
      subject: formData.subject as ContactSubject,
      message: formData.message,
    });
  };

  const isSubmitting = submitMutation.isPending;

  const subjectOptions = Object.entries(labels.subjects).map(([key, value]) => ({
    value: key,
    label: value,
  }));

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div
        className="relative py-16 md:py-24"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Badge className="mb-4 bg-white/20 text-white border-0">
              <MessageSquare className="h-3 w-3 mr-1" />
              Contact
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              {labels.title}
            </h1>
            <p className="text-lg text-white/90 max-w-2xl mx-auto">
              {labels.subtitle}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-12 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" style={{ color: theme.primaryColor }} />
                  {labels.formTitle}
                </CardTitle>
                <CardDescription>{labels.formSubtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                {isSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-12 text-center"
                  >
                    <div
                      className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4"
                      style={{ backgroundColor: `${theme.primaryColor}20` }}
                    >
                      <CheckCircle
                        className="h-8 w-8"
                        style={{ color: theme.primaryColor }}
                      />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{labels.sent}</h3>
                    <p className="text-muted-foreground">{labels.sentDesc}</p>
                    <Button
                      variant="outline"
                      className="mt-6"
                      onClick={() => {
                        setIsSubmitted(false);
                        setFormData({ name: "", email: "", subject: "" as ContactSubject | "", message: "" });
                      }}
                    >
                      Envoyer un autre message
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">{labels.name}</Label>
                        <Input
                          id="name"
                          placeholder={labels.namePlaceholder}
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{labels.email}</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder={labels.emailPlaceholder}
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">{labels.subject}</Label>
                      <Select
                        value={formData.subject}
                        onValueChange={(value) =>
                          setFormData({ ...formData, subject: value as ContactSubject })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={labels.subjectPlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {subjectOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">{labels.message}</Label>
                      <Textarea
                        id="message"
                        placeholder={labels.messagePlaceholder}
                        rows={6}
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      style={{ backgroundColor: theme.primaryColor }}
                      className="w-full sm:w-auto"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {labels.sending}
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          {labels.send}
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{labels.contactInfo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contactInfo.email && (
                  <ContactInfoCard
                    icon={Mail}
                    label={labels.emailLabel}
                    value={contactInfo.email}
                    href={`mailto:${contactInfo.email}`}
                  />
                )}
                {contactInfo.phone && (
                  <ContactInfoCard
                    icon={Phone}
                    label={labels.phoneLabel}
                    value={contactInfo.phone}
                    href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                  />
                )}
                {contactInfo.address && (
                  <ContactInfoCard
                    icon={MapPin}
                    label={labels.addressLabel}
                    value={contactInfo.address}
                  />
                )}
                {contactInfo.hours && (
                  <ContactInfoCard
                    icon={Clock}
                    label={labels.hoursLabel}
                    value={contactInfo.hours}
                  />
                )}
              </CardContent>
            </Card>

            {/* Organization Card */}
            <Card>
              <CardContent className="p-6 text-center">
                <div
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4"
                  style={{ backgroundColor: `${theme.primaryColor}15` }}
                >
                  <Building2
                    className="h-8 w-8"
                    style={{ color: theme.primaryColor }}
                  />
                </div>
                <h3 className="font-bold text-lg">{organization.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Organisateur de concours
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">{labels.faqTitle}</h2>
          </div>
          <div className="max-w-2xl mx-auto space-y-4">
            {labels.faqItems.map((item, index) => (
              <FAQItem
                key={index}
                question={item.question}
                answer={item.answer}
                index={index}
              />
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
