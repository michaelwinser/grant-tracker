#!/bin/bash
set -e

# Change to web directory if it exists (for npm commands)
if [ -d "/workspace/web" ]; then
    cd /workspace/web
fi

# Install dependencies if node_modules is missing or package.json is newer
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
fi

exec "$@"
