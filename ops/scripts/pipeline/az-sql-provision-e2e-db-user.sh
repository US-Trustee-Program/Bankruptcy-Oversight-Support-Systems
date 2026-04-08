#!/usr/bin/env bash

# Description: Provisions a contained database user for a managed identity in an Azure SQL database.
#              Detects or installs go-sqlcmd based on OS/architecture.
# Prerequisites:
#   - Azure CLI (logged in)
#   - sqlcmd: go-sqlcmd auto-installed on Linux if absent; macOS: brew install go-sqlcmd
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

# Detect sqlcmd binary, installing go-sqlcmd on Linux if not found.
# go-sqlcmd is required (not mssql-tools18) because --token auth is a go-sqlcmd feature.
if command -v sqlcmd &>/dev/null; then
  # go-sqlcmd on PATH (macOS via brew install go-sqlcmd, or existing install)
  SQLCMD="sqlcmd"
elif [[ "$(uname -s)" == "Linux" ]]; then
  echo "sqlcmd not found — installing go-sqlcmd..."
  arch="$(uname -m)"
  case "${arch}" in
    x86_64)  go_sqlcmd_arch="amd64" ;;
    aarch64) go_sqlcmd_arch="arm64" ;;
    *)
      echo "Error: unsupported architecture ${arch}"
      exit 1
      ;;
  esac
  go_sqlcmd_version="v1.9.0"
  go_sqlcmd_url="https://github.com/microsoft/go-sqlcmd/releases/download/${go_sqlcmd_version}/sqlcmd-linux-${go_sqlcmd_arch}.tar.bz2"
  curl -fsSL "${go_sqlcmd_url}" | tar -xj -C /usr/local/bin sqlcmd
  SQLCMD="sqlcmd"
else
  echo "Error: sqlcmd not found. Install go-sqlcmd (macOS: brew install go-sqlcmd)."
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
