#!/usr/bin/env bash

# pre-commit
pre-commit --version
if [ $? -ne 0 ]
then
    echo "Please follow the instructions to install the pre-commit python tool. The instructions can be found at https://pre-commit.com/index.html#install"
    exit 1
fi
pre-commit install

# Append the branch naming convention check
pushd ops/helper-scripts
cat pre-commit >> ../../.git/hooks/pre-commit
popd
