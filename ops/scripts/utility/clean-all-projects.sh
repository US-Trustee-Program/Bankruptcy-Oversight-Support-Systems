#!/usr/bin/env bash

# A utility script useful for cleaning all project directories

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/clean-all-projects.sh

PROJECTS=("common" "dev-tools" "test/e2e" "user-interface")

for str in "${PROJECTS[@]}"; do
  pushd "${str}" || exit
  echo "Cleaning ${str}."
  npm run clean
  popd || exit
done

pushd "backend" || exit
echo "Cleaning backend."
npm run clean:all
popd || exit

exit 0
