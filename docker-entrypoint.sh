#!/bin/sh
set -e

echo "Starting application..."

# Run migrations
echo "Running database migrations..."
npm run migration:run

# Start the application
echo "Starting NestJS application..."
exec npm run start:prod
