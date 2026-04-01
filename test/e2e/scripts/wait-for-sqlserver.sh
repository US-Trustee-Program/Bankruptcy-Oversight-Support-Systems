#!/bin/bash
# Wait for SQL Server to be reachable before starting backend
set -e

HOST=${MSSQL_HOST:-sqlserver}
PORT=1433
MAX_ATTEMPTS=30
ATTEMPT=0

echo "Waiting for SQL Server at $HOST:$PORT..."

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if nc -z "$HOST" "$PORT" 2>/dev/null; then
    echo "SQL Server is reachable!"
    exit 0
  fi
  ATTEMPT=$((ATTEMPT + 1))
  echo "Attempt $ATTEMPT/$MAX_ATTEMPTS: SQL Server not yet reachable, waiting..."
  sleep 2
done

echo "ERROR: SQL Server at $HOST:$PORT did not become reachable after $MAX_ATTEMPTS attempts"
exit 1
