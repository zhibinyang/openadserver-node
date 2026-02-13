# Build Stage
FROM node:20-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

COPY . .

# Build the NestJS application
RUN npm run build

# Production Stage
FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy built assets from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/drizzle ./drizzle
COPY --from=builder /usr/src/app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /usr/src/app/docker-entrypoint.sh ./

# Copy runtime data files
COPY --from=builder /usr/src/app/libs ./libs
COPY --from=builder /usr/src/app/models ./models

# Copy debug scripts if needed
COPY --from=builder /usr/src/app/scripts ./scripts

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
