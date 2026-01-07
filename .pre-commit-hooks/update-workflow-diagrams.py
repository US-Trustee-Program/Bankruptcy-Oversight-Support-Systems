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

# Configuration constants
WORKFLOW_DIRECTORY = '.github/workflows/'
WORKFLOW_EXTENSIONS = ['.yml', '.yaml']
DIAGRAM_FILE = 'docs/operations/workflow-diagram.md'

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
    return any(
        WORKFLOW_DIRECTORY in file_path and any(file_path.endswith(ext) for ext in WORKFLOW_EXTENSIONS)
        for file_path in staged_files
    )


def has_diagram_changes(staged_files):
    """Check if the workflow diagram file is being committed."""
    return DIAGRAM_FILE in staged_files


def run_diagram_generator():
    """Run the workflow diagram generator script.

    Uses sys.executable explicitly and avoids shell=True; arguments are static.
    Returns True on success, False on failure.
    """
    try:
        repo_root = subprocess.run(
            ("git", "rev-parse", "--show-toplevel"),
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()
    except subprocess.CalledProcessError:
        print("Error: Could not determine repository root")
        return False

    original_dir = os.getcwd()
    try:
        os.chdir(repo_root)
        result = subprocess.run(
            (sys.executable, "ops/scripts/pipeline/workflow-diagram-generator.py"),
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
            print("Workflow diagrams generated successfully")
            return True
        print("Error generating workflow diagrams:")
        if result.stdout:
            print("stdout:", result.stdout)
        if result.stderr:
            print("stderr:", result.stderr)
        return False
    except Exception as exc:  # defensive
        print(f"Error running diagram generator: {exc}")
        return False
    finally:
        os.chdir(original_dir)


def has_unstaged_changes(file_path):
    """Check if a file has unstaged changes."""
    try:
        result = subprocess.run(
            ["git", "diff", "--exit-code", file_path],
            capture_output=True,
            check=False
        )
        # Exit code 0 = no changes, 1 = has changes
        return result.returncode == 1
    except subprocess.CalledProcessError:
        return False


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

    success = run_diagram_generator()
    if not success:
        print("Failed to generate workflow diagrams")
        return EXIT_FAILURE

    # Check if the generator actually changed the file
    if has_unstaged_changes(DIAGRAM_FILE):
        print("!!! Commit blocked: Please review and stage the updated workflow diagram")
        return EXIT_FAILURE

    print("Workflow diagram is already up-to-date (no changes needed)")
    return EXIT_SUCCESS


if __name__ == "__main__":
    sys.exit(main())
