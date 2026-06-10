import DOMPurify from "isomorphic-dompurify";

// TODO: not yet wired up. Centralized sanitize policy kept here so any
// future surface that renders user-supplied HTML uses one consistent
// allowlist rather than ad-hoc DOMPurify calls.
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "option"],
    // The html profile's allowlist already strips every on* event handler, so
    // we only additionally forbid the inline style attribute (a CSS-injection
    // vector the allowlist otherwise permits). A hand-maintained list of on*
    // handlers here would be misleading — it could never be complete.
    FORBID_ATTR: ["style"],
  });
}
