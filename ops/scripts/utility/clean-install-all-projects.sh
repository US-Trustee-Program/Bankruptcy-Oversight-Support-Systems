#!/usr/bin/env bash

# A utility script useful for cleaning all project directories

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/clean-all-projects.sh

echo "Clean installing root."
npm ci

PROJECTS=("backend" "common" "dev-tools" "test/e2e" "test/bdd" "user-interface")

for str in "${PROJECTS[@]}"; do
  pushd "${str}" || exit
  echo "Clean installing ${str}."
  npm ci
  popd || exit
done

exit 0
