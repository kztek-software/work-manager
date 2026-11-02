"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  ChevronDown,
  RemoveFormatting,
} from "lucide-react";
import { COLOR_PRESETS, type ColorPreset } from "./rich-text-toolbar";

/**
 * Converts Markdown string to HTML for WYSIWYG editor initialization
 */
export function markdownToHtml(md: string): string {
  if (!md) return "";

  // If already HTML, return as is
  if (/<(p|strong|b|em|i|u|del|s|strike|span|ol|ul|li|h[1-6]|blockquote|pre|code|div|mark|br|hr|a|img)[\s>/]/i.test(md)) {
    return md;
  }

  let html = md;

  // 1. Headings
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // 2. Blockquotes
  html = html.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");

  // 3. Bold & Italic & Underline & Strike
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  html = html.replace(/==([^=]+)==/g, '<mark style="background-color: #fef08a; padding: 2px 4px; border-radius: 4px;">$1</mark>');

  // 4. Color tags
  html = html.replace(/\[color:([^\]]+)\]([\s\S]+?)\[\/color\]/gi, (match, color, text) => {
    const preset = COLOR_PRESETS.find((p) => p.key === color.toLowerCase());
    const hex = preset ? preset.hex : color;
    return `<span style="color: ${hex}; font-weight: 600;">${text}</span>`;
  });

  html = html.replace(/\[(red|green|blue|amber|purple|gray)\]([\s\S]+?)\[\/\1\]/gi, (match, color, text) => {
    const preset = COLOR_PRESETS.find((p) => p.key === color.toLowerCase());
    const hex = preset ? preset.hex : color;
    return `<span style="color: ${hex}; font-weight: 600;">${text}</span>`;
  });

  // 5. Lists (Ordered & Unordered)
  const lines = html.split("\n");
  let inOl = false;
  let inUl = false;
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    const ulMatch = line.match(/^[-*•]\s+(.*)$/);

    if (olMatch) {
      if (!inOl) {
        if (inUl) {
          resultLines.push("</ul>");
          inUl = false;
        }
        resultLines.push("<ol>");
        inOl = true;
      }
      resultLines.push(`<li>${olMatch[2]}</li>`);
    } else if (ulMatch) {
      if (!inUl) {
        if (inOl) {
          resultLines.push("</ol>");
          inOl = false;
        }
        resultLines.push("<ul>");
        inUl = true;
      }
      resultLines.push(`<li>${ulMatch[1]}</li>`);
    } else {
      if (inOl) {
        resultLines.push("</ol>");
        inOl = false;
      }
      if (inUl) {
        resultLines.push("</ul>");
        inUl = false;
      }
      if (line.trim().length > 0 && !line.startsWith("<h") && !line.startsWith("<blockquote")) {
        resultLines.push(`<p>${line}</p>`);
      } else {
        resultLines.push(line);
      }
    }
  }

  if (inOl) resultLines.push("</ol>");
  if (inUl) resultLines.push("</ul>");

  return resultLines.join("\n");
}

export interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  disabled?: boolean;
  borderless?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onSave?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export const WysiwygEditor = React.memo(function WysiwygEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung chi tiết...",
  minHeight = "140px",
  className = "",
  disabled = false,
  borderless = false,
  onKeyDown,
  onSave,
  onCancel,
  autoFocus = false,
}: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value || value.trim() === "" || value === "<p><br></p>");

  // Active formatting state under current selection / cursor
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    orderedList: false,
    unorderedList: false,
    blockquote: false,
    code: false,
    heading: "",
  });

  const isFocusedRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastEmittedValueRef = useRef(value || "");
  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const headingMenuRef = useRef<HTMLDivElement | null>(null);

  // Check active formatting under cursor / selection
  const updateActiveFormats = useCallback(() => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !editorRef.current.contains(anchorNode)) return;

    let bold = false;
    let italic = false;
    let underline = false;
    let strikeThrough = false;
    let orderedList = false;
    let unorderedList = false;
    let blockquote = false;
    let code = false;
    let heading = "";

    try {
      bold = document.queryCommandState("bold");
      italic = document.queryCommandState("italic");
      underline = document.queryCommandState("underline");
      strikeThrough = document.queryCommandState("strikeThrough");
      orderedList = document.queryCommandState("insertOrderedList");
      unorderedList = document.queryCommandState("insertUnorderedList");
    } catch {
      // Fallback
    }

    // Traverse ancestors in DOM to catch semantic elements
    let curr: Node | null = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentNode : anchorNode;
    while (curr && curr !== editorRef.current) {
      if (curr instanceof HTMLElement) {
        const tag = curr.tagName.toLowerCase();
        if (tag === "b" || tag === "strong") bold = true;
        if (tag === "i" || tag === "em") italic = true;
        if (tag === "u") underline = true;
        if (tag === "s" || tag === "del" || tag === "strike") strikeThrough = true;
        if (tag === "ol") orderedList = true;
        if (tag === "ul") unorderedList = true;
        if (tag === "blockquote") blockquote = true;
        if (tag === "pre" || tag === "code") code = true;
        if (tag === "h1" || tag === "h2" || tag === "h3") {
          if (!heading) heading = tag;
        }
      }
      curr = curr.parentNode;
    }

    setActiveFormats((prev) => {
      if (
        prev.bold === bold &&
        prev.italic === italic &&
        prev.underline === underline &&
        prev.strikeThrough === strikeThrough &&
        prev.orderedList === orderedList &&
        prev.unorderedList === unorderedList &&
        prev.blockquote === blockquote &&
        prev.code === code &&
        prev.heading === heading
      ) {
        return prev;
      }
      return {
        bold,
        italic,
        underline,
        strikeThrough,
        orderedList,
        unorderedList,
        blockquote,
        code,
        heading,
      };
    });
  }, []);

  // Listen to selectionchange globally when editor is focused
  useEffect(() => {
    const handleSelectionChange = () => {
      if (isFocusedRef.current) {
        updateActiveFormats();
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [updateActiveFormats]);

  // Autofocus if requested
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  // Sync external value to innerHTML ONLY when not focused (avoids cursor loss & re-render lag)
  useEffect(() => {
    if (!editorRef.current) return;
    if (!isFocusedRef.current) {
      const html = markdownToHtml(value || "");
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = html;
        lastEmittedValueRef.current = value || "";
        setIsEmpty(!html || html.trim() === "" || html === "<p><br></p>" || html === "<br>");
      }
    }
  }, [value]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle outside click for menus
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

  // Flush pending changes immediately
  const flushChange = useCallback(() => {
    if (!editorRef.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const html = editorRef.current.innerHTML;
    const cleanHtml = html === "<p><br></p>" || html === "<br>" || html === "" ? "" : html;
    if (cleanHtml !== lastEmittedValueRef.current) {
      lastEmittedValueRef.current = cleanHtml;
      onChange(cleanHtml);
    }
  }, [onChange]);

  // Execute formatting command
  const execCmd = (command: string, cmdValue: string | undefined = undefined) => {
    if (disabled) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    try {
      document.execCommand(command, false, cmdValue);
    } catch (e) {
      console.warn("execCommand failed:", e);
    }
    handleInputImmediate();
    setTimeout(updateActiveFormats, 10);
  };

  // Immediate input handler (Zero DOM thrashing, debounced parent update)
  const handleInputImmediate = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const empty = !html || html.trim() === "" || html === "<p><br></p>" || html === "<br>";
    setIsEmpty(empty);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce 150ms to prevent parent re-render lag during rapid typing
    debounceTimerRef.current = setTimeout(() => {
      flushChange();
    }, 150);

    setTimeout(updateActiveFormats, 10);
  };

  const applyColor = (hex: string) => {
    if (hex === "inherit" || hex === "default") {
      execCmd("removeFormat");
    } else {
      execCmd("foreColor", hex);
    }
    setShowColorMenu(false);
    setTimeout(updateActiveFormats, 10);
  };

  const applyHeading = (tag: string) => {
    execCmd("formatBlock", `<${tag}>`);
    setShowHeadingMenu(false);
    setTimeout(updateActiveFormats, 10);
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }

    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        execCmd("bold");
        return;
      }
      if (key === "i") {
        e.preventDefault();
        execCmd("italic");
        return;
      }
      if (key === "u") {
        e.preventDefault();
        execCmd("underline");
        return;
      }
      if (key === "x" && e.shiftKey) {
        e.preventDefault();
        execCmd("strikeThrough");
        return;
      }
      if (key === "enter") {
        e.preventDefault();
        flushChange();
        if (onSave) onSave();
        return;
      }
    }

    if (e.key === "Escape") {
      if (onCancel) {
        e.preventDefault();
        onCancel();
      }
      return;
    }

    // Auto-detect list triggers: "1. " -> Ordered List, "- " or "* " -> Bullet List
    if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const selection = window.getSelection();
      if (selection && selection.isCollapsed && selection.anchorNode) {
        const node = selection.anchorNode;
        const text = node.textContent || "";
        const offset = selection.anchorOffset;
        const textBeforeCursor = text.slice(0, offset).trim();

        const olMatch = textBeforeCursor.match(/^(\d+)\.$/);
        const ulMatch = textBeforeCursor.match(/^[-*]$/);

        if (olMatch) {
          e.preventDefault();
          const remaining = text.slice(offset);
          node.textContent = remaining;
          document.execCommand("insertOrderedList", false);
          flushChange();
          setTimeout(updateActiveFormats, 10);
          return;
        }

        if (ulMatch) {
          e.preventDefault();
          const remaining = text.slice(offset);
          node.textContent = remaining;
          document.execCommand("insertUnorderedList", false);
          flushChange();
          setTimeout(updateActiveFormats, 10);
          return;
        }
      }
    }
  };

  const getBtnClass = (isActive: boolean, extra = "") =>
    `inline-flex items-center justify-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer select-none h-8 px-2 min-w-[32px] ${
      isActive
        ? "bg-accent/20 text-accent font-bold ring-1 ring-accent/40 shadow-xs"
        : "text-muted hover:text-foreground hover:bg-surface-3"
    } disabled:opacity-40 disabled:cursor-not-allowed ${extra}`;

  return (
    <div
      className={`rounded-lg transition-colors relative ${
        borderless
          ? "border-none shadow-none bg-surface/60"
          : isFocused
          ? "border border-accent ring-1 ring-accent/30 shadow-sm bg-surface-2/80 rounded-xl"
          : "border border-line shadow-sm bg-surface-2/80 rounded-xl"
      } ${className}`}
    >
      {/* WYSIWYG Toolbar */}
      <div
        className={`flex flex-wrap items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 bg-surface-2/80 border-b border-line/60 text-xs relative z-20 ${
          borderless ? "rounded-t-lg" : "rounded-t-xl"
        }`}
      >
        {/* 1. Bold */}
        <button
          type="button"
          title="In đậm (Ctrl+B)"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("bold")}
          className={getBtnClass(activeFormats.bold)}
        >
          <Bold className="h-4 w-4" />
        </button>

        {/* 2. Italic */}
        <button
          type="button"
          title="In nghiêng (Ctrl+I)"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("italic")}
          className={getBtnClass(activeFormats.italic)}
        >
          <Italic className="h-4 w-4" />
        </button>

        {/* 3. Underline */}
        <button
          type="button"
          title="Gạch chân (Ctrl+U)"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("underline")}
          className={getBtnClass(activeFormats.underline)}
        >
          <Underline className="h-4 w-4" />
        </button>

        {/* 4. Strikethrough */}
        <button
          type="button"
          title="Gạch ngang chữ (Ctrl+Shift+X)"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("strikeThrough")}
          className={getBtnClass(activeFormats.strikeThrough)}
        >
          <Strikethrough className="h-4 w-4" />
        </button>

        {/* 5. Highlight */}
        <button
          type="button"
          title="Đánh dấu highlight"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("hiliteColor", "#fef08a")}
          className={getBtnClass(false, "text-amber-500 hover:text-amber-400")}
        >
          <Highlighter className="h-4 w-4" />
        </button>

        {/* Separator */}
        <div className="h-5 w-[1px] bg-line/80 mx-0.5" />

        {/* 6. Color Picker Menu */}
        <div className="relative" ref={colorMenuRef}>
          <button
            type="button"
            title="Đổi màu chữ trực tiếp"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowColorMenu((prev) => !prev)}
            className={getBtnClass(showColorMenu, "gap-0.5 text-accent")}
          >
            <Palette className="h-4 w-4" />
            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
          </button>

          {showColorMenu && (
            <div className="absolute top-full left-0 mt-1 z-[100] w-64 rounded-xl border border-line bg-surface-2 p-2.5 shadow-2xl space-y-1.5 animate-fade-in-up">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Palette className="h-3 w-3 text-accent" />
                  Màu chữ
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyColor("inherit")}
                  className="text-[10px] text-muted hover:text-accent font-semibold cursor-pointer"
                >
                  Mặc định
                </button>
              </div>

              {/* Compact 4-column color grid with swatches & clear labels */}
              <div className="grid grid-cols-4 gap-1 pt-1 border-t border-line/40">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.key}
                    type="button"
                    title={color.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyColor(color.hex)}
                    className="flex items-center gap-1.5 rounded-lg p-1.5 text-[11px] font-medium text-foreground hover:bg-surface-3 transition-colors cursor-pointer"
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 shadow-xs border border-white/20 ${color.bgClass}`}
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="truncate">{color.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="h-5 w-[1px] bg-line/80 mx-0.5" />

        {/* 7. Numbered List 1. 2. 3. */}
        <button
          type="button"
          title="Danh sách số thứ tự (1. 2. 3.)"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("insertOrderedList")}
          className={getBtnClass(activeFormats.orderedList, "font-mono font-bold")}
        >
          <ListOrdered className="h-4 w-4" />
          <span className="text-[10px] ml-0.5">1.2.3</span>
        </button>

        {/* 8. Bullet List */}
        <button
          type="button"
          title="Danh sách gạch đầu dòng"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("insertUnorderedList")}
          className={getBtnClass(activeFormats.unorderedList)}
        >
          <List className="h-4 w-4" />
        </button>

        {/* Separator */}
        <div className="h-5 w-[1px] bg-line/80 mx-0.5" />

        {/* 9. Headings Dropdown */}
        <div className="relative" ref={headingMenuRef}>
          <button
            type="button"
            title="Tiêu đề (H1, H2, H3)"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowHeadingMenu((prev) => !prev)}
            className={getBtnClass(Boolean(activeFormats.heading) || showHeadingMenu, "gap-0.5")}
          >
            <span className="font-bold text-[11px]">
              {activeFormats.heading ? activeFormats.heading.toUpperCase() : "H"}
            </span>
            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
          </button>

          {showHeadingMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 w-40 rounded-xl border border-line bg-surface-2 p-1.5 shadow-2xl space-y-1 animate-fade-in-up">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyHeading("h1")}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs font-bold rounded-lg text-left cursor-pointer transition-colors ${
                  activeFormats.heading === "h1" ? "bg-accent/20 text-accent" : "hover:bg-surface-3 text-foreground"
                }`}
              >
                <Heading1 className="h-3.5 w-3.5 text-accent" />
                <span>Tiêu đề 1 (H1)</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyHeading("h2")}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg text-left cursor-pointer transition-colors ${
                  activeFormats.heading === "h2" ? "bg-accent/20 text-accent" : "hover:bg-surface-3 text-foreground"
                }`}
              >
                <Heading2 className="h-3.5 w-3.5 text-accent" />
                <span>Tiêu đề 2 (H2)</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyHeading("h3")}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg text-left cursor-pointer transition-colors ${
                  activeFormats.heading === "h3" ? "bg-accent/20 text-accent" : "hover:bg-surface-3 text-foreground"
                }`}
              >
                <Heading3 className="h-3.5 w-3.5 text-accent" />
                <span>Tiêu đề 3 (H3)</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyHeading("p")}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg text-left cursor-pointer transition-colors ${
                  !activeFormats.heading ? "bg-surface-3 text-foreground font-semibold" : "text-muted hover:bg-surface-3"
                }`}
              >
                <span>Văn bản thường</span>
              </button>
            </div>
          )}
        </div>

        {/* 10. Blockquote */}
        <button
          type="button"
          title="Trích dẫn"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("formatBlock", "<blockquote>")}
          className={getBtnClass(activeFormats.blockquote)}
        >
          <Quote className="h-4 w-4" />
        </button>

        {/* 11. Code block */}
        <button
          type="button"
          title="Khối mã (Code)"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("formatBlock", "<pre>")}
          className={getBtnClass(activeFormats.code, "font-mono")}
        >
          <Code className="h-4 w-4" />
        </button>

        {/* 12. Clear Formatting */}
        <button
          type="button"
          title="Xóa định dạng"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd("removeFormat")}
          className={getBtnClass(false)}
        >
          <RemoveFormatting className="h-4 w-4" />
        </button>
      </div>

      {/* Editable Container */}
      <div className="relative p-3">
        {isEmpty && !isFocused && (
          <div className="absolute top-3 left-3 pointer-events-none text-muted text-xs italic select-none">
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInputImmediate}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onFocus={() => {
            isFocusedRef.current = true;
            setIsFocused(true);
            updateActiveFormats();
          }}
          onBlur={() => {
            isFocusedRef.current = false;
            setIsFocused(false);
            flushChange();
          }}
          onKeyDown={handleKeyDownInternal}
          style={{ minHeight }}
          className="w-full text-xs text-foreground focus:outline-none leading-relaxed font-sans overflow-y-auto space-y-1.5 [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:ml-5 [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:ml-5 [&_ul]:space-y-1 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:bg-accent/5 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:italic [&_pre]:bg-surface-3 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:border [&_pre]:border-line [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-accent"
        />
      </div>
    </div>
  );
});

