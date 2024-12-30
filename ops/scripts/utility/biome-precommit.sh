#!/usr/bin/env bash

# A utility script useful for using biome linter on all directories

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/clean-all-projects.sh

# PROJECTS=("./backend" "./common" "./dev-tools" "./test/e2e" "./user-interface") TODO: go through these and validate formatting changes
PROJECTS=("./backend" "./common" "./dev-tools" "./test/e2e" "./user-interface") # temporarily ones that don't require changes

# this should be the command we run
#  npm run biome-lint:write && npm run biome-format:write

for str in "${PROJECTS[@]}"; do
  pushd "${str}" || exit
  echo "Linting and Formatting ${str}."
  npm run biome-check:write
  popd || exit
done

exit 0
