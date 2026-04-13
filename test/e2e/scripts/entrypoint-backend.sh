#!/bin/bash
set -e

# Wait for pod-sibling services (MongoDB, SQL Edge, Azurite) then seed and start
# the Functions host. All services share localhost via the Podman pod network namespace.

# Wait for MongoDB
echo "[entrypoint] Waiting for MongoDB..."
for i in $(seq 1 30); do
    if bash -c '</dev/tcp/localhost/27017' 2>/dev/null; then
        echo "[entrypoint] MongoDB ready"
        break
    fi
    [ "$i" -eq 30 ] && echo "[entrypoint] ERROR: MongoDB failed to start" && exit 1
    sleep 1
done

# Wait for SQL Edge
echo "[entrypoint] Waiting for SQL Edge..."
for i in $(seq 1 30); do
    if bash -c '</dev/tcp/localhost/1433' 2>/dev/null; then
        echo "[entrypoint] SQL Edge ready"
        break
    fi
    [ "$i" -eq 30 ] && echo "[entrypoint] ERROR: SQL Edge failed to start" && exit 1
    sleep 1
done

# Wait for Azurite
echo "[entrypoint] Waiting for Azurite..."
for i in $(seq 1 15); do
    if bash -c '</dev/tcp/localhost/10000' 2>/dev/null; then
        echo "[entrypoint] Azurite ready"
        break
    fi
    [ "$i" -eq 15 ] && echo "[entrypoint] ERROR: Azurite failed to start" && exit 1
    sleep 1
done

# Seed databases
echo "[entrypoint] Seeding MongoDB..."
cd /app/test/e2e
MONGO_CONNECTION_STRING="mongodb://localhost:27017/cams-e2e?retrywrites=false" \
  npx tsx ./scripts/seed-database.ts

echo "[entrypoint] Seeding SQL Server..."
LOCAL_MSSQL_HOST=localhost \
  LOCAL_MSSQL_USER=sa \
  LOCAL_MSSQL_PASS="${MSSQL_PASS}" \
  MSSQL_DATABASE_DXTR=CAMS_E2E \
  MSSQL_ENCRYPT=false \
  MSSQL_TRUST_UNSIGNED_CERT=true \
  npx tsx ./scripts/seed-sqlserver.ts

echo "[entrypoint] Databases seeded"

# Warm up SQL Server plan cache
echo "[entrypoint] Warming up SQL Server..."
LOCAL_MSSQL_HOST=localhost \
  LOCAL_MSSQL_USER=sa \
  LOCAL_MSSQL_PASS="${MSSQL_PASS}" \
  MSSQL_DATABASE_DXTR=CAMS_E2E \
  MSSQL_ENCRYPT=false \
  MSSQL_TRUST_UNSIGNED_CERT=true \
  npx tsx ./scripts/warmup-sqlserver.ts 2>/dev/null || echo "[entrypoint] Warmup completed (or skipped)"

# Start Azure Functions host (foreground — keeps the container alive)
echo "[entrypoint] Starting Azure Functions host..."
cd /app/backend/function-apps/api
exec func start --javascript --port 7071 --verbose
