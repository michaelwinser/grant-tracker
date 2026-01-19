# Grant Tracker

A lightweight grant management PWA for a small non-profit organization. Uses Google Sheets as the database and Google Drive for document storage.

## Project Overview

**Problem**: Grants fall through the cracks, internal discussions are scattered, decisions get forgotten, and report compliance is tracked manually.

**Solution**: A PWA that provides workflow support on top of Google Sheets + Drive, with no backend server required.

**Key Principle**: "Walkaway-able" — if the PWA breaks, the Sheets and Drive folders remain fully usable.

## Documentation

- `docs/ROADMAP.md` — **Implementation roadmap and progress tracking** (keep this up-to-date!)
- `docs/PRD.md` — Product requirements, user personas, functional requirements
- `docs/DESIGN.md` — Technical architecture, data model, API patterns, implementation guidance
- `docs/SETUP.md` — Setup guide for new developers
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

See `docs/DESIGN.md` for full schema.

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

**First-time setup:** Run `/setup` to start the interactive setup guide. This walks through:
- GCP project creation and API enablement
- OAuth consent screen and client configuration
- Google Sheets setup
- Dev environment verification

**Manual setup:** See `docs/SETUP.md` for step-by-step instructions.

**Already set up?** Start the dev server with `./gt start`.

## For Development

1. **Check `docs/ROADMAP.md` first** — See what's done, what's in progress, and what to work on next
2. Review `docs/PRD.md` for requirements
3. Review `docs/DESIGN.md` for technical details
4. Open `mockups/index.html` in browser to see the UI direction

## Keeping the Roadmap Updated

**IMPORTANT:** The roadmap (`docs/ROADMAP.md`) is the source of truth for project progress. Keep it current:

- Mark items `[x]` when complete
- Mark items `[~]` when in progress
- Add new items as requirements emerge
- Update the "Last updated" date when making changes

When starting work on a feature:
1. Check the roadmap for dependencies (what must be done first)
2. Mark the items you're working on as in-progress
3. When done, mark items complete and update any affected sections

This helps maintain continuity across sessions and keeps everyone aligned on project status.

## Working Efficiently

When permissions are granted in `.claude/settings.json`, use them without asking for confirmation. For example:
- If `Bash(git *)` is allowed, just commit when work is complete—don't ask "would you like me to commit?"
- If file edits are allowed, make the edits directly
- Reserve questions for actual ambiguity about *what* to do, not *whether* to use permitted tools

**Avoid chaining commands with `&&`** when permissions use patterns like `Bash(git *)`. Chained commands may not match the pattern correctly. Run them as separate tool calls instead.

This keeps the workflow efficient and avoids unnecessary back-and-forth.

## Design Decisions

- **Action items**: Stored in Sheet (not Internal Notes doc) for queryability
- **OAuth scopes**: Using `drive.file` (not `spreadsheets`) for least-privilege access
- **Spreadsheet selection**: Users select via Picker or create new (not hardcoded in env)
- **Google Docs add-on**: Deferred to post-v1
- **GitHub Action for reports**: Planned for Phase 12
