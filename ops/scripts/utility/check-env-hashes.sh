#!/usr/bin/env bash

# A utility script useful for beginning dependency updates

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/check-env-hashes.sh [-l|h|r|e {hash}]

############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "This script runs 'npm update' for all Node projects in the repository."
   echo
   echo "Syntax: ./ops/scripts/utility/update-dependencies.sh [-c|h|r|u]"
   echo "options:"
   echo "l     Check local branches."
   echo "h     Print this Help and exit."
   echo "r     Check remote branches."
   echo "e     Check against a specific known short hash. Example usage: -e 0a3de4"
   echo
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################
LOCAL=true
REMOTE=true
while getopts ":hlre:" option; do
  case $option in
    h) # display help
      Help
      exit;;
    l) # Local branches
      LOCAL=true
      REMOTE=false
      ;;
    r) # Remote branches
      REMOTE=true
      ;;
    e) # Existing environment
      inputHash=${OPTARG}
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
    echo "Branch: \"$branch\", Short Hash: \"$shortHash\""
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
