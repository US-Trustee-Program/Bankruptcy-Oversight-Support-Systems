#!/usr/bin/env bash

# A utility script to check for npm packages across all project directories

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/check-for-packages.sh [--verbose] <package-name> [package-name2] ...
#   Examples:
#     ./ops/scripts/utility/check-for-packages.sh word-wrap
#     ./ops/scripts/utility/check-for-packages.sh --verbose word-wrap@1.2
#     ./ops/scripts/utility/check-for-packages.sh --verbose word-wrap@^1.1
#     ./ops/scripts/utility/check-for-packages.sh word-wrap eslint typescript

# Initialize variables
VERBOSE=false
PACKAGES=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    -*)
      echo "Error: Unknown option $1"
      echo "Usage: $0 [--verbose] <package-name> [package-name2] ..."
      exit 1
      ;;
    *)
      PACKAGES+=("$1")
      shift
      ;;
  esac
done

# Check if at least one package name is provided
if [ ${#PACKAGES[@]} -eq 0 ]; then
  echo "Error: Please provide at least one package name to search for."
  echo "Usage: $0 [--verbose] <package-name> [package-name2] ..."
  echo "Examples:"
  echo "  $0 word-wrap"
  echo "  $0 --verbose word-wrap@1.2"
  echo "  $0 word-wrap eslint typescript"
  exit 1
fi

PROJECTS=("." "backend" "common" "dev-tools" "test/e2e" "user-interface")

# Initialize associative arrays to track package findings
declare -A package_findings

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

  if $VERBOSE; then
    echo "========================================="
    echo "Checking packages in: $project_name"
    echo "========================================="
  fi

  if [ ! -f "$project_dir/package.json" ]; then
    if $VERBOSE; then
      echo "No package.json found in $project_name, skipping..."
      echo ""
    fi
    return
  fi

  for package in "${packages[@]}"; do
    if $VERBOSE; then
      echo "Searching for: $package"
      echo "-----------------------------------------"
    fi

    # Run npm list for the package and capture output
    if npm_output=$(cd "$project_dir" && npm list "$package" 2>/dev/null); then
      # Check if the output contains "(empty)" which means package not found
      if echo "$npm_output" | grep -q "(empty)"; then
        if $VERBOSE; then
          echo "❌ NOT FOUND: $package"
        fi
      else
        if $VERBOSE; then
          echo "✅ FOUND: $package"
          echo "$npm_output" | tail -n +2  # Show dependency tree without the first line
        fi

        # Track the finding for summary
        if [ -z "${package_findings[$package]}" ]; then
          package_findings[$package]="$project_name"
        else
          package_findings[$package]="${package_findings[$package]} | $project_name"
        fi
      fi
    else
      if $VERBOSE; then
        echo "❌ NOT FOUND: $package"
      fi
    fi

    if $VERBOSE; then
      echo ""
    fi
  done
}

# Check each project
for project in "${PROJECTS[@]}"; do
  if [ -d "$project" ]; then
    check_packages_in_project "$project" "${PACKAGES[@]}"
  else
    if $VERBOSE; then
      echo "Warning: Directory '$project' not found, skipping..."
      echo ""
    fi
  fi
done

# Display summary
echo "========================================="
echo "Package Search Summary"
echo "========================================="

if [ ${#package_findings[@]} -eq 0 ]; then
  echo "No packages found in any projects."
else
  echo "Found packages:"
  for package in "${PACKAGES[@]}"; do
    if [ -n "${package_findings[$package]}" ]; then
      echo "  $package in: ${package_findings[$package]}"
    fi
  done

  # Show packages that were searched for but not found
  missing_packages=()
  for package in "${PACKAGES[@]}"; do
    if [ -z "${package_findings[$package]}" ]; then
      missing_packages+=("$package")
    fi
  done

  if [ ${#missing_packages[@]} -gt 0 ]; then
    echo ""
    echo "Not found:"
    for package in "${missing_packages[@]}"; do
      echo "  $package"
    done
  fi
fi

echo "========================================="

exit 0
