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
# Copy from root node_modules (npm workspaces structure)
cp -r ../../../node_modules/* node_modules/
mkdir -p "$PACK_TEMP_DIR"
zip -q -r "$PACK_TEMP_DIR/$FILE_NAME.zip" ./dist ./node_modules ./package.json ./host.json --exclude "*.map" --exclude "*.ts"
mv "$PACK_TEMP_DIR/$FILE_NAME.zip" .
rm -rf node_modules
