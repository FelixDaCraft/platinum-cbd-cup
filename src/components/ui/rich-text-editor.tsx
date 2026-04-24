"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link as LinkIcon,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Toggle } from "~/components/ui/toggle";
import { Separator } from "~/components/ui/separator";
import { useCallback, useEffect } from "react";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

// Toolbar button component
function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Toggle
      size="sm"
      pressed={isActive}
      onPressedChange={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 p-0 data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-500",
        "hover:bg-white/10 hover:text-foreground"
      )}
    >
      {children}
    </Toggle>
  );
}

// Toolbar component
function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL du lien:", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-white/10 bg-white/5 rounded-t-md">
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Annuler"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Rétablir"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6 bg-white/20" />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Titre 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Titre 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Titre 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6 bg-white/20" />

      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Gras"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italique"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Souligné"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Barré"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6 bg-white/20" />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="Aligner à gauche"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="Centrer"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        title="Aligner à droite"
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6 bg-white/20" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Liste à puces"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Liste numérotée"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6 bg-white/20" />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Citation"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Séparateur"
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6 bg-white/20" />

      {/* Links */}
      <ToolbarButton
        onClick={setLink}
        isActive={editor.isActive("link")}
        title="Ajouter un lien"
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive("link")}
        title="Supprimer le lien"
      >
        <Unlink className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Commencez à écrire...",
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false, // Avoid SSR hydration mismatch
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-amber-500 underline hover:text-amber-400",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "min-h-[200px] p-4 focus:outline-none text-foreground",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  // Update content when prop changes (for initial load)
  useEffect(() => {
    if (editor && content) {
      try {
        const parsed = JSON.parse(content);
        if (JSON.stringify(editor.getJSON()) !== JSON.stringify(parsed)) {
          editor.commands.setContent(parsed);
        }
      } catch {
        // If content is not valid JSON, try to set it as HTML or plain text
        if (content !== JSON.stringify(editor.getJSON())) {
          editor.commands.setContent(content);
        }
      }
    }
  }, [content, editor]);

  return (
    <div
      className={cn(
        "rounded-md border border-white/20 bg-background overflow-hidden",
        "focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20",
        className
      )}
    >
      <style>{`
        /* Headings */
        .ProseMirror h1 {
          font-size: 1.875rem;
          line-height: 2.25rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .ProseMirror h2 {
          font-size: 1.5rem;
          line-height: 2rem;
          font-weight: 700;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror h3 {
          font-size: 1.25rem;
          line-height: 1.75rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }

        /* Paragraphs */
        .ProseMirror p {
          margin-bottom: 0.75rem;
          line-height: 1.625;
        }

        /* Text formatting */
        .ProseMirror strong {
          font-weight: 700;
        }
        .ProseMirror em {
          font-style: italic;
        }
        .ProseMirror u {
          text-decoration: underline;
        }
        .ProseMirror s {
          text-decoration: line-through;
        }
        .ProseMirror code {
          background-color: rgba(255, 255, 255, 0.1);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: ui-monospace, monospace;
          font-size: 0.875em;
        }
        .ProseMirror pre {
          background-color: rgba(0, 0, 0, 0.3);
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin-bottom: 0.75rem;
        }
        .ProseMirror pre code {
          background: none;
          padding: 0;
          border-radius: 0;
        }

        /* Lists */
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .ProseMirror ul {
          list-style-type: disc;
        }
        .ProseMirror ol {
          list-style-type: decimal;
        }
        .ProseMirror li {
          margin-bottom: 0.25rem;
        }
        .ProseMirror li p {
          margin-bottom: 0.25rem;
        }

        /* Blockquote */
        .ProseMirror blockquote {
          border-left: 3px solid #f59e0b;
          padding-left: 1rem;
          margin-left: 0;
          margin-right: 0;
          margin-bottom: 0.75rem;
          font-style: italic;
          opacity: 0.85;
        }

        /* Horizontal rule */
        .ProseMirror hr {
          border: none;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          margin: 1.5rem 0;
        }

        /* Links */
        .ProseMirror a {
          color: #f59e0b;
          text-decoration: underline;
          cursor: pointer;
        }
        .ProseMirror a:hover {
          color: #fbbf24;
        }

        /* Text alignment */
        .ProseMirror .text-left {
          text-align: left;
        }
        .ProseMirror .text-center {
          text-align: center;
        }
        .ProseMirror .text-right {
          text-align: right;
        }
        .ProseMirror [style*="text-align: left"] {
          text-align: left;
        }
        .ProseMirror [style*="text-align: center"] {
          text-align: center;
        }
        .ProseMirror [style*="text-align: right"] {
          text-align: right;
        }

        /* Placeholder */
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255, 255, 255, 0.4);
          pointer-events: none;
          height: 0;
        }

        /* Focus state */
        .ProseMirror:focus {
          outline: none;
        }

        /* Selection */
        .ProseMirror ::selection {
          background-color: rgba(245, 158, 11, 0.3);
        }
      `}</style>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

// Helper to convert TipTap JSON to HTML for display
export function tiptapToHtml(content: Record<string, unknown>): string {
  if (!content || typeof content !== "object") return "";

  const renderNode = (node: Record<string, unknown>): string => {
    if (!node.type) return "";

    const children = Array.isArray(node.content)
      ? node.content.map((child) => renderNode(child as Record<string, unknown>)).join("")
      : "";

    const textAlign = (node.attrs as Record<string, unknown>)?.textAlign as string | undefined;
    const alignStyle = textAlign ? ` style="text-align: ${textAlign}"` : "";

    switch (node.type) {
      case "doc":
        return children;
      case "paragraph":
        return children ? `<p${alignStyle}>${children}</p>` : "<p><br></p>";
      case "heading": {
        const level = (node.attrs as Record<string, unknown>)?.level ?? 1;
        return `<h${level}${alignStyle}>${children}</h${level}>`;
      }
      case "text": {
        let text = (node.text as string) || "";
        const marks = (node.marks as Array<{ type: string; attrs?: Record<string, unknown> }>) || [];

        marks.forEach((mark) => {
          switch (mark.type) {
            case "bold":
              text = `<strong>${text}</strong>`;
              break;
            case "italic":
              text = `<em>${text}</em>`;
              break;
            case "underline":
              text = `<u>${text}</u>`;
              break;
            case "strike":
              text = `<s>${text}</s>`;
              break;
            case "link":
              text = `<a href="${mark.attrs?.href || "#"}" target="_blank" rel="noopener noreferrer" class="text-amber-500 hover:underline">${text}</a>`;
              break;
          }
        });
        return text;
      }
      case "bulletList":
        return `<ul class="list-disc pl-6 space-y-1">${children}</ul>`;
      case "orderedList":
        return `<ol class="list-decimal pl-6 space-y-1">${children}</ol>`;
      case "listItem":
        return `<li>${children}</li>`;
      case "blockquote":
        return `<blockquote class="border-l-4 border-amber-500 pl-4 italic text-foreground/70">${children}</blockquote>`;
      case "horizontalRule":
        return `<hr class="border-white/20 my-6" />`;
      case "hardBreak":
        return "<br />";
      default:
        return children;
    }
  };

  return renderNode(content);
}
