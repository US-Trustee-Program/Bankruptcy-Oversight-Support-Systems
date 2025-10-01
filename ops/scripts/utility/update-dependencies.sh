#!/usr/bin/env bash

# A utility script for individual dependency updates with safety controls

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/update-dependencies.sh [-c|h|r|u|t]

############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "This script processes outdated npm packages individually with age-based safety controls."
   echo
   echo "Syntax: ./ops/scripts/utility/update-dependencies.sh [-c|h|r|u|t]"
   echo "options:"
   echo "c     Run this script from a CI/CD workflow. Incompatible with other options."
   echo "h     Print this Help and exit."
   echo "r     Run the script but remain on dependency-updates branch."
   echo "u     Run the script but keep the existing dependency-updates branch."
   echo "t     Test mode: run on current branch without switching, committing, or pushing."
   echo
}

############################################################
# Configuration Loading                                    #
############################################################
load_config() {
    local config_file=".dependency-update-config.json"

    if [[ ! -f "$config_file" ]]; then
        echo "Warning: Configuration file $config_file not found. Using defaults."
        MIN_PACKAGE_AGE_DAYS=30
        ALLOWED_PACKAGES=("eslint")
        PROJECTS=("backend" "common" "dev-tools" "test/e2e" "user-interface")
        return
    fi

    # Use jq to parse configuration
    if ! command -v jq &> /dev/null; then
        echo "Error: jq is required but not installed. Please install jq."
        exit 1
    fi

    MIN_PACKAGE_AGE_DAYS=$(jq -r '.minPackageAgeDays // 30' "$config_file")

    # Use mapfile to properly handle array assignment
    mapfile -t ALLOWED_PACKAGES < <(jq -r '.allowedPackages[]?' "$config_file")
    mapfile -t PROJECTS < <(jq -r '.projects[]?' "$config_file")

    echo "Loaded configuration: ${#ALLOWED_PACKAGES[@]} allowed packages, ${MIN_PACKAGE_AGE_DAYS}-day minimum age"
}

############################################################
# Package Version Functions                               #
############################################################
get_package_versions() {
    local package_name="$1"
    npm view "$package_name" versions --json 2>/dev/null
}

get_package_times() {
    local package_name="$1"
    npm view "$package_name" time --json 2>/dev/null
}

############################################################
# Version Filtering with Age Safety                       #
############################################################
filter_safe_versions() {
    local package_name="$1"
    local current_version="$2"

    echo "Checking safe versions for $package_name (current: $current_version)" >&2

    # Declare and assign separately to avoid masking return values
    local versions_json
    local times_json
    versions_json=$(get_package_versions "$package_name")
    times_json=$(get_package_times "$package_name")

    if [[ -z "$versions_json" || -z "$times_json" ]]; then
        echo "Error: Could not fetch version information for $package_name" >&2
        return 1
    fi

    # Calculate cutoff date (MIN_PACKAGE_AGE_DAYS days ago)
    local cutoff_date
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS date command - quote the variable to prevent word splitting
        cutoff_date=$(date -v-"${MIN_PACKAGE_AGE_DAYS}"d -u +"%Y-%m-%dT%H:%M:%S.000Z")
    else
        # Linux date command
        cutoff_date=$(date -u -d "${MIN_PACKAGE_AGE_DAYS} days ago" +"%Y-%m-%dT%H:%M:%S.000Z")
    fi

    echo "Cutoff date: $cutoff_date" >&2

    # Use mapfile for array assignment
    local versions_array
    mapfile -t versions_array < <(echo "$versions_json" | jq -r '.[]? // empty')

    # Find the index of current version
    local current_index=-1
    for i in "${!versions_array[@]}"; do
        if [[ "${versions_array[$i]}" == "$current_version" ]]; then
            current_index=$i
            break
        fi
    done

    if [[ $current_index -eq -1 ]]; then
        echo "Current version $current_version not found in versions list" >&2
        return 1
    fi

    # Only check versions newer than current (from the end of array backwards)
    local newer_versions=("${versions_array[@]:$((current_index + 1))}")

    if [[ ${#newer_versions[@]} -eq 0 ]]; then
        echo "No newer versions available for $package_name" >&2
        return 1
    fi

    echo "Found ${#newer_versions[@]} newer versions to evaluate" >&2

    # Start from the newest and work backwards to find the first version that meets age requirement
    for ((i=${#newer_versions[@]}-1; i>=0; i--)); do
        local version="${newer_versions[$i]}"

        # Declare and assign separately to avoid masking return values
        local pub_date
        pub_date=$(echo "$times_json" | jq -r --arg v "$version" '.[$v] // empty')

        if [[ -z "$pub_date" ]]; then
            echo "No publication date found for $package_name@$version (possibly depublished)" >&2
            continue
        fi

        # Check if version is old enough
        if [[ "$pub_date" < "$cutoff_date" ]]; then
            echo "Found safe version: $package_name@$version (published: $pub_date)" >&2
            echo "$version"
            return 0
        else
            echo "Skipping $package_name@$version (too recent: $pub_date)" >&2
        fi
    done

    echo "No safe versions found for $package_name (all newer versions are too recent)" >&2
    return 1
}

############################################################
# Package Checking Functions                              #
############################################################
check_package_allowed() {
    local package_name="$1"

    for allowed in "${ALLOWED_PACKAGES[@]}"; do
        if [[ "$package_name" == "$allowed" ]]; then
            return 0
        fi
    done
    return 1
}

############################################################
# Individual Package Update                               #
############################################################
update_package_individually() {
    local package_name="$1"
    local target_version="$2"
    local project_dir="$3"

    echo "Updating $package_name to $target_version in $project_dir"

    pushd "$project_dir" >/dev/null || return 1

    # Install exact version
    if npm install --save-exact "$package_name@$target_version"; then
        popd >/dev/null || return 1

        # Create individual commit only if not in test mode
        if [[ -z "${TEST}" ]]; then
            git add "$project_dir/package.json" "$project_dir/package-lock.json"
            git commit -m "Update $package_name to $target_version in $project_dir"
            echo "Successfully updated $package_name to $target_version in $project_dir"
        else
            echo "TEST MODE: Updated $package_name to $target_version in $project_dir (no commit)"
        fi
        return 0
    else
        popd >/dev/null || return 1
        echo "Failed to update $package_name to $target_version in $project_dir"
        return 1
    fi
}

############################################################
# Process Outdated Packages                               #
############################################################
process_project_packages() {
    local project_dir="$1"
    local updated_count=0

    echo "Processing packages in $project_dir"

    pushd "$project_dir" >/dev/null || return 1

    # Declare and assign separately to avoid masking return values
    local outdated_json
    outdated_json=$(npm outdated --json 2>/dev/null || echo "{}")

    popd >/dev/null || return 1

    if [[ "$outdated_json" == "{}" ]]; then
        echo "No outdated packages found in $project_dir"
        return 0
    fi

    # Declare and assign separately to avoid masking return values
    local packages
    packages=$(echo "$outdated_json" | jq -r 'keys[]?')

    while IFS= read -r package_name; do
        [[ -z "$package_name" ]] && continue

        echo "Checking package: $package_name"

        # Check if package is in allowed list
        if ! check_package_allowed "$package_name"; then
            echo "Skipping $package_name (not in allowed packages list)"
            continue
        fi

        # Declare and assign separately to avoid masking return values
        local current_version
        current_version=$(echo "$outdated_json" | jq -r --arg pkg "$package_name" '.[$pkg].current // empty')

        if [[ -z "$current_version" ]]; then
            echo "Could not determine current version for $package_name"
            continue
        fi

        # Find safe version to update to
        local safe_version
        if safe_version=$(filter_safe_versions "$package_name" "$current_version"); then
            echo "Found safe version for $package_name: $safe_version"

            # Update the package
            if update_package_individually "$package_name" "$safe_version" "$project_dir"; then
                ((updated_count++))
            fi
        else
            echo "No safe version found for $package_name"
        fi

    done <<< "$packages"

    echo "Updated $updated_count packages in $project_dir"
    return 0
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################
while getopts ":chrut" option; do
  case $option in
    c) # CI/CD
      CICD=true
      ;;
    h) # display help
      Help
      exit;;
    r) # stay on dependency-updates branch upon completion
      REMAIN=true
      ;;
    u) # update existing dependency-updates branch
      UPDATE=true
      ;;
    t) # test mode
      TEST=true
      ;;
    \?) # Invalid option
      echo "Run with the '-h' option to see valid usage."
      exit 1
      ;;
  esac
done

# Load configuration
load_config

BRANCH_NAME="dependency-updates"

if [[ -n "${TEST}" ]]; then
  # Test mode: stay on current branch, no Git operations
  echo "TEST MODE: Running on current branch without switching"
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "Current branch: $CURRENT_BRANCH"
elif [[ -n "${CICD}" ]]; then
  BRANCH_NAME="dependency-updates-auto"
  git switch -c "${BRANCH_NAME}"
else
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ -n $(git status -s) ]]; then
    STASHED_CHANGE=true
    git stash
  fi
  if [[ -z "${UPDATE}" ]]; then
    git switch main
    git pull --rebase
    git branch -D "${BRANCH_NAME}"
    git switch -c "${BRANCH_NAME}"
  else
    git checkout "${BRANCH_NAME}"
    git pull --rebase
  fi
fi

echo "Starting individual package updates with ${MIN_PACKAGE_AGE_DAYS}-day minimum age requirement"
echo "Allowed packages: ${ALLOWED_PACKAGES[*]}"

total_updates=0

# Process root level if it has package.json
if [[ -f "package.json" ]]; then
    echo "Processing root level packages"
    npm ci
    if process_project_packages "."; then
        root_updates=$?
        ((total_updates += root_updates))
    fi
fi

# Process sub-projects
for project in "${PROJECTS[@]}"; do
    if [[ -d "$project" && -f "$project/package.json" ]]; then
        echo "Processing project: $project"
        pushd "$project" >/dev/null || continue

        # Clean and install dependencies first
        if command -v npm run clean &> /dev/null; then
            npm run clean 2>/dev/null || true
        fi
        npm ci

        popd >/dev/null || return 1

        if process_project_packages "$project"; then
            project_updates=$?
            ((total_updates += project_updates))
        fi
    else
        echo "Skipping $project (not found or no package.json)"
    fi
done

echo "Total packages updated: $total_updates"

if [[ -n "${TEST}" ]]; then
  # Test mode: no Git push or branch switching
  echo "TEST MODE: Skipping Git push and branch operations"
  if [[ $total_updates -gt 0 ]]; then
    echo "In normal mode, would push $total_updates updates to $BRANCH_NAME branch"
  fi
elif [[ $total_updates -gt 0 ]]; then
  git push -u origin "${BRANCH_NAME}"
  echo "Changes pushed to $BRANCH_NAME branch"
else
  echo "No packages were updated - no changes to push"
fi

if [[ -n "${CICD}" ]]; then
  exit 0
fi

if [[ -n "${TEST}" ]]; then
  # Test mode: no branch switching back
  echo "TEST MODE: Staying on current branch ($CURRENT_BRANCH)"
elif [[ -z "${REMAIN}" ]]; then
  git switch "$CURRENT_BRANCH"
  if [[ -n "${STASHED_CHANGE}" ]]; then
    git stash pop
  fi
elif [[ -n "${STASHED_CHANGE}" ]]; then
  echo "Remaining on '${BRANCH_NAME}' branch, but don't forget you have changes to ${CURRENT_BRANCH} that were stashed."
fi

if [[ -z "${CICD}" ]] && [[ -z "${TEST}" ]] && [[ $total_updates -gt 0 ]]; then
  open "https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/compare/main...${BRANCH_NAME}?template=dependencies.md";
fi

exit 0
