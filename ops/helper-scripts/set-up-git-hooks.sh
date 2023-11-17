#!/usr/bin/env bash

# pre-commit package
pre-commit --version
if ! pre-commit --version; then
    echo "Please follow the instructions to install the pre-commit python tool. The instructions can be found at https://pre-commit.com/index.html#install"
    exit 1
fi
pre-commit install

pushd ops/helper-scripts || exit

# Insert the branch naming convention check
## Create a temporary file to hold the modified contents
temp_file=$(mktemp)

## Read the original file and insert the contents of source-file into it
{
    head -n 1 ../../.git/hooks/pre-commit
    cat pre-commit-hook-content
    tail -n +3 ../../.git/hooks/pre-commit
} > "$temp_file"

## Move the modified contents back to the original file
mv "$temp_file" ../../.git/hooks/pre-commit
chmod +x ../../.git/hooks/pre-commit

# Set up prepare-commit-msg hook
cp ../git-setup/prepare-commit-msg ../../.git/hooks/prepare-commit-msg
chmod +x ../../.git/hooks/prepare-commit-msg

popd || exit

# Set up commit template
git config commit.template ./ops/git-setup/commit.template
