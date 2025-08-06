#!/usr/bin/env bash

function usage() {
    echo "Usage: $0 [-s]"
    echo "Options:"
    echo "  -s Set up git hooks for submodule"
    exit 1
}

while getopts ":sh" option; do
  case $option in
    s)
      SUBMODULE=true
      ;;
    h)
      usage
      ;;
    *)
      ;;
  esac
done

if [ "$SUBMODULE" = true ]; then
    echo "Setting up git hooks for submodule..."
    GITHOOKS_DIR="../../../.git/modules/cams/hooks"
else
    echo "Setting up git hooks for main repository..."
    GITHOOKS_DIR="../../.git/hooks"
fi

# check current working directory
if [ ! -f "./ops/git-setup/set-up-git-hooks.sh" ]; then
    echo "Error: Incorrect working directory $(pwd) : Execute command from root of repository."
    exit 10
fi

# pre-commit package
pre-commit --version
if ! pre-commit --version; then
    echo "Please follow the instructions to install the pre-commit python tool. The instructions can be found at https://pre-commit.com/index.html#install"
    exit 1
fi
pre-commit install

pushd ops/git-setup || exit

# Insert the branch naming convention check
## Create a temporary file to hold the modified contents
temp_file=$(mktemp)

## Read the original file and insert the contents of source-file into it
{
    head -n 1 ${GITHOOKS_DIR}/pre-commit
    cat pre-commit-hook-content
    tail -n +3 ${GITHOOKS_DIR}/pre-commit
} > "$temp_file"

## Move the modified contents back to the original file
mv "$temp_file" ${GITHOOKS_DIR}/pre-commit
chmod +x ${GITHOOKS_DIR}/pre-commit

# Set up prepare-commit-msg hook
cp ./prepare-commit-msg ${GITHOOKS_DIR}/prepare-commit-msg
chmod +x ${GITHOOKS_DIR}/prepare-commit-msg

popd || exit

# Set up commit template
git config commit.template ./ops/git-setup/commit.template
