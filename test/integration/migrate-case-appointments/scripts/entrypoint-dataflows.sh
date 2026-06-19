#!/bin/bash
set -e

echo "[entrypoint] Waiting for SQL Edge..."
for i in $(seq 1 60); do
  if bash -c '</dev/tcp/localhost/1433' 2>/dev/null; then
    echo "[entrypoint] SQL Edge ready"
    break
  fi
  [ "$i" -eq 60 ] && echo "ERROR: SQL Edge failed to start" && exit 1
  sleep 2
done

echo "[entrypoint] Waiting for MongoDB..."
for i in $(seq 1 30); do
  if bash -c '</dev/tcp/localhost/27017' 2>/dev/null; then
    echo "[entrypoint] MongoDB ready"
    break
  fi
  [ "$i" -eq 30 ] && echo "ERROR: MongoDB failed to start" && exit 1
  sleep 1
done

echo "[entrypoint] Waiting for Azurite..."
for i in $(seq 1 15); do
  if bash -c '</dev/tcp/localhost/10000' 2>/dev/null; then
    echo "[entrypoint] Azurite ready"
    break
  fi
  [ "$i" -eq 15 ] && echo "ERROR: Azurite failed to start" && exit 1
  sleep 1
done

echo "[entrypoint] Starting dataflows function app..."
cd /app/backend/function-apps/dataflows
exec func start --javascript --port 7072
