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
SECRET_NAME="${SERVICE_NAME}-sa-key"

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
    secretmanager.googleapis.com \
    --quiet

# Create Artifact Registry repository if it doesn't exist
echo "Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe "$SERVICE_NAME" \
    --location="$GCP_REGION" &>/dev/null || \
gcloud artifacts repositories create "$SERVICE_NAME" \
    --repository-format=docker \
    --location="$GCP_REGION" \
    --description="Grant Tracker container images ($ENV)"

# Handle service account key via Secret Manager (avoids shell escaping issues)
SECRET_MOUNT_ARG=""
SA_ENV_ARG=""
if [ -n "$GOOGLE_SERVICE_ACCOUNT_KEY" ]; then
    echo "Setting up service account key in Secret Manager..."

    # Check if secret exists
    if gcloud secrets describe "$SECRET_NAME" &>/dev/null; then
        echo "  Secret '$SECRET_NAME' exists, adding new version..."
        echo "$GOOGLE_SERVICE_ACCOUNT_KEY" | gcloud secrets versions add "$SECRET_NAME" --data-file=-
    else
        echo "  Creating secret '$SECRET_NAME'..."
        echo "$GOOGLE_SERVICE_ACCOUNT_KEY" | gcloud secrets create "$SECRET_NAME" --data-file=-
    fi

    # Get the project number for the compute service account
    PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
    COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

    # Grant Cloud Run's service account access to read the secret
    echo "  Granting secret access to Cloud Run service account..."
    gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
        --member="serviceAccount:${COMPUTE_SA}" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet 2>/dev/null || true

    # Build the secret mount argument for Cloud Run
    SECRET_MOUNT_ARG="--set-secrets=/secrets/service-account.json=${SECRET_NAME}:latest"
    SA_ENV_ARG="GOOGLE_APPLICATION_CREDENTIALS=/secrets/service-account.json"
fi

# Build using Cloud Build (no local Docker needed)
echo "Building image with Cloud Build..."
cd "$PROJECT_ROOT"
gcloud builds submit \
    --tag "$IMAGE_NAME" \
    --quiet

# Build env vars for simple values (no JSON/special chars)
ENV_VARS="GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
ENV_VARS="${ENV_VARS},GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
ENV_VARS="${ENV_VARS},REDIRECT_URI=${REDIRECT_URI}"

if [ -n "$SA_ENV_ARG" ]; then
    ENV_VARS="${ENV_VARS},${SA_ENV_ARG}"
fi
if [ -n "$SPREADSHEET_ID" ]; then
    ENV_VARS="${ENV_VARS},SPREADSHEET_ID=${SPREADSHEET_ID}"
fi
if [ -n "$GRANTS_FOLDER_ID" ]; then
    ENV_VARS="${ENV_VARS},GRANTS_FOLDER_ID=${GRANTS_FOLDER_ID}"
fi

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
DEPLOY_CMD="gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --region $GCP_REGION \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars $ENV_VARS"

# Add secret mount if configured
if [ -n "$SECRET_MOUNT_ARG" ]; then
    DEPLOY_CMD="$DEPLOY_CMD $SECRET_MOUNT_ARG"
fi

DEPLOY_CMD="$DEPLOY_CMD --quiet"

# Execute deploy
eval $DEPLOY_CMD

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
