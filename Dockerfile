# Base image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./

# Delete potentially corrupted package-lock.json and install dependencies
RUN rm -f package-lock.json && npm install

# Copy remaining frontend files
COPY frontend/ ./

# Verify important files before build
RUN test -f public/index.html || (echo "Error: public/index.html missing!" && exit 1)

# Build project
RUN npm run build

# Production image
FROM nginx:alpine

# Copy build results to nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
