#! /bin/bash

if [[ $OUT == "" ]]; then
  FILE_NAME=$1;
else
  FILE_NAME=$OUT;
fi

PACK_TEMP_DIR="/tmp/build/$1"

echo "Creating archive $PACK_TEMP_DIR/$FILE_NAME.zip"

mkdir -p dist/
mkdir -p node_modules/
cp -r ../../node_modules/* node_modules/
mkdir -p "$PACK_TEMP_DIR"

# Include dev-users.json if it exists (for dev authentication)
DEV_USERS_FILE="../../dev-users.json"
INCLUDE_DEV_USERS=""
if [ -f "$DEV_USERS_FILE" ]; then
  echo "Including dev-users.json in deployment package"
  cp "$DEV_USERS_FILE" ./dev-users.json
  INCLUDE_DEV_USERS="./dev-users.json"
fi

zip -q -r "$PACK_TEMP_DIR/$FILE_NAME.zip" ./dist ./node_modules ./package.json ./host.json $INCLUDE_DEV_USERS --exclude "*.map" --exclude "*.ts"

# Clean up
mv "$PACK_TEMP_DIR/$FILE_NAME.zip" .
rm -rf node_modules
[ -f "./dev-users.json" ] && rm ./dev-users.json
