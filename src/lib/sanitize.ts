import DOMPurify from "isomorphic-dompurify";

export const ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "del",
  "strike",
  "span",
  "font",
  "mark",
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
];

export const ALLOWED_ATTR = [
  "style",
  "color",
  "href",
  "target",
  "rel",
  "class",
  "align",
];

export const FORBID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "svg",
  "math",
];

/**
 * Seam trung tâm lọc HTML chống Stored XSS bằng DOMPurify.
 * Cấu hình an toàn cho rich-text KZTEK, triệt tiêu mã độc, svg onload, img onerror, script, on*, javascript:
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== "string") return "";

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    ALLOW_DATA_ATTR: false,
  }) as string;
}
