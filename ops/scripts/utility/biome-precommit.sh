#!/usr/bin/env bash

# A utility script useful for using biome linter on all directories

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/biome-precommit.sh

PROJECTS=("./backend" "./common" "./dev-tools" "./test/e2e" "./user-interface") # temporarily ones that don't require changes


for str in "${PROJECTS[@]}"; do
  pushd "${str}" || exit
  echo "Linting and Formatting ${str}."
  npm run biome-check:write
  popd || exit
done

exit 0
