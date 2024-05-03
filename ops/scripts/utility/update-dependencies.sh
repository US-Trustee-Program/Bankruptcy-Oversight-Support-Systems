#!/usr/bin/env bash

# A utility script useful for beginning dependency updates

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/update-dependencies.sh [-c|h|r|u]

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
   echo "c     Run this script from a CI/CD workflow. Incompatible with other options."
   echo "h     Print this Help and exit."
   echo "r     Run the script but remain on dependency-updates branch."
   echo "u     Run the script but keep the existing dependency-updates branch."
   echo
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################
while getopts ":chru" option; do
  case $option in
    c) # CI/CD
      CICD=true
      ;;
    h) # display help
      Help
      exit;;
    r) # stay on dependency-updates branch upon completion
      REMAIN=true
      ;;
    u) # update existing dependency-updates branch
      UPDATE=true
      ;;
    \?) # Invalid option
      echo "Run with the '-h' option to see valid usage."
      exit 1
      ;;
  esac
done

BRANCH_NAME="dependency-updates"

if [[ -n "${CICD}" ]]; then
  BRANCH_NAME="dependency-updates-auto"
  git switch -c "${BRANCH_NAME}"
else
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ -n $(git status -s) ]]; then
    STASHED_CHANGE=true
    git stash
  fi
  if [[ -z "${UPDATE}" ]]; then
    git switch main
    git pull --rebase
    git branch -D "${BRANCH_NAME}"
    git switch -c "${BRANCH_NAME}"
  else
    git checkout "${BRANCH_NAME}"
    git pull --rebase
  fi
fi


PROJECTS=("backend/functions" "common" "dev-tools" "test/e2e" "user-interface")

for str in "${PROJECTS[@]}"; do
  pushd "${str}" || exit
  npm run clean
  npm ci
  npm update --save
  popd || exit
done

git add .
git commit -m "Update all npm projects"
git push -u origin "${BRANCH_NAME}"

if [[ -c "${CICD}" ]]; then
  exit 0
fi

if [[ -z "${REMAIN}" ]]; then
  git switch "$CURRENT_BRANCH"
  if [[ -n "${STASHED_CHANGE}" ]]; then
    git stash pop
  fi
elif [[ -n "${STASHED_CHANGE}" ]]; then
  echo "Remaining on '${BRANCH_NAME}' branch, but don't forget you have changes to ${CURRENT_BRANCH} that were stashed."
fi

if [[ -z "${CICD}" ]]; then
  open "https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/compare/main...${BRANCH_NAME}?template=dependencies.md";
fi

exit 0
