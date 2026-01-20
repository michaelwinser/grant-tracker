# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app

# Install dependencies first (better layer caching)
COPY web/package*.json ./
RUN npm ci

# Build the app
COPY web/ ./
RUN npm run build

# Stage 2: Build Go server
FROM golang:1.23-alpine AS backend
WORKDIR /app

# Install dependencies first (better layer caching)
COPY server/go.* ./
RUN go mod download

# Build the server
COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Stage 3: Final minimal image
FROM alpine:3.20

# Install CA certificates for HTTPS calls to Google APIs
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy the server binary
COPY --from=backend /app/server .

# Copy the frontend build
COPY --from=frontend /app/dist ./static

# Set environment defaults
ENV PORT=8080
ENV STATIC_DIR=/app/static

EXPOSE 8080

CMD ["./server"]
