# Server Dockerfile for Telemedicine Platform
# Updated: 2025-10-29
FROM node:18-alpine

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install all dependencies (needed for knex migrations)
RUN npm install

# Copy all application files
COPY . .

# Debug: List what was copied
RUN echo "=== Files in /app ===" && ls -la /app && echo "=== Checking for index.js ===" && ls -la /app/index.js || echo "index.js NOT FOUND"

# Expose port 5000
EXPOSE 5000

# Start server (migrations run automatically via initializeDatabase function)
CMD ["node", "index.js"]
