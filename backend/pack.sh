#! /bin/bash

if [[ $OUT == "" ]]; then
  FILE_NAME=$1;
else
  FILE_NAME=$OUT;
fi

PACK_TEMP_DIR="/tmp/build/$1"

echo "Creating archive $PACK_TEMP_DIR/$FILE_NAME.zip"

# Create node_modules with only external dependencies (esbuild has bundled everything else)
# External dependencies are defined centrally in esbuild-shared.mjs
mkdir -p node_modules/

# Get external dependencies from shared config and copy them from root node_modules
while IFS= read -r dep; do
  if [[ -d "../../../node_modules/$dep" ]]; then
    # Create parent directory if it contains a slash (like @azure)
    mkdir -p "node_modules/$(dirname "$dep")"
    cp -r "../../../node_modules/$dep" "node_modules/$dep" 2>/dev/null || true
  fi
done < <(node ../../get-external-deps.mjs)

# Create the zip archive
mkdir -p "$PACK_TEMP_DIR"
zip -q -r "$PACK_TEMP_DIR/$FILE_NAME.zip" ./dist ./node_modules ./package.json ./host.json --exclude "*.map" --exclude "*.ts"
mv "$PACK_TEMP_DIR/$FILE_NAME.zip" .
rm -rf node_modules
