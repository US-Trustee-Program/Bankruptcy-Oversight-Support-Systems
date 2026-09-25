# Beads v32 → v66 Schema Migration

## Overview

This is a one-time procedure that migrates the shared beads (`bd`) issue
database from schema **v32** to **v66**, 34 migrations in total.

The database is remote-backed by
`git+https://github.com/flexion/flexion-doj-cams-issues.git`, with the Dolt
data living on the `refs/dolt/data` ref. Every developer has a full clone.

`bd` refuses to apply these migrations automatically, because two clones
migrating independently fork the schema and `bd dolt pull` can no longer merge
them (upstream issue #4259). Exactly **one** machine migrates and pushes;
everyone else adopts the result with `bd bootstrap`.

Prem is the designated migrator for this run.

> Between the migrator's `bd dolt push` and each teammate's `bd bootstrap`,
> that teammate's `bd` is **blocked for writes**. Plan the window accordingly.

## Baseline

Captured 2026-09-25 before any migration step. These are the numbers to verify
against afterward.

| Fact | Value |
| --- | --- |
| Issue count | `1403` (plus 9 memories) |
| `schema_migrations` | 32 rows, max version `32` |
| Local + remote dolt HEAD | `03bo6q58fkgdhq6f036qfeucdbvm7i90` |
| Remote `refs/dolt/data` SHA | `f34f86c04e680ef27864735ded9156f95b82970a` |
| Schema version | `v32` (target `v66`) |
| Total dolt commits | `2937` |
| Migrator binary (pre-swap) | `bd 1.0.3` at `~/.local/bin/bd` |
| Migrator binary (for migration) | `bd 1.3.0` at `/opt/homebrew/bin/bd` |

The remote ref SHA is the **rollback anchor**. Do not lose it.

## Prerequisites

- Confirmed sole designated migrator — nobody else runs `bd migrate`.
- Force-push rights on `refs/dolt/data`. Verify this *before* starting; it is
  the only way to roll the remote back after Phase 7.
- Every teammate has run `bd dolt push` and stopped writing.
- bd 1.3.0 available locally (Homebrew Cellar is fine).

## Phases

| # | Phase | Command(s) | Touches remote? | Reversible? | Status |
| --- | --- | --- | --- | --- | --- |
| 0 | Freeze the team | _(coordination, no commands)_ | No | n/a | ☑ Done |
| 1 | Final sync at v32 | `bd dolt pull` | Read only | n/a | ☑ Done |
| 2 | Back up | `bd export --all -o <file>`, `cp -R .beads/embeddeddolt <dir>` | No | n/a | ☑ Done |
| 3 | Swap to bd 1.3.0 | `mv ~/.local/bin/bd ~/.local/bin/bd-1.0.3` | No | Yes — move it back | ☑ Done |
| 4 | Dry run | `bd migrate --dry-run`, `bd migrate --inspect` | No | Yes — read only | ☑ Done (see caveat) |
| 5 | Migrate **locally** | `bd migrate schema --force --json` | **No** | Yes — restore Phase 2 copy | ☐ |
| 6 | Verify before publishing | `bd count`, `bd ready`, spot-check issues | No | Yes — last easy exit | ☐ |
| 7 | Publish | `bd dolt push` | **Yes** | Only by force-push to anchor | ☐ |
| 8 | Unblock the team | _(teammates upgrade + `bd bootstrap`)_ | No | n/a | ☐ |

The hard boundary is **between Phase 6 and Phase 7**. Everything before it is a
local change to one laptop; the remote stays pristine v32 the whole time.

## Phase detail

### Phase 0 — Freeze the team

Kelly, Fritz, Brian, and Matt each run `bd dolt push` and stop writing. Get an
explicit "pushed and stopped" from each — not just silence.

Anything unpushed at this point is effectively lost, because the recovery path
is `bd bootstrap`, which replaces the local database wholesale.

### Phase 1 — Final sync at v32

Run on the **1.0.3** binary, which still matches the remote's v32 schema:

```bash
bd dolt pull
```

Then confirm local `main` and `origin/main` are the same hash.

### Phase 2 — Back up

Run the export with the **v32** binary, which matches the database on disk:

```bash
~/.local/bin/bd-1.0.3 export --all -o ~/beads-backup-pre-v66-$(date +%Y%m%d).jsonl
cp -R .beads/embeddeddolt ~/beads-embeddeddolt-pre-v66
```

Verify the physical copy actually opens rather than trusting the byte count:

```bash
cd ~/beads-embeddeddolt-pre-v66/cams && dolt sql -q "select count(*) from dolt_log"
```

Taken 2026-09-25: export `1403 issues and 9 memories` (3.1M), directory copy
254M reporting `2937` commits — both matching baseline.

Note that until Phase 7 the remote is itself a pristine v32 backup, and every
teammate's un-bootstrapped clone is another. **Tell teammates to hold off on
`bd bootstrap` until you have verified the migration** — while they wait, their
clones remain living v32 backups.

### Phase 3 — Swap to bd 1.3.0

```bash
mv ~/.local/bin/bd ~/.local/bin/bd-1.0.3   # move, don't delete — instant rollback
hash -r
bd version                                  # must read 1.3.0
```

`~/.local/bin` precedes `/opt/homebrew/bin` on PATH, so moving the shadow aside
re-exposes the Homebrew 1.3.0 build.

### Phase 4 — Dry run

```bash
bd migrate --dry-run
bd migrate --inspect
```

**Caveat — there is no real dry run for the 34 schema migrations.** Observed
2026-09-25:

- `bd migrate --dry-run` reports only `Would update Dolt version: → 1.3.0`.
  That is the metadata version bump, not the schema work.
- `bd migrate --inspect` reports `Schema Version: (blank)`, `Issue Count: 0`,
  `Registered Migrations: 0` even with 1403 issues present. It does not read a
  v32 database usefully.
- `bd migrate schema` has **no** `--dry-run` flag — only `--force` and `--json`.

So Phase 4 cannot preview what the migrations will do. The compensating
controls are the verified Phase 2 backup and the fact that the remote stays
pristine v32 until Phase 7. Do not read the thin dry-run output as a green
light; it is simply uninformative.

Ground truth for the schema version comes from the database itself:

```bash
cd .beads/embeddeddolt/cams
dolt sql -q "select count(*) as applied, max(version) as at_version from schema_migrations"
```

Before migration this returns `32 / 32`.

### Phase 5 — Migrate locally

```bash
bd migrate schema --force --json
```

`--force` bypasses the coordination gate. It does **not** touch the remote —
this is a local-only schema change, and `bd dolt push` in Phase 7 is what
publishes it.

Two notes on the command choice:

- bd's own gate message suggests `bd migrate --force`. The `schema` subcommand
  is preferred here because it is documented as the way to "make migration
  explicit and observable in CI, release gates, and recovery scenarios", and
  `--json` gives a reviewable record. Both converge on the same result.
- Per `bd migrate schema --help`, **schema migrations also run automatically on
  store open**. The coordination gate is the only thing suppressing them. Once
  the gate is bypassed, every later bd 1.3.0 command operates on v66 — there is
  no partially-migrated steady state to sit in.

### Phase 6 — Verify before publishing

| Check | Command | Expected |
| --- | --- | --- |
| Schema version | `dolt sql -q "select count(*) as applied, max(version) from schema_migrations"` | `66 / 66` (was `32 / 32`) |
| Issue count | `bd count` | `1403` |
| Queue intact | `bd ready` | Returns the P0/P1 queue |
| Export parity | `bd export --all -o /tmp/post.jsonl` | `1403 issues and 9 memories` |
| Spot-check known issues | `bd show <id>` | Fields intact, no truncation |

Stop here if anything looks off. This is the last exit that costs nothing.

### Phase 7 — Publish

```bash
bd dolt push
git ls-remote https://github.com/flexion/flexion-doj-cams-issues.git refs/dolt/data
```

The ref must have moved off `f34f86c04e680ef27864735ded9156f95b82970a`.

### Phase 8 — Unblock the team

Each teammate:

```bash
brew upgrade beads   # or install bd 1.3.0 by their preferred method
bd bootstrap
```

Re-state that `bd bootstrap` replaces the local database — harmless only
because they pushed in Phase 0.

## Rollback

| When | How |
| --- | --- |
| Before Phase 5 | Move `~/.local/bin/bd-1.0.3` back; nothing was changed |
| After Phase 5, before Phase 7 | Restore `~/beads-embeddeddolt-pre-v66` over `.beads/embeddeddolt`, re-shadow 1.0.3. Or simply re-clone: the remote is still v32 |
| After Phase 7 | Force-push `refs/dolt/data` back to `f34f86c04e680ef27864735ded9156f95b82970a`, then every clone re-bootstraps |

## Notes

- `bd` prints `auto-export: git add failed: exit status 1` on pull. This is
  benign and pre-existing — `.beads/` is gitignored (`.gitignore:134`), so bd's
  attempt to stage `.beads/issues.jsonl` is correctly rejected. Issues live in
  the Dolt remote, not in this repo.
- Homebrew is in API mode with no local formula checkout, so `brew extract` is
  not a practical way to obtain old bd versions. Release binaries from
  `gastownhall/beads` (verified against `checksums.txt`) are the workable path.
- `bd upgrade` only reports version changes; it cannot install a specific
  version.
- Migration duration is unknown. For scale: the Phase 1 pull of 134 commits
  took ~11 minutes, most of it in the local merge/index step rather than the
  network fetch.
