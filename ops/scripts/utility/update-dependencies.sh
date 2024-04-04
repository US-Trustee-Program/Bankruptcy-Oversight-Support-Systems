#!/usr/bin/env bash

# A utility script useful for beginning dependency updates

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/update-dependencies.sh [-r]

############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "This script runs 'npm update' for all Node projects in the repository."
   echo
   echo "Syntax: ./ops/scripts/utility/update-dependencies.sh [-h|r|u]"
   echo "options:"
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
while getopts ":hru" option; do
  case $option in
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
      echo "'-r' is the only supported option. It is used to remain on the dependency-updates branch at the end of the script."
      ;;
  esac
done

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ -n $(git status -s) ]]; then
  STASHED_CHANGE=true
  git stash
fi
if [[ -z "${UPDATE}" ]]; then
  git checkout main
  git pull --rebase
  git branch -D dependency-updates
  git checkout -b dependency-updates
else
  git checkout dependency-updates
  git pull --rebase
fi

pushd common || exit
npm run clean
npm ci
npm update --save
popd || exit

pushd user-interface || exit
npm run clean
npm ci
npm update --save
popd || exit

pushd backend/functions || exit
npm run clean
npm ci
npm update --save
popd || exit

pushd dev-tools || exit
npm run clean
npm ci
npm update --save
popd || exit

git add .
git commit -m "Update all npm projects"
git push -u origin dependency-updates

if [[ -z "${REMAIN}" ]]; then
  git checkout "$CURRENT_BRANCH"
  if [[ -n "${STASHED_CHANGE}" ]]; then
    git stash pop
  fi
elif [[ -n "${STASHED_CHANGE}" ]]; then
  echo "Remaining on 'dependency-updates' branch, but don't forget you have changes to ${CURRENT_BRANCH} that were stashed."
fi

open "https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/compare/main...dependency-updates?template=dependencies.md";
