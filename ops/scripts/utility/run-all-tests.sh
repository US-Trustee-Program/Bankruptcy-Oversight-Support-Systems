#!/usr/bin/env bash

# A utility script useful for testing all project directories

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/run-all-tests.sh

PROJECTS=("backend/functions" "common" "user-interface")

for str in "${PROJECTS[@]}"; do
  pushd "${str}" || exit
  echo "Cleaning ${str}."
  npm run test
  popd || exit 1
done

exit 0
