FROM node:22-bookworm

# Install useful tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the project
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Default command: run dev server with host binding for container access
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
