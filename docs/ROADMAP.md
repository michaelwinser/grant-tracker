# Grant Tracker Roadmap

This document tracks implementation progress and planned work for Grant Tracker.

**Last updated:** 2026-01-19 (v2 phases added)

## Status Legend

- [ ] Not started
- [x] Complete
- [~] In progress

---

## Phase 0: Infrastructure & Setup

**Status: Complete**

- [x] Dev container (Node.js 22, Google Cloud CLI)
- [x] Vite + Svelte 5 + Tailwind CSS build pipeline
- [x] GitHub Pages deployment workflow
- [x] GCP setup scripts (project creation, API enablement)
- [x] OAuth configuration scripts
- [x] CLI wrapper (`./gt`) for common operations
- [x] Setup documentation and interactive skill
- [x] UI mockups for all major views

---

## Phase 1: Authentication

**Status: Complete**

Implement Google OAuth flow for team member authentication.

- [x] Google Identity Services integration
- [x] Sign-in/sign-out UI components
- [x] Token storage (memory-only for security)
- [x] Token refresh logic (auto-refresh 5 min before expiry)
- [x] Team member allowlist validation (check against Config sheet)
- [x] Auth state management (Svelte 5 runes store)
- [x] Protected route handling
- [x] Error handling (invalid token, not on allowlist)

**Blocked by:** Nothing
**Blocks:** All other phases (need authenticated user for API calls)

---

## Phase 2: Spreadsheet Selection

**Status: Complete**

Allow users to select or create their spreadsheet via Google Picker.

- [x] Google Picker API integration
- [x] "Select Spreadsheet" UI flow on first use
- [x] "Create New Spreadsheet" option
- [x] Sheet schema initialization (create tabs with headers)
- [x] Spreadsheet ID storage in localStorage
- [x] Switch spreadsheet functionality
- [x] Validate selected sheet has correct schema

**Blocked by:** Phase 1 (need OAuth token for Picker/Sheets API)
**Blocks:** Phase 3 (need spreadsheet to fetch data)

---

## Phase 3: Core Data Layer

**Status: Complete**

Build the Sheets API wrapper and Svelte stores for data management.

- [x] Sheets API client wrapper
  - [x] Generic read/write operations
  - [x] Pagination support (via full sheet read)
  - [x] Error handling with exponential backoff
  - [x] Rate limit handling
- [x] Data models/types (Grant, ActionItem, Report, Artifact)
- [x] Svelte stores
  - [x] `grants` - all grants
  - [x] `actionItems` - all action items
  - [x] `reports` - all reports
  - [x] `artifacts` - all artifacts (implemented in Phase 11)
  - [x] `config` - team members, settings
  - [x] `user` - current user info (from Phase 1)
- [x] Derived stores
  - [x] `grantsByStatus` - grouped by pipeline stage
  - [x] `myActionItems` - filtered to current user
  - [x] `overdueReports` - reports past due date
- [x] CRUD operations for each entity
- [x] Optimistic updates with rollback on failure

**Blocked by:** Phase 2 (need spreadsheet ID)
**Blocks:** Phases 4-10 (all views need data)

---

## Phase 4: Grant Registry & Display

**Status: Complete**

Implement grant list and detail views.

- [x] Grant list view (`/grants`)
  - [x] Fetch and display grants from Sheets
  - [x] Sortable columns (ID, title, organization, status, amount)
  - [x] Filter by: status, category, type, program manager, year
  - [x] Search by title/organization
  - [ ] Pagination or virtual scrolling for large lists (deferred - not needed yet)
- [x] Grant detail view (`/grant/[id]`)
  - [x] Display all grant fields
  - [x] Document links (Proposal, Internal Notes, Drive Folder, GitHub)
  - [x] Category allocation display (percentage breakdown)
  - [x] Status badge with visual indicator
- [x] Permalink routing with SvelteKit or hash-based routing
- [x] Loading states and empty states
- [x] Grant ID generation utility (`CODE-YEAR-Codename` format)

**Blocked by:** Phase 3
**Blocks:** Nothing directly (can develop in parallel with Phase 5+)

---

## Phase 5: Dashboard

**Status: Complete**

Build the main dashboard with summary widgets.

- [x] Pipeline summary cards
  - [x] Count of grants per stage
  - [x] Click to filter grant list
  - [x] Color-coded by stage
- [x] "My Action Items" widget
  - [x] Filter to current user's items
  - [x] Show due date, status, grant link
  - [ ] Inline checkbox to mark complete (deferred to Phase 7)
- [x] "Reports Due" widget
  - [x] Reports due this month
  - [x] Highlight overdue items
  - [ ] Quick action to mark received (deferred to Phase 8)
- [x] "Recent Activity" list
  - [x] Recently updated grants
  - [x] Recent status changes
- [x] Responsive layout

**Blocked by:** Phase 3
**Blocks:** Nothing

---

## Phase 6: Status Management

**Status: Complete**

Implement grant status tracking with history.

- [x] Status change UI in grant detail
  - [x] Dropdown with available statuses
  - [ ] Optional: soft validation of transitions (deferred)
- [x] Status change logic
  - [x] Update grant record
  - [x] Write to StatusHistory sheet
  - [x] Update `status_changed_at` timestamp
- [x] Status history timeline in grant detail
  - [x] Show: previous → new status
  - [x] Changed by, changed at
  - [x] Optional notes field
- [x] Optimistic UI updates

**Blocked by:** Phase 4 (need grant detail view)
**Blocks:** Nothing

---

## Phase 7: Action Items

**Status: Complete**

Full action item management.

- [x] Action items list in grant detail
  - [x] Display: description, assignee, due date, status
  - [x] Filter: show open only vs all
  - [x] Sort by due date
- [x] Create action item
  - [x] Inline form in grant detail
  - [x] Assignee dropdown (from Config.team_members)
  - [x] Due date picker
  - [x] Auto-populate source timestamp
- [ ] Edit action item (deferred)
- [x] Mark complete (update status, set completed_at)
- [x] "My Action Items" page (`/action-items`)
  - [x] All open items across grants
  - [x] Filter by assignee, due date range, grant
  - [x] Bulk actions (mark multiple complete)

**Blocked by:** Phase 3
**Blocks:** Nothing

---

## Phase 8: Report Compliance

**Status: Complete (pending migration)**

Track report submissions and compliance.

- [x] Reports view (`/reports`)
  - [x] List all expected reports
  - [x] Filter/group by grant or by period
- [x] Report status display
  - [x] Expected, Received, Overdue badges
  - [x] Color-coded indicators
- [x] "Mark Received" action
  - [x] Modal to enter received date and optional URL
  - [x] Update Reports sheet
- [x] Filters
  - [x] By period
  - [x] By status (expected, received, overdue)
  - [x] By grant
  - [x] By report type
- [x] Overdue highlighting
- [ ] Export/summary view for compliance reporting (deferred)

**Note:** This phase will be migrated in Phase 17. Reports will become files in each grant's Reports/ subfolder rather than rows in a Reports sheet. The UI will be updated to read from Drive instead.

**Blocked by:** Phase 3
**Blocks:** Nothing (Phase 12 superseded)

---

## Phase 9: Budget & Charts

**Status: Complete**

Budget allocation visualization.

- [x] Budget calculations
  - [x] Sum grant amounts by category (using percentage allocations)
  - [x] Handle grants with split categories
  - [x] Filter by grant year
- [x] Chart.js integration
  - [x] Pie chart: allocation by category
  - [x] Bar chart: category breakdown by year (stacked)
- [x] Budget table
  - [x] Grant-by-grant breakdown
  - [x] Category columns with calculated amounts
  - [x] Totals row
- [x] Year selector
- [x] Year-over-year comparison (via stacked bar chart)

**Blocked by:** Phase 3
**Blocks:** Nothing

---

## Phase 10: Drive Integration (Legacy)

**Status: Superseded by Phase 17**

_This phase has been superseded by the new folder-first architecture in Phase 17. The original design called for a year-based folder hierarchy; the new design uses a flat Grants/ folder with per-grant subfolders._

---

---

## Phase 11: Artifacts

**Status: Complete**

Link external content to grants.

- [x] Artifacts list in grant detail
  - [x] Display: type, title, URL, date, added by
  - [x] Clickable links (open in new tab)
- [x] Add artifact form
  - [x] Type dropdown (blog post, meeting notes, announcement, etc.)
  - [x] Title, URL, date fields
  - [x] Auto-populate added_by from current user
- [ ] Edit artifact (deferred)
- [x] Delete artifact (with confirmation)

**Blocked by:** Phase 4
**Blocks:** Nothing

---

## Phase 12: GitHub Integration (Legacy)

**Status: Superseded**

_This phase has been superseded by the new folder-first architecture. Reports are now tracked as files in each grant's Reports/ subfolder in Google Drive, eliminating the need for a separate Reports sheet and GitHub Action integration._

---

---

## Phase 13: Polish & Error Handling

**Status: Partial**

Production readiness improvements.

- [x] Comprehensive error handling
  - [x] Network failure recovery (via store rollback)
  - [x] API rate limit handling (exponential backoff in sheetsClient)
  - [x] User-friendly error messages
  - [ ] Retry logic with feedback (deferred)
- [x] Loading states
  - [ ] Skeleton loaders for lists (deferred)
  - [x] Spinners for actions
  - [ ] Progress indicators for multi-step operations (deferred)
- [x] Empty states
  - [x] No grants yet
  - [x] No action items
  - [x] No search results
- [x] Mobile responsiveness (basic support via Tailwind)
- [~] Accessibility
  - [x] ARIA labels (form labels, buttons)
  - [ ] Keyboard navigation (partial)
  - [ ] Focus management (deferred)
- [ ] Performance
  - [ ] Lazy loading for large lists (deferred - not needed yet)
  - [ ] Debounced search/filter (deferred)
  - [x] Memoization (via Svelte $derived)

**Blocked by:** Phases 4-11 (need features to polish)
**Blocks:** Nothing

---

## Phase 14: Apps Script & Validation

**Status: Not Started**

Server-side validation in Google Sheets.

- [ ] Apps Script deployment
  - [ ] Create script bound to spreadsheet
  - [ ] Deploy with appropriate permissions
- [ ] Validation functions
  - [ ] Grant ID uniqueness check
  - [ ] Category percentage sum validation (must equal 100%)
  - [ ] Required field validation
- [ ] Custom menu
  - [ ] Manual folder creation trigger
  - [ ] Data validation check
  - [ ] Cleanup utilities
- [ ] Linked value restrictions
  - [ ] Grant ID dropdowns in ActionItems, Reports, etc.
  - [ ] Status value restrictions

**Blocked by:** Nothing (can be done in parallel)
**Blocks:** Nothing

---

## Phase 15: Foundation Improvements

**Status: Not Started**

Auth enhancements and workflow streamlining.

- [ ] Auth credential caching
  - [ ] Persist OAuth tokens in sessionStorage
  - [ ] Auto-restore session on page reload
  - [ ] Clear on explicit sign-out
- [ ] Root folder setup
  - [ ] Folder picker for selecting/creating root folder
  - [ ] Store root folder ID alongside spreadsheet ID
  - [ ] Create Grants/ subfolder structure
- [ ] Simplified grant creation
  - [ ] Minimal "quick create" form (org, title, year, type)
  - [ ] Auto-generate grant ID
  - [ ] Auto-create folder and docs on save
  - [ ] Full edit available after creation

**Blocked by:** Phase 1 (auth), Phase 2 (picker)
**Blocks:** Phase 16

---

## Phase 16: Drive Folder Architecture

**Status: Not Started**

New folder-first architecture with Drive as source of truth for files.

**Folder Structure:**
```
[Root Folder]
├── Grant-Tracker-Database (spreadsheet)
└── Grants/
    └── [GRANT-ID]/
        ├── GRANT-ID-Tracker (doc with metadata, approvals)
        ├── GRANT-ID-Proposal (doc, shared with grantee)
        ├── [other files] → shown as Attachments
        └── Reports/
            └── [files] → shown as Reports (grantee-writable)
```

- [ ] Drive API integration
  - [ ] Create folder with specific parent
  - [ ] Create Google Doc from scratch (no template needed)
  - [ ] List files in folder
  - [ ] Set sharing permissions
- [ ] Auto-create on grant creation
  - [ ] Create grant folder under Grants/
  - [ ] Create Tracker doc with metadata table structure
  - [ ] Create Proposal doc (blank)
  - [ ] Create Reports/ subfolder
  - [ ] Update grant record with folder/doc URLs
- [ ] Attachments view in grant detail
  - [ ] List all files in grant folder (excluding Tracker, Proposal, Reports/)
  - [ ] Show file name, type icon, modified date
  - [ ] Click to open in Drive
- [ ] Reports from folder
  - [ ] List files in Reports/ subfolder
  - [ ] Show file name, date (from filename or modified date)
  - [ ] Remove Reports sheet dependency
  - [ ] Update /reports page to aggregate from Drive
- [ ] Handle existing grants
  - [ ] "Create Folder" button for grants without folders
  - [ ] Gracefully handle partial folder structures

**Blocked by:** Phase 15 (root folder setup)
**Blocks:** Phase 17

---

## Phase 17: Google Docs Integration

**Status: Not Started**

Sync data between app and Google Docs for distributed source of truth.

- [ ] Tracker doc structure
  - [ ] Define metadata table format (key-value pairs)
  - [ ] Define approvals table format (date, type, approver, notes)
  - [ ] Create doc with proper headings and tables on grant creation
- [ ] Metadata sync
  - [ ] Read metadata table from Tracker doc
  - [ ] Display in grant detail (read-only initially)
  - [ ] Future: two-way sync
- [ ] Approvals section
  - [ ] Read approvals table from Tracker doc
  - [ ] Display approval history in grant detail
  - [ ] Future: add approval from app
- [ ] Action items from comments
  - [ ] Use Drive API to fetch comments on Tracker/Proposal docs
  - [ ] Parse comments for action item patterns (e.g., "TODO:", "@assignee")
  - [ ] Show in action items list with source link
  - [ ] Mark as synced vs. manual
- [ ] Periodic sync
  - [ ] Refresh on grant detail load
  - [ ] Manual "Sync" button
  - [ ] Future: background polling

**Blocked by:** Phase 16 (Tracker doc creation)
**Blocks:** Nothing

---

## Phase 18: Advanced Features

**Status: Not Started**

Polish and advanced workflows.

- [ ] Permissions management
  - [ ] Set Proposal doc sharing (grantee can edit)
  - [ ] Set Reports/ folder sharing (grantee can add files)
  - [ ] Permissions summary in grant detail
- [ ] "Create from existing doc" flow
  - [ ] Detect grant folders without spreadsheet entries
  - [ ] Parse Tracker doc metadata to populate grant fields
  - [ ] Create grant record from doc
- [ ] Organization patterns
  - [ ] Auto-complete from previous grants
  - [ ] Suggested org codes based on history
  - [ ] People API integration for contact lookup (optional)
- [ ] Multiple contacts per grant
  - [ ] Store as comma-separated emails in single field
  - [ ] Display as list in UI
  - [ ] Auto-complete from contacts
- [ ] Global action items improvements
  - [ ] Filter view instead of separate page
  - [ ] Include synced items from Docs
  - [ ] Group by grant or by assignee

**Blocked by:** Phase 17
**Blocks:** Nothing

---

## Future Considerations (Post-v2)

These items are explicitly out of scope for v2 but may be considered later:

- [ ] Automated email notifications (approval/rejection)
- [ ] Grantee-facing portal (read-only view of their grants)
- [ ] Google Docs add-on/sidebar (edit grants from within Docs)
- [ ] Calendar integration for due dates
- [ ] Mobile-optimized experience (PWA with offline support)
- [ ] Advanced reporting and analytics
- [ ] Bulk import/export functionality
- [ ] Multi-organization support
- [ ] Slack/Teams integration for notifications
- [ ] AI-assisted grant writing (integration with Claude API)

---

## Implementation Notes

### V1 Critical Path (Complete)

The v1 application provides a working grant management system:

1. **Phase 1: Authentication** — Google OAuth for team members
2. **Phase 2: Spreadsheet Selection** — Picker-based spreadsheet selection
3. **Phase 3: Core Data Layer** — Sheets API wrapper and Svelte stores
4. **Phase 4: Grant Registry** — Grant list and detail views
5. **Phase 5: Dashboard** — Pipeline summary and widgets

### V2 Critical Path (In Progress)

The v2 evolution adds Drive integration for a distributed source of truth:

1. **Phase 15: Foundation** — Auth caching, root folder setup
2. **Phase 16: Drive Folder Architecture** — Auto-create folders/docs, files as attachments/reports
3. **Phase 17: Google Docs Integration** — Sync metadata, action items, approvals from Tracker docs
4. **Phase 18: Advanced Features** — Permissions, "create from doc", org patterns

### Parallelization

- Phase 13 (Polish) can be done alongside any other work
- Phase 14 (Apps Script) is independent and can be done anytime
- Phases 15-18 must be done sequentially (each depends on the previous)

### Key Design Principles

- **Walkaway-able**: If the PWA breaks, Sheets and Drive remain fully usable
- **No backend**: All API calls from browser using user's OAuth token
- **Least privilege**: Use `drive.file` scope, not full Drive access
- **Distributed source of truth**: Spreadsheet for data, Docs for discussions/approvals, Drive for files
- **Google-native**: Leverage Sheets Tables, Drive structure, Docs comments
- **App as aggregator**: The PWA aggregates and displays data from multiple Google sources

---

## Updating This Document

This roadmap should be kept current as work progresses:

1. Mark items complete (`[x]`) when finished
2. Mark items in progress (`[~]`) when actively being worked on
3. Add new items as requirements emerge
4. Update "Last updated" date at the top
5. Move completed phases to a "Completed" section if desired

When planning work, reference this document to understand dependencies and choose appropriate next steps.
