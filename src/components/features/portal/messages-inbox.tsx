"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Mail,
  MailOpen,
  Star,
  StarOff,
  Archive,
  Reply,
  Trash2,
  Inbox,
  Filter,
  Search,
  RefreshCw,
  MoreVertical,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { api } from "~/trpc/react";

type MessageStatus = "unread" | "read" | "replied" | "archived";
type ContactSubject = "general" | "registration" | "results" | "sponsorship" | "press" | "technical" | "other";

interface Message {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: ContactSubject;
  message: string;
  status: MessageStatus;
  isStarred: boolean;
  repliedAt: Date | null;
  createdAt: Date;
}

/**
 * Subject labels
 */
const SUBJECT_LABELS: Record<ContactSubject, { label: string; color: string; dotColor: string }> = {
  general: { label: "Question générale", color: "bg-blue-500", dotColor: "#3b82f6" },
  registration: { label: "Inscription", color: "bg-green-500", dotColor: "var(--n-success)" },
  results: { label: "Résultats", color: "bg-purple-500", dotColor: "#8b5cf6" },
  sponsorship: { label: "Sponsoring", color: "bg-amber-500", dotColor: "var(--n-warning)" },
  press: { label: "Presse", color: "bg-pink-500", dotColor: "#ec4899" },
  technical: { label: "Support technique", color: "bg-red-500", dotColor: "var(--n-accent)" },
  other: { label: "Autre", color: "bg-gray-500", dotColor: "var(--n-text-disabled)" },
};

/**
 * Message List Item Component
 */
function MessageListItem({
  message,
  isSelected,
  onSelect,
  onToggleStar,
}: {
  message: Message;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
}) {
  const subjectConfig = SUBJECT_LABELS[message.subject];

  return (
    <div
      className="flex items-start gap-3 p-4 cursor-pointer transition-colors"
      style={{
        borderBottom: "1px solid var(--n-border)",
        borderLeft: isSelected ? "4px solid var(--n-accent)" : "4px solid transparent",
        background: isSelected
          ? "var(--n-surface-raised)"
          : message.status === "unread"
            ? "rgba(255,255,255,0.03)"
            : "transparent",
      }}
      onClick={onSelect}
    >
      {/* Star button */}
      <button
        className="shrink-0 mt-1"
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
      >
        {message.isStarred ? (
          <Star className="h-4 w-4" style={{ fill: "var(--n-warning)", color: "var(--n-warning)" }} />
        ) : (
          <StarOff className="h-4 w-4" style={{ color: "var(--n-text-disabled)" }} />
        )}
      </button>

      {/* Status icon */}
      <div className="shrink-0 mt-1">
        {message.status === "unread" ? (
          <Mail className="h-4 w-4" style={{ color: "var(--n-accent)" }} />
        ) : message.status === "replied" ? (
          <Reply className="h-4 w-4" style={{ color: "var(--n-success)" }} />
        ) : (
          <MailOpen className="h-4 w-4" style={{ color: "var(--n-text-disabled)" }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate"
            style={{ fontWeight: message.status === "unread" ? 600 : 500, color: "var(--n-text-primary)" }}
          >
            {message.senderName}
          </span>
          <span className="text-xs shrink-0" style={{ color: "var(--n-text-disabled)", fontFamily: "'Space Mono', monospace" }}>
            {format(new Date(message.createdAt), "dd MMM", { locale: fr })}
          </span>
        </div>

        <p className="text-sm truncate" style={{ color: "var(--n-text-secondary)" }}>
          {message.senderEmail}
        </p>

        <div className="flex items-center gap-2 mt-1">
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: subjectConfig.dotColor }}
          />
          <span className="text-xs truncate" style={{ color: "var(--n-text-secondary)" }}>
            {message.message.substring(0, 60)}...
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Message Detail Component
 */
function MessageDetail({
  message,
  onMarkAsRead,
  onReply,
  onArchive,
  onDelete,
}: {
  message: Message;
  onMarkAsRead: () => void;
  onReply: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const subjectConfig = SUBJECT_LABELS[message.subject];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4" style={{ borderBottom: "1px solid var(--n-border)" }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontFamily: "'Space Mono', monospace", background: subjectConfig.dotColor, color: "var(--n-black)" }}>
            {subjectConfig.label}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onMarkAsRead}>
              <MailOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onArchive}>
              <Archive className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDelete} style={{ color: "var(--n-accent)" }}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <h2 className="text-lg font-semibold" style={{ color: "var(--n-text-display)" }}>{message.senderName}</h2>
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--n-text-secondary)" }}>
          <span>{message.senderEmail}</span>
          <span>-</span>
          <span>
            {format(new Date(message.createdAt), "PPpp", { locale: fr })}
          </span>
        </div>
      </div>

      {/* Message body */}
      <div className="flex-1 p-4 overflow-auto">
        <p className="whitespace-pre-wrap">{message.message}</p>
      </div>

      {/* Reply button */}
      <div className="p-4" style={{ borderTop: "1px solid var(--n-border)" }}>
        <Button onClick={onReply} className="w-full">
          <Reply className="h-4 w-4 mr-2" />
          Répondre par email
        </Button>
      </div>
    </div>
  );
}

/**
 * Empty State Component
 */
function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <Inbox className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--n-text-disabled)", opacity: 0.5 }} />
        <h3 className="font-medium text-lg mb-1" style={{ color: "var(--n-text-primary)" }}>Aucun message</h3>
        <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
          {filter === "all"
            ? "Votre boîte de réception est vide"
            : filter === "unread"
              ? "Aucun message non lu"
              : filter === "starred"
                ? "Aucun message favoris"
                : "Aucun message archivé"}
        </p>
      </div>
    </div>
  );
}

/**
 * Messages Inbox Component - Story 12.19
 * Dashboard inbox for contact form messages
 */
export function MessagesInbox() {
  const utils = api.useUtils();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "starred" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch messages
  const { data: messages = [], isLoading, refetch } = api.contactMessages.list.useQuery({
    filter,
    search: searchQuery || undefined,
  });

  // Mutations
  const markAsReadMutation = api.contactMessages.markAsRead.useMutation({
    onSuccess: () => utils.contactMessages.list.invalidate(),
  });

  const toggleStarMutation = api.contactMessages.toggleStar.useMutation({
    onSuccess: () => utils.contactMessages.list.invalidate(),
  });

  const archiveMutation = api.contactMessages.archive.useMutation({
    onSuccess: () => {
      setSelectedId(null);
      utils.contactMessages.list.invalidate();
    },
  });

  const deleteMutation = api.contactMessages.delete.useMutation({
    onSuccess: () => {
      setSelectedId(null);
      utils.contactMessages.list.invalidate();
    },
  });

  const selectedMessage = messages.find((m) => m.id === selectedId);

  // Handle reply (opens email client)
  const handleReply = (message: Message) => {
    const subject = encodeURIComponent(`Re: ${SUBJECT_LABELS[message.subject].label}`);
    const body = encodeURIComponent(
      `\n\n---\nMessage original de ${message.senderName} (${message.senderEmail}) :\n\n${message.message}`
    );
    window.open(`mailto:${message.senderEmail}?subject=${subject}&body=${body}`);
  };

  // Count unread
  const unreadCount = messages.filter((m) => m.status === "unread").length;

  return (
    <div className="h-[600px] flex flex-col" style={{ border: "1px solid var(--n-border)", borderRadius: "12px" }}>
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                Messages
                {unreadCount > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 8px", borderRadius: "6px", fontSize: "12px", fontFamily: "'Space Mono', monospace", background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }}>
                    {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Messages reçus via le formulaire de contact du portail
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters and search */}
        <div className="flex items-center gap-2 pt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: "var(--n-text-disabled)" }} />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="unread">Non lus</SelectItem>
              <SelectItem value="starred">Favoris</SelectItem>
              <SelectItem value="archived">Archivés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="flex-1 p-0 overflow-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="h-full flex">
            {/* Message list */}
            <div className="w-1/3 overflow-auto" style={{ borderRight: "1px solid var(--n-border)" }}>
              {messages.map((message) => (
                <MessageListItem
                  key={message.id}
                  message={message}
                  isSelected={selectedId === message.id}
                  onSelect={() => {
                    setSelectedId(message.id);
                    if (message.status === "unread") {
                      markAsReadMutation.mutate({ id: message.id });
                    }
                  }}
                  onToggleStar={() => toggleStarMutation.mutate({ id: message.id })}
                />
              ))}
            </div>

            {/* Message detail */}
            <div className="flex-1">
              {selectedMessage ? (
                <MessageDetail
                  message={selectedMessage}
                  onMarkAsRead={() => markAsReadMutation.mutate({ id: selectedMessage.id })}
                  onReply={() => handleReply(selectedMessage)}
                  onArchive={() => archiveMutation.mutate({ id: selectedMessage.id })}
                  onDelete={() => deleteMutation.mutate({ id: selectedMessage.id })}
                />
              ) : (
                <div className="h-full flex items-center justify-center" style={{ color: "var(--n-text-disabled)" }}>
                  Sélectionnez un message pour le lire
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
