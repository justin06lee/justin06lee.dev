# Relevance matrix: signal → discipline

This is what replaces the user picking skills. Given the inventory, decide which
disciplines apply and why. Record the decision in the report so the user can see
what ran and what didn't.

## Always applicable (every web project)

Run these regardless of business type — they are SEO fundamentals:

| Discipline | Skill | What it applies |
|-----------|-------|-----------------|
| Technical hygiene | `seo-technical` | canonical, robots meta, status/redirect sanity, mobile, crawlability, JS-rendering exposure |
| Content quality | `seo-content` | E-E-A-T signals, thin/duplicate content, heading hierarchy, readability, AI-citability |
| Schema | `seo-schema` | Organization/WebSite/BreadcrumbList always; page-type schema per route |
| Sitemap + robots | `seo-sitemap` | generate/repair the sitemap and robots for the stack |
| GEO / AI search | `seo-geo` | quotable passages, heading-answerable structure, `llms.txt`, crawler access |
| Images | `seo-images` | alt text, dimensions, lazy-loading, modern formats, filename hygiene |
| Search experience | `seo-sxo` | page-type match to intent, above-fold clarity, internal linking |

## Conditional (only when the signal fires)

| Signal (from inventory) | Discipline | Skill |
|-------------------------|-----------|-------|
| `business_type.ecommerce`, `/products`, `/cart`, SKUs | Product/Offer schema, merchant fields, faceted-nav hygiene | `seo-ecommerce` |
| `business_type.local`, address/phone/`/locations` | LocalBusiness schema, NAP consistency, per-location pages | `seo-local` |
| Multiple locales (i18n dirs, `hreflang`, locale routing) | hreflang cluster, content parity, locale formats | `seo-hreflang` |
| A real content library (`/blog`, many articles/posts) | topic clusters, hub-and-spoke internal linking | `seo-cluster` |
| Templated page sets (programmatic routes) | scale/quality gates, uniqueness thresholds | `seo-programmatic` (guidance) |

## How to decide

1. Start from the inventory's `business_type.primary` and `scores`, plus the
   `routes` sample and `seo_surface`.
2. Turn on every "always" discipline.
3. Turn on a conditional discipline only when its signal is present. A single
   weak hit is enough to *investigate*; require a real signal before *applying*
   vertical-specific schema (don't put LocalBusiness on a SaaS because one page
   says "contact us").
4. When a signal is ambiguous, prefer analysis-without-apply for that discipline:
   surface the recommendation in "suggested, not applied" rather than editing.

## Anti-patterns (do not do)

- Applying `LocalBusiness` schema to a product with no physical presence.
- Adding `hreflang` to a single-language site.
- Generating location pages for a business with one location.
- Adding `Product` schema to non-commerce pages.
- Inventing an author, address, review, or rating to satisfy a schema's required
  field. If the truthful value is not in the project, the fix is "suggested, not
  applied".
