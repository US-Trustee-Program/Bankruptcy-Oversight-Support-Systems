#!/usr/bin/env bash

# A utility script useful for identifying deployed branch environments

############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "This script prints branch names and their short hashes or checks a"
   echo "known short hash against existing branches. Default lists remote"
   echo "branches and their short hashes."
   echo
   echo "Usage: $0 [options]"
     echo ""
     echo "Options:"
     echo "  --help                             Display this help message."
     echo "  --app-resource-group-base=<rg>     Application resource group name. **REQUIRED**"
     echo "  --db-account=<account>             Database account name. **REQUIRED**"
     echo "  --db-resource-group=<rg>           Database resource group name. **REQUIRED**"
     echo "  --network-resource-group-base=<rg> Network resource group name. **REQUIRED**"
     echo "  --existing-hash=<hash>             Branch hash ID for a specific resource. **OPTIONAL**"
     echo "  --local-branches                   Run against local branches. Overrides default behavior."
     echo "  --remote-branches                  Run against remote branches. Default behavior. Flag is useful for running both local and remote."
     echo ""
     exit 0
}

############################################################
# Error                                                    #
############################################################
function error() {
    local msg=$1
    local code=$2
    echo "ERROR: ${msg}" >>/dev/stderr
    exit "${code}"
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################
LOCAL=true
REMOTE=true
# Parse named parameters
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      Help
      ;;
    --app-resource-group-base=*)
      app_rg_base="${1#*=}"
      shift
      ;;
    --db-account=*)
      db_account="${1#*=}"
      shift
      ;;
    --db-resource-group=*)
      db_rg="${1#*=}"
      shift
      ;;
    --network-resource-group-base=*)
      network_rg_base="${1#*=}"
      shift
      ;;
    --existing-hash=*)
      inputHash="${1#*=}"
      shift
      ;;
    --local-branches)
      LOCAL=true
      REMOTE=false
      shift
      ;;
    --remote-branches)
      REMOTE=true
      shift
      ;;
    *)
      echo "Invalid option: $1"
      echo "Run with '--help' to see valid usage."
      exit 1
      ;;
  esac
done

if [[ -z "${inputHash}" && ( -z "${app_rg_base}" || -z "${db_account}" || -z "${db_rg}" || -z "${network_rg_base}" ) ]]; then
  error "Not all required parameters provided. Run this script with the --help flag for details." 2
fi

branches=()
if [[ "$LOCAL" = "true" ]]; then
  mapfile -t localBranches < <(git for-each-ref refs/heads --format='%(refname:short)')
  branches+=("${localBranches[@]}")
fi
if [[ "$REMOTE" = "true" ]]; then
  mapfile -t remoteBranches < <(git for-each-ref refs/remotes --format='%(refname:short)' | sed 's|^origin/||')
  branches+=("${remoteBranches[@]}")
fi

found=false
for branch in "${branches[@]}"; do
  # Generate the SHA256 hash
  hash=$(echo -n "$branch" | openssl sha256 | awk '{print $2}')
  # Extract the first 6 characters of the hash
  shortHash="${hash:0:6}"

  if [[ -z "$inputHash" ]]; then
  # Check if resources exist
  rgAppExists=$(az group exists -n "${app_rg_base}-${shortHash}")
  rgNetExists=$(az group exists -n "${network_rg_base}-${shortHash}")
  dbExists=$(az cosmosdb mongodb database exists -g "${db_rg}" -a "${db_account}" -n "cams-e2e-${shortHash}")
    echo "Branch: \"$branch\", Short Hash: \"$shortHash\", app exists: ${rgAppExists}, network exists: ${rgNetExists}, db exists: ${dbExists}"
  else
    if [ "$shortHash" == "$inputHash" ]; then
      echo "Matching branch found: $branch"
      found=true
      break
    fi
  fi
done

# If --existing-hash was used but no branch was found
if [[ -n "$inputHash" && "$found" = "false" ]]; then
    echo "No branch found with the short hash: $inputHash"
    exit 0
fi
