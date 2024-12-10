#!/usr/bin/env bash

# A utility script useful for cleaning all project directories

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/clean-all-projects.sh

PROJECTS=("backend" "common" "dev-tools" "test/e2e" "user-interface")

for str in "${PROJECTS[@]}"; do
  pushd "${str}" || exit
  echo "Clean installing ${str}."
  npm ci
  popd || exit
done

exit 0
