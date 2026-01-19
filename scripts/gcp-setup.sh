#!/bin/bash
set -euo pipefail

# Google Cloud Project Setup for Grant Tracker
# Run this once to create and configure the GCP project

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
if [[ -f "$SCRIPT_DIR/gcp-config.env" ]]; then
    source "$SCRIPT_DIR/gcp-config.env"
else
    echo "Error: scripts/gcp-config.env not found"
    echo "Copy scripts/gcp-config.env.example to scripts/gcp-config.env and fill in values"
    exit 1
fi

# Validate required variables
: "${GCP_PROJECT_ID:?GCP_PROJECT_ID must be set in gcp-config.env}"
: "${GCP_PROJECT_NAME:?GCP_PROJECT_NAME must be set in gcp-config.env}"

echo "=== Grant Tracker GCP Setup ==="
echo "Project ID: $GCP_PROJECT_ID"
echo "Project Name: $GCP_PROJECT_NAME"
echo ""

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "Not logged in to gcloud."
    echo "Run './gt gcp auth' first, then re-run this script."
    echo ""
    echo "  ./gt gcp auth   # Opens a URL to copy into your browser"
    exit 1
fi

# Create project (or skip if exists)
echo "Creating project..."
if gcloud projects describe "$GCP_PROJECT_ID" &>/dev/null; then
    echo "Project $GCP_PROJECT_ID already exists, skipping creation"
else
    gcloud projects create "$GCP_PROJECT_ID" --name="$GCP_PROJECT_NAME"
    echo "Project created"
fi

# Set as active project
gcloud config set project "$GCP_PROJECT_ID"

# Check if billing is enabled
echo ""
echo "Checking billing..."
BILLING_ACCOUNT=$(gcloud billing accounts list --filter=open=true --format="value(name)" --limit=1)
if [[ -n "$BILLING_ACCOUNT" ]]; then
    if gcloud billing projects describe "$GCP_PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null | grep -q "True"; then
        echo "Billing already enabled"
    else
        echo "Linking billing account: $BILLING_ACCOUNT"
        gcloud billing projects link "$GCP_PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
    fi
else
    echo "WARNING: No billing account found. Some APIs may not work."
    echo "Enable billing at: https://console.cloud.google.com/billing/linkedaccount?project=$GCP_PROJECT_ID"
fi

# Enable required APIs
echo ""
echo "Enabling APIs..."
APIS=(
    "sheets.googleapis.com"        # Google Sheets API v4
    "drive.googleapis.com"         # Google Drive API v3
    "picker.googleapis.com"        # Google Picker API (for file selection UI)
)

for api in "${APIS[@]}"; do
    echo "  Enabling $api..."
    gcloud services enable "$api" --quiet
done

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Run scripts/gcp-oauth.sh to create OAuth credentials"
echo "  2. Configure the OAuth consent screen (some steps require console):"
echo "     https://console.cloud.google.com/apis/credentials/consent?project=$GCP_PROJECT_ID"
echo ""
