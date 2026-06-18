"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  className,
  minHeight = "140px",
  disabled = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "เริ่มพิมพ์…" }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none",
        style: `min-height: ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      {!disabled && (
        <div className="flex items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1">
          <ToolBtn
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolBtn>
          <span className="mx-1 h-4 w-px bg-border" />
          <ToolBtn
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolBtn>
          <span className="mx-1 h-4 w-px bg-border" />
          <ToolBtn
            active={false}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Divider"
          >
            <Minus className="h-3.5 w-3.5" />
          </ToolBtn>
        </div>
      )}
      <EditorContent
        editor={editor}
        className={cn(
          "rte px-3 py-2 text-sm",
          disabled && "cursor-default opacity-60",
        )}
      />
    </div>
  );
}

function ToolBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** True when a string looks like Tiptap/HTML output. */
export function isHtmlContent(text: string): boolean {
  return text.trimStart().startsWith("<");
}

/** Strip HTML tags to plain text (for PDF/DOCX export). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Convert plain-text (legacy) to basic Tiptap HTML. */
export function plainTextToHtml(text: string): string {
  if (!text) return "<p></p>";
  if (isHtmlContent(text)) return text;
  return text
    .split("\n")
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
}
