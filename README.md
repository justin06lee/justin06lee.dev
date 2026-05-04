# justin06lee.dev

my personal site. portfolio + articles + a little calendar app i use to track my time + a cat you can pet. feel free to look around.

## what's here

- **/** — home. ascii donut, scramble text, the usual
- **/gallery** — projects, hobbies, and stuff i'm tinkering with
- **/articles** — long-form notes, pulled from a github repo
- **/calendar** — day/month/year views, tracks plans vs what i actually did
- **/cat** — pet the cat. there's a global counter

## stack

next 15 (app router) + react 19 + ts. tailwind 4. **bun** for everything. turso/libsql for the db (raw sql, no orm — i lied in the old readme). motion v12 for animations. dark mode only.

## dev

```sh
bun install
bun run dev      # next dev w/ turbopack
bun run build
bun run lint
bun run test     # vitest
```

needs `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in `.env`. `ADMIN_KEY` for the cms. `GITHUB_TOKEN` if you want to write articles back via /author.

## notes

- the calendar bit is the most involved piece — single-running-actual is enforced via a partial unique index, dst-correct datetime-local round-trips, prayer times via aladhan w/ a 3-tier cache. see CLAUDE.md if you actually want to touch it
- /me is the item/config cms. /author is the article cms (writes to a separate github repo via the contents api)
- yes i used claude code hella. CLAUDE.md is now actually up to date
