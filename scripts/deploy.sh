#!/bin/bash
set -e

# Cloud Run deployment script
# Usage: ./scripts/deploy.sh <environment>
# Environments: staging, prod

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check for environment argument
ENV="${1:-}"
if [ -z "$ENV" ]; then
    echo "Usage: ./scripts/deploy.sh <environment>"
    echo ""
    echo "Environments:"
    echo "  staging   Deploy to grants-staging.alpha-omega.fund"
    echo "  prod      Deploy to grants.alpha-omega.fund"
    exit 1
fi

# Validate environment
if [ "$ENV" != "staging" ] && [ "$ENV" != "prod" ]; then
    echo "Error: Unknown environment '$ENV'"
    echo "Valid environments: staging, prod"
    exit 1
fi

# Load environment-specific config
ENV_FILE="$SCRIPT_DIR/envs/${ENV}.env"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
else
    echo "Error: Environment config not found: $ENV_FILE"
    echo "Copy scripts/envs/${ENV}.env.example to scripts/envs/${ENV}.env and fill in your values"
    exit 1
fi

# Validate required vars
if [ -z "$GCP_PROJECT_ID" ] || [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "Error: Missing required configuration"
    echo "Ensure GCP_PROJECT_ID, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET are set in $ENV_FILE"
    exit 1
fi

if [ -z "$REDIRECT_URI" ]; then
    echo "Error: REDIRECT_URI must be set in $ENV_FILE"
    exit 1
fi

# Defaults
GCP_REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-grant-tracker}"
IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}"

echo "=== Cloud Run Deployment ==="
echo "Environment: $ENV"
echo "Project:     $GCP_PROJECT_ID"
echo "Region:      $GCP_REGION"
echo "Service:     $SERVICE_NAME"
echo "Redirect:    $REDIRECT_URI"
echo "Image:       $IMAGE_NAME"
echo ""

# Check gcloud auth
echo "Checking gcloud authentication..."
if ! gcloud auth print-access-token &>/dev/null; then
    echo "Not authenticated. Run: ./gt gcp auth"
    exit 1
fi

# Set project
echo "Setting project..."
gcloud config set project "$GCP_PROJECT_ID"

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    --quiet

# Create Artifact Registry repository if it doesn't exist
echo "Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe "$SERVICE_NAME" \
    --location="$GCP_REGION" &>/dev/null || \
gcloud artifacts repositories create "$SERVICE_NAME" \
    --repository-format=docker \
    --location="$GCP_REGION" \
    --description="Grant Tracker container images ($ENV)"

# Build using Cloud Build (no local Docker needed)
echo "Building image with Cloud Build..."
cd "$PROJECT_ROOT"
gcloud builds submit \
    --tag "$IMAGE_NAME" \
    --quiet

# Create temp env vars file for Cloud Run (handles JSON and special chars properly)
ENV_VARS_FILE=$(mktemp)
trap "rm -f $ENV_VARS_FILE" EXIT

# Write basic env vars
printf 'GOOGLE_CLIENT_ID: "%s"\n' "$GOOGLE_CLIENT_ID" > "$ENV_VARS_FILE"
printf 'GOOGLE_CLIENT_SECRET: "%s"\n' "$GOOGLE_CLIENT_SECRET" >> "$ENV_VARS_FILE"
printf 'REDIRECT_URI: "%s"\n' "$REDIRECT_URI" >> "$ENV_VARS_FILE"

# Add service account key using YAML literal block scalar to preserve JSON exactly
if [ -n "$GOOGLE_SERVICE_ACCOUNT_KEY" ]; then
    printf 'GOOGLE_SERVICE_ACCOUNT_KEY: |-\n' >> "$ENV_VARS_FILE"
    printf '  %s\n' "$GOOGLE_SERVICE_ACCOUNT_KEY" >> "$ENV_VARS_FILE"
fi
if [ -n "$SPREADSHEET_ID" ]; then
    printf 'SPREADSHEET_ID: "%s"\n' "$SPREADSHEET_ID" >> "$ENV_VARS_FILE"
fi
if [ -n "$GRANTS_FOLDER_ID" ]; then
    printf 'GRANTS_FOLDER_ID: "%s"\n' "$GRANTS_FOLDER_ID" >> "$ENV_VARS_FILE"
fi

# Deploy to Cloud Run with all environment variables set at once
echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_NAME" \
    --region "$GCP_REGION" \
    --platform managed \
    --allow-unauthenticated \
    --env-vars-file "$ENV_VARS_FILE" \
    --quiet

# Get the service URL (for display only - we use the configured REDIRECT_URI)
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$GCP_REGION" \
    --format 'value(status.url)')

echo ""
echo "=== Deployment Complete ==="
echo "Environment:  $ENV"
echo "Service URL:  $SERVICE_URL"
echo "Redirect URI: $REDIRECT_URI"
echo ""

# Extract domain from redirect URI for reminder
DOMAIN=$(echo "$REDIRECT_URI" | sed -E 's|https?://([^/]+).*|\1|')
if [ "$SERVICE_URL" != "https://$DOMAIN" ]; then
    echo "NOTE: Using custom domain. Ensure DNS is configured for: $DOMAIN"
    echo ""
fi

echo "Ensure this redirect URI is registered in your OAuth client:"
echo "  $REDIRECT_URI"
echo ""
echo "GCP Console: https://console.cloud.google.com/apis/credentials"
echo ""
echo "Done! Your app is live at: https://$DOMAIN"
