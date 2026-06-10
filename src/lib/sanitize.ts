import DOMPurify from "isomorphic-dompurify";

// TODO: not yet wired up. Centralized sanitize policy kept here so any
// future surface that renders user-supplied HTML uses one consistent
// allowlist rather than ad-hoc DOMPurify calls.
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "option"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });
}
