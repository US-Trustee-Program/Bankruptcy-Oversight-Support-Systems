#!/usr/bin/env python3
"""
Pre-commit hook to check if workflow diagrams need updating.

Logic:
1. Check if any workflow files (.github/workflows/*.yml|*.yaml) changed in this commit
2. If no workflow files changed → PASS
3. If workflow files changed:
   - Check if docs/operations/workflow-diagram.md also changed
   - If diagram changed → PASS (developer already updated it)
   - If diagram not changed → RUN generator script and inform developer
"""

import os
import subprocess
import sys
from pathlib import Path

# Configuration constants
WORKFLOW_DIRECTORY = '.github/workflows/'
WORKFLOW_EXTENSIONS = ['.yml', '.yaml']
DIAGRAM_FILE = 'docs/operations/workflow-diagram.md'
GENERATOR_SCRIPT = 'ops/scripts/pipeline/workflow-diagram-generator.py'

# Exit codes
EXIT_SUCCESS = 0
EXIT_FAILURE = 1


def get_staged_files():
    """Get list of files staged for commit."""
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip().split('\n') if result.stdout.strip() else []
    except subprocess.CalledProcessError:
        return []


def has_workflow_changes(staged_files):
    """Check if any workflow files are being committed."""
    for file_path in staged_files:
        if WORKFLOW_DIRECTORY in file_path:
            if any(file_path.endswith(ext) for ext in WORKFLOW_EXTENSIONS):
                return True
    return False


def has_diagram_changes(staged_files):
    """Check if the workflow diagram file is being committed."""
    return DIAGRAM_FILE in staged_files


def run_diagram_generator():
    """Run the workflow diagram generator script."""
    # Get the repository root (where this script should be executed from)
    try:
        repo_root = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()
    except subprocess.CalledProcessError:
        print("Error: Could not determine repository root")
        return False

    # Change to repository root and run the script
    original_dir = os.getcwd()
    try:
        os.chdir(repo_root)
        result = subprocess.run([
            sys.executable,
            GENERATOR_SCRIPT
        ], capture_output=True, text=True)

        if result.returncode == 0:
            print("Workflow diagrams generated successfully")
            return True
        else:
            print("Error generating workflow diagrams:")
            print(result.stderr)
            return False

    except Exception as e:
        print(f"Error running diagram generator: {e}")
        return False
    finally:
        os.chdir(original_dir)


def main():
    staged_files = get_staged_files()

    if not staged_files:
        return EXIT_SUCCESS

    if not has_workflow_changes(staged_files):
        return EXIT_SUCCESS

    print("Detected changes to GitHub Actions workflow files")

    if has_diagram_changes(staged_files):
        print("Workflow diagram already updated")
        return EXIT_SUCCESS

    print("Workflow diagram needs updating...")

    if run_diagram_generator():
        print("!!! Commit blocked: Please review and stage the updated workflow diagram")
        return EXIT_FAILURE
    else:
        print("Failed to generate workflow diagrams")
        return EXIT_FAILURE


if __name__ == "__main__":
    sys.exit(main())
