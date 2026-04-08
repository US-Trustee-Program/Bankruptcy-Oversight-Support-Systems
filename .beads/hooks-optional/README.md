# Beads + Specs + GitHub Integration

Automatic syncing between beads issues, spec files, GitHub issues, and git workflows.

**What happens automatically once installed:**
- View GitHub issue (`/cams-issue-reader CAMS-XXX`) → Creates beads issue
- Checkout branch (`git checkout` or `git checkout -b CAMS-XXX-branch`) → Creates + claims beads issue
- Create feature (`/cams-new-feature`) → Links spec files to beads
- Commit changes (`/cams-commit`) → Records commit message in beads notes
- Pull from main (`git pull` with merged PR) → Closes beads issue
- Pull spec changes (`git pull`) → Updates beads with new spec files

## Installation

```bash
# Recommended: Install both hooks
ln -sf ../../.beads/hooks-optional/post-checkout-beads-create .git/hooks/post-checkout-beads-create
ln -sf ../../.beads/hooks-optional/post-merge .git/hooks/post-merge-beads-sync
```

## Available Hooks

### `post-checkout-beads-create`
- Runs after `git checkout` or `git checkout -b`
- If beads issue exists: Claims it (if unclaimed) or reports status
- If beads issue doesn't exist: Creates from GitHub + claims
- Only creates once per ticket (safe to checkout same branch multiple times)

### `post-merge`
- Runs after `git pull` or `git merge`
- Auto-closes beads issues when PR merge detected (on main/master)
- Syncs spec files updated by teammates

### Helper Scripts (not hooks)

#### `post-pr-merge`
- Manual fallback: `.beads/hooks-optional/post-pr-merge CAMS-362 1234`
- Closes beads issue when PR merges

#### `close-issue`
- Close with custom reason: `.beads/hooks-optional/close-issue CAMS-362 "reason"`
- Use when: PR closed without merge, work done without PR, issue no longer needed

## Integrated Skills

### `/cams-issue-reader`
- Auto-creates beads issue from GitHub issue
- Links with `--external-ref=gh-<number>`
- Maps GitHub labels to beads types
- Displays combined GitHub + Beads view

### `/cams-new-feature`
- **Phase 1**: Creates beads issue + syncs specs (`--spec-id`)
- **Phase 3**: Links design document (`--design-file`)
- **Phase 4**: Updates progress notes

### `/cams-commit`
- Tracks commit hash, title, co-authors in beads notes
- Example: `Commit a1b2c3d: Add transform logic (with Kelly D, Brian Posey)`

## What Happens Automatically

| Action | Beads Integration |
|--------|------------------|
| `/cams-issue-reader CAMS-XXX` | Auto-creates beads issue from GitHub |
| `git checkout CAMS-XXX-branch` | Auto-creates + claims beads issue |
| `/cams-new-feature` Phase 1-4 | Syncs specs to beads (`--spec-id`, `--design-file`) |
| `/cams-commit` | Tracks commit hash, title, co-authors in beads notes |
| `git pull` (PR merge on main) | Auto-closes beads issue (merged PRs only) |
| `git pull` (spec changes) | Syncs updated specs to beads |

## Beads Fields Synced

- `--spec-id` → Spec directory (`.ustp-cams-fdp/ai/specs/CAMS-XXX-...`)
- `--design-file` → Design document (`.design.md`)
- `--external-ref` → GitHub issue link (`gh-1234`)
- `--notes` → Commit history, phase completion

## Manual Commands

```bash
# Sync specs (also runs automatically via post-merge hook and /cams-new-feature)
.beads/sync-specs.sh
.beads/sync-specs.sh CAMS-362

# Close after PR merge (fallback if auto-detection fails)
.beads/hooks-optional/post-pr-merge CAMS-362 1234

# Close with custom reason (manual only - no automatic equivalent)
.beads/hooks-optional/close-issue CAMS-362 "PR closed - requirements changed"
.beads/hooks-optional/close-issue CAMS-362 "Completed without PR"
.beads/hooks-optional/close-issue CAMS-362 "No longer needed"

# Update during coding (manual only)
bd update <issue-id> --append-notes="Implemented feature X"
bd close <issue-id>
```

## Troubleshooting

```bash
# No beads issue found
/cams-issue-reader CAMS-XXX  # Auto-creates it

# Hook not running
chmod +x .beads/hooks-optional/post-checkout-beads-create
ls -la .git/hooks/post-checkout-beads-create

# Disable hooks
rm .git/hooks/*-beads-*
```
