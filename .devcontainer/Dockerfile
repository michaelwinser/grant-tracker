FROM node:22-bookworm

# Install useful tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    jq \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Google Cloud CLI
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
    | tee /etc/apt/sources.list.d/google-cloud-sdk.list \
    && curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
    | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && apt-get update && apt-get install -y google-cloud-cli \
    && rm -rf /var/lib/apt/lists/*

# Set working directory (web app lives in /workspace/web)
WORKDIR /workspace/web

# Expose Vite dev server port
EXPOSE 5173

# Copy entrypoint script
COPY .devcontainer/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

# Default command: run dev server with host binding for container access
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
