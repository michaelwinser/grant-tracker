#!/bin/bash
set -euo pipefail

# Create OAuth 2.0 credentials for Grant Tracker
# Run after gcp-setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
if [[ -f "$SCRIPT_DIR/gcp-config.env" ]]; then
    source "$SCRIPT_DIR/gcp-config.env"
else
    echo "Error: scripts/gcp-config.env not found"
    exit 1
fi

: "${GCP_PROJECT_ID:?GCP_PROJECT_ID must be set}"
: "${OAUTH_APP_NAME:?OAUTH_APP_NAME must be set}"
: "${GITHUB_PAGES_URL:?GITHUB_PAGES_URL must be set}"

# Ensure we're using the right project
gcloud config set project "$GCP_PROJECT_ID"

echo "=== OAuth Configuration ==="
echo "Project: $GCP_PROJECT_ID"
echo "App Name: $OAUTH_APP_NAME"
echo ""

# OAuth consent screen configuration
# Note: Some consent screen settings can only be configured via Console
echo "Configuring OAuth consent screen..."

# Create OAuth brand (consent screen) if it doesn't exist
# This is limited - full configuration requires Console
if ! gcloud iap oauth-brands list --format="value(name)" 2>/dev/null | grep -q .; then
    echo "Note: OAuth consent screen must be configured in Console:"
    echo "  https://console.cloud.google.com/apis/credentials/consent?project=$GCP_PROJECT_ID"
    echo ""
    echo "Required settings:"
    echo "  - User Type: External (or Internal if using Workspace)"
    echo "  - App name: $OAUTH_APP_NAME"
    echo "  - User support email: your email"
    echo "  - Developer contact: your email"
    echo "  - Scopes: (add these)"
    echo "      - https://www.googleapis.com/auth/spreadsheets"
    echo "      - https://www.googleapis.com/auth/drive.file"
    echo ""
fi

# Define authorized origins
ORIGINS=(
    "http://localhost:5173"           # Vite dev server
    "http://localhost:4173"           # Vite preview server
)

# Add GitHub Pages URL if configured
if [[ -n "${GITHUB_PAGES_URL:-}" ]]; then
    ORIGINS+=("$GITHUB_PAGES_URL")
fi

echo "Authorized JavaScript origins:"
for origin in "${ORIGINS[@]}"; do
    echo "  - $origin"
done
echo ""

# Create OAuth client ID
# Note: gcloud doesn't have direct support for creating OAuth clients
# We need to use the API directly or provide instructions

echo "=== Creating OAuth 2.0 Client ID ==="
echo ""
echo "Unfortunately, gcloud CLI cannot create OAuth 2.0 client IDs directly."
echo "You have two options:"
echo ""
echo "Option 1: Use the Console (recommended for first setup)"
echo "  https://console.cloud.google.com/apis/credentials?project=$GCP_PROJECT_ID"
echo "  1. Click 'Create Credentials' > 'OAuth client ID'"
echo "  2. Application type: 'Web application'"
echo "  3. Name: '$OAUTH_APP_NAME'"
echo "  4. Authorized JavaScript origins:"
for origin in "${ORIGINS[@]}"; do
    echo "       - $origin"
done
echo "  5. Authorized redirect URIs: (leave empty for implicit flow)"
echo "  6. Click Create and save the Client ID"
echo ""
echo "Option 2: Use the REST API (can be scripted)"
echo "  See: scripts/gcp-oauth-api.sh (if you need full automation)"
echo ""

# Generate the REST API script for those who want full automation
cat > "$SCRIPT_DIR/gcp-oauth-api.sh" << 'SCRIPT'
#!/bin/bash
set -euo pipefail

# Create OAuth client using REST API
# This requires an access token with appropriate permissions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/gcp-config.env"

ACCESS_TOKEN=$(gcloud auth print-access-token)

# Build origins JSON array
ORIGINS_JSON=$(printf '%s\n' "${ORIGINS[@]}" | jq -R . | jq -s .)

# Create the OAuth client
curl -s -X POST \
  "https://oauth2.googleapis.com/v2/projects/${GCP_PROJECT_ID}/oauthClients" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"displayName\": \"${OAUTH_APP_NAME}\",
    \"applicationType\": \"WEB\",
    \"allowedOrigins\": ${ORIGINS_JSON}
  }"

echo ""
echo "OAuth client created. Check output above for client ID."
SCRIPT

chmod +x "$SCRIPT_DIR/gcp-oauth-api.sh"

echo "Created scripts/gcp-oauth-api.sh for REST API approach"
echo ""
echo "After creating the OAuth client, add the Client ID to your app:"
echo "  - For development: add to .env.local"
echo "  - For production: add to GitHub repository secrets"
echo ""
