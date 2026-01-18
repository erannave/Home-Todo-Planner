#!/bin/sh
set -e

# Ensure data directory exists and is writable
mkdir -p "$(dirname "$DATABASE_PATH")"

exec ./server
