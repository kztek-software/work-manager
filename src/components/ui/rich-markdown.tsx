"use client";

import React from "react";
import { AtSign, CheckSquare, Square, ExternalLink, Code as CodeIcon } from "lucide-react";
import type { MemberDto } from "@/lib/types";
import { sanitizeHtml } from "@/lib/sanitize";

/**
 * Color map for preset keys and hex values
 */
const COLOR_MAP: Record<string, string> = {
  red: "#ef4444",
  green: "#10b981",
  blue: "#3b82f6",
  amber: "#f59e0b",
  orange: "#f97316",
  yellow: "#eab308",
  purple: "#8b5cf6",
  violet: "#7c3aed",
  pink: "#ec4899",
  gray: "#9ca3af",
  grey: "#9ca3af",
  white: "#f9fafb",
};

/**
 * Parses inline rich formatting tokens:
 * - **bold** / __bold__
 * - *italic* / _italic_
 * - <u>underline</u> / ++underline++ / ~_underline_~
 * - ~~strikethrough~~ / <del>strikethrough</del>
 * - ==highlight== / [bg:color]...[/bg]
 * - [color:xxx]text[/color] / [xxx]text[/xxx]
 * - `code`
 * - [link](url)
 * - @mentions
 */
export function renderRichInline(
  text: string,
  members?: MemberDto[]
): React.ReactNode[] {
  if (!text) return [];

  // Match pattern:
  // 1. **bold** or __bold__
  // 2. <u>underline</u> or ++underline++ or ~_underline_~
  // 3. ~~strike~~ or <del>strike</del>
  // 4. ==highlight==
  // 5. [color:key|#hex]text[/color]
  // 6. [bg:key|#hex]text[/bg]
  // 7. [red|green|blue|amber|orange|purple|gray]text[/red|...]
  // 8. *italic* or _italic_
  // 9. `code`
  // 10. [link text](url)
  // 11. @mentions

  const inlineRegex =
    /(<br\s*\/?>|\*\*[^*]+?\*\*|__[^_]+?__|<u>[\s\S]+?<\/u>|\+\+[\s\S]+?\+\+|~_[\s\S]+?_~|~~[\s\S]+?~~|<del>[\s\S]+?<\/del>|==[\s\S]+?==|\[color:[^\]]+\][\s\S]+?\[\/color\]|\[bg:[^\]]+\][\s\S]+?\[\/bg\]|\[(?:red|green|blue|amber|orange|purple|gray|pink)\][\s\S]+?\[\/(?:red|green|blue|amber|orange|purple|gray|pink)\]|`[^`]+?`|\[[^\]]+\]\([^)]+\)|(?:\B@[\w\u00C0-\u1EF9]+(?:\s+[\w\u00C0-\u1EF9]+)*)|\*(?:[^*]+?)\*|_(?:[^_]+?)_)/g;

  const parts = text.split(inlineRegex);

  return parts.map((part, i) => {
    if (!part) return null;

    // 1. Bold: **text** or __text__
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      const inner = part.slice(2, -2);
      return (
        <strong key={i} className="font-bold text-foreground">
          {renderRichInline(inner, members)}
        </strong>
      );
    }

    // 2. Underline: <u>text</u> or ++text++ or ~_text_~
    if (part.startsWith("<u>") && part.endsWith("</u>") && part.length >= 7) {
      const inner = part.slice(3, -4);
      return (
        <span key={i} className="underline decoration-1 underline-offset-2 font-medium">
          {renderRichInline(inner, members)}
        </span>
      );
    }
    if (part.startsWith("++") && part.endsWith("++") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <span key={i} className="underline decoration-1 underline-offset-2 font-medium">
          {renderRichInline(inner, members)}
        </span>
      );
    }
    if (part.startsWith("~_") && part.endsWith("_~") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <span key={i} className="underline decoration-1 underline-offset-2 font-medium">
          {renderRichInline(inner, members)}
        </span>
      );
    }

    // 3. Strikethrough: ~~text~~ or <del>text</del>
    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <del key={i} className="line-through opacity-70">
          {renderRichInline(inner, members)}
        </del>
      );
    }
    if (part.startsWith("<del>") && part.endsWith("</del>") && part.length >= 11) {
      const inner = part.slice(5, -6);
      return (
        <del key={i} className="line-through opacity-70">
          {renderRichInline(inner, members)}
        </del>
      );
    }

    // 4. Highlight: ==text==
    if (part.startsWith("==") && part.endsWith("==") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <mark
          key={i}
          className="bg-amber-400/25 text-amber-300 dark:text-amber-200 px-1 py-0.5 rounded font-medium border border-amber-400/30"
        >
          {renderRichInline(inner, members)}
        </mark>
      );
    }

    // 5. Color: [color:xxx]text[/color]
    const colorMatch = part.match(/^\[color:([^\]]+)\]([\s\S]+?)\[\/color\]$/);
    if (colorMatch) {
      const colorVal = colorMatch[1].trim();
      const inner = colorMatch[2];
      const resolvedColor = COLOR_MAP[colorVal.toLowerCase()] || colorVal;
      return (
        <span key={i} style={{ color: resolvedColor }} className="font-medium">
          {renderRichInline(inner, members)}
        </span>
      );
    }

    // 6. Background Highlight: [bg:xxx]text[/bg]
    const bgMatch = part.match(/^\[bg:([^\]]+)\]([\s\S]+?)\[\/bg\]$/);
    if (bgMatch) {
      const bgVal = bgMatch[1].trim();
      const inner = bgMatch[2];
      const resolvedBg = COLOR_MAP[bgVal.toLowerCase()] || bgVal;
      return (
        <span
          key={i}
          style={{ backgroundColor: resolvedBg }}
          className="px-1 py-0.5 rounded text-white font-medium shadow-sm"
        >
          {renderRichInline(inner, members)}
        </span>
      );
    }

    // 7. Shortcut Color tags: [red]text[/red], [blue]text[/blue], etc.
    const shortcutColorMatch = part.match(
      /^\[(red|green|blue|amber|orange|purple|gray|pink)\]([\s\S]+?)\[\/\1\]$/
    );
    if (shortcutColorMatch) {
      const colorKey = shortcutColorMatch[1];
      const inner = shortcutColorMatch[2];
      const resolvedColor = COLOR_MAP[colorKey] || colorKey;
      return (
        <span key={i} style={{ color: resolvedColor }} className="font-medium">
          {renderRichInline(inner, members)}
        </span>
      );
    }

    // 8. Inline Code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-surface-3 border border-line font-mono text-[11px] text-accent"
        >
          {inner}
        </code>
      );
    }

    // 9. Links: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      return (
        <a
          key={i}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline hover:opacity-80 inline-flex items-center gap-0.5"
        >
          <span>{linkText}</span>
          <ExternalLink className="h-2.5 w-2.5 inline" />
        </a>
      );
    }

    // 10. Mentions: @Name
    if (part.startsWith("@") && part.length > 1) {
      const rawName = part.slice(1).trim();
      // Check if matches member
      const isMember = members
        ? members.some((m) => m.user.name.toLowerCase() === rawName.toLowerCase())
        : true;

      if (isMember) {
        return (
          <span
            key={i}
            className="inline-flex items-center gap-0.5 rounded-md bg-accent/15 px-1.5 py-0.2 text-[11px] font-bold text-accent border border-accent/25 mx-0.5 align-middle"
          >
            <AtSign className="h-2.5 w-2.5 inline" />
            {rawName}
          </span>
        );
      }
    }

    // 11. Italic: *text* or _text_
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      const inner = part.slice(1, -1);
      return (
        <em key={i} className="italic text-foreground/90">
          {renderRichInline(inner, members)}
        </em>
      );
    }

    // 0. Line break: <br> or <br/>
    if (/^<br\s*\/?>$/i.test(part)) {
      return <br key={i} />;
    }

    // Normal text with entity decoding
    const decodedText = part
      .replace(/&nbsp;/g, "\u00A0")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    return <span key={i}>{decodedText}</span>;
  });
}

export interface RichMarkdownProps {
  content: string;
  className?: string;
  members?: MemberDto[];
}

// sanitizeHtml is now imported from @/lib/sanitize

/**
 * Rich Markdown block & inline parser component:
 * - Supports HTML strings directly from WysiwygEditor
 * - Numbered lists (1. 2. 3.) -> <ol>
 * - Bullet lists (- • *) -> <ul>
 * - Checklists (- [ ], - [x])
 * - Headings (#, ##, ###)
 * - Blockquotes (> )
 * - Code blocks (```)
 * - Horizontal rules (---)
 * - Inline formatting (Bold, Italic, Underline, Strikethrough, Color, Highlight, Links, Code, Mentions)
 */
export function RichMarkdown({
  content,
  className = "",
  members = [],
}: RichMarkdownProps) {
  if (!content || !content.trim()) return null;

  // Check if content is HTML from WYSIWYG editor
  const isHtml = /<\/?(p|strong|b|em|i|u|del|s|strike|span|ol|ul|li|h[1-6]|blockquote|pre|code|div|mark|br|hr|a|img|table|tbody|thead|tr|th|td)\b[^>]*>/i.test(content) || /&(nbsp|amp|quot|lt|gt|#\d+|#x[0-9a-f]+);/i.test(content);

  if (isHtml) {
    const sanitized = sanitizeHtml(content);
    return (
      <div
        className={`rich-html-content text-xs leading-relaxed text-foreground space-y-1.5 [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:ml-5 [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:ml-5 [&_ul]:space-y-1 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:bg-accent/5 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:italic [&_pre]:bg-surface-3 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:border [&_pre]:border-line [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-accent ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  const rawLines = content.split("\n");

  // Group lines into structured blocks (paragraphs, lists, codeblocks, etc.)
  type BlockType =
    | { type: "code"; lang?: string; code: string }
    | { type: "ordered_list"; items: string[] }
    | { type: "bullet_list"; items: string[] }
    | { type: "checklist"; items: { checked: boolean; text: string }[] }
    | { type: "heading"; level: number; text: string }
    | { type: "quote"; text: string }
    | { type: "hr" }
    | { type: "paragraph"; text: string }
    | { type: "empty" };

  const blocks: BlockType[] = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeBuffer: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Code block toggle (```)
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({
          type: "code",
          lang: codeLang,
          code: codeBuffer.join("\n"),
        });
        inCodeBlock = false;
        codeBuffer = [];
        codeLang = "";
      } else {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Empty line
    if (!trimmed) {
      blocks.push({ type: "empty" });
      continue;
    }

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      blocks.push({ type: "hr" });
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "heading", level: 1, text: trimmed.slice(2) });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "heading", level: 2, text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "heading", level: 3, text: trimmed.slice(4) });
      continue;
    }
    if (trimmed.startsWith("#### ")) {
      blocks.push({ type: "heading", level: 4, text: trimmed.slice(5) });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      blocks.push({ type: "quote", text: trimmed.slice(2) });
      continue;
    }

    // Checklist: - [ ] or - [x]
    const checklistMatch = trimmed.match(/^[-*•]\s+\[(\s|[xX])\]\s+(.*)$/);
    if (checklistMatch) {
      const checked = checklistMatch[1].toLowerCase() === "x";
      const text = checklistMatch[2];

      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === "checklist") {
        lastBlock.items.push({ checked, text });
      } else {
        blocks.push({
          type: "checklist",
          items: [{ checked, text }],
        });
      }
      continue;
    }

    // Numbered List: 1. 2. 3. ...
    const orderedListMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedListMatch) {
      const text = orderedListMatch[2];
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === "ordered_list") {
        lastBlock.items.push(text);
      } else {
        blocks.push({
          type: "ordered_list",
          items: [text],
        });
      }
      continue;
    }

    // Bullet List: - * •
    const bulletListMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletListMatch) {
      const text = bulletListMatch[1];
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === "bullet_list") {
        lastBlock.items.push(text);
      } else {
        blocks.push({
          type: "bullet_list",
          items: [text],
        });
      }
      continue;
    }

    // Normal Paragraph
    blocks.push({ type: "paragraph", text: line });
  }

  // If codeblock wasn't closed
  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({
      type: "code",
      lang: codeLang,
      code: codeBuffer.join("\n"),
    });
  }

  return (
    <div className={`space-y-2 text-xs leading-relaxed text-foreground ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "empty":
            return <div key={idx} className="h-1" />;

          case "hr":
            return <hr key={idx} className="my-2.5 border-line" />;

          case "heading":
            if (block.level === 1) {
              return (
                <h2 key={idx} className="text-base font-bold text-foreground mt-3 mb-1.5 pb-1 border-b border-line/60">
                  {renderRichInline(block.text, members)}
                </h2>
              );
            }
            if (block.level === 2) {
              return (
                <h3 key={idx} className="text-sm font-bold text-foreground mt-2.5 mb-1 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span>{renderRichInline(block.text, members)}</span>
                </h3>
              );
            }
            if (block.level === 3) {
              return (
                <h4 key={idx} className="text-xs font-bold text-foreground mt-2 mb-0.5 text-accent">
                  {renderRichInline(block.text, members)}
                </h4>
              );
            }
            return (
              <h5 key={idx} className="text-xs font-semibold text-foreground/90 mt-1.5 mb-0.5">
                {renderRichInline(block.text, members)}
              </h5>
            );

          case "quote":
            return (
              <blockquote
                key={idx}
                className="pl-3 py-1 my-1.5 border-l-2 border-accent bg-accent/5 rounded-r text-muted-light italic text-xs"
              >
                {renderRichInline(block.text, members)}
              </blockquote>
            );

          case "code":
            return (
              <div key={idx} className="my-2 rounded-xl bg-surface-3 border border-line p-3 overflow-x-auto shadow-sm">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-line/60 text-[10px] text-muted font-mono font-bold">
                  <span className="flex items-center gap-1">
                    <CodeIcon className="h-3 w-3 text-accent" />
                    <span>{block.lang || "code"}</span>
                  </span>
                </div>
                <pre className="font-mono text-[11px] text-foreground/90 leading-relaxed overflow-x-auto">
                  <code>{block.code}</code>
                </pre>
              </div>
            );

          case "ordered_list":
            return (
              <ol key={idx} className="list-decimal list-outside ml-5 space-y-1 my-1.5 text-xs text-muted-light">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="pl-1">
                    {renderRichInline(item, members)}
                  </li>
                ))}
              </ol>
            );

          case "bullet_list":
            return (
              <ul key={idx} className="list-disc list-outside ml-5 space-y-1 my-1.5 text-xs text-muted-light">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="pl-1 marker:text-accent">
                    {renderRichInline(item, members)}
                  </li>
                ))}
              </ul>
            );

          case "checklist":
            return (
              <div key={idx} className="space-y-1.5 my-1.5 pl-1">
                {block.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-start gap-2 text-xs">
                    {item.checked ? (
                      <CheckSquare className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-muted mt-0.5 shrink-0" />
                    )}
                    <span
                      className={`flex-1 ${
                        item.checked ? "line-through text-muted" : "text-muted-light"
                      }`}
                    >
                      {renderRichInline(item.text, members)}
                    </span>
                  </div>
                ))}
              </div>
            );

          case "paragraph":
            return (
              <p key={idx} className="text-muted-light leading-relaxed">
                {renderRichInline(block.text, members)}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
