#!/usr/bin/env bash

# A utility script useful for cleaning all project directories

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/clean-all-projects.sh

PROJECTS=("backend" "backend/function-apps/api" "backend/function-apps/dataflows" "common" "dev-tools" "test/e2e" "test/bdd" "user-interface")

for str in "${PROJECTS[@]}"; do
  pushd "${str}" || exit
  echo "Cleaning ${str}."
  npm run clean
  popd || exit
done

exit 0
