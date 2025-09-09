#!/usr/bin/env bash

# This script is used to generate architecture diagrams from the dsl.
# It relies on the Structurizr CLI being installed locally in a particular way.
# https://docs.structurizr.com/cli/installation#local-installation
# Following the instructions at the above link, ensuring that the $PATH variable
# is updated will enable this script to execute properly.

# Usage
#   From the root directory, run the following command:
#     sh ./architecture/export-architecture-diagrams.sh

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
mv temp_file.md ../docs/architecture/diagrams/cams-webapp-with-function-apps-api.md

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
mv temp_file.md ../docs/architecture/diagrams/cams-function-apps-api-components.md

## CAMS Dataflows Components
mermaid_file="./structurizr-Dataflows.mmd"
{
  printf "# CAMS Dataflows Components\n\n\`\`\`mermaid\n"
  cat "$mermaid_file"
  printf "\n\`\`\`\n"
} > temp_file.md
mv temp_file.md ../docs/architecture/diagrams/cams-dataflows-components.md

popd || exit
