# Grant Tracker

A lightweight grant management PWA for a small non-profit organization. Uses Google Sheets as the database and Google Drive for document storage.

## Project Overview

**Problem**: Grants fall through the cracks, internal discussions are scattered, decisions get forgotten, and report compliance is tracked manually.

**Solution**: A PWA that provides workflow support on top of Google Sheets + Drive, with no backend server required.

**Key Principle**: "Walkaway-able" — if the PWA breaks, the Sheets and Drive folders remain fully usable.

## Documentation

- `PRD.md` — Product requirements, user personas, functional requirements
- `DESIGN.md` — Technical architecture, data model, API patterns, implementation guidance
- `mockups/` — Interactive HTML mockups (open in browser to explore)

## Tech Stack

- **Frontend**: Svelte 5 + Vite + Tailwind CSS
- **Hosting**: GitHub Pages (static, no backend)
- **Auth**: Google OAuth (client-side)
- **Data**: Google Sheets API v4, Google Drive API v3
- **Charts**: Chart.js (for budget views)

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                   PWA (GitHub Pages)                │
│              Svelte + Tailwind + Vite               │
└─────────────────────┬───────────────────────────────┘
                      │ OAuth Token (client-side)
                      ▼
        ┌─────────────────────────────┐
        │      Google APIs            │
        │  - Sheets API (data)        │
        │  - Drive API (folders/docs) │
        └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │   Google Workspace          │
        │  - Spreadsheet (Tables)     │
        │  - Drive folders per grant  │
        │  - Proposal + Notes docs    │
        └─────────────────────────────┘
```

## Data Model (Google Sheets)

**Grants** — Main table with grant_id, title, organization, type, category, amount, status, URLs to docs/folders

**Grantees** — Organization info, GitHub reporting path

**ActionItems** — Linked to grants, with assignee, due date, status

**Reports** — Expected vs received reports per grant/period

**Artifacts** — Blog posts, meeting notes linked to grants

**Stages** — Configurable workflow stages (soft enforcement)

**Config** — Team members, folder IDs, settings

See `DESIGN.md` for full schema.

## Key Features (Priority Order)

1. **Grant registry with permalinks** — `/grant/PYPI-2026-Packaging`
2. **Pipeline dashboard** — Grants by stage, filterable
3. **Grant detail view** — Documents, action items, artifacts, history
4. **Status tracking** — Change status, preserve history
5. **Action items** — Per-grant tasks with assignees
6. **Report compliance** — Track monthly/quarterly/annual submissions
7. **Budget views** — Allocation by category, grant year aware

## Implementation Notes

- All API calls client-side using user's OAuth token
- Google Sheets Tables for schema enforcement
- Grant ID format: `CODE-YEAR-Codename` (e.g., `PYPI-2026-Staffing`)
- Status changes should log to StatusHistory sheet
- Folder/doc creation can be Apps Script or client-side Drive API

## Getting Started

1. Review `PRD.md` for requirements
2. Review `DESIGN.md` for technical details
3. Open `mockups/index.html` in browser to see the UI direction
4. Start with:
   - Project setup (Svelte + Vite + Tailwind)
   - Google OAuth integration
   - Sheets API connection
   - Basic grant list view

## Open Questions (Deferred)

- Action items storage: Sheet vs Internal Notes doc (start with Sheet)
- Google Docs add-on: Nice to have, not v1
- GitHub Action for report tracking: Phase 2
