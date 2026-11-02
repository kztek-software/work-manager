"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Palette,
  CheckSquare,
  Highlighter,
  Minus,
  Eye,
  Pencil,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ColorPreset {
  name: string;
  key: string;
  bgClass: string;
  textClass: string;
  hex: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: "Đỏ", key: "red", bgClass: "bg-red-500", textClass: "text-red-500", hex: "#ef4444" },
  { name: "Xanh lá", key: "green", bgClass: "bg-emerald-500", textClass: "text-emerald-500", hex: "#10b981" },
  { name: "Xanh dương", key: "blue", bgClass: "bg-blue-500", textClass: "text-blue-500", hex: "#3b82f6" },
  { name: "Vàng cam", key: "amber", bgClass: "bg-amber-500", textClass: "text-amber-500", hex: "#f59e0b" },
  { name: "Tím", key: "purple", bgClass: "bg-purple-500", textClass: "text-purple-500", hex: "#8b5cf6" },
  { name: "Hồng", key: "pink", bgClass: "bg-pink-500", textClass: "text-pink-500", hex: "#ec4899" },
  { name: "Xám", key: "gray", bgClass: "bg-zinc-400", textClass: "text-zinc-400", hex: "#9ca3af" },
];

export interface FormatOptions {
  prefix: string;
  suffix?: string;
  defaultText?: string;
  isBlockLine?: boolean;
  isNumberedList?: boolean;
  isBulletList?: boolean;
  isChecklist?: boolean;
  isHeading?: string; // e.g. "### "
}

/**
 * Helper to apply formatting to textarea selection
 */
export function applyFormatToTextarea({
  textarea,
  value,
  onChange,
  options,
}: {
  textarea: HTMLTextAreaElement | null;
  value: string;
  onChange: (newVal: string) => void;
  options: FormatOptions;
}) {
  if (!textarea) {
    // Fallback if textarea not available
    const newText = value + (options.prefix + (options.defaultText || "") + (options.suffix || ""));
    onChange(newText);
    return;
  }

  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const selectedText = value.substring(start, end);
  const before = value.substring(0, start);
  const after = value.substring(end);

  // 1. Multi-line block formatting (e.g. Numbered List 1. 2. 3., Bullet List, Checklist)
  if (options.isNumberedList || options.isBulletList || options.isChecklist || options.isHeading) {
    if (selectedText.length > 0) {
      const lines = selectedText.split("\n");
      const formattedLines = lines.map((line, idx) => {
        // Strip existing list prefix if present
        const cleanLine = line.replace(/^(\d+\.\s+|- \[\s?[xX]?\]\s+|- \s+|\* \s+|• \s+|#{1,6}\s+)/, "");
        if (options.isNumberedList) {
          return `${idx + 1}. ${cleanLine}`;
        }
        if (options.isBulletList) {
          return `- ${cleanLine}`;
        }
        if (options.isChecklist) {
          return `- [ ] ${cleanLine}`;
        }
        if (options.isHeading) {
          return `${options.isHeading}${cleanLine}`;
        }
        return `${options.prefix}${cleanLine}`;
      });

      const newContent = formattedLines.join("\n");
      const updatedValue = before + newContent + after;
      onChange(updatedValue);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + newContent.length);
      }, 0);
      return;
    }

    // No selection: Insert at line start or current pos
    let insertText = "";
    if (options.isNumberedList) {
      insertText = "1. " + (options.defaultText || "Mục thứ nhất");
    } else if (options.isBulletList) {
      insertText = "- " + (options.defaultText || "Mục danh sách");
    } else if (options.isChecklist) {
      insertText = "- [ ] " + (options.defaultText || "Công việc cần làm");
    } else if (options.isHeading) {
      insertText = options.isHeading + (options.defaultText || "Tiêu đề");
    }

    // Ensure leading newline if not at start of line
    const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
    const prefixStr = needsLeadingNewline ? "\n" : "";
    const updatedValue = before + prefixStr + insertText + after;
    onChange(updatedValue);

    setTimeout(() => {
      textarea.focus();
      const newCursor = start + prefixStr.length + insertText.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
    return;
  }

  // 2. Inline wrapping (Bold, Italic, Underline, Strikethrough, Highlight, Color, Quote, Code)
  const targetText = selectedText || options.defaultText || "văn bản";
  const wrappedText = options.prefix + targetText + (options.suffix || "");
  const updatedValue = before + wrappedText + after;

  onChange(updatedValue);

  setTimeout(() => {
    textarea.focus();
    if (selectedText.length > 0) {
      textarea.setSelectionRange(start, start + wrappedText.length);
    } else {
      // Select the placeholder text so user can immediately type over it
      const selectStart = start + options.prefix.length;
      const selectEnd = selectStart + targetText.length;
      textarea.setSelectionRange(selectStart, selectEnd);
    }
  }, 0);
}

/**
 * Global shortcut listener for rich text keys (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Shift+X)
 */
export function handleRichTextKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (val: string) => void
): boolean {
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      applyFormatToTextarea({
        textarea: textareaRef.current,
        value,
        onChange,
        options: { prefix: "**", suffix: "**", defaultText: "in đậm" },
      });
      return true;
    }
    if (key === "i") {
      e.preventDefault();
      applyFormatToTextarea({
        textarea: textareaRef.current,
        value,
        onChange,
        options: { prefix: "*", suffix: "*", defaultText: "in nghiêng" },
      });
      return true;
    }
    if (key === "u") {
      e.preventDefault();
      applyFormatToTextarea({
        textarea: textareaRef.current,
        value,
        onChange,
        options: { prefix: "<u>", suffix: "</u>", defaultText: "gạch chân" },
      });
      return true;
    }
    if (key === "x" && e.shiftKey) {
      e.preventDefault();
      applyFormatToTextarea({
        textarea: textareaRef.current,
        value,
        onChange,
        options: { prefix: "~~", suffix: "~~", defaultText: "gạch ngang" },
      });
      return true;
    }
  }
  return false;
}

export interface RichTextToolbarProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (val: string) => void;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  showPreviewToggle?: boolean;
  isPreview?: boolean;
  onTogglePreview?: () => void;
}

export function RichTextToolbar({
  textareaRef,
  value,
  onChange,
  compact = false,
  disabled = false,
  className = "",
  showPreviewToggle = false,
  isPreview = false,
  onTogglePreview,
}: RichTextToolbarProps) {
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const headingMenuRef = useRef<HTMLDivElement | null>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) {
        setShowColorMenu(false);
      }
      if (headingMenuRef.current && !headingMenuRef.current.contains(event.target as Node)) {
        setShowHeadingMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function format(options: FormatOptions) {
    if (disabled) return;
    applyFormatToTextarea({
      textarea: textareaRef?.current ?? null,
      value,
      onChange,
      options,
    });
  }

  function applyColor(colorKey: string) {
    format({
      prefix: `[color:${colorKey}]`,
      suffix: `[/color]`,
      defaultText: "văn bản màu",
    });
    setShowColorMenu(false);
  }

  const btnBase =
    "inline-flex items-center justify-center rounded-md text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-3 transition-colors disabled:opacity-40 cursor-pointer select-none";
  const btnSize = compact ? "h-6 w-6 p-0" : "h-7 px-1.5 min-w-[28px]";

  return (
    <div
      className={`flex flex-wrap items-center gap-0.5 sm:gap-1 p-1 bg-surface-2/90 border border-line rounded-lg text-xs ${className}`}
    >
      {/* 1. Bold */}
      <button
        type="button"
        title="In đậm (Ctrl+B)"
        disabled={disabled}
        onClick={() => format({ prefix: "**", suffix: "**", defaultText: "in đậm" })}
        className={`${btnBase} ${btnSize}`}
      >
        <Bold className="h-3.5 w-3.5" />
      </button>

      {/* 2. Italic */}
      <button
        type="button"
        title="In nghiêng (Ctrl+I)"
        disabled={disabled}
        onClick={() => format({ prefix: "*", suffix: "*", defaultText: "in nghiêng" })}
        className={`${btnBase} ${btnSize}`}
      >
        <Italic className="h-3.5 w-3.5" />
      </button>

      {/* 3. Underline */}
      <button
        type="button"
        title="Gạch chân (Ctrl+U)"
        disabled={disabled}
        onClick={() => format({ prefix: "<u>", suffix: "</u>", defaultText: "gạch chân" })}
        className={`${btnBase} ${btnSize}`}
      >
        <Underline className="h-3.5 w-3.5" />
      </button>

      {/* 4. Strikethrough */}
      <button
        type="button"
        title="Gạch ngang (Ctrl+Shift+X)"
        disabled={disabled}
        onClick={() => format({ prefix: "~~", suffix: "~~", defaultText: "gạch ngang" })}
        className={`${btnBase} ${btnSize}`}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>

      {/* 5. Highlight (Đánh dấu nền vàng) */}
      <button
        type="button"
        title="Đánh dấu highlight (==nội dung==)"
        disabled={disabled}
        onClick={() => format({ prefix: "==", suffix: "==", defaultText: "đánh dấu" })}
        className={`${btnBase} ${btnSize} text-amber-500 hover:text-amber-400`}
      >
        <Highlighter className="h-3.5 w-3.5" />
      </button>

      {/* Separator */}
      <div className="h-4 w-[1px] bg-line/80 mx-0.5" />

      {/* 6. Color Picker Dropdown */}
      <div className="relative" ref={colorMenuRef}>
        <button
          type="button"
          title="Màu chữ (Đỏ, Xanh, Vàng, Tím...)"
          disabled={disabled}
          onClick={() => setShowColorMenu((prev) => !prev)}
          className={`${btnBase} ${btnSize} gap-0.5 text-accent`}
        >
          <Palette className="h-3.5 w-3.5" />
          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
        </button>

        {showColorMenu && (
          <div className="absolute top-full left-0 mt-1 z-[100] w-72 rounded-2xl border border-line bg-surface-2 p-3 shadow-2xl space-y-2 animate-fade-in-up">
            <div className="text-xs font-bold text-foreground px-1 flex items-center justify-between border-b border-line/50 pb-2">
              <span className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-accent" />
                Màu chữ
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  applyColor("inherit");
                  setShowColorMenu(false);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold border border-line/50 text-muted hover:text-foreground hover:bg-surface-3"
              >
                Mặc định
              </button>
            </div>

            {/* 2-column color grid with ample width (w-72), NO ellipsis '...' truncation */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color.key}
                  type="button"
                  title={color.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyColor(color.key);
                    setShowColorMenu(false);
                  }}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold border border-line/40 bg-surface/70 text-foreground hover:bg-surface-3 hover:border-line transition-all cursor-pointer"
                >
                  <span
                    className={`h-3.5 w-3.5 rounded-full shrink-0 shadow-xs border border-white/20 ${color.bgClass}`}
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="whitespace-nowrap">{color.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="h-4 w-[1px] bg-line/80 mx-0.5" />

      {/* 7. Numbered List 1. 2. 3. */}
      <button
        type="button"
        title="Danh sách số thứ tự (1. 2. 3.)"
        disabled={disabled}
        onClick={() => format({ prefix: "1. ", isNumberedList: true, defaultText: "Bước 1" })}
        className={`${btnBase} ${btnSize} text-accent font-mono font-bold`}
      >
        <ListOrdered className="h-3.5 w-3.5" />
        {!compact && <span className="text-[10px] ml-0.5">1.2.3</span>}
      </button>

      {/* 8. Bullet List */}
      <button
        type="button"
        title="Danh sách gạch đầu dòng (- •)"
        disabled={disabled}
        onClick={() => format({ prefix: "- ", isBulletList: true, defaultText: "Mục danh sách" })}
        className={`${btnBase} ${btnSize}`}
      >
        <List className="h-3.5 w-3.5" />
      </button>

      {/* 9. Checklist */}
      <button
        type="button"
        title="Danh sách công việc (- [ ])"
        disabled={disabled}
        onClick={() => format({ prefix: "- [ ] ", isChecklist: true, defaultText: "Việc cần làm" })}
        className={`${btnBase} ${btnSize}`}
      >
        <CheckSquare className="h-3.5 w-3.5" />
      </button>

      {/* Separator */}
      {!compact && <div className="h-4 w-[1px] bg-line/80 mx-0.5" />}

      {/* 10. Headings dropdown */}
      {!compact && (
        <div className="relative" ref={headingMenuRef}>
          <button
            type="button"
            title="Tiêu đề (H1, H2, H3)"
            disabled={disabled}
            onClick={() => setShowHeadingMenu((prev) => !prev)}
            className={`${btnBase} ${btnSize} gap-0.5`}
          >
            <span className="font-bold text-[11px]">H</span>
            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
          </button>

          {showHeadingMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 w-36 rounded-xl border border-line bg-surface-2 p-1.5 shadow-2xl space-y-1 animate-fade-in-up">
              <button
                type="button"
                onClick={() => {
                  format({ prefix: "# ", isHeading: "# ", defaultText: "Tiêu đề lớn" });
                  setShowHeadingMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1 text-xs font-bold hover:bg-surface-3 rounded-lg text-left cursor-pointer"
              >
                <Heading1 className="h-3.5 w-3.5 text-accent" />
                <span>Tiêu đề 1 (H1)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  format({ prefix: "## ", isHeading: "## ", defaultText: "Tiêu đề phụ" });
                  setShowHeadingMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1 text-xs font-semibold hover:bg-surface-3 rounded-lg text-left cursor-pointer"
              >
                <Heading2 className="h-3.5 w-3.5 text-accent" />
                <span>Tiêu đề 2 (H2)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  format({ prefix: "### ", isHeading: "### ", defaultText: "Tiêu đề nhỏ" });
                  setShowHeadingMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1 text-xs font-medium hover:bg-surface-3 rounded-lg text-left cursor-pointer"
              >
                <Heading3 className="h-3.5 w-3.5 text-accent" />
                <span>Tiêu đề 3 (H3)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 11. Quote */}
      {!compact && (
        <button
          type="button"
          title="Trích dẫn (> văn bản)"
          disabled={disabled}
          onClick={() => format({ prefix: "> ", defaultText: "Lời trích dẫn" })}
          className={`${btnBase} ${btnSize}`}
        >
          <Quote className="h-3.5 w-3.5" />
        </button>
      )}

      {/* 12. Code */}
      <button
        type="button"
        title="Khối mã / Code (`văn bản`)"
        disabled={disabled}
        onClick={() => format({ prefix: "`", suffix: "`", defaultText: "code" })}
        className={`${btnBase} ${btnSize} font-mono`}
      >
        <Code className="h-3.5 w-3.5" />
      </button>

      {/* 13. Horizontal Divider */}
      {!compact && (
        <button
          type="button"
          title="Đường kẻ ngang (---)"
          disabled={disabled}
          onClick={() => format({ prefix: "\n---\n", defaultText: "" })}
          className={`${btnBase} ${btnSize}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Preview Toggle Button (if enabled) */}
      {showPreviewToggle && onTogglePreview && (
        <div className="ml-auto flex items-center pl-2 border-l border-line">
          <button
            type="button"
            onClick={onTogglePreview}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              isPreview
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-foreground hover:bg-surface-3"
            }`}
          >
            {isPreview ? (
              <>
                <Pencil className="h-3 w-3" />
                <span>Sửa</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                <span>Xem trước</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
