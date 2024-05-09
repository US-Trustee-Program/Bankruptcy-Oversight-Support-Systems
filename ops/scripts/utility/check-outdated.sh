#!/usr/bin/env bash

# A utility script useful for checking for outdated packages

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/check-outdated.sh [-c|h]

############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "This script runs 'npm outdated' for all Node projects in the repository and"
   echo "creates a comment on an open PR."
   echo
   echo "Syntax: ./ops/scripts/utility/check-outdated.sh [-c|h]"
   echo "options:"
   echo "c     Run this script from a CI/CD workflow."
   echo "h     Print this Help and exit."
   echo
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################
while getopts ":ch" option; do
  case $option in
    c) # CI/CD
      CICD=true
      ;;
    h) # display help
      Help
      exit;;
    \?) # Invalid option
      echo "Run with the '-h' option to see valid usage."
      exit 1
      ;;
  esac
done


if [[ -n "${CICD}" ]]; then
  BRANCH_NAME="dependency-updates-auto"
else
  BRANCH_NAME="dependency-updates"
fi


# Temporary file for storing outputs
TEMP_FILE=$(mktemp)

# Ensure cleanup of the temp file on exit
trap 'rm -f "$TEMP_FILE"' EXIT

cat ./ops/scripts/utility/outdated-comment.md >> "$TEMP_FILE"
OUTDATED=false

PROJECTS=("backend/functions" "common" "dev-tools" "test/e2e" "user-interface")
for dir in "${PROJECTS[@]}"; do
  pushd "${dir}" || exit
  npm ci
  npm outdated | sed -e '1d' \
                      -e 's/  */ | /g' \
                      -e 's/^/| /' \
                      -e 's/ $/ |/' >> "$TEMP_FILE"
  # Check the exit status of npm outdated
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    OUTDATED=true
  fi
  popd || exit
done

if [[ "${OUTDATED}" = true ]]; then
  gh pr comment "${BRANCH_NAME}" --body-file "$TEMP_FILE"
else
  gh pr comment "${BRANCH_NAME}" --body-file ./ops/scripts/utility/no-outdated-comment.md
fi

exit 0
