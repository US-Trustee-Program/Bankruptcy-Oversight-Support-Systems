#!/usr/bin/env bash

# Export the diagrams from our model
structurizr.sh export -workspace architecture/cams.dsl -format mermaid

# Produce Docsify Content
#   This should replace the content of the appropriate markdown file,
#     wrapping the mermaid in a code tag.
