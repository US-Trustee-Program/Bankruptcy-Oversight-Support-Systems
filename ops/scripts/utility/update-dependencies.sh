#!/usr/bin/env bash

# A utility script useful for beginning dependency updates

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/update-dependencies.sh
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ -n $(git status -s) ]]; then
  STASHED_CHANGE=true
  git stash
fi
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

pushd dev-tools || exit
npm run clean
npm ci
npm update --save
popd || exit

git add .
git commit -m "Update all npm projects"
git push -u origin dependency-updates

git checkout "$CURRENT_BRANCH"
if [[ -n "${STASHED_CHANGE}" ]]; then
  git stash pop
fi

open "https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/compare/main...dependency-updates?template=dependencies.md";
