# Grant Tracker — Design Document

## Overview

This document describes the technical architecture for Grant Tracker, a lightweight grant management system for a small non-profit. The system uses Google Sheets as its database, Google Drive for document storage, and a client-side PWA for enhanced workflow support.

**Design Principles:**
1. **Walkaway-able** — If the PWA breaks, the Sheets and Drive folders remain fully usable
2. **No backend** — All API calls from browser; zero server maintenance
3. **Google-native** — Leverages Google Workspace APIs and features (Tables, Apps Script)
4. **Progressive enhancement** — PWA adds convenience; Sheets provides durability

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User's Browser                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Grant Tracker PWA                             │  │
│  │                    (Svelte, hosted on GitHub Pages)                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│         │                        │                         │                │
│         │ OAuth Token            │ OAuth Token             │ OAuth Token    │
│         ▼                        ▼                         ▼                │
└─────────┼────────────────────────┼─────────────────────────┼────────────────┘
          │                        │                         │
          ▼                        ▼                         ▼
   ┌─────────────┐         ┌─────────────┐          ┌─────────────┐
   │   Google    │         │   Google    │          │   Google    │
   │  Sheets API │         │  Drive API  │          │  Docs API   │
   └─────────────┘         └─────────────┘          └─────────────┘
          │                        │                         │
          ▼                        ▼                         ▼
   ┌─────────────┐         ┌─────────────────────────────────────┐
   │   Grant     │         │            Google Drive              │
   │  Tracker    │         │  ┌─────────────────────────────────┐ │
   │ Spreadsheet │         │  │  Grants/                        │ │
   │  (Tables)   │         │  │    2025/                        │ │
   └─────────────┘         │  │      PYPI-2025-Staffing/        │ │
                           │  │        📄 Proposal              │ │
                           │  │        📄 Internal Notes        │ │
                           │  └─────────────────────────────────┘ │
                           └─────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────────────┐
   │                          GitHub (Separate)                              │
   │  ┌───────────────────┐    ┌───────────────────────────────────────────┐ │
   │  │  Grantee Repos    │───▶│  GitHub Action: on monthly report commit  │ │
   │  │  (monthly reports)│    │  → Writes to Sheets via Service Account   │ │
   │  └───────────────────┘    └───────────────────────────────────────────┘ │
   └─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model (Google Sheets)

The spreadsheet uses Google Sheets **Tables** feature for schema enforcement. Tables provide:
- Column typing and validation
- Dropdown lists for enumerated values
- Structured references in formulas
- Better API ergonomics

### Sheet: `Grants`

| Column | Type | Validation | Description |
|--------|------|------------|-------------|
| `grant_id` | String | Unique, required, format: `CODE-YEAR-Codename` | Primary identifier |
| `title` | String | Required | Human-readable name |
| `organization` | String | Required | Grantee/vendor organization |
| `contact_name` | String | | Primary contact person |
| `contact_email` | String | Email format | Contact email |
| `type` | Dropdown | `Grant`, `Contract` | Deal type |
| `category` | Dropdown | `A`, `B`, `C`, `D` | Budget category |
| `ecosystem` | String | | Ecosystem beneficiary |
| `amount` | Currency | | Grant/contract value |
| `grant_year` | Number | YYYY | Year of work (not disbursement) |
| `status` | Dropdown | See lifecycle stages | Current stage |
| `program_manager` | Dropdown | Team member list | Assigned PM |
| `proposal_doc_url` | URL | | Link to collaborative proposal |
| `internal_notes_url` | URL | | Link to private notes doc |
| `drive_folder_url` | URL | | Link to grant folder |
| `github_repo` | String | | Repo for monthly reports (if applicable) |
| `created_at` | DateTime | Auto | When record created |
| `updated_at` | DateTime | Auto | Last modification |
| `status_changed_at` | DateTime | | When status last changed |
| `notes` | String | | Free-form notes |

**Status Values:**
- `Initial Contact`
- `Evaluation Meeting`
- `Proposal Development`
- `Stakeholder Review`
- `Approved`
- `Rejected`
- `Deferred`
- `Notification`
- `Signing`
- `Disbursement`
- `Active`
- `Finished`

### Sheet: `ActionItems`

| Column | Type | Validation | Description |
|--------|------|------------|-------------|
| `item_id` | String | Unique, auto-generated | `AI-XXXXX` |
| `grant_id` | String | Must exist in Grants | Foreign key |
| `description` | String | Required | What needs to be done |
| `assignee` | Dropdown | Team member list | Who's responsible |
| `due_date` | Date | | When it's due |
| `status` | Dropdown | `Open`, `Done`, `Cancelled` | Current state |
| `source` | String | | Where this came from (e.g., "2025-01-15 meeting") |
| `created_at` | DateTime | Auto | When created |
| `completed_at` | DateTime | | When marked done |

### Sheet: `Reports`

| Column | Type | Validation | Description |
|--------|------|------------|-------------|
| `report_id` | String | Unique, auto-generated | `RPT-XXXXX` |
| `grant_id` | String | Must exist in Grants | Foreign key |
| `period` | String | | `2025-01` (monthly), `2025-Q1` (quarterly), `2025` (annual) |
| `report_type` | Dropdown | `Monthly`, `Quarterly`, `Annual` | Type of report |
| `status` | Dropdown | `Expected`, `Received`, `Overdue` | Current state |
| `due_date` | Date | | When expected |
| `received_date` | Date | | When actually received |
| `url` | URL | | Link to report |
| `notes` | String | | |

### Sheet: `Artifacts`

| Column | Type | Validation | Description |
|--------|------|------------|-------------|
| `artifact_id` | String | Unique, auto-generated | `ART-XXXXX` |
| `grant_id` | String | Must exist in Grants | Foreign key |
| `artifact_type` | Dropdown | `Blog Post`, `Meeting Notes`, `Announcement`, `Final Report`, `Other` | Type |
| `title` | String | Required | Artifact title |
| `url` | URL | Required | Link to artifact |
| `date` | Date | | Publication/creation date |
| `added_by` | String | | Who added this |
| `created_at` | DateTime | Auto | When record created |

### Sheet: `StatusHistory`

| Column | Type | Description |
|--------|------|-------------|
| `history_id` | String | Unique |
| `grant_id` | String | Foreign key |
| `from_status` | String | Previous status |
| `to_status` | String | New status |
| `changed_by` | String | User email |
| `changed_at` | DateTime | When changed |
| `notes` | String | Optional context |

### Sheet: `Config`

| Column | Type | Description |
|--------|------|-------------|
| `key` | String | Configuration key |
| `value` | String | Configuration value |

Used for:
- `categories`: JSON array of valid categories (allows future evolution)
- `team_members`: JSON array of team emails
- `drive_root_folder_id`: ID of Grants folder
- `templates_folder_id`: ID of templates folder

---

## Google Drive Structure

```
Grants/                              ← Root folder (ID stored in Config)
├── Templates/                       ← Document templates
│   ├── Proposal Template
│   └── Internal Notes Template
├── 2024/                           ← Year folders
│   ├── RUBY-2024-Staffing/
│   │   ├── 📄 Proposal
│   │   ├── 📄 Internal Notes
│   │   └── 📁 Supporting Materials/
│   └── RUST-2024-Security/
│       └── ...
├── 2025/
│   ├── PYPI-2025-Packaging/
│   └── ...
└── 2026/
    └── ...
```

**Folder Naming Convention:** `{grant_id}/` (e.g., `PYPI-2025-Staffing/`)

**Document Creation:**
- **Proposal Doc**: Created from template, shared with grantee (edit access)
- **Internal Notes Doc**: Created from template, team-only (no grantee access)

---

## PWA Architecture

### Tech Stack

- **Framework**: Svelte 5 (or SvelteKit in SPA mode)
- **Styling**: Tailwind CSS
- **Build**: Vite
- **Hosting**: GitHub Pages (static)
- **Auth**: Google Identity Services (OAuth 2.0)
- **APIs**: Google Sheets API v4, Google Drive API v3, Google Docs API v1

### Application Structure

```
src/
├── lib/
│   ├── api/
│   │   ├── auth.ts          # Google OAuth handling
│   │   ├── sheets.ts        # Sheets API wrapper
│   │   ├── drive.ts         # Drive API wrapper
│   │   └── docs.ts          # Docs API wrapper
│   ├── stores/
│   │   ├── grants.ts        # Grant data store
│   │   ├── actionItems.ts   # Action items store
│   │   ├── reports.ts       # Reports store
│   │   └── user.ts          # Current user store
│   ├── components/
│   │   ├── GrantCard.svelte
│   │   ├── GrantDetail.svelte
│   │   ├── PipelineView.svelte
│   │   ├── ActionItemList.svelte
│   │   ├── ReportTracker.svelte
│   │   ├── BudgetChart.svelte
│   │   └── ...
│   └── utils/
│       ├── grantId.ts       # ID generation/validation
│       └── dates.ts         # Date formatting
├── routes/
│   ├── +page.svelte         # Dashboard
│   ├── grants/
│   │   ├── +page.svelte     # Grant list
│   │   └── [id]/
│   │       └── +page.svelte # Grant detail (permalink)
│   ├── action-items/
│   │   └── +page.svelte     # All action items
│   ├── reports/
│   │   └── +page.svelte     # Report compliance
│   └── budget/
│       └── +page.svelte     # Budget allocation
└── app.html
```

### Authentication Flow

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User      │────▶│  Google OAuth   │────▶│  Check email    │
│   clicks    │     │  consent screen │     │  against        │
│   "Sign In" │     │                 │     │  Config.team    │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                          ┌──────────┴──────────┐
                                          ▼                     ▼
                                    ┌──────────┐          ┌──────────┐
                                    │ Allowed  │          │ Rejected │
                                    │ → Load   │          │ → Show   │
                                    │   app    │          │   error  │
                                    └──────────┘          └──────────┘
```

**OAuth Scopes Required:**
- `https://www.googleapis.com/auth/spreadsheets` — Read/write Sheets
- `https://www.googleapis.com/auth/drive` — Read/write Drive
- `https://www.googleapis.com/auth/documents` — Create Docs from templates
- `https://www.googleapis.com/auth/userinfo.email` — Get user email for auth check

### Key Views

**1. Dashboard (`/`)**
- Pipeline summary: Count of grants per stage
- My action items (filtered to current user)
- Recently updated grants
- Reports due this month

**2. Grant List (`/grants`)**
- Table view of all grants
- Sortable by any column
- Filterable by: Status, Category, Type, PM, Year
- Search by title/organization
- Quick status badge

**3. Grant Detail (`/grants/[id]`)**
- Full grant information
- Quick links: Proposal Doc, Internal Notes, Drive Folder, GitHub
- Status change dropdown with confirmation
- Action items for this grant (add/edit/complete)
- Artifacts list (add new)
- Report status for this grant
- Status history timeline

**4. Action Items (`/action-items`)**
- All open action items across grants
- Filter by: Assignee, Due date, Grant
- Sort by due date (default)
- Mark complete inline

**5. Reports (`/reports`)**
- Compliance dashboard
- Filter by: Period, Status, Grant
- Highlight overdue
- Quick "mark received" action

**6. Budget (`/budget`)**
- Allocation by category (pie/bar chart)
- Grant year selector
- Table breakdown
- Year-over-year comparison (if historical data present)

### Client-Side Data Management

```typescript
// Example: Grants store
import { writable, derived } from 'svelte/store';
import { fetchGrants, updateGrant } from '$lib/api/sheets';

interface Grant {
  grant_id: string;
  title: string;
  status: GrantStatus;
  // ... other fields
}

function createGrantsStore() {
  const { subscribe, set, update } = writable<Grant[]>([]);
  
  return {
    subscribe,
    
    async load() {
      const grants = await fetchGrants();
      set(grants);
    },
    
    async updateStatus(grantId: string, newStatus: GrantStatus) {
      await updateGrant(grantId, { status: newStatus });
      update(grants => grants.map(g => 
        g.grant_id === grantId ? { ...g, status: newStatus } : g
      ));
    },
    
    // ... other methods
  };
}

export const grants = createGrantsStore();

// Derived stores for filtered views
export const activeGrants = derived(grants, $grants => 
  $grants.filter(g => g.status === 'Active')
);

export const grantsByStage = derived(grants, $grants => {
  const stages = {};
  for (const grant of $grants) {
    stages[grant.status] = stages[grant.status] || [];
    stages[grant.status].push(grant);
  }
  return stages;
});
```

### Grant ID Generation

```typescript
// lib/utils/grantId.ts

export function generateGrantId(
  organization: string, 
  year: number, 
  title: string
): string {
  // Extract 2-4 letter code from organization
  const code = extractCode(organization);
  
  // Extract one-word codename from title
  const codename = extractCodename(title);
  
  return `${code}-${year}-${codename}`;
}

function extractCode(org: string): string {
  // Remove common suffixes
  const cleaned = org
    .replace(/\s+(Inc|LLC|Foundation|Project|Initiative)\.?$/i, '')
    .trim();
  
  // If short enough, use as-is (uppercase)
  if (cleaned.length <= 4) {
    return cleaned.toUpperCase();
  }
  
  // If multiple words, use initials
  const words = cleaned.split(/\s+/);
  if (words.length > 1) {
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
  }
  
  // Single long word: take first 4 chars
  return cleaned.slice(0, 4).toUpperCase();
}

function extractCodename(title: string): string {
  // Find the most distinctive word in the title
  const stopWords = new Set(['the', 'a', 'an', 'for', 'and', 'or', 'of', 'to', 'in']);
  const words = title.split(/\s+/).filter(w => 
    w.length > 2 && !stopWords.has(w.toLowerCase())
  );
  
  // Prefer longer words, capitalize
  const sorted = words.sort((a, b) => b.length - a.length);
  return sorted[0] ? capitalize(sorted[0]) : 'Grant';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Validation
export function validateGrantId(id: string): boolean {
  return /^[A-Z]{2,4}-\d{4}-[A-Za-z]+$/.test(id);
}
```

---

## Google Apps Script

Minimal Apps Script for operations that benefit from server-side execution:

### Script: `CreateGrantFolder.gs`

```javascript
/**
 * Creates the folder structure and documents for a new grant.
 * Triggered manually or via custom menu.
 */
function createGrantFolder(grantId, grantYear) {
  const config = getConfig();
  const rootFolder = DriveApp.getFolderById(config.drive_root_folder_id);
  
  // Get or create year folder
  let yearFolder = getOrCreateFolder(rootFolder, grantYear.toString());
  
  // Create grant folder
  const grantFolder = yearFolder.createFolder(grantId);
  
  // Copy templates
  const templatesFolder = DriveApp.getFolderById(config.templates_folder_id);
  
  const proposalTemplate = templatesFolder.getFilesByName('Proposal Template').next();
  const proposalDoc = proposalTemplate.makeCopy(`${grantId} - Proposal`, grantFolder);
  
  const notesTemplate = templatesFolder.getFilesByName('Internal Notes Template').next();
  const notesDoc = notesTemplate.makeCopy(`${grantId} - Internal Notes`, grantFolder);
  
  // Create Supporting Materials subfolder
  grantFolder.createFolder('Supporting Materials');
  
  return {
    folderId: grantFolder.getId(),
    folderUrl: grantFolder.getUrl(),
    proposalUrl: proposalDoc.getUrl(),
    notesUrl: notesDoc.getUrl()
  };
}

function getOrCreateFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

function getConfig() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const data = sheet.getDataRange().getValues();
  const config = {};
  for (const [key, value] of data.slice(1)) {
    config[key] = value;
  }
  return config;
}
```

### Script: `Validation.gs`

```javascript
/**
 * Validates grant ID uniqueness on edit.
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'Grants') return;
  
  const col = e.range.getColumn();
  const grantIdCol = 1; // Adjust based on actual column
  
  if (col === grantIdCol) {
    validateGrantIdUnique(e.range);
  }
}

function validateGrantIdUnique(cell) {
  const sheet = cell.getSheet();
  const grantId = cell.getValue();
  const allIds = sheet.getRange('A:A').getValues().flat().filter(Boolean);
  
  const count = allIds.filter(id => id === grantId).length;
  if (count > 1) {
    cell.setNote('⚠️ Duplicate grant ID!');
    cell.setBackground('#ffcccc');
  } else {
    cell.clearNote();
    cell.setBackground(null);
  }
}

/**
 * Custom menu for manual operations.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Grant Tracker')
    .addItem('Create Folder for Selected Grant', 'createFolderForSelected')
    .addItem('Validate All Grant IDs', 'validateAllGrantIds')
    .addToUi();
}

function createFolderForSelected() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  
  const grantId = sheet.getRange(row, 1).getValue(); // Adjust column
  const grantYear = sheet.getRange(row, 10).getValue(); // Adjust column
  
  if (!grantId || !grantYear) {
    SpreadsheetApp.getUi().alert('Please select a row with a grant ID and year.');
    return;
  }
  
  const result = createGrantFolder(grantId, grantYear);
  
  // Update the sheet with URLs
  sheet.getRange(row, 12).setValue(result.proposalUrl); // Adjust columns
  sheet.getRange(row, 13).setValue(result.notesUrl);
  sheet.getRange(row, 14).setValue(result.folderUrl);
  
  SpreadsheetApp.getUi().alert(`Folder created for ${grantId}`);
}
```

---

## GitHub Action for Report Tracking

### Approach

Each grantee with monthly reporting requirements has a GitHub repo. A GitHub Action runs on push to check for new monthly reports and updates the Google Sheet.

### Action: `.github/workflows/report-tracker.yml`

```yaml
name: Track Monthly Report

on:
  push:
    paths:
      - 'reports/**'
  workflow_dispatch:

jobs:
  track-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Detect new reports
        id: detect
        run: |
          # Find reports added in this push
          REPORTS=$(git diff --name-only HEAD~1 HEAD -- reports/ | grep -E 'reports/\d{4}-\d{2}' || true)
          if [ -n "$REPORTS" ]; then
            echo "reports_found=true" >> $GITHUB_OUTPUT
            # Extract periods (YYYY-MM format)
            PERIODS=$(echo "$REPORTS" | sed -E 's|reports/([0-9]{4}-[0-9]{2}).*|\1|' | sort -u | tr '\n' ',' | sed 's/,$//')
            echo "periods=$PERIODS" >> $GITHUB_OUTPUT
          fi
      
      - name: Update Google Sheet
        if: steps.detect.outputs.reports_found == 'true'
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GOOGLE_SERVICE_ACCOUNT }}
      
      - name: Mark reports received
        if: steps.detect.outputs.reports_found == 'true'
        run: |
          # Call Sheets API to update report status
          curl -X POST \
            "https://sheets.googleapis.com/v4/spreadsheets/${{ secrets.SHEET_ID }}/values/Reports!A:H:append?valueInputOption=USER_ENTERED" \
            -H "Authorization: Bearer $(gcloud auth print-access-token)" \
            -H "Content-Type: application/json" \
            -d '{
              "values": [
                ["'${{ github.repository }}'", "'${{ steps.detect.outputs.periods }}'", "Received", "'$(date -I)'"]
              ]
            }'
```

**Note:** This is a simplified example. Production implementation would:
- Look up the grant_id from the repo name
- Update existing report rows rather than appending
- Handle multiple periods in one push
- Include proper error handling

---

## API Patterns

### Sheets API: Reading Data

```typescript
// lib/api/sheets.ts

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';

export async function fetchGrants(accessToken: string): Promise<Grant[]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Grants!A:Z`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const data = await response.json();
  const [headers, ...rows] = data.values;
  
  return rows.map(row => rowToGrant(headers, row));
}

function rowToGrant(headers: string[], row: any[]): Grant {
  const obj: any = {};
  headers.forEach((header, i) => {
    obj[header] = row[i] ?? null;
  });
  return obj as Grant;
}
```

### Sheets API: Writing Data

```typescript
export async function updateGrant(
  accessToken: string,
  grantId: string,
  updates: Partial<Grant>
): Promise<void> {
  // First, find the row number for this grant
  const grants = await fetchGrants(accessToken);
  const rowIndex = grants.findIndex(g => g.grant_id === grantId);
  
  if (rowIndex === -1) {
    throw new Error(`Grant ${grantId} not found`);
  }
  
  const rowNumber = rowIndex + 2; // +1 for header, +1 for 1-indexed
  
  // Build the update range and values
  // This is simplified; production code would handle sparse updates better
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Grants!A${rowNumber}:Z${rowNumber}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [grantToRow(updates)]
      })
    }
  );
}
```

### Drive API: Creating Folders

```typescript
// lib/api/drive.ts

export async function createGrantFolder(
  accessToken: string,
  grantId: string,
  year: number,
  rootFolderId: string
): Promise<{ folderId: string; folderUrl: string }> {
  // Get or create year folder
  const yearFolderId = await getOrCreateFolder(accessToken, rootFolderId, year.toString());
  
  // Create grant folder
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: grantId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [yearFolderId]
      })
    }
  );
  
  const folder = await response.json();
  
  return {
    folderId: folder.id,
    folderUrl: `https://drive.google.com/drive/folders/${folder.id}`
  };
}
```

---

## Implementation Guidance for Claude Code

### Phase 1: Foundation
1. Set up Svelte project with Vite and Tailwind
2. Implement Google OAuth flow with scope handling
3. Create Sheets API wrapper with read/write operations
4. Build basic Grant list view with real data

### Phase 2: Core Views
1. Dashboard with pipeline summary
2. Grant detail page with permalinks
3. Status change functionality with history logging
4. Filter and search implementation

### Phase 3: Action Items & Reports
1. Action items CRUD
2. "My action items" filtered view
3. Reports tracking view
4. Manual "mark received" functionality

### Phase 4: Drive Integration
1. Folder creation (can be Apps Script or client-side)
2. Document creation from templates
3. Link management in grant records

### Phase 5: Polish
1. Budget allocation charts
2. Artifact management
3. Error handling and loading states
4. Mobile responsiveness (basic)

### Phase 6: GitHub Integration
1. GitHub Action for report detection
2. Service account setup documentation
3. Testing with sample repo

### Key Implementation Notes

**OAuth Token Management:**
- Use Google Identity Services (new library, not deprecated gapi)
- Store token in memory only (security)
- Handle token refresh gracefully
- Clear token on sign out

**Error Handling:**
- Sheets API rate limits: Implement exponential backoff
- Network failures: Show clear user feedback, allow retry
- Auth failures: Redirect to sign-in

**Optimistic Updates:**
- Update UI immediately on user action
- Sync to Sheets in background
- Revert on failure with user notification

**Spreadsheet ID Configuration:**
- Store in environment variable for build
- Or in a config file that's easy to change
- Document how to find/change the ID

---

## Security Considerations

1. **OAuth tokens never persisted** — Session only
2. **Team allowlist in Sheet** — Easy to update, no code change needed
3. **No service account in PWA** — All actions under user's identity
4. **GitHub Action uses separate service account** — Minimal permissions (Sheets write only)
5. **No sensitive data in client code** — Spreadsheet ID is not secret, but don't include API keys

---

## Testing Strategy

**Manual Testing Checklist:**
- [ ] OAuth flow works for allowed users
- [ ] OAuth rejects non-team users
- [ ] Grants load and display correctly
- [ ] Status changes persist to Sheet
- [ ] Action items CRUD works
- [ ] Permalinks resolve correctly
- [ ] Filters and search work
- [ ] Folder creation works (if implemented client-side)

**Sheet Validation Testing:**
- [ ] Duplicate grant ID shows warning
- [ ] Invalid status values rejected
- [ ] Required fields enforced

---

## Migration Notes

For migrating existing data:
1. Create new Sheet with Tables structure
2. Export current data to CSV
3. Transform column names to match schema
4. Import to new Sheet
5. Manually create Drive folders for active grants
6. Update URLs in Sheet

Alternatively, build a one-time migration script that:
- Reads old Sheet
- Creates folders for each grant
- Writes to new Sheet with proper structure

---

*Document version: 1.0*
*Last updated: 2025-01-18*
