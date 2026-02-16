#!/bin/sh
set -e

# Fix volume permissions (runs as root)
mkdir -p /app/data/uploads/reactions /app/data/uploads/demos /app/data/output
chown -R nodejs:nodejs /app/data

# Drop to nodejs user and run CMD
exec su-exec nodejs "$@"
