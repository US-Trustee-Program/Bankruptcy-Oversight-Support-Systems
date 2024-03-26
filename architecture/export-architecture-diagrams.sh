#!/usr/bin/env bash

# Export the diagrams from our model
structurizr.sh export -workspace architecture/cams.dsl -format mermaid

# Produce Docsify Content
pushd architecture || exit

## CAMS System Context
mermaid_file="./structurizr-SystemLandscape.mmd"
{
  printf "# CAMS System Context\n\n\`\`\`mermaid\n"
  cat "$mermaid_file"
  printf "\n\`\`\`\n"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-context.md

## CAMS Containers
mermaid_file="./structurizr-CAMSContainers.mmd"
{
  printf "# CAMS Containers\n\n\`\`\`mermaid\n"
  cat "$mermaid_file"
  printf "\n\`\`\`\n"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-containers.md

## CAMS Functions API with Webapp
mermaid_file="./structurizr-FunctionsAPIwithWebapp.mmd"
{
  printf "# CAMS Webapp with Functions API\n\n\`\`\`mermaid\n"
  cat "$mermaid_file"
  printf "\n\`\`\`\n"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-webapp-with-functions-api.md

## CAMS Webapp Components
mermaid_file="./structurizr-CAMSWebapp.mmd"
{
  printf "# CAMS Webapp Components\n\n\`\`\`mermaid\n"
  cat "$mermaid_file"
  printf "\n\`\`\`\n"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-webapp-components.md

## CAMS Functions API Components
mermaid_file="./structurizr-FunctionsAPI.mmd"
{
  printf "# CAMS Functions API Components\n\n\`\`\`mermaid\n"
  cat "$mermaid_file"
  printf "\n\`\`\`\n"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-functions-api-components.md

popd || exit
