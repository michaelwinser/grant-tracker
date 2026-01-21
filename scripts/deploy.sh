#!/bin/bash
set -e

# Cloud Run deployment script
# Run from project root: ./scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load config
if [ -f "$SCRIPT_DIR/gcp-config.env" ]; then
    source "$SCRIPT_DIR/gcp-config.env"
else
    echo "Error: scripts/gcp-config.env not found"
    echo "Copy scripts/gcp-config.env.example to scripts/gcp-config.env and fill in your values"
    exit 1
fi

# Validate required vars
if [ -z "$GCP_PROJECT_ID" ] || [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "Error: Missing required configuration"
    echo "Ensure GCP_PROJECT_ID, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET are set in gcp-config.env"
    exit 1
fi

# Defaults
GCP_REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-grant-tracker}"
IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}"

echo "=== Cloud Run Deployment ==="
echo "Project:  $GCP_PROJECT_ID"
echo "Region:   $GCP_REGION"
echo "Service:  $SERVICE_NAME"
echo "Image:    $IMAGE_NAME"
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
    --description="Grant Tracker container images"

# Build using Cloud Build (no local Docker needed)
echo "Building image with Cloud Build..."
cd "$PROJECT_ROOT"
gcloud builds submit \
    --tag "$IMAGE_NAME" \
    --quiet

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_NAME" \
    --region "$GCP_REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
    --set-env-vars "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}" \
    --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$GCP_REGION" \
    --format 'value(status.url)')

echo ""
echo "=== Deployment Complete ==="
echo "Service URL: $SERVICE_URL"
echo ""
echo "IMPORTANT: Add this redirect URI to your OAuth client in GCP Console:"
echo "  ${SERVICE_URL}/auth/callback"
echo ""
echo "Go to: https://console.cloud.google.com/apis/credentials"
echo "Edit your OAuth 2.0 Client ID and add the redirect URI above."

# Update the service with the correct redirect URI
echo ""
echo "Updating service with correct REDIRECT_URI..."
gcloud run services update "$SERVICE_NAME" \
    --region "$GCP_REGION" \
    --update-env-vars "REDIRECT_URI=${SERVICE_URL}/auth/callback" \
    --quiet

echo ""
echo "Done! Your app is live at: $SERVICE_URL"
