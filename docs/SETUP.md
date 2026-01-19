# Grant Tracker Setup Guide

This guide walks you through setting up Grant Tracker from a fresh clone to a running application.

## Prerequisites

- **Docker** — [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Git** — For cloning and version control
- **Google Account** — With access to Google Cloud Console
- **Text Editor** — For editing configuration files

## Quick Start

If you're familiar with the stack, here's the abbreviated version:

```bash
git clone <repo-url> && cd grant-tracker
cp scripts/gcp-config.env.example scripts/gcp-config.env  # Edit this
./gt build
./gt gcp auth          # Run in terminal (interactive)
./gt gcp setup
# Configure OAuth consent screen and create client in GCP Console
echo "VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com" > web/.env.local
./gt start
```

---

## Detailed Setup

### Step 1: Clone and Configure

```bash
git clone <repo-url>
cd grant-tracker
```

Copy the GCP configuration template:

```bash
cp scripts/gcp-config.env.example scripts/gcp-config.env
```

Edit `scripts/gcp-config.env` with your values:

```bash
GCP_PROJECT_ID="your-project-id"        # Must be globally unique
GCP_PROJECT_NAME="Grant Tracker"
OAUTH_APP_NAME="Grant Tracker"
GITHUB_PAGES_URL="https://your-org.github.io/grant-tracker"
SUPPORT_EMAIL="your-email@example.com"
```

**Note:** `GCP_PROJECT_ID` must be globally unique across all of Google Cloud. Use something like `grant-tracker-yourorg` or add random characters.

### Step 2: Build the Dev Container

```bash
./gt build
```

This builds a Docker container with:
- Node.js 22
- Google Cloud CLI
- Required tools (jq, git, curl)

### Step 3: Authenticate with Google Cloud

```bash
./gt gcp auth
```

**Important:** This command requires an interactive terminal. Run it directly in your terminal (not through an automated tool).

The browser-less flow works as follows:
1. A URL is displayed
2. Open that URL in your browser
3. Sign in with your Google account
4. Copy the authorization code
5. Paste it back into the terminal

Your credentials are stored in the local `.gcloud/` directory (gitignored), so they persist across container rebuilds.

### Step 4: Create GCP Project and Enable APIs

```bash
./gt gcp setup
```

This script:
- Creates the GCP project (or skips if it exists)
- Enables required APIs:
  - Google Sheets API v4
  - Google Drive API v3
  - Google Picker API

**Troubleshooting:**
- If project creation fails, the ID may already be taken — choose a different one
- Billing is optional for basic usage; the script will warn but continue

### Step 5: Configure OAuth

#### 5a: OAuth Consent Screen

1. Go to: `https://console.cloud.google.com/apis/credentials/consent?project=YOUR_PROJECT_ID`
2. Select **External** (or Internal if using Google Workspace)
3. Fill in:
   - App name: `Grant Tracker`
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue**
5. On Scopes screen, click **Add or Remove Scopes** and add:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/userinfo.email`
6. Click **Save and Continue**
7. On Test Users screen, add your email (and team members)
8. Click **Save and Continue**

**Note on Scopes:** We use `drive.file` instead of `spreadsheets` because it provides access only to files the app creates or that the user explicitly selects via the Picker. This is more privacy-respecting and follows the principle of least privilege.

#### 5b: Create OAuth Client ID

1. Go to: `https://console.cloud.google.com/apis/credentials?project=YOUR_PROJECT_ID`
2. Click **Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: `Grant Tracker`
5. Authorized JavaScript origins:
   - `http://localhost:5173` (development)
   - Your production URL (add later)
6. Leave Authorized redirect URIs empty
7. Click **Create**
8. **Copy the Client ID** — you'll need this in Step 6

### Step 6: Configure Environment Variables

Create the local environment file:

```bash
echo "VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com" > web/.env.local
```

Replace with your actual Client ID from Step 5b.

**Note:** No spreadsheet ID is needed in the environment. Users will select or create their spreadsheet through the app's UI using Google Picker.

### Step 7: Start Development Server

```bash
./gt start
```

Open http://localhost:5173 in your browser.

### Step 8: Connect a Spreadsheet

On first use, the app will prompt you to either:
- **Select an existing spreadsheet** via Google Picker
- **Create a new spreadsheet** which the app will initialize with the required schema

The spreadsheet ID is stored in your browser's localStorage, so each user can connect to their own or a shared spreadsheet.

---

## Production Deployment

### Update OAuth for Production

1. Go to **APIs & Services > Credentials** in Google Cloud Console
2. Edit your OAuth client
3. Add your production URL to **Authorized JavaScript origins**:
   - `https://your-org.github.io`

### Configure GitHub Secrets

In your GitHub repository:

1. Go to **Settings > Secrets and variables > Actions**
2. Add this secret:
   - `VITE_GOOGLE_CLIENT_ID` — Your OAuth client ID

### Deploy

Push to main branch:

```bash
git push origin main
```

The GitHub Action will build and deploy to GitHub Pages automatically.

### Publish OAuth App (Optional)

While in "Testing" mode, only users listed as test users can sign in. To allow anyone:

1. Go to **OAuth consent screen**
2. Click **Publish App**
3. Confirm the warning

**Note:** For internal tools, you may prefer to keep it in testing mode and manage users manually.

---

## Verification Checklist

- [ ] `./gt build` completes successfully
- [ ] `./gt gcp auth` authenticates (run in terminal)
- [ ] `./gt gcp setup` creates project and enables APIs
- [ ] OAuth consent screen configured with `drive.file` and `userinfo.email` scopes
- [ ] OAuth client ID created with localhost origin
- [ ] `web/.env.local` contains `VITE_GOOGLE_CLIENT_ID`
- [ ] `./gt start` launches dev server
- [ ] Can sign in with Google at localhost:5173
- [ ] Can select or create a spreadsheet in the app

---

## Troubleshooting

### "OAuth client not found" or "redirect_uri_mismatch"
- Verify `http://localhost:5173` is in Authorized JavaScript origins
- Check for typos in the Client ID

### "Access blocked: This app's request is invalid"
- Ensure you're listed as a test user on the OAuth consent screen
- Or publish the app (see: Publish OAuth App)

### "Not logged in to gcloud" when running setup
- Run `./gt gcp auth` in your terminal (requires interactive input)
- Credentials are stored in `.gcloud/` directory

### Container build fails
- Ensure Docker is running
- Try `docker system prune` to free up space

### gcloud auth fails
- Check your internet connection
- Make sure you're running `./gt gcp auth` in an interactive terminal
- Copy the full authorization code (it's long)

---

## Next Steps

- Review `docs/DESIGN.md` for the full data model
- Open `mockups/index.html` to see the UI direction
- Start building features (see Implementation Guidance in DESIGN.md)
