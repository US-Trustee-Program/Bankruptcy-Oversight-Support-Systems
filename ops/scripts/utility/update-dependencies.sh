#!/usr/bin/env bash

# A utility script useful for beginning dependency updates

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/update-dependencies.sh
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git stash
git checkout main
git pull --rebase
git branch -D dependency-updates
git checkout -b dependency-updates

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

git checkout "$CURRENT_BRANCH"
git stash pop
