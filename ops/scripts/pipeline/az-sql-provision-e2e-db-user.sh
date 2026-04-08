#!/usr/bin/env bash

# Description: Provisions a contained database user for a managed identity in an Azure SQL database.
#              Detects sqlcmd installation path based on OS/architecture.
# Prerequisites:
#   - Azure CLI (logged in)
#   - sqlcmd (mssql-tools18 on Linux/amd64, go-sqlcmd on macOS/arm64)
# Usage: az-sql-provision-e2e-db-user.sh --server-name <name> --database <db> --identity-name <name>

set -euo pipefail

while [[ $# -gt 0 ]]; do
  case $1 in
  --server-name)
    server_name="${2}"
    shift 2
    ;;
  --database)
    database="${2}"
    shift 2
    ;;
  --identity-name)
    identity_name="${2}"
    shift 2
    ;;
  *)
    echo "Unknown argument: $1"
    exit 2
    ;;
  esac
done

if [[ -z "${server_name:-}" || -z "${database:-}" || -z "${identity_name:-}" ]]; then
  echo "Error: --server-name, --database, and --identity-name are required"
  exit 1
fi

# Build FQDN from server name using the current cloud's SQL hostname suffix
sql_hostname_suffix=$(az cloud show --query "suffixes.sqlServerHostname" -o tsv)
server_fqdn="${server_name}.${sql_hostname_suffix}"

# Detect sqlcmd binary
if [[ -x "/opt/mssql-tools18/bin/sqlcmd" ]]; then
  # Pre-installed on ubuntu-latest (amd64) GHA runners
  SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
elif command -v sqlcmd &>/dev/null; then
  # go-sqlcmd or mssql-tools on PATH (macOS via brew, or go-sqlcmd install)
  SQLCMD="sqlcmd"
else
  echo "Error: sqlcmd not found. Install mssql-tools18 (Linux) or go-sqlcmd (macOS: brew install go-sqlcmd)."
  exit 1
fi

echo "Using sqlcmd: ${SQLCMD}"

# Get an Azure AD access token for the SQL resource endpoint
# Azure Government: database.usgovcloudapi.net; Azure Commercial: database.windows.net
sql_token=$(az account get-access-token --resource "https://${sql_hostname_suffix}/" --query accessToken -o tsv)

echo "Provisioning SQL user '${identity_name}' in database '${database}' on '${server_fqdn}'"

"${SQLCMD}" \
  -S "${server_fqdn}" \
  -d "${database}" \
  --token "${sql_token}" \
  -Q "
    IF NOT EXISTS (
      SELECT 1 FROM sys.database_principals
      WHERE name = '${identity_name}'
    )
    BEGIN
      CREATE USER [${identity_name}] FROM EXTERNAL PROVIDER;
      ALTER ROLE db_datareader ADD MEMBER [${identity_name}];
    END
  "

echo "Done provisioning SQL user '${identity_name}'"
