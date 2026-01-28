# Service Account Architecture Design

## Status: Proposed

## Overview

This document describes a redesign of Grant Tracker's authentication and authorization model to use a service account for Google API operations, replacing the current per-user OAuth token approach.

### Problem Statement

The current architecture uses individual users' OAuth tokens with `drive.file` scope to access Google Sheets and Drive. This creates several issues:

1. **Fragmented access**: Each user can only see files they've explicitly opened through the app
2. **Inconsistent views**: Different users see different files in the same folder
3. **Permission confusion**: Users can accidentally deny required permissions
4. **Complex scope management**: Balancing security (`drive.file`) vs. usability (`drive.readonly`)

### Solution

Separate authentication (who is the user?) from authorization (what can they access?):

- **User OAuth**: Identity verification only (`email profile drive.metadata.readonly`)
- **Service Account**: All data operations (Sheets, Drive)
- **Drive Permissions**: Source of truth for user authorization

## Architecture

### Current Architecture

```
┌─────────────┐     OAuth token      ┌─────────────┐
│   Browser   │ ──────────────────>  │ Google APIs │
│             │   (user's token)     │             │
│  drive.file │                      │ Sheets/Drive│
└─────────────┘                      └─────────────┘
     │
     └── Each user has different access based on what they've "opened"
```

### Proposed Architecture

```
┌─────────────┐                      ┌─────────────┐                      ┌─────────────┐
│   Browser   │ ────── session ────> │   Backend   │ ── service acct ──> │ Google APIs │
│             │                      │  (Cloud Run)│                      │             │
│ email       │                      │             │                      │ Sheets/Drive│
│ profile     │                      │ 1. Verify   │                      │             │
│ drive.meta  │                      │    session  │                      └─────────────┘
└─────────────┘                      │ 2. Check    │                             ↑
                                     │    Drive    │                             │
                                     │    access   │                             │
                                     │ 3. Execute  │─────────────────────────────┘
                                     │    with SA  │   (service account has
                                     └─────────────┘    Editor access to folder)
```

## Authentication Flow

### User Sign-In

1. User clicks "Sign In"
2. Google OAuth consent screen requests:
   - `email` - User's email address
   - `profile` - User's name and picture
   - `drive.metadata.readonly` - Check file/folder access (no read/write)
3. User grants permissions
4. Backend receives OAuth tokens, creates session
5. User info stored in session cookie

### Scopes Comparison

| Scope | Current | Proposed | Purpose |
|-------|---------|----------|---------|
| `email` | Yes | Yes | Identify user |
| `profile` | Yes | Yes | Display name/picture |
| `drive.file` | Yes | **No** | Was: access files opened via app |
| `drive.readonly` | Optional | **No** | Was: see all files |
| `drive.metadata.readonly` | No | **Yes** | Verify user can access folder |

## Authorization Model

### Principle

**Drive permissions are the source of truth.** If a user has access to the root folder in Google Drive, they can use the app. If they don't, they can't.

### Authorization Check

On each API request:

```javascript
async function requireDriveAccess(req, res, next) {
  const userToken = req.session.accessToken;
  const folderId = process.env.GRANTS_FOLDER_ID;

  // Use USER's token to verify they have Drive access
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id`,
    { headers: { Authorization: `Bearer ${userToken}` } }
  );

  if (!response.ok) {
    return res.status(403).json({
      error: 'Access denied. You do not have permission to this Grant Tracker instance.'
    });
  }

  // User has access - proceed with service account for actual operations
  next();
}
```

### Why This Works

| Scenario | Outcome |
|----------|---------|
| User has folder access in Drive | `drive.metadata.readonly` check succeeds → app works |
| User removed from folder | Check fails → immediate access revocation |
| User never had access | Check fails → cannot use app |
| Service account has access but user doesn't | Check fails → user blocked |

### No Allowlist Required

The previous allowlist (email list in config) is **no longer needed**. Drive's sharing permissions serve this purpose and are easier to manage through Drive's native UI.

## API Design

### Backend Endpoints

All endpoints require authenticated session + Drive access verification.

#### Sheets Operations

```
POST /api/sheets/read
Body: { sheet: "Grants", range?: "A1:Z" }
Response: { rows: [...] }

POST /api/sheets/append
Body: { sheet: "Grants", row: {...} }
Response: { success: true }

POST /api/sheets/update
Body: { sheet: "Grants", idColumn: "ID", id: "GRANT-123", data: {...} }
Response: { success: true }

POST /api/sheets/delete
Body: { sheet: "Grants", idColumn: "ID", id: "GRANT-123" }
Response: { success: true }
```

#### Drive Operations

```
POST /api/drive/list
Body: { folderId: "..." }
Response: { files: [...] }

POST /api/drive/create-folder
Body: { name: "GRANT-2026-Example", parentId: "..." }
Response: { id: "...", url: "..." }

POST /api/drive/create-doc
Body: { name: "...", parentId: "...", mimeType: "..." }
Response: { id: "...", url: "..." }

POST /api/drive/create-shortcut
Body: { targetId: "...", parentId: "..." }
Response: { id: "..." }
```

#### Configuration

```
GET /api/config
Response: {
  spreadsheetId: "...",
  grantsFolderId: "...",
  // Note: IDs exposed since user already has Drive access
}
```

### Frontend API Client

```javascript
// lib/api/client.js
async function apiRequest(endpoint, data) {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include', // Send session cookie
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (response.status === 401) {
    // Session expired - redirect to login
    window.location.href = '/';
    return;
  }

  if (response.status === 403) {
    // No Drive access
    throw new Error('Access denied. Contact your administrator.');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

// Usage
const grants = await apiRequest('/api/sheets/read', { sheet: 'Grants' });
```

## Service Account Setup

### 1. Create Service Account

```bash
# In GCP Console or via gcloud
gcloud iam service-accounts create grant-tracker-app \
  --display-name="Grant Tracker App"
```

This creates: `grant-tracker-app@PROJECT_ID.iam.gserviceaccount.com`

### 2. Credential Options

#### Option A: Workload Identity (Recommended for Cloud Run)

No key file needed. Cloud Run automatically provides credentials.

```bash
# Grant the Cloud Run service account permission to impersonate
gcloud iam service-accounts add-iam-policy-binding \
  grant-tracker-app@PROJECT_ID.iam.gserviceaccount.com \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Configure Cloud Run to use the service account:
```bash
gcloud run services update grant-tracker \
  --service-account=grant-tracker-app@PROJECT_ID.iam.gserviceaccount.com
```

#### Option B: JSON Key (Simpler, less secure)

```bash
gcloud iam service-accounts keys create sa-key.json \
  --iam-account=grant-tracker-app@PROJECT_ID.iam.gserviceaccount.com
```

Store in Secret Manager:
```bash
gcloud secrets create grant-tracker-sa-key --data-file=sa-key.json
rm sa-key.json  # Don't keep local copy
```

### 3. Share Resources with Service Account

In Google Drive / Sheets UI:

1. **Spreadsheet**: Share with `grant-tracker-app@PROJECT_ID.iam.gserviceaccount.com` as **Editor**
2. **Grants Folder**: Share with same email as **Editor**

This is a one-time admin setup task.

## Configuration

### Environment Variables

```bash
# Required
SPREADSHEET_ID=1ABC...xyz           # The Grant Tracker spreadsheet
GRANTS_FOLDER_ID=1DEF...xyz         # Root folder for grant folders
GOOGLE_CLIENT_ID=123...apps.com     # OAuth client ID (for user auth)
GOOGLE_CLIENT_SECRET=GOCSPX-...     # OAuth client secret

# Service Account (if using JSON key method)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # JSON key contents
# OR
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json           # Path to key file

# Optional
NODE_ENV=production
PORT=8080
```

### Deployment Binding

Each deployment is bound to exactly one spreadsheet and folder via environment variables. This enables:

- **Staging**: Points to test spreadsheet/folder
- **Production**: Points to real data
- **Multiple orgs**: Separate deployments with separate configs

## Audit Logging

Since the service account performs all operations, we lose the automatic "who did this" tracking from Google's audit logs. The app should implement its own audit logging.

### Approach

```javascript
async function logAudit(req, action, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    user: req.session.user.email,
    action,  // e.g., "grant.create", "grant.update", "status.change"
    details, // e.g., { grantId: "...", field: "Status", from: "Draft", to: "Active" }
    ip: req.ip,
  };

  // Option 1: Write to a separate "AuditLog" sheet
  await appendToSheet('AuditLog', entry);

  // Option 2: Write to Cloud Logging
  console.log(JSON.stringify({ severity: 'INFO', ...entry }));
}
```

### StatusHistory Sheet

The existing StatusHistory sheet pattern should continue to work, but the "Changed_By" field should be populated from the session user, not the service account.

## Migration Plan

### Phase 1: Backend Infrastructure [DONE]

1. [x] OpenAPI spec created (`api/openapi.yaml`)
2. [x] Go server code generated with oapi-codegen
3. [x] API server implementation (`server/api/server.go`)
4. [x] Authorization middleware (RequireAuth, RequireDriveAccess)
5. [x] TypeScript client generated with openapi-typescript-codegen
6. [ ] Create service account in GCP
7. [ ] Test with service account credentials

### Phase 2: Frontend Migration [IN PROGRESS]

1. [x] Create new API client module (`web/src/lib/api/backend.js`)
2. [x] Create unified API clients (`sheets-unified.js`, `drive-unified.js`)
3. [x] Update config store to track `serviceAccountEnabled`, `spreadsheetId`, `grantsFolderId`
4. [x] Update grants store to use unified client
5. [x] Update actionItems store to use unified client
6. [ ] Update remaining stores (reports, artifacts, statusHistory, etc.)
7. [ ] Update components using Drive API directly
8. [ ] Simplify OAuth to identity-only scopes
9. [ ] Remove extended access toggle (no longer needed)

### Phase 3: Cleanup

1. [ ] Remove direct Google API calls from frontend
2. [ ] Remove Picker for spreadsheet selection (now configured via env)
3. [ ] Update documentation
4. [ ] Remove unused auth code

### Rollout Strategy

1. Deploy backend with new endpoints (existing functionality unchanged)
2. Add feature flag: `USE_SERVICE_ACCOUNT=true`
3. Test thoroughly with flag enabled
4. Enable flag in staging
5. Enable flag in production
6. Remove old code paths

## Security Considerations

### Service Account Key Protection

- Never commit keys to git
- Use Secret Manager or Workload Identity
- Rotate keys periodically if using JSON key method
- Restrict key usage to Cloud Run service only

### Session Security

- HTTP-only cookies for session tokens
- Secure flag in production
- Reasonable session expiry (e.g., 8 hours)
- CSRF protection on state-changing endpoints

### Authorization Check Caching

To avoid checking Drive access on every request:

```javascript
// Cache authorization for 5 minutes
const authCache = new Map();

async function checkDriveAccess(userEmail, userToken, folderId) {
  const cacheKey = `${userEmail}:${folderId}`;
  const cached = authCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.hasAccess;
  }

  const hasAccess = await verifyDriveAccess(userToken, folderId);

  authCache.set(cacheKey, {
    hasAccess,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  return hasAccess;
}
```

### What's NOT Changing

- HTTPS everywhere
- Google OAuth for user identity
- Drive permissions model (users must have folder access)
- Data stays in user's Google Workspace

## Open Questions

1. **Picker for attachments**: Should we keep the file picker for adding attachments, or require users to add files directly in Drive?

2. **Offline/degraded mode**: What happens if the backend is unavailable? Currently the app works client-side only.

3. **Rate limiting**: Should we implement rate limiting on the backend to prevent abuse?

## Appendix: File Changes Summary

### New Files

```
server/
├── middleware/
│   └── requireDriveAccess.js
├── services/
│   ├── sheetsService.js      # Service account Sheets operations
│   └── driveService.js       # Service account Drive operations
└── routes/
    ├── sheets.js             # /api/sheets/* endpoints
    └── drive.js              # /api/drive/* endpoints

web/src/lib/api/
└── client.js                 # Backend API client
```

### Modified Files

```
server/
└── index.js                  # Add new routes

web/src/lib/
├── api/
│   └── auth.js               # Simplify scopes
├── stores/
│   ├── grants.svelte.js      # Use backend API
│   ├── actionItems.svelte.js # Use backend API
│   └── ...                   # Other stores
└── components/
    └── UserMenu.svelte       # Remove extended access toggle
```

### Removed (Eventually)

```
web/src/lib/api/
├── sheetsClient.js           # Direct Google Sheets calls
├── drive.js                  # Direct Google Drive calls (most of it)
└── picker.js                 # Spreadsheet picker (folder picker may stay)
```
