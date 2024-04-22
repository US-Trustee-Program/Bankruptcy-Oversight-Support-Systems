#!/usr/bin/env bash

# A utility script useful for beginning dependency updates

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/update-dependencies.sh [-h]

############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "This script runs 'npm update' for all Node projects in the repository."
   echo "It is intended to be run by a scheduled GitHub Actions Workflow."
   echo
   echo "Syntax: ./ops/scripts/utility/update-dependencies.sh [-h]"
   echo "options:"
   echo "h     Print this Help and exit."
   echo
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################
while getopts ":h" option; do
  case $option in
    h) # display help
      Help
      exit;;
    \?) # Invalid option
      echo "'-r' is the only supported option. It is used to remain on the dependency-updates branch at the end of the script."
      ;;
  esac
done

git checkout -b dependency-updates-auto

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
git push -u origin dependency-updates-auto
