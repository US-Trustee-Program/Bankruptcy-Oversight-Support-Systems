#!/usr/bin/env bash

# A utility script useful for identifying deployed branch environments

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/check-env-hashes.sh [-l|h|r|e {hash}]

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
   echo "Syntax: ./ops/scripts/utility/check-env-hashes.sh [-l|h|r|e {hash}]"
   echo "options:"
   echo "a     Database account name. Required unless using -e flag."
   echo "d     Database resource group name. Required unless using -e flag."
   echo "e     Check against a specific known short hash."
   echo "g     App resource group name. Required unless using -e flag."
   echo "h     Print this Help and exit."
   echo "l     Check local branches."
   echo "n     Network resource group name. Required unless using -e flag."
   echo "r     Check remote branches."
   echo "      Example usage: -e 0a3de4"
   echo
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################
LOCAL=true
REMOTE=true
while getopts ":a:d:e:g:hln:r" option; do
  case $option in
    a) # Database account name
      db_account=${OPTARG}
      ;;
    d) # Database resource group name
      db_rg=${OPTARG}
      ;;
    e) # Existing environment
      inputHash=${OPTARG}
      ;;
    g) # App resource group base name
      app_rg_base=${OPTARG}
      ;;
    h) # display help
      Help
      exit;;
    l) # Local branches
      LOCAL=true
      REMOTE=false
      ;;
    n) # Network resource group base name
      network_rg_base=${OPTARG}
      ;;
    r) # Remote branches
      REMOTE=true
      ;;
    \?) # Invalid option
      echo "Run with the '-h' option to see valid usage."
      exit 1
      ;;
  esac
done

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

# If -e was used but no branch was found
if [[ -n "$inputHash" && "$found" = "false" ]]; then
    echo "No branch found with the short hash: $inputHash"
    exit 0
fi
