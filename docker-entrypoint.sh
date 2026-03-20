#!/bin/sh
set -e

echo "Starting application..."

# Start the application
echo "Starting NestJS application..."
exec npm run start:prod
