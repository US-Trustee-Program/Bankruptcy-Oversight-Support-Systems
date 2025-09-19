#!/bin/bash

# Veracode SAST Debug Scan Script
# This script downloads the Veracode pipeline scan tool, downloads the policy,
# packages the source code, and runs a debug scan with verbose logging.

# Usage
#   From the root directory, run the following command:
#     ./ops/scripts/utility/veracode-debug-scan.sh
#   Requires the following environment variables to be set:
#     VERACODE_API_ID, VERACODE_API_KEY, VERACODE_SAST_POLICY

set -e

# Check for required environment variables
if [ -z "$VERACODE_API_ID" ]; then
    echo "Error: VERACODE_API_ID environment variable is required"
    exit 1
fi

if [ -z "$VERACODE_API_KEY" ]; then
    echo "Error: VERACODE_API_KEY environment variable is required"
    exit 1
fi

if [ -z "$VERACODE_SAST_POLICY" ]; then
    echo "Error: VERACODE_SAST_POLICY environment variable is required"
    exit 1
fi

# Set up directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../" && pwd)"
SCAN_DIR="$REPO_ROOT/veracode-debug-scan"

echo "Creating scan directory: $SCAN_DIR"
mkdir -p "$SCAN_DIR"
cd "$SCAN_DIR"

# Clean up previous scan artifacts
echo "Cleaning up previous scan artifacts..."
rm -f pipeline-scan-LATEST.zip pipeline-scan.jar cams.zip ./*.json ./*.log

echo "Starting Veracode debug scan process..."

# Step 1: Download the pipeline-scan tool
echo "Step 1: Downloading pipeline-scan tool..."
curl -sSO https://downloads.veracode.com/securityscan/pipeline-scan-LATEST.zip
unzip -o pipeline-scan-LATEST.zip
java -jar pipeline-scan.jar --version

# Step 2: Package source code for scan
echo "Step 2: Packaging source code..."
cd "$REPO_ROOT"
zip -r "$SCAN_DIR/cams.zip" . -i "./backend/*" -i "./user-interface/*" -i "./common/*"
cd "$SCAN_DIR"

echo "Created package: cams.zip ($(du -h cams.zip | cut -f1))"

# Step 3: Download Veracode policy file
echo "Step 3: Downloading Veracode policy file..."
java -jar pipeline-scan.jar \
    -vid "$VERACODE_API_ID" \
    -vkey "$VERACODE_API_KEY" \
    --request_policy="$VERACODE_SAST_POLICY"

# Step 4: Execute pipeline-scan with verbose logging and debug output
echo "Step 4: Executing pipeline scan with verbose logging..."
echo "This may take a while. Debug output will be saved to veracode-debug.log"

# Check Java version - but don't add modules parameter as it's causing issues
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "Java version $JAVA_VERSION detected"

# Note: Removing --add-modules java.xml.bind as it's causing module not found errors
# The pipeline-scan.jar should handle Java modules internally

# Run the scan with verbose output and redirect to log file
{
    echo "=== Veracode Pipeline Scan Debug Log ==="
    echo "Timestamp: $(date)"
    echo "Java Version: $(java -version 2>&1 | head -n 1)"
    echo "Working Directory: $(pwd)"
    echo "Package Size: $(du -h cams.zip)"
    echo "Policy: $VERACODE_SAST_POLICY"
    echo "========================================="
    echo ""

    java -jar pipeline-scan.jar \
        -vid "$VERACODE_API_ID" \
        -vkey "$VERACODE_API_KEY" \
        -jf results.json \
        -fjf filtered_results.json \
        -pf "$VERACODE_SAST_POLICY.json" \
        --file cams.zip \
        --verbose true

} 2>&1 | tee veracode-debug.log

SCAN_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "=== Scan Complete ==="
echo "Exit code: $SCAN_EXIT_CODE"
echo "Debug log saved to: $SCAN_DIR/veracode-debug.log"

if [ -f "results.json" ]; then
    echo "Results file created: results.json"
    echo "File size: $(du -h results.json | cut -f1)"
fi

if [ -f "filtered_results.json" ]; then
    echo "Filtered results file created: filtered_results.json"
    echo "File size: $(du -h filtered_results.json | cut -f1)"
fi

echo ""
echo "Scan artifacts location: $SCAN_DIR"
echo "To view the debug log: cat $SCAN_DIR/veracode-debug.log"

exit "$SCAN_EXIT_CODE"
