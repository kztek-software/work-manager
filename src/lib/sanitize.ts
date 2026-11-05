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
  // Ảnh trong mô tả / phản hồi (dán từ clipboard) — chỉ chấp nhận ảnh đã upload nội bộ, xem hook bên dưới
  "img",
];

export const ALLOWED_ATTR = [
  "style",
  "color",
  "href",
  "target",
  "rel",
  "class",
  "align",
  "src",
  "alt",
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

// Chỉ giữ <img> trỏ tới tệp đã upload nội bộ (/uploads/...). Ảnh ngoài, data:, javascript: ... bị gỡ bỏ.
const SAFE_IMG_SRC = /^\/uploads\/[A-Za-z0-9._\-]+$/;
let imgHookInstalled = false;
function ensureImgHook() {
  if (imgHookInstalled) return;
  imgHookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "IMG") {
      const src = node.getAttribute("src") || "";
      if (!SAFE_IMG_SRC.test(src)) {
        node.parentNode?.removeChild(node);
      }
    }
  });
}

/**
 * Seam trung tâm lọc HTML chống Stored XSS bằng DOMPurify.
 * Cấu hình an toàn cho rich-text KZTEK, triệt tiêu mã độc, svg onload, img onerror, script, on*, javascript:
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== "string") return "";
  ensureImgHook();

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    ALLOW_DATA_ATTR: false,
  }) as string;
}
