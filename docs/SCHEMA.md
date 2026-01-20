# Grant Tracker Schema

This document defines the authoritative schema for the Grant Tracker spreadsheet. Use this as a reference when creating the template spreadsheet manually.

**Last updated:** 2026-01-19

---

## Overview

The Grant Tracker uses a Google Sheets spreadsheet as its database. The spreadsheet should contain 6 sheets (tabs), each functioning as a table with specific columns.

**Template Approach:** Rather than creating the schema programmatically (which has proven unreliable with the Tables API), we maintain a hand-crafted template spreadsheet. When users set up Grant Tracker, they copy this template to their own Drive.

---

## Sheets Summary

| Sheet | Purpose | Primary Key |
|-------|---------|-------------|
| Grants | Main grant/contract records | `grant_id` |
| ActionItems | Tasks linked to grants | `item_id` |
| Reports | Expected/received reports | `report_id` |
| Artifacts | Blog posts, announcements, etc. | `artifact_id` |
| StatusHistory | Audit log of status changes | `history_id` |
| Config | App configuration key-value pairs | `key` |

---

## Sheet: Grants

The main table containing all grant and contract records.

| # | Column | Type | Required | Validation | Description |
|---|--------|------|----------|------------|-------------|
| A | `grant_id` | Text | Yes | Unique, format: `CODE-YEAR-Codename` | Primary identifier (e.g., "PYPI-2026-Packaging") |
| B | `title` | Text | Yes | | Human-readable name |
| C | `organization` | Text | Yes | | Grantee/vendor organization |
| D | `contact_name` | Text | | | Primary contact person |
| E | `contact_email` | Text | | Email format | Contact email address |
| F | `type` | Dropdown | Yes | See Type Values | "Grant" or "Contract" |
| G | `category_a_pct` | Percent | | 0-100 | % allocation to Category A |
| H | `category_b_pct` | Percent | | 0-100 | % allocation to Category B |
| I | `category_c_pct` | Percent | | 0-100 | % allocation to Category C |
| J | `category_d_pct` | Percent | | 0-100 | % allocation to Category D |
| K | `ecosystem` | Text | | | Ecosystem beneficiary (e.g., "Python", "Rust") |
| L | `amount` | Currency | | | Grant/contract value in USD |
| M | `grant_year` | Number | | YYYY format | Year of work (not disbursement year) |
| N | `status` | Dropdown | Yes | See Status Values | Current pipeline stage |
| O | `proposal_doc_url` | URL | | | Link to collaborative proposal doc |
| P | `internal_notes_url` | URL | | | Link to private internal notes doc |
| Q | `drive_folder_url` | URL | | | Link to grant's Drive folder |
| R | `github_repo` | Text | | | GitHub repo path (e.g., "org/repo") |
| S | `created_at` | DateTime | | ISO 8601 | When record was created |
| T | `updated_at` | DateTime | | ISO 8601 | Last modification timestamp |
| U | `status_changed_at` | DateTime | | ISO 8601 | When status last changed |
| V | `notes` | Text | | | Free-form notes |

### Grant ID Format

Grant IDs follow the pattern: `CODE-YEAR-Codename`

- **CODE**: 2-4 letter organization code (e.g., "PYPI", "RUST", "PSF")
- **YEAR**: 4-digit year of work
- **Codename**: Descriptive word from title (e.g., "Packaging", "Security")

Examples:
- `PYPI-2026-Packaging`
- `RUST-2025-Security`
- `PSF-2026-Infrastructure`

### Type Values (Dropdown)

| Value | Description |
|-------|-------------|
| Grant | Traditional grant funding |
| Contract | Contractual service agreement |

### Status Values (Dropdown)

Pipeline stages in typical order:

| Value | Description |
|-------|-------------|
| Initial Contact | First contact with potential grantee |
| Evaluation Meeting | Formal evaluation discussion |
| Proposal Development | Proposal being written |
| Stakeholder Review | Internal review process |
| Approved | Approved, pending notification |
| Notification | Grantee notified of approval |
| Signing | Contract/agreement signing |
| Disbursement | Funds being disbursed |
| Active | Work in progress |
| Finished | Work completed |
| Rejected | Proposal rejected |
| Deferred | Postponed to future consideration |

### Category Percentage Note

The four category percentages should sum to 100% for grants with budget allocation. The app validates this on the client side. Consider adding a conditional formatting rule or Apps Script validation to highlight rows where the sum ≠ 100%.

---

## Sheet: ActionItems

Tasks and to-do items linked to specific grants.

| # | Column | Type | Required | Validation | Description |
|---|--------|------|----------|------------|-------------|
| A | `item_id` | Text | Yes | Unique, format: `AI-XXXXX` | Auto-generated identifier |
| B | `grant_id` | Text | Yes | Must exist in Grants | Foreign key to grant |
| C | `description` | Text | Yes | | What needs to be done |
| D | `assignee` | Text | | | Who's responsible (email or name) |
| E | `due_date` | Date | | YYYY-MM-DD | When it's due |
| F | `status` | Dropdown | Yes | See Status Values | Current state |
| G | `source` | Text | | | Origin (e.g., "2025-01-15 meeting") |
| H | `created_at` | DateTime | | ISO 8601 | When created |
| I | `completed_at` | DateTime | | ISO 8601 | When marked done |
| J | `synced_comment_id` | Text | | | Unique ID for items synced from Google Docs comments. Format: `{fileId}:{commentId}`. Used for deduplication across syncs. |
| K | `comment_link` | URL | | | Direct link to the source comment in Google Docs. Allows jumping directly to the comment thread. |

### Action Item Status Values (Dropdown)

| Value | Description |
|-------|-------------|
| Open | Not yet completed |
| Done | Completed |
| Cancelled | No longer needed |

---

## Sheet: Reports

Tracks expected and received reports from grantees.

| # | Column | Type | Required | Validation | Description |
|---|--------|------|----------|------------|-------------|
| A | `report_id` | Text | Yes | Unique, format: `RPT-XXXXX` | Auto-generated identifier |
| B | `grant_id` | Text | Yes | Must exist in Grants | Foreign key to grant |
| C | `period` | Text | Yes | | Period covered (see format below) |
| D | `report_type` | Dropdown | Yes | See Type Values | Monthly, Quarterly, or Annual |
| E | `status` | Dropdown | Yes | See Status Values | Expected, Received, or Overdue |
| F | `due_date` | Date | | YYYY-MM-DD | When report is expected |
| G | `received_date` | Date | | YYYY-MM-DD | When report was received |
| H | `url` | URL | | | Link to the report |
| I | `notes` | Text | | | Additional notes |

### Period Format

- Monthly: `2025-01`, `2025-02`, etc.
- Quarterly: `2025-Q1`, `2025-Q2`, etc.
- Annual: `2025`, `2026`, etc.

### Report Type Values (Dropdown)

| Value | Description |
|-------|-------------|
| Monthly | Monthly progress report |
| Quarterly | Quarterly summary report |
| Annual | Annual/final report |

### Report Status Values (Dropdown)

| Value | Description |
|-------|-------------|
| Expected | Report not yet due or due soon |
| Received | Report has been submitted |
| Overdue | Report is past due date |

> **Note:** In v2 (Phase 16+), reports will migrate to files in each grant's Drive folder. This sheet may be deprecated.

---

## Sheet: Artifacts

Links to blog posts, announcements, and other public artifacts related to grants.

| # | Column | Type | Required | Validation | Description |
|---|--------|------|----------|------------|-------------|
| A | `artifact_id` | Text | Yes | Unique, format: `ART-XXXXX` | Auto-generated identifier |
| B | `grant_id` | Text | Yes | Must exist in Grants | Foreign key to grant |
| C | `artifact_type` | Dropdown | Yes | See Type Values | Category of artifact |
| D | `title` | Text | Yes | | Artifact title |
| E | `url` | URL | Yes | | Link to artifact |
| F | `date` | Date | | YYYY-MM-DD | Publication/creation date |
| G | `added_by` | Text | | | Who added this record |
| H | `created_at` | DateTime | | ISO 8601 | When record was created |

### Artifact Type Values (Dropdown)

| Value | Description |
|-------|-------------|
| Blog Post | Published blog article |
| Meeting Notes | Notes from a meeting |
| Announcement | Public announcement |
| Final Report | Final project report |
| Other | Other artifact type |

---

## Sheet: StatusHistory

Audit log tracking all status changes for grants.

| # | Column | Type | Required | Validation | Description |
|---|--------|------|----------|------------|-------------|
| A | `history_id` | Text | Yes | Unique, format: `SH-XXXXX` | Auto-generated identifier |
| B | `grant_id` | Text | Yes | Must exist in Grants | Foreign key to grant |
| C | `from_status` | Text | | | Previous status (null for new grants) |
| D | `to_status` | Text | Yes | | New status |
| E | `changed_by` | Text | Yes | | User email who made the change |
| F | `changed_at` | DateTime | Yes | ISO 8601 | When the change occurred |
| G | `notes` | Text | | | Optional context for the change |

---

## Sheet: Config

Key-value configuration store for app settings.

| # | Column | Type | Required | Description |
|---|--------|------|----------|-------------|
| A | `key` | Text | Yes | Configuration key name |
| B | `value` | Text | Yes | Configuration value (may be JSON) |

### Default Configuration

| Key | Default Value | Description |
|-----|---------------|-------------|
| `team_members` | `[]` | JSON array of authorized user emails |
| `categories` | `["Category A", "Category B", "Category C", "Category D"]` | JSON array of category names |
| `drive_root_folder_id` | `` | Google Drive folder ID for grant folders |
| `templates_folder_id` | `` | Google Drive folder ID for document templates |

---

## Template Creation Guide

Follow these steps to create the template spreadsheet manually:

### 1. Create the Spreadsheet

1. Go to Google Sheets and create a new blank spreadsheet
2. Name it "Grant Tracker Template" (or similar)
3. Delete the default "Sheet1" after creating the required sheets

### 2. Create Each Sheet

For each sheet listed above:
1. Add a new sheet tab with the exact name (Grants, ActionItems, Reports, Artifacts, StatusHistory, Config)
2. Add column headers in row 1 exactly as specified (case-sensitive)
3. Format the header row: **Bold**, light gray background (#E0E0E0)
4. Freeze the header row (View → Freeze → 1 row)

### 3. Add Data Validation (Dropdowns)

For columns with dropdown values:
1. Select the column (excluding header), e.g., F2:F1000 for Grants.type
2. Data → Data validation → Add rule
3. Criteria: "Dropdown (from a list)"
4. Enter the values exactly as listed above (comma-separated)
5. Check "Show dropdown list in cell"
6. Set "If data is invalid" to "Show warning" (allows flexibility)

**Dropdown columns to configure:**
- Grants.type: Grant, Contract
- Grants.status: Initial Contact, Evaluation Meeting, Proposal Development, Stakeholder Review, Approved, Notification, Signing, Disbursement, Active, Finished, Rejected, Deferred
- ActionItems.status: Open, Done, Cancelled
- Reports.report_type: Monthly, Quarterly, Annual
- Reports.status: Expected, Received, Overdue
- Artifacts.artifact_type: Blog Post, Meeting Notes, Announcement, Final Report, Other

### 4. Format Special Columns

**Percent columns (Grants G:J):**
1. Select columns G through J (excluding header)
2. Format → Number → Percent
3. Or: Format → Number → Custom number format → `0%`

**Currency column (Grants.amount):**
1. Select column L (excluding header)
2. Format → Number → Currency

**Date columns:**
1. Select relevant columns (due_date, date, etc.)
2. Format → Number → Date

### 5. Add Default Config Values

In the Config sheet, add these rows:
```
Row 1: key | value
Row 2: team_members | []
Row 3: categories | ["Category A", "Category B", "Category C", "Category D"]
Row 4: drive_root_folder_id |
Row 5: templates_folder_id |
```

### 6. Optional: Conditional Formatting

**Highlight overdue reports:**
1. Select Reports sheet data range
2. Format → Conditional formatting
3. Custom formula: `=AND($E2="Expected", $F2<TODAY())`
4. Format: Light red background

**Highlight category sum ≠ 100%:**
1. Select Grants data range (rows 2+)
2. Format → Conditional formatting
3. Custom formula: `=AND(OR($G2<>"", $H2<>"", $I2<>"", $J2<>""), SUM($G2:$J2)<>1)`
4. Format: Light yellow background

### 7. Optional: Google Sheets Tables

If you want the benefits of Tables (structured references, better filtering):
1. Select the data range including headers for each sheet
2. Format → Convert to table
3. Tables provide automatic filtering and better structured references

Note: Tables may not be available in all Google Workspace accounts.

### 8. Record the Template ID

After creating the template:
1. Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
2. This ID will be hardcoded in the app for copying to new users

---

## Planned v2 Changes

The following changes are planned for v2 (Phases 15-18):

1. **Reports Sheet Deprecation**: Reports will move to files in each grant's Drive folder (`/Grants/{grant_id}/Reports/`). The Reports sheet may be retained for backwards compatibility but will no longer be the source of truth.

2. **New Drive Folder Structure**:
   ```
   [Root Folder]/
   ├── Grant-Tracker-Database (this spreadsheet)
   └── Grants/
       └── {GRANT-ID}/
           ├── {GRANT-ID}-Tracker (Google Doc)
           ├── {GRANT-ID}-Proposal (Google Doc)
           ├── [attachments...]
           └── Reports/
               └── [report files...]
   ```

3. **Tracker Doc Integration**: Each grant will have a Tracker doc containing metadata tables and approval records that sync with the app.

4. **Artifacts Migration**: Artifacts may also move to being auto-detected from the grant folder contents.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-19 | Initial schema documentation |

---

*This document supersedes the schema section in DESIGN.md for template creation purposes.*
