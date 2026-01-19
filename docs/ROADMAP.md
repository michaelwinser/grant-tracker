# Grant Tracker Roadmap

This document tracks implementation progress and planned work for Grant Tracker.

**Last updated:** 2026-01-19

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
  - [x] `artifacts` - (schema ready, store deferred to Phase 11)
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

**Status: Not Started**

Implement grant list and detail views.

- [ ] Grant list view (`/grants`)
  - [ ] Fetch and display grants from Sheets
  - [ ] Sortable columns (ID, title, organization, status, amount)
  - [ ] Filter by: status, category, type, program manager, year
  - [ ] Search by title/organization
  - [ ] Pagination or virtual scrolling for large lists
- [ ] Grant detail view (`/grant/[id]`)
  - [ ] Display all grant fields
  - [ ] Document links (Proposal, Internal Notes, Drive Folder, GitHub)
  - [ ] Category allocation display (percentage breakdown)
  - [ ] Status badge with visual indicator
- [ ] Permalink routing with SvelteKit or hash-based routing
- [ ] Loading states and empty states
- [ ] Grant ID generation utility (`CODE-YEAR-Codename` format)

**Blocked by:** Phase 3
**Blocks:** Nothing directly (can develop in parallel with Phase 5+)

---

## Phase 5: Dashboard

**Status: Not Started**

Build the main dashboard with summary widgets.

- [ ] Pipeline summary cards
  - [ ] Count of grants per stage
  - [ ] Click to filter grant list
  - [ ] Color-coded by stage
- [ ] "My Action Items" widget
  - [ ] Filter to current user's items
  - [ ] Show due date, status, grant link
  - [ ] Inline checkbox to mark complete
- [ ] "Reports Due" widget
  - [ ] Reports due this month
  - [ ] Highlight overdue items
  - [ ] Quick action to mark received
- [ ] "Recent Activity" list
  - [ ] Recently updated grants
  - [ ] Recent status changes
- [ ] Responsive layout

**Blocked by:** Phase 3
**Blocks:** Nothing

---

## Phase 6: Status Management

**Status: Not Started**

Implement grant status tracking with history.

- [ ] Status change UI in grant detail
  - [ ] Dropdown with available statuses
  - [ ] Optional: soft validation of transitions
- [ ] Status change logic
  - [ ] Update grant record
  - [ ] Write to StatusHistory sheet
  - [ ] Update `status_changed_at` timestamp
- [ ] Status history timeline in grant detail
  - [ ] Show: previous → new status
  - [ ] Changed by, changed at
  - [ ] Optional notes field
- [ ] Optimistic UI updates

**Blocked by:** Phase 4 (need grant detail view)
**Blocks:** Nothing

---

## Phase 7: Action Items

**Status: Not Started**

Full action item management.

- [ ] Action items list in grant detail
  - [ ] Display: description, assignee, due date, status
  - [ ] Filter: show open only vs all
  - [ ] Sort by due date
- [ ] Create action item
  - [ ] Modal or inline form
  - [ ] Assignee dropdown (from Config.team_members)
  - [ ] Due date picker
  - [ ] Auto-populate source timestamp
- [ ] Edit action item
- [ ] Mark complete (update status, set completed_at)
- [ ] "My Action Items" page (`/action-items`)
  - [ ] All open items across grants
  - [ ] Filter by assignee, due date range, grant
  - [ ] Bulk actions (mark multiple complete)

**Blocked by:** Phase 3
**Blocks:** Nothing

---

## Phase 8: Report Compliance

**Status: Not Started**

Track report submissions and compliance.

- [ ] Reports view (`/reports`)
  - [ ] List all expected reports
  - [ ] Group by grant or by period
- [ ] Report status display
  - [ ] Expected, Received, Overdue badges
  - [ ] Color-coded indicators
- [ ] "Mark Received" action
  - [ ] Modal to enter received date and optional URL
  - [ ] Update Reports sheet
- [ ] Filters
  - [ ] By period (month, quarter, year)
  - [ ] By status (expected, received, overdue)
  - [ ] By grant
- [ ] Overdue highlighting
- [ ] Export/summary view for compliance reporting

**Blocked by:** Phase 3
**Blocks:** Phase 11 (GitHub Action updates same data)

---

## Phase 9: Budget & Charts

**Status: Not Started**

Budget allocation visualization.

- [ ] Budget calculations
  - [ ] Sum grant amounts by category (using percentage allocations)
  - [ ] Handle grants with split categories
  - [ ] Filter by grant year
- [ ] Chart.js integration
  - [ ] Pie chart: allocation by category
  - [ ] Bar chart: category breakdown by year
- [ ] Budget table
  - [ ] Grant-by-grant breakdown
  - [ ] Category columns with calculated amounts
  - [ ] Totals row
- [ ] Year selector
- [ ] Year-over-year comparison (optional)

**Blocked by:** Phase 3
**Blocks:** Nothing

---

## Phase 10: Drive Integration

**Status: Not Started**

Automatic folder and document creation.

- [ ] Drive API wrapper
  - [ ] Create folder
  - [ ] Copy file (from template)
  - [ ] Set sharing permissions
- [ ] Folder structure creation
  - [ ] Get/create year folder under Grants root
  - [ ] Create grant folder (`{grant_id}`)
  - [ ] Create Supporting Materials subfolder
- [ ] Document creation
  - [ ] Copy Proposal Template, rename
  - [ ] Copy Internal Notes Template, rename
  - [ ] Set appropriate sharing (proposal shared with grantee email)
- [ ] Trigger options
  - [ ] Auto-create on grant creation
  - [ ] Manual "Create Folder" button in grant detail
- [ ] Update grant record with folder/doc URLs
- [ ] Handle existing folders gracefully

**Blocked by:** Phase 4 (need grant detail view)
**Blocks:** Nothing

---

## Phase 11: Artifacts

**Status: Not Started**

Link external content to grants.

- [ ] Artifacts list in grant detail
  - [ ] Display: type, title, URL, date, added by
  - [ ] Clickable links (open in new tab)
- [ ] Add artifact form
  - [ ] Type dropdown (blog post, meeting notes, announcement, etc.)
  - [ ] Title, URL, date fields
  - [ ] Auto-populate added_by from current user
- [ ] Edit artifact
- [ ] Delete artifact (with confirmation)

**Blocked by:** Phase 4
**Blocks:** Nothing

---

## Phase 12: GitHub Integration

**Status: Not Started**

GitHub Action to auto-track report submissions.

- [ ] GitHub Action workflow
  - [ ] Trigger on push to `reports/` directory
  - [ ] Detect new monthly reports (YYYY-MM pattern)
  - [ ] Use service account to update Sheets
- [ ] Service account setup
  - [ ] Create GCP service account
  - [ ] Grant Sheets editor permission
  - [ ] Document secret configuration
- [ ] Sheets update logic
  - [ ] Find matching report record
  - [ ] Update status to "Received"
  - [ ] Set received_date and commit URL
- [ ] Documentation
  - [ ] Setup guide for grantee repos
  - [ ] Repository naming conventions

**Blocked by:** Phase 8 (Reports schema must be defined)
**Blocks:** Nothing

---

## Phase 13: Polish & Error Handling

**Status: Not Started**

Production readiness improvements.

- [ ] Comprehensive error handling
  - [ ] Network failure recovery
  - [ ] API rate limit handling (exponential backoff)
  - [ ] User-friendly error messages
  - [ ] Retry logic with feedback
- [ ] Loading states
  - [ ] Skeleton loaders for lists
  - [ ] Spinners for actions
  - [ ] Progress indicators for multi-step operations
- [ ] Empty states
  - [ ] No grants yet
  - [ ] No action items
  - [ ] No search results
- [ ] Mobile responsiveness (basic support)
- [ ] Accessibility
  - [ ] ARIA labels
  - [ ] Keyboard navigation
  - [ ] Focus management
- [ ] Performance
  - [ ] Lazy loading for large lists
  - [ ] Debounced search/filter
  - [ ] Memoization where appropriate

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

## Future Considerations (Post-v1)

These items are explicitly out of scope for v1 but may be considered later:

- [ ] Automated email notifications (approval/rejection)
- [ ] Grantee-facing portal
- [ ] Google Docs add-on/sidebar
- [ ] Calendar integration for due dates
- [ ] Mobile-optimized experience
- [ ] Advanced reporting and analytics
- [ ] Bulk import/export functionality
- [ ] Multi-organization support

---

## Implementation Notes

### Critical Path

The following sequence represents the minimum path to a working application:

1. **Phase 1: Authentication** — Everything requires an authenticated user
2. **Phase 2: Spreadsheet Selection** — Need a spreadsheet to read/write
3. **Phase 3: Core Data Layer** — All views depend on data access
4. **Phase 4: Grant Registry** — Core value proposition
5. **Phase 5: Dashboard** — Primary entry point for users

### Parallelization

Once Phase 3 is complete, the following can be developed in parallel:
- Phases 4-9 (different views, same data layer)
- Phase 14 (Apps Script is independent)

### Key Design Principles

- **Walkaway-able**: If the PWA breaks, Sheets and Drive remain fully usable
- **No backend**: All API calls from browser using user's OAuth token
- **Least privilege**: Use `drive.file` scope, not full Drive access
- **Google-native**: Leverage Sheets Tables, Drive structure, Docs templates

---

## Updating This Document

This roadmap should be kept current as work progresses:

1. Mark items complete (`[x]`) when finished
2. Mark items in progress (`[~]`) when actively being worked on
3. Add new items as requirements emerge
4. Update "Last updated" date at the top
5. Move completed phases to a "Completed" section if desired

When planning work, reference this document to understand dependencies and choose appropriate next steps.
