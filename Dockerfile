# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Accept CORS_ORIGIN as build argument
ARG CORS_ORIGIN
# Set it as environment variable
ENV CORS_ORIGIN=${CORS_ORIGIN}

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads/posts

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server.js"]
