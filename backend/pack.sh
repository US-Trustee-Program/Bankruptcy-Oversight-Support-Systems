#! /bin/bash

if [[ $OUT == "" ]]; then
  FILE_NAME=$PACK_OUT;
else
  FILE_NAME=$OUT;
fi

PACK_TEMP_DIR="/tmp/build/$1"

echo "Creating archive $PACK_TEMP_DIR/$FILE_NAME.zip"

mkdir -p dist/node_modules/
cp -r build/* dist/
cp -r ../../node_modules/* dist/node_modules/
cp dist.package.json dist/package.json
cp host.json dist/
mkdir -p "$PACK_TEMP_DIR"
pushd dist || exit
zip -q -r "$PACK_TEMP_DIR/$FILE_NAME.zip" . --exclude "*.map" --exclude "*.ts"
popd || exit
mv "$PACK_TEMP_DIR/$FILE_NAME.zip" .
