#!/usr/bin/env bash

# Export the diagrams from our model
structurizr.sh export -workspace architecture/cams.dsl -format mermaid

# Produce Docsify Content
pushd architecture

## CAMS System Context
mermaid_file="./structurizr-SystemLandscape.mmd"
{
  echo "# CAMS System Context\n\n\`\`\`mermaid"
  cat "$mermaid_file"
  echo "\n\`\`\`"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-context.md

## CAMS Containers
mermaid_file="./structurizr-CAMSContainers.mmd"
{
  echo "# CAMS Containers\n\n\`\`\`mermaid"
  cat "$mermaid_file"
  echo "\n\`\`\`"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-containers.md

## CAMS Functions API with Webapp
mermaid_file="./structurizr-FunctionsAPIwithWebapp.mmd"
{
  echo "# CAMS Webapp with Functions API\n\n\`\`\`mermaid"
  cat "$mermaid_file"
  echo "\n\`\`\`"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-webapp-with-functions-api.md

## CAMS Webapp Components
mermaid_file="./structurizr-CAMSWebapp.mmd"
{
  echo "# CAMS Webapp Components\n\n\`\`\`mermaid"
  cat "$mermaid_file"
  echo "\n\`\`\`"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-webapp-components.md

## CAMS Functions API Components
mermaid_file="./structurizr-FunctionsAPI.mmd"
{
  echo "# CAMS Functions API Components\n\n\`\`\`mermaid"
  cat "$mermaid_file"
  echo "\n\`\`\`"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-functions-api-components.md

popd
