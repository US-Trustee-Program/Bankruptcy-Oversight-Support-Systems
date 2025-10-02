#!/usr/bin/env bash

# A utility script for individual dependency updates with safety controls

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/update-dependencies.sh [-c|h|r|u|t]

############################################################
# Global Variables for Tracking                           #
############################################################
declare -a UPDATED_PACKAGES
declare -a SKIPPED_PACKAGES
declare -a FAILED_PACKAGES

############################################################
# Manifest Tracking Functions                             #
############################################################
add_updated_package() {
    local package_name="$1"
    local old_version="$2"
    local new_version="$3"
    local project="$4"

    UPDATED_PACKAGES+=("$package_name|$old_version|$new_version|$project")
}

add_skipped_package() {
    local package_name="$1"
    local current_version="$2"
    local reason="$3"
    local project="$4"

    SKIPPED_PACKAGES+=("$package_name|$current_version|$reason|$project")
}

add_failed_package() {
    local package_name="$1"
    local current_version="$2"
    local target_version="$3"
    local error_details="$4"
    local project="$5"

    FAILED_PACKAGES+=("$package_name|$current_version|$target_version|$error_details|$project")
}

############################################################
# Error Handling Functions                                #
############################################################
handle_npm_command_error() {
    local command="$1"
    local package_name="$2"
    local exit_code="$3"
    local error_output="$4"

    echo "ERROR: NPM command failed - $command" >&2
    echo "Package: $package_name" >&2
    echo "Exit code: $exit_code" >&2
    if [[ -n "$error_output" ]]; then
        echo "Error output: $error_output" >&2
    fi

    return "$exit_code"
}

safe_npm_command() {
    local command_description="$1"
    shift
    local command_args=("$@")

    echo "Executing: npm ${command_args[*]}" >&2

    local output
    local exit_code

    # Capture both stdout and stderr, and get exit code
    if output=$(npm "${command_args[@]}" 2>&1); then
        echo "$output"
        return 0
    else
        exit_code=$?
        echo "NPM command failed: $command_description" >&2
        echo "Command: npm ${command_args[*]}" >&2
        echo "Exit code: $exit_code" >&2
        echo "Output: $output" >&2
        return $exit_code
    fi
}

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
        USE_ALLOWLIST=true
        PROJECTS=("backend" "common" "dev-tools" "test/e2e" "user-interface")
        PINNED_PACKAGES=()
        declare -gA MAJOR_VERSION_LOCKS
        return
    fi

    # Use jq to parse configuration
    if ! command -v jq &> /dev/null; then
        echo "Error: jq is required but not installed. Please install jq."
        exit 1
    fi

    MIN_PACKAGE_AGE_DAYS=$(jq -r '.minPackageAgeDays // 30' "$config_file")

    # Check if allowedPackages is defined
    local has_allowed
    has_allowed=$(jq 'has("allowedPackages")' "$config_file")

    if [[ "$has_allowed" == "true" ]]; then
        # Allowlist mode: use the specified allowed packages
        USE_ALLOWLIST=true
        mapfile -t ALLOWED_PACKAGES < <(jq -r '.allowedPackages[]?' "$config_file")
        echo "Using allowlist mode: processing only ${#ALLOWED_PACKAGES[@]} allowed packages"
    else
        # Permissive mode: process all packages (constraints provide safety)
        USE_ALLOWLIST=false
        ALLOWED_PACKAGES=()
        echo "Using permissive mode: processing all packages (constraints provide safety)"
    fi

    mapfile -t PROJECTS < <(jq -r '.projects[]?' "$config_file")

    # Load constraints
    mapfile -t PINNED_PACKAGES < <(jq -r '.constraints.pinned[]?' "$config_file")

    # Load major version locks into associative array
    declare -gA MAJOR_VERSION_LOCKS
    while IFS="=" read -r key value; do
        if [[ -n "$key" && -n "$value" ]]; then
            MAJOR_VERSION_LOCKS["$key"]="$value"
        fi
    done < <(jq -r '.constraints.majorVersionLock | to_entries[] | "\(.key)=\(.value)"' "$config_file" 2>/dev/null || true)

    # Load major version delay constraints
    declare -gA MAJOR_VERSION_DELAY_DAYS
    while IFS="=" read -r key value; do
        if [[ -n "$key" && -n "$value" ]]; then
            MAJOR_VERSION_DELAY_DAYS["$key"]="$value"
        fi
    done < <(jq -r '.constraints.majorVersionDelay | to_entries[] | "\(.key)=\(.value)"' "$config_file" 2>/dev/null || true)

    # Display configuration summary
    echo "Loaded configuration: ${MIN_PACKAGE_AGE_DAYS}-day minimum age"
    if [[ "$USE_ALLOWLIST" == "true" ]]; then
        echo "Allowed packages: ${ALLOWED_PACKAGES[*]}"
    else
        echo "Processing all packages (permissive mode)"
    fi
    if [[ ${#PINNED_PACKAGES[@]} -gt 0 ]]; then
        echo "Pinned packages (will be skipped): ${PINNED_PACKAGES[*]}"
    fi
    if [[ ${#MAJOR_VERSION_LOCKS[@]} -gt 0 ]]; then
        echo "Major version locks configured for ${#MAJOR_VERSION_LOCKS[@]} packages"
    fi
    if [[ ${#MAJOR_VERSION_DELAY_DAYS[@]} -gt 0 ]]; then
        echo "Major version delay constraints configured for ${#MAJOR_VERSION_DELAY_DAYS[@]} packages"
    fi
}

############################################################
# Package Version Functions                               #
############################################################
get_package_versions() {
    local package_name="$1"
    local output
    local exit_code

    if output=$(safe_npm_command "get package versions for $package_name" view "$package_name" versions --json); then
        echo "$output"
        return 0
    else
        exit_code=$?
        echo "Failed to get versions for $package_name" >&2
        return $exit_code
    fi
}

get_package_times() {
    local package_name="$1"
    local output
    local exit_code

    if output=$(safe_npm_command "get package times for $package_name" view "$package_name" time --json); then
        echo "$output"
        return 0
    else
        exit_code=$?
        echo "Failed to get package times for $package_name" >&2
        return $exit_code
    fi
}

############################################################
# Version Filtering with Age Safety                       #
############################################################
is_stable_version() {
    local version="$1"
    # Check if version matches stable semver pattern: major.minor.patch (digits only)
    if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        return 0
    else
        return 1
    fi
}

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

    # Start from the newest and work backwards to find the first stable version that meets age requirement
    for ((i=${#newer_versions[@]}-1; i>=0; i--)); do
        local version="${newer_versions[$i]}"

        # Skip non-stable versions (alpha, beta, rc, etc.)
        if ! is_stable_version "$version"; then
            echo "Skipping $package_name@$version (not a stable version)" >&2
            continue
        fi

        # Declare and assign separately to avoid masking return values
        local pub_date
        pub_date=$(echo "$times_json" | jq -r --arg v "$version" '.[$v] // empty')

        if [[ -z "$pub_date" ]]; then
            echo "No publication date found for $package_name@$version (possibly depublished)" >&2
            continue
        fi

        # Check if version is old enough
        if [[ "$pub_date" < "$cutoff_date" ]]; then
            # Check for major version delay constraints
            local delay_days=""

            # First check for package-specific delay
            if [[ -n "${MAJOR_VERSION_DELAY_DAYS[$package_name]}" ]]; then
                delay_days="${MAJOR_VERSION_DELAY_DAYS[$package_name]}"
            # Fall back to wildcard delay if no specific override
            elif [[ -n "${MAJOR_VERSION_DELAY_DAYS["*"]}" ]]; then
                delay_days="${MAJOR_VERSION_DELAY_DAYS["*"]}"
            fi

            if [[ -n "$delay_days" ]]; then
                local current_major="${current_version%%.*}"
                local target_major="${version%%.*}"

                # If this is a major version change, check if it's a x.0.0 version
                if [[ "$current_major" != "$target_major" ]]; then
                    local minor_patch="${version#*.}"  # Get everything after first dot
                    local minor="${minor_patch%%.*}"   # Get minor version
                    local patch="${minor_patch#*.}"    # Get patch version

                    # If this is a x.0.0 version, apply additional delay
                    if [[ "$minor" == "0" && "$patch" == "0" ]]; then
                        # Calculate extended cutoff date for x.0.0 versions
                        local extended_cutoff_date
                        if [[ "$OSTYPE" == "darwin"* ]]; then
                            extended_cutoff_date=$(date -v-"${delay_days}"d -u +"%Y-%m-%dT%H:%M:%S.000Z")
                        else
                            extended_cutoff_date=$(date -u -d "${delay_days} days ago" +"%Y-%m-%dT%H:%M:%S.000Z")
                        fi

                        if [[ "$pub_date" < "$extended_cutoff_date" ]]; then
                            # Determine if using package-specific or wildcard delay
                            local delay_source="package-specific"
                            if [[ -z "${MAJOR_VERSION_DELAY_DAYS[$package_name]}" ]]; then
                                delay_source="default wildcard"
                            fi
                            echo "Found safe major version: $package_name@$version (published: $pub_date, waited $delay_days days for x.0.0, $delay_source)" >&2
                            echo "$version"
                            return 0
                        else
                            echo "Skipping $package_name@$version (major version x.0.0 needs $delay_days days, published: $pub_date)" >&2
                            continue
                        fi
                    else
                        echo "Found safe major version: $package_name@$version (published: $pub_date, not x.0.0 so no extra delay)" >&2
                        echo "$version"
                        return 0
                    fi
                fi
            fi

            echo "Found safe version: $package_name@$version (published: $pub_date)" >&2
            echo "$version"
            return 0
        else
            echo "Skipping $package_name@$version (too recent: $pub_date)" >&2
        fi
    done

    echo "No safe stable versions found for $package_name (all newer stable versions are too recent)" >&2
    return 1
}

############################################################
# Package Checking Functions                              #
############################################################
check_package_allowed() {
    local package_name="$1"

    if [[ "$USE_ALLOWLIST" == "true" ]]; then
        # Allowlist mode: only allow packages in ALLOWED_PACKAGES
        for allowed in "${ALLOWED_PACKAGES[@]}"; do
            if [[ "$package_name" == "$allowed" ]]; then
                return 0  # Package is allowed
            fi
        done
        return 1  # Package is not in allowlist
    else
        # Permissive mode: allow all packages (constraints provide safety)
        return 0  # All packages are allowed
    fi
}

############################################################
# Constraints Checking Functions                          #
############################################################
check_constraints() {
    local package_name="$1"
    local current_version="$2"
    local target_version="$3"

    # Check if package is pinned
    for pinned in "${PINNED_PACKAGES[@]}"; do
        if [[ "$package_name" == "$pinned" ]]; then
            echo "Skipping $package_name (pinned package - updates disabled)"
            return 1
        fi
    done

    # Check major version lock constraints
    if [[ -n "${MAJOR_VERSION_LOCKS[$package_name]}" ]]; then
        local locked_major="${MAJOR_VERSION_LOCKS[$package_name]}"
        local current_major="${current_version%%.*}"
        local target_major="${target_version%%.*}"

        # Verify current version matches the locked major version
        if [[ "$current_major" != "$locked_major" ]]; then
            echo "Warning: $package_name current version $current_version doesn't match locked major version $locked_major"
        fi

        # Check if target version would violate major version lock
        if [[ "$target_major" != "$locked_major" ]]; then
            echo "Skipping $package_name (major version lock: locked to v$locked_major, target v$target_major)"
            return 1
        fi

        echo "Constraint check passed for $package_name: target v$target_version respects major version lock v$locked_major"
    fi

    # Check major version delay constraints
    if [[ -n "${MAJOR_VERSION_DELAY_DAYS[$package_name]}" ]]; then
        local delay_days="${MAJOR_VERSION_DELAY_DAYS[$package_name]}"
        local current_major="${current_version%%.*}"
        local target_major="${target_version%%.*}"

        # Only warn if the major version is changing
        if [[ "$current_major" != "$target_major" ]]; then
            echo "Warning: $package_name major version change from $current_major to $target_major may be delayed by $delay_days days"
        fi
    fi

    return 0
}

############################################################
# Individual Package Update                               #
############################################################
update_package_individually() {
    local package_name="$1"
    local target_version="$2"
    local project_dir="$3"
    local current_version="$4"

    echo "Updating $package_name to $target_version in $project_dir"

    pushd "$project_dir" >/dev/null || {
        local error_msg="Failed to change directory to $project_dir"
        echo "$error_msg" >&2
        add_failed_package "$package_name" "$current_version" "$target_version" "$error_msg" "$project_dir"
        return 1
    }

    # Install exact version with enhanced error handling
    local npm_output
    local npm_exit_code

    if npm_output=$(safe_npm_command "install $package_name@$target_version" install --save-exact "$package_name@$target_version" 2>&1); then
        popd >/dev/null || return 1

        # Create individual commit only if not in test mode
        if [[ -z "${TEST}" ]]; then
            if git add "$project_dir/package.json" "$project_dir/package-lock.json" && \
               git commit -m "Update $package_name to $target_version in $project_dir"; then
                echo "Successfully updated $package_name to $target_version in $project_dir"
                add_updated_package "$package_name" "$current_version" "$target_version" "$project_dir"
                return 0
            else
                local git_error="Git commit failed for $package_name update"
                echo "$git_error" >&2
                add_failed_package "$package_name" "$current_version" "$target_version" "$git_error" "$project_dir"
                return 1
            fi
        else
            echo "TEST MODE: Updated $package_name to $target_version in $project_dir (no commit)"
            add_updated_package "$package_name" "$current_version" "$target_version" "$project_dir"
            return 0
        fi
    else
        npm_exit_code=$?
        popd >/dev/null || return 1

        # Extract meaningful error from npm output
        local error_summary="NPM install failed (exit code: $npm_exit_code)"
        if [[ "$npm_output" == *"ERESOLVE"* ]]; then
            error_summary="Dependency resolution conflict"
        elif [[ "$npm_output" == *"404"* ]]; then
            error_summary="Package version not found"
        elif [[ "$npm_output" == *"EACCES"* ]]; then
            error_summary="Permission denied"
        elif [[ "$npm_output" == *"ENOTFOUND"* ]]; then
            error_summary="Network/DNS error"
        fi

        echo "Failed to update $package_name to $target_version in $project_dir: $error_summary" >&2
        add_failed_package "$package_name" "$current_version" "$target_version" "$error_summary" "$project_dir"
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

    pushd "$project_dir" >/dev/null || {
        echo "ERROR: Failed to change directory to $project_dir" >&2
        return 1
    }

    # Handle npm outdated specially - it returns exit code 1 when packages are outdated
    local outdated_json
    local npm_exit_code

    # Run npm outdated directly without the safe_npm_command wrapper
    if outdated_json=$(npm outdated --json 2>/dev/null); then
        # npm outdated succeeded (no outdated packages)
        npm_exit_code=0
    else
        npm_exit_code=$?
        # npm outdated returns 1 when there are outdated packages, which is expected
        # Capture the output even with exit code 1
        outdated_json=$(npm outdated --json 2>/dev/null || echo "{}")
    fi

    popd >/dev/null || return 1

    # Handle different exit codes appropriately
    if [[ $npm_exit_code -eq 0 ]]; then
        # No outdated packages
        if [[ "$outdated_json" == "{}" || -z "$outdated_json" ]]; then
            echo "No outdated packages found in $project_dir"
            return $updated_count
        fi
    elif [[ $npm_exit_code -eq 1 ]]; then
        # Outdated packages found - this is expected, continue processing
        if [[ -z "$outdated_json" || "$outdated_json" == "{}" ]]; then
            echo "No outdated packages found in $project_dir (empty result despite exit code 1)"
            return $updated_count
        fi
    else
        # Actual error (network issues, permission problems, etc.)
        echo "ERROR: Failed to get outdated packages for $project_dir (exit code: $npm_exit_code)" >&2
        return $updated_count
    fi

    # Declare and assign separately to avoid masking return values
    local packages
    if ! packages=$(echo "$outdated_json" | jq -r 'keys[]?' 2>/dev/null); then
        echo "ERROR: Failed to parse outdated packages JSON for $project_dir" >&2
        return $updated_count
    fi

    local packages_processed=0
    local packages_failed=0

    while IFS= read -r package_name; do
        [[ -z "$package_name" ]] && continue
        ((packages_processed++))

        echo "Checking package: $package_name in $project_dir"

        # Check if package is in allowed list
        if ! check_package_allowed "$package_name"; then
            echo "Skipping $package_name (not in allowed packages list)"
            add_skipped_package "$package_name" "unknown" "Not in allowed packages list" "$project_dir"
            continue
        fi

        # Declare and assign separately to avoid masking return values
        local current_version
        current_version=$(echo "$outdated_json" | jq -r --arg pkg "$package_name" '.[$pkg].current // empty')

        if [[ -z "$current_version" ]]; then
            echo "Could not determine current version for $package_name"
            add_failed_package "$package_name" "unknown" "unknown" "Could not determine current version" "$project_dir"
            ((packages_failed++))
            continue
        fi

        # Find safe version to update to
        local safe_version
        if safe_version=$(filter_safe_versions "$package_name" "$current_version" 2>/dev/null); then
            echo "Found safe version for $package_name: $safe_version"

            # Check constraints before updating
            if check_constraints "$package_name" "$current_version" "$safe_version"; then
                # Update the package - continue processing even if this fails
                if update_package_individually "$package_name" "$safe_version" "$project_dir" "$current_version"; then
                    ((updated_count++))
                    echo "✅ Successfully updated $package_name from $current_version to $safe_version in $project_dir"
                else
                    ((packages_failed++))
                    echo "❌ Failed to update $package_name from $current_version to $safe_version in $project_dir"
                fi
            else
                local constraint_reason="Constraints not met"
                # Check which constraint failed for better messaging
                for pinned in "${PINNED_PACKAGES[@]}"; do
                    if [[ "$package_name" == "$pinned" ]]; then
                        constraint_reason="Pinned package - updates disabled"
                        break
                    fi
                done

                if [[ -n "${MAJOR_VERSION_LOCKS[$package_name]}" ]]; then
                    local locked_major="${MAJOR_VERSION_LOCKS[$package_name]}"
                    local target_major="${safe_version%%.*}"
                    if [[ "$target_major" != "$locked_major" ]]; then
                        constraint_reason="Major version lock violation (locked to v$locked_major, target v$target_major)"
                    fi
                fi

                echo "Skipping $package_name: $constraint_reason"
                add_skipped_package "$package_name" "$current_version" "$constraint_reason" "$project_dir"
            fi
        else
            echo "No safe version found for $package_name (age requirements not met)"
            add_skipped_package "$package_name" "$current_version" "No safe version found (age requirements not met)" "$project_dir"
        fi

    done <<< "$packages"

    echo "Completed processing $project_dir: $updated_count updated, $packages_failed failed, $packages_processed total packages"
    return $updated_count
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

# Process projects from configuration
for project in "${PROJECTS[@]}"; do
    # Handle special "root" keyword
    if [[ "$project" == "root" ]]; then
        if [[ -f "package.json" ]]; then
            echo "Processing root level packages"
            npm ci
            process_project_packages "."
            project_updates=$?
            ((total_updates += project_updates))
        else
            echo "Skipping root (no package.json found)"
        fi
        continue
    fi

    # Handle glob patterns
    if [[ "$project" == *"*"* ]]; then
        # Expand glob pattern
        for expanded_path in $project; do
            if [[ -d "$expanded_path" && -f "$expanded_path/package.json" ]]; then
                echo "Processing project: $expanded_path (from glob: $project)"
                pushd "$expanded_path" >/dev/null || continue

                # Clean and install dependencies first
                if command -v npm run clean &> /dev/null; then
                    npm run clean 2>/dev/null || true
                fi
                npm ci

                popd >/dev/null || return 1

                process_project_packages "$expanded_path"
                project_updates=$?
                ((total_updates += project_updates))
            fi
        done
        continue
    fi

    # Handle regular directory paths
    if [[ -d "$project" && -f "$project/package.json" ]]; then
        echo "Processing project: $project"
        pushd "$project" >/dev/null || continue

        # Clean and install dependencies first
        if command -v npm run clean &> /dev/null; then
            npm run clean 2>/dev/null || true
        fi
        npm ci

        popd >/dev/null || return 1

        process_project_packages "$project"
        project_updates=$?
        ((total_updates += project_updates))
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

# Continue to manifest generation for all modes

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

############################################################
# Summary and Reporting Functions                         #
############################################################
generate_update_manifest() {
    local manifest_file="dependency-update-manifest.md"

    echo "Generating update manifest: $manifest_file"

    # Create manifest file
    cat > "$manifest_file" << 'EOF'
# Dependency Update Report

This PR contains automated dependency updates with safety controls applied.

## Configuration Summary

EOF

    # Add configuration details
    {
        echo "- **Minimum package age**: ${MIN_PACKAGE_AGE_DAYS} days"
        echo "- **Allowed packages**: ${#ALLOWED_PACKAGES[@]} packages configured"
        echo "- **Projects processed**: ${#PROJECTS[@]} projects"
        if [[ ${#PINNED_PACKAGES[@]} -gt 0 ]]; then
            echo "- **Pinned packages**: ${#PINNED_PACKAGES[@]} packages blocked from updates"
        fi
        if [[ ${#MAJOR_VERSION_LOCKS[@]} -gt 0 ]]; then
            echo "- **Major version locks**: ${#MAJOR_VERSION_LOCKS[@]} packages with major version constraints"
        fi
        if [[ ${#MAJOR_VERSION_DELAY_DAYS[@]} -gt 0 ]]; then
            echo "- **Major version delays**: ${#MAJOR_VERSION_DELAY_DAYS[@]} packages with x.0.0 version delays"
        fi
        echo ""
    } >> "$manifest_file"

    local total_updated=${#UPDATED_PACKAGES[@]}
    local total_skipped=${#SKIPPED_PACKAGES[@]}
    local total_failed=${#FAILED_PACKAGES[@]}

    # Add statistics
    {
        echo "## Summary Statistics"
        echo ""
        echo "- ✅ **Successfully updated**: $total_updated package instances"
        echo "- ⏭️ **Skipped**: $total_skipped package instances"
        echo "- ❌ **Failed**: $total_failed package instances"
        echo ""
    } >> "$manifest_file"

    # Group updated packages by name across projects
    if [[ $total_updated -gt 0 ]]; then
        echo "## ✅ Updated Packages" >> "$manifest_file"
        echo "" >> "$manifest_file"

        # Create associative array to group packages
        declare -A package_updates
        for entry in "${UPDATED_PACKAGES[@]}"; do
            IFS='|' read -r package old_version new_version project <<< "$entry"
            # Convert "." to "root" for better readability
            local display_project="$project"
            if [[ "$project" == "." ]]; then
                display_project="root"
            fi

            local update_key="${package}|${old_version}|${new_version}"
            if [[ -n "${package_updates[$update_key]}" ]]; then
                package_updates[$update_key]="${package_updates[$update_key]}, $display_project"
            else
                package_updates[$update_key]="$display_project"
            fi
        done

        # Output grouped packages
        for update_key in "${!package_updates[@]}"; do
            IFS='|' read -r package old_version new_version <<< "$update_key"
            local projects="${package_updates[$update_key]}"
            echo "- **$package**: \`$old_version\` → \`$new_version\` (in: $projects)" >> "$manifest_file"
        done
        echo "" >> "$manifest_file"
    fi

    # Add skipped packages with reasons
    if [[ $total_skipped -gt 0 ]]; then
        {
            echo "## ⏭️ Skipped Packages"
            echo ""
            echo "The following packages were skipped for safety or policy reasons:"
            echo ""
        } >> "$manifest_file"

        # Group skipped packages by reason
        declare -A skip_reasons
        for entry in "${SKIPPED_PACKAGES[@]}"; do
            IFS='|' read -r package current_version reason project <<< "$entry"
            local skip_key="$reason"
            if [[ -n "${skip_reasons[$skip_key]}" ]]; then
                skip_reasons[$skip_key]="${skip_reasons[$skip_key]}, $package@$current_version ($project)"
            else
                skip_reasons[$skip_key]="$package@$current_version ($project)"
            fi
        done

        # Output grouped skipped packages
        for reason in "${!skip_reasons[@]}"; do
            local packages="${skip_reasons[$reason]}"
            {
                echo "### $reason"
                echo "- $packages"
                echo ""
            } >> "$manifest_file"
        done
    fi

    # Add failed packages if any
    if [[ $total_failed -gt 0 ]]; then
        {
            echo "## ❌ Failed Updates"
            echo ""
            echo "The following package updates failed and require manual attention:"
            echo ""
        } >> "$manifest_file"

        for entry in "${FAILED_PACKAGES[@]}"; do
            IFS='|' read -r package current_version target_version error_details project <<< "$entry"
            echo "- **$package** in $project: \`$current_version\` → \`$target_version\`" >> "$manifest_file"
            echo "  - Error: $error_details" >> "$manifest_file"
        done
        echo "" >> "$manifest_file"
    fi

    # Add footer
    {
        echo "## Notes"
        echo ""
        echo "- All updates respect the configured ${MIN_PACKAGE_AGE_DAYS}-day minimum age requirement"
        echo "- Only packages in the allowed list are considered for updates"
        echo "- Major version locks and other constraints are enforced"
        echo "- Each package update is committed individually for easy review and rollback"
        echo ""
        echo "---"
        echo "*Generated by automated dependency update script on $(date)*"
    } >> "$manifest_file"

    echo "Manifest generated: $manifest_file"
}

generate_execution_summary() {
    echo ""
    echo "=============================================="
    echo "DEPENDENCY UPDATE EXECUTION SUMMARY"
    echo "=============================================="

    local total_updated=${#UPDATED_PACKAGES[@]}
    local total_skipped=${#SKIPPED_PACKAGES[@]}
    local total_failed=${#FAILED_PACKAGES[@]}
    local total_processed=$((total_updated + total_skipped + total_failed))

    echo "📊 STATISTICS:"
    echo "   Total packages processed: $total_processed"
    echo "   ✅ Successfully updated: $total_updated"
    echo "   ⏭️ Skipped: $total_skipped"
    echo "   ❌ Failed: $total_failed"
    echo ""

    if [[ $total_updated -gt 0 ]]; then
        echo "✅ SUCCESSFULLY UPDATED PACKAGES:"
        for entry in "${UPDATED_PACKAGES[@]}"; do
            IFS='|' read -r package old_version new_version project <<< "$entry"
            echo "   • $package: $old_version → $new_version ($project)"
        done
        echo ""
    fi

    if [[ $total_skipped -gt 0 ]]; then
        echo "⏭️ SKIPPED PACKAGES:"
        for entry in "${SKIPPED_PACKAGES[@]}"; do
            IFS='|' read -r package current_version reason project <<< "$entry"
            echo "   • $package@$current_version in $project: $reason"
        done
        echo ""
    fi

    if [[ $total_failed -gt 0 ]]; then
        echo "❌ FAILED PACKAGE UPDATES:"
        for entry in "${FAILED_PACKAGES[@]}"; do
            IFS='|' read -r package current_version target_version error_details project <<< "$entry"
            echo "   • $package: $current_version → $target_version ($project)"
            echo "     Error: $error_details"
        done
        echo ""
    fi

    echo "=============================================="

    # Return appropriate exit code
    if [[ $total_failed -gt 0 ]]; then
        echo "⚠️  Some package updates failed, but processing continued."
        if [[ $total_updated -gt 0 ]]; then
            echo "✅ $total_updated packages were successfully updated despite the failures."
        fi
        return 1
    elif [[ $total_updated -gt 0 ]]; then
        echo "🎉 All attempted package updates completed successfully!"
        return 0
    else
        echo "ℹ️  No packages were updated (all were skipped or no updates available)."
        return 0
    fi
}

# Generate update manifest for PR description
generate_update_manifest

# Generate summary report
generate_execution_summary

# Exit with appropriate code based on whether packages were updated
total_updated=${#UPDATED_PACKAGES[@]}
echo "Total packages updated: $total_updated"

# Return 0 for success, 1 for failure (don't use package count as exit code)
if [[ $total_updated -gt 0 ]]; then
    echo "SUCCESS: $total_updated packages were updated"
    exit 0
else
    echo "INFO: No packages were updated"
    exit 0
fi
