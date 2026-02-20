#!/bin/sh
set -e

echo "Starting application..."

# Run migrations
echo "Running database migrations..."
npm run migration:run

# Seed database
echo "Seeding database..."
npm run seed:db

# Start the application
echo "Starting NestJS application..."
exec npm run start:prod
