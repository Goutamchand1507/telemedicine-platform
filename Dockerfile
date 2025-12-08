# Server Dockerfile for Telemedicine Platform
# This Dockerfile is at the root but builds the server directory
FROM node:18-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install all dependencies
RUN npm install

# Copy all server files
COPY server/ ./

# Debug: List what was copied
RUN echo "=== Files in /app ===" && ls -la /app && echo "=== Checking for index.js ===" && ls -la /app/index.js || echo "index.js NOT FOUND"

# Expose port 5000
EXPOSE 5000

# Start server (migrations run automatically via initializeDatabase function)
CMD ["node", "index.js"]
