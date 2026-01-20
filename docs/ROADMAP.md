# Grant Tracker Roadmap

This document tracks implementation progress and planned work for Grant Tracker.

**Last updated:** 2026-01-19

---

## v1: Complete

The v1 release provides a fully functional grant management PWA with Google Sheets as the database and Drive for document storage.

### What's Included

**Core Features:**
- Google OAuth authentication with session persistence
- Spreadsheet selection/creation via Google Picker
- Full CRUD for grants, action items, reports, artifacts
- Pipeline dashboard with status tracking
- Budget visualization with Chart.js
- Grant detail pages with permalinks

**Drive Integration:**
- Automatic folder structure per grant (Tracker doc, Proposal doc, Reports folder)
- Attachments and reports from Drive folders
- File picker for adding files

**Docs Integration:**
- Tracker doc with metadata table (synced from spreadsheet)
- Approvals section in Tracker docs
- Action items synced from assigned comments in Docs
- Direct links to comments

**Quality:**
- Optimistic updates with rollback
- Exponential backoff for rate limits
- Mobile-responsive UI
- Error handling and loading states

---

## v2: Distributed Source of Truth

The v2 roadmap focuses on making the spreadsheet optional, with Google Docs as the authoritative source. This maximizes "walkaway-ability" — each grant folder becomes fully self-contained.

### v2.1: Polish & Two-Way Sync

Complete the bidirectional connection between app and Docs.

- [ ] **Two-way comment sync** — Resolve comments from app (via Drive API replies.create with `action: "resolve"`)
- [ ] **Read metadata from Tracker docs** — Parse tables, display in grant detail
- [ ] **Read approvals from Tracker docs** — Display approval history
- [ ] **Auto-refresh on grant detail load** — Sync comments/metadata when viewing a grant

### v2.2: Permissions & Sharing

Enable grantee collaboration through Drive sharing.

- [ ] **Proposal sharing** — Set grantee as editor on Proposal doc
- [ ] **Reports folder sharing** — Allow grantee to upload to Reports/
- [ ] **Permissions summary** — Show sharing status in grant detail
- [ ] **Bulk permission setup** — Apply sharing to existing grants

### v2.3: Workflow Improvements

Streamline common operations.

- [ ] **Quick grant creation** — Minimal form (org, title, year), auto-generate ID, auto-create folder
- [ ] **Create from existing folder** — Detect orphan grant folders, import metadata from Tracker doc
- [ ] **Organization auto-complete** — Suggest from previous grants
- [ ] **Edit action items and artifacts** — Currently create/delete only

### v2.4: Spreadsheet-Optional Mode

The big architectural shift: Docs become the source of truth.

**Discovery & Caching:**
- [ ] List Grants/ folders via Drive API
- [ ] Cache in IndexedDB with modifiedTime
- [ ] Incremental refresh (only fetch changed docs)

**Reading from Docs:**
- [ ] Parse metadata table from Tracker doc
- [ ] Parse approvals table
- [ ] Handle missing/malformed gracefully

**Action Items (Comments-Only):**
- [ ] Remove ActionItems sheet dependency
- [ ] Query comments across all grant docs
- [ ] Resolved comments = done items

**Materialized View:**
- [ ] "Sync to Spreadsheet" button
- [ ] Two-way sync option (detect edits, push back to docs)
- [ ] Conflict resolution UI

**Migration:**
- [ ] Wizard to migrate existing grants
- [ ] Create Tracker docs for grants that lack them
- [ ] Verify consistency between sheet and docs

**Performance Targets:**
- Cold load (50 grants): <5s
- Warm load (no changes): <500ms
- Incremental (1 changed): <1s

### v2.5: Optional Enhancements

Nice-to-haves that can be tackled as needed.

- [ ] Apps Script validation (grant ID uniqueness, category % sum)
- [ ] Keyboard navigation and focus management
- [ ] Skeleton loaders and progress indicators
- [ ] Virtual scrolling for large grant lists
- [ ] Export/compliance reporting views

---

## Future (Post-v2)

Ideas for future consideration, explicitly out of scope for v2:

- Automated email notifications (approval/rejection)
- Grantee-facing portal (read-only view)
- Google Docs add-on/sidebar
- Calendar integration for due dates
- Advanced PWA with offline support
- Slack/Teams notifications
- AI-assisted grant writing

---

## Design Principles

These principles guide all development:

- **Walkaway-able**: If the PWA breaks, Sheets and Drive remain fully usable
- **No backend**: All API calls from browser using user's OAuth token
- **Least privilege**: Use `drive.file` scope, not full Drive access
- **Google-native**: Leverage Sheets, Drive, Docs as they're designed
- **App as aggregator**: The PWA aggregates data from multiple Google sources

---

## Completed Phases (v1 Reference)

<details>
<summary>Click to expand v1 phase details</summary>

### Phase 0: Infrastructure & Setup ✓
Dev container, Vite + Svelte 5 + Tailwind, GitHub Pages deployment, GCP setup scripts, CLI wrapper.

### Phase 1: Authentication ✓
Google OAuth, token refresh, session persistence, protected routes.

### Phase 2: Spreadsheet Selection ✓
Google Picker, create/select spreadsheet, schema validation.

### Phase 3: Core Data Layer ✓
Sheets API client, Svelte stores, CRUD operations, optimistic updates.

### Phase 4: Grant Registry ✓
Grant list with filtering/sorting, grant detail view, permalinks.

### Phase 5: Dashboard ✓
Pipeline cards, action items widget, reports due widget, recent activity.

### Phase 6: Status Management ✓
Status dropdown, status history tracking, timeline display.

### Phase 7: Action Items ✓
Create/complete action items, assignee/due date, bulk actions.

### Phase 8: Report Compliance ✓
Reports list, mark received, filtering by period/status/grant.

### Phase 9: Budget & Charts ✓
Category allocation, Chart.js pie/bar charts, year selector.

### Phase 11: Artifacts ✓
Add/delete artifacts, type categorization, display in grant detail.

### Phase 15: Foundation (Partial) ✓
OAuth caching in sessionStorage, root folder setup, Grants/ structure.

### Phase 16: Drive Folder Architecture ✓
Auto-create grant folders, Tracker/Proposal docs, Reports subfolder, file picker.

### Phase 17: Google Docs Integration (Partial) ✓
Metadata table in Tracker doc, approvals section, action items from assigned comments.

</details>
