#!/usr/bin/env bash

# A utility script to check for npm packages across all project directories

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/check-for-packages.sh <package-name> [package-name2] ...
#   Examples:
#     ./ops/scripts/utility/check-for-packages.sh word-wrap
#     ./ops/scripts/utility/check-for-packages.sh word-wrap@1.2
#     ./ops/scripts/utility/check-for-packages.sh word-wrap@^1.0
#     ./ops/scripts/utility/check-for-packages.sh word-wrap eslint typescript

# Check if at least one package name is provided
if [ $# -eq 0 ]; then
  echo "Error: Please provide at least one package name to search for."
  echo "Usage: $0 <package-name> [package-name2] ..."
  echo "Examples:"
  echo "  $0 word-wrap"
  echo "  $0 word-wrap@1.2"
  echo "  $0 word-wrap eslint typescript"
  exit 1
fi

PROJECTS=("." "backend" "common" "dev-tools" "test/e2e" "user-interface")

# Function to check for packages in a given directory
check_packages_in_project() {
  local project_dir="$1"
  shift
  local packages=("$@")

  local project_name
  if [ "$project_dir" = "." ]; then
    project_name="root"
  else
    project_name="$project_dir"
  fi

  echo "========================================="
  echo "Checking packages in: $project_name"
  echo "========================================="

  if [ ! -f "$project_dir/package.json" ]; then
    echo "No package.json found in $project_name, skipping..."
    echo ""
    return
  fi

  for package in "${packages[@]}"; do
    echo "Searching for: $package"
    echo "-----------------------------------------"

    # Run npm list for the package and capture output
    if npm_output=$(cd "$project_dir" && npm list "$package" 2>/dev/null); then
      # Check if the output contains "(empty)" which means package not found
      if echo "$npm_output" | grep -q "(empty)"; then
        echo "❌ NOT FOUND: $package"
      else
        echo "✅ FOUND: $package"
        echo "$npm_output" | tail -n +2  # Show dependency tree without the first line
      fi
    else
      echo "❌ NOT FOUND: $package"
    fi
    echo ""
  done
}

# Check each project
for project in "${PROJECTS[@]}"; do
  if [ -d "$project" ]; then
    check_packages_in_project "$project" "$@"
  else
    echo "Warning: Directory '$project' not found, skipping..."
    echo ""
  fi
done

echo "========================================="
echo "Package search completed!"
echo "========================================="

exit 0
