#! /bin/bash
mkdir -p dist/node_modules/
cp -r build/* dist/
cp -r ../../node_modules/* dist/node_modules/
cp dist.package.json dist/package.json
cp host.json dist/
mkdir -p "$PACK_TEMP_DIR"
pushd dist || exit
zip -r "$PACK_TEMP_DIR/$PACK_OUT.zip" . --exclude "*.map" --exclude "*.ts"
popd || exit
mv "$PACK_TEMP_DIR/$PACK_OUT.zip" .
