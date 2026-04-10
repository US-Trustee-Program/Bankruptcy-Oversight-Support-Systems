#!/usr/bin/env bash

# Description: Provisions a contained database user for a managed identity in an Azure SQL database.
#              Uses SQL auth (server admin) to avoid requiring an Azure AD admin connection.
#              Detects or installs mssql-tools18 on Linux; macOS requires manual install.
# Prerequisites:
#   - Azure CLI (logged in, for cloud suffix discovery and admin login lookup)
#   - sqlcmd: mssql-tools18 auto-installed on Linux if absent; macOS: brew install mssql-tools
# Usage: az-sql-provision-e2e-db-user.sh --resource-group <rg> --server-name <name> --database <db> --identity-name <name> --identity-client-id <guid> --sa-password <password>

set -euo pipefail

while [[ $# -gt 0 ]]; do
  case $1 in
  --resource-group | -g)
    resource_group="${2}"
    shift 2
    ;;
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
  --identity-client-id)
    identity_client_id="${2}"
    shift 2
    ;;
  --sa-password)
    sa_password="${2}"
    shift 2
    ;;
  *)
    echo "Unknown argument: $1"
    exit 2
    ;;
  esac
done

if [[ -z "${resource_group:-}" || -z "${server_name:-}" || -z "${database:-}" || -z "${identity_name:-}" || -z "${identity_client_id:-}" || -z "${sa_password:-}" ]]; then
  echo "Error: --resource-group, --server-name, --database, --identity-name, --identity-client-id, and --sa-password are required"
  exit 1
fi

# Build FQDN using the current cloud's SQL hostname suffix (includes leading dot)
sql_hostname_suffix=$(az cloud show --query "suffixes.sqlServerHostname" -o tsv)
server_fqdn="${server_name}${sql_hostname_suffix}"

# Look up the server admin login from Azure rather than hardcoding it
sa_user=$(az sql server show -g "${resource_group}" -n "${server_name}" --query administratorLogin -o tsv)

# Detect sqlcmd binary, installing mssql-tools18 on Linux if not found
if [[ -x "/opt/mssql-tools18/bin/sqlcmd" ]]; then
  SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
elif command -v sqlcmd &>/dev/null; then
  SQLCMD="sqlcmd"
elif [[ "$(uname -s)" == "Linux" ]]; then
  echo "sqlcmd not found — installing mssql-tools18 via apt..."
  curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add - 2>/dev/null
  curl -fsSL "https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/prod.list" \
    | sudo tee /etc/apt/sources.list.d/mssql-release.list
  sudo apt-get update -q
  sudo ACCEPT_EULA=Y apt-get install -y -q mssql-tools18 unixodbc-dev
  SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
else
  echo "Error: sqlcmd not found. Install mssql-tools18 (Linux) or go-sqlcmd (macOS: brew install go-sqlcmd)."
  exit 1
fi

echo "Using sqlcmd: ${SQLCMD}"
echo "Provisioning SQL user '${identity_name}' in database '${database}' on '${server_fqdn}'"

# CREATE USER ... WITH SID = <clientId>, TYPE = E creates a contained database user
# mapped to the managed identity without requiring an Azure AD admin connection.
# SID must be the client ID (application ID) of the managed identity, not the object/principal ID.
# TYPE = E covers service principals and managed identities.
# This avoids FROM EXTERNAL PROVIDER which requires an Entra-authenticated connection.
"${SQLCMD}" \
  -S "${server_fqdn}" \
  -d "${database}" \
  -U "${sa_user}" \
  -P "${sa_password}" \
  -Q "
    IF NOT EXISTS (
      SELECT 1 FROM sys.database_principals
      WHERE name = '${identity_name}'
    )
    BEGIN
      DECLARE @sid NVARCHAR(MAX) = CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(16), CAST('${identity_client_id}' AS UNIQUEIDENTIFIER)), 1);
      DECLARE @cmd NVARCHAR(MAX) = N'CREATE USER [${identity_name}] WITH SID = ' + @sid + N', TYPE = E;';
      EXEC (@cmd);
      ALTER ROLE db_datareader ADD MEMBER [${identity_name}];
    END
  "

echo "Done provisioning SQL user '${identity_name}'"
