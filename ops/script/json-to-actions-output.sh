#!/bin/bash

if [ ! -r "$1" ]; then
    echo "Error: File does not exist"
    exit 10
fi
# test=$(cat outputs.json | jp -u "[keys(@), *.value]")
# len=$(cat outputs.json | jp -u "length([keys(@), *.value] | [0])")

# adding debugging 
cat $1
cat $1 | jq -r .functionAppId.value
cat $1 | jq -r .functionAppName.value
cat $1 | jq -r .functionAppId.value | base64
cat $1 | jq -r .functionAppName.value | base64

value1=$(cat $1 | jq -r .functionAppId.value | base64)
value2=$(cat $1 | jq -r .functionAppName.value | base64)
value3=$(cat $1 | jq -r .webappId.value | base64)
value4=$(cat $1 | jq -r .webappName.value | base64)

echo $value1
echo $value2

echo "functionAppId=${value1}" >> $GITHUB_OUTPUT
echo "functionAppName=${value2}" >> $GITHUB_OUTPUT
echo "webappId=${value3}" >> $GITHUB_OUTPUT
echo "webappName=${value4}" >> $GITHUB_OUTPUT
