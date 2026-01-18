# Grant Tracker UI Mockups

Interactive HTML mockups for the Grant Tracker PWA. Open any file in a browser to explore.

## Files

| File | Description |
|------|-------------|
| `index.html` | **Dashboard** — Pipeline overview, action items, reports due, recent activity |
| `grants.html` | **Grant list** — Filterable/searchable table of all grants |
| `grant-detail.html` | **Grant detail** — Single grant view with documents, action items, artifacts, history |
| `reports.html` | **Report compliance** — Track monthly/quarterly/annual report submissions |
| `budget.html` | **Budget allocation** — Charts and breakdown by category and year |
| `new-grant.html` | **New grant modal** — Create a new grant with auto-generated ID |
| `docs-sidebar.html` | **Google Docs sidebar** — Concept for a Docs add-on showing grant context |

## Navigation

The mockups are linked together — click navigation links to move between views.

## Notes

- These are static HTML mockups using Tailwind CSS (via CDN)
- Charts in budget.html use Chart.js
- No actual data persistence — this is for UX exploration only
- The Google Docs sidebar mockup (`docs-sidebar.html`) shows a potential add-on concept

## Key UX Decisions to Explore

1. **Action items** — Should these live in a Sheet or in the Internal Notes doc? The mockups show them in both the PWA and the Docs sidebar.

2. **Grant ID generation** — The `new-grant.html` mockup shows auto-generation with the `CODE-YEAR-Codename` format and uniqueness checking.

3. **Docs sidebar** — Would a Google Docs add-on be valuable, or is the PWA sufficient?

4. **Status changes** — Currently shown as a dropdown. Should there be a confirmation step? Notes?
