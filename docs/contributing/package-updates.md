# NPM Package Updates

We have an automated dependency update system that helps maintain package security and stability while providing fine-grained control over update behavior.

## Automated GitHub Actions Workflow

We have a GitHub Actions Workflow that automatically runs every Wednesday at 10 UTC (5 AM ET). This workflow uses our dependency update script at `ops/scripts/utility/update-dependencies.sh` with the following features:

- Age-based safety controls (packages must be at least 30 days old by default)
- Individual commits per package update for easier review and rollback
- Constraint-based controls for managing risky updates
- Stable version filtering (excludes alpha, beta, rc releases)
- Selective package updating (only processes allowed packages)

### Workflow Process

1. Sets up the GitHub runner with commit-signing information
1. Runs the individual package update script in CI/CD mode (`-c` flag)
1. Creates individual commits for each package update
1. Pushes changes to a new branch
1. Creates a pull request with the dependency updates
1. Adds comments noting any remaining outdated packages
1. Adds comments noting any audit findings

### Manual Execution

The same script can also be run manually for testing or ad-hoc updates:

```bash
# Test mode (no commits, no branch changes)
./ops/scripts/utility/update-dependencies.sh -t

# Normal mode (creates dependency-updates branch)
./ops/scripts/utility/update-dependencies.sh

# Stay on dependency-updates branch after completion
./ops/scripts/utility/update-dependencies.sh -r

# Update existing dependency-updates branch
./ops/scripts/utility/update-dependencies.sh -u

# CI/CD mode (used by GitHub Actions)
./ops/scripts/utility/update-dependencies.sh -c
```

## Configuration

The dependency update script uses `.dependency-update-config.json` in the repository root for configuration. This file controls which packages can be updated and applies various safety constraints.

### Basic Configuration Structure

```json
{
  "constraints": {
    "pinned": [],
    "majorVersionLock": {},
    "majorVersionDelay": {}
  },
  "minPackageAgeDays": 7,
  "allowedPackages": [
    "eslint",
    "prettier",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser"
  ],
  "projects": ["backend", "common", "dev-tools", "test/e2e", "user-interface"]
}
```

### Production Configuration Structure

```json
{
  "minPackageAgeDays": 7,
  "allowedPackages": [
    "eslint",
    "prettier",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "@types/node",
    "typescript",
    "vite",
    "vitest",
    "react",
    "react-dom"
  ],
  "projects": [
    "root",
    "backend",
    "common",
    "dev-tools",
    "test/e2e",
    "user-interface"
  ],
  "constraints": {
    "pinned": [
      "applicationinsights"
    ],
    "majorVersionLock": {
      "react": "18",
      "eslint": "9"
    },
    "majorVersionDelay": {
      "*": 30,
      "react": 60,
      "typescript": 45
    }
  }
}
```

### Configuration Options

#### `minPackageAgeDays`
Minimum number of days a package version must be published before it's considered for updates. Default: 30 days.

This helps avoid adopting packages with critical bugs that are quickly patched.

#### `allowedPackages`
Array of package names that are permitted to be updated. Only packages in this list will be processed for updates.

This provides explicit control over which dependencies can be automatically updated.

#### `projects`
Array of directory paths containing package.json files to process. The script will check each of these locations for outdated packages.

**Special Keywords:**
- `"root"`: Processes the repository root directory (where the main package.json is located)

**Glob Pattern Support:**
The projects array supports glob patterns for flexible directory matching:
- `"test/*"`: Matches all directories under test/ (e.g., test/e2e, test/unit)
- `"**/package.json"`: Would match any directory containing package.json
- `"lib-*"`: Matches directories starting with "lib-"

**Examples:**
```json
{
  "projects": [
    "root",
    "backend",
    "frontend",
    "test/*",
    "lib-*"
  ]
}
```

This configuration would process:
- The root directory package.json
- The backend/ directory
- The frontend/ directory
- All subdirectories under test/ that contain package.json
- All directories starting with "lib-" that contain package.json

### Constraint Types

The constraints system provides fine-grained control over package update behavior to prevent breaking changes and manage risk.

#### Pinned Packages (`constraints.pinned`)
Array of package names that should never be updated automatically.

```json
{
  "constraints": {
    "pinned": ["legacy-package", "custom-fork"]
  }
}
```

Use this for:
- Packages with known compatibility issues
- Custom forks or modified packages
- Dependencies that require manual testing

#### Major Version Locks (`constraints.majorVersionLock`)
Object mapping package names to their locked major version numbers. Prevents updates that would change the major version.

```json
{
  "constraints": {
    "majorVersionLock": {
      "mssql": "10",
      "react": "18"
    }
  }
}
```

Use this for:
- Packages that introduced breaking changes in newer major versions
- Dependencies that require significant code changes to upgrade
- Critical packages where major version stability is essential

#### Major Version Delays (`constraints.majorVersionDelay`)
Object mapping package names to additional aging days for x.0.0 versions. This implements a conservative strategy where new major versions (x.0.0) require extra time before adoption. It supports different delays by package.

```json
{
  "constraints": {
    "majorVersionDelay": {
      "eslint": 90
    }
  }
}
```

**How it works:**
- Normal versions (x.1.0, x.0.1): Use standard `minPackageAgeDays` (30 days)
- Major x.0.0 versions: Require additional aging specified in `majorVersionDelay`

**Example:** If `eslint` releases version 10.0.0:
- `eslint@10.0.0`: Must wait 90 days before adoption
- `eslint@10.0.1`: Can be adopted after 30 days (standard aging)
- `eslint@10.1.0`: Can be adopted after 30 days (standard aging)

This strategy ensures that x.0.0 releases have time for community adoption and initial bug fixes before we adopt them.

## Troubleshooting

### Common Issues and Solutions

#### No Packages Being Updated
**Symptoms**: Script runs but reports "No packages were updated"

**Common Causes & Solutions**:
- **All packages filtered by allowlist**: Add more packages to `allowedPackages` if safe
- **Age requirements too strict**: Lower `minPackageAgeDays` (carefully)
- **Packages pinned or version-locked**: Review constraints configuration

#### Packages Consistently Skipped Due to Age
**Symptoms**: Packages show as "No safe version found (age requirements not met)"

**Solutions**:
1. Wait for packages to meet age requirements naturally
2. Lower `minPackageAgeDays` temporarily for urgent security updates
3. Manually update critical security patches

#### Package Updates Failing with Dependency Conflicts
**Symptoms**: Packages fail with "Dependency resolution conflict" (ERESOLVE)

**Solutions**:
1. Add major version locks to prevent breaking changes
2. Check if packages need to be updated together
3. Verify peer dependencies don't need updating first

### Emergency Procedures

#### Rollback Updates
```bash
# Single commit rollback
git revert <commit-hash>

# Manual package downgrade
npm install --save-exact <package-name>@<previous-version>
```

### Configuration Examples

#### Conservative
```json
{
  "minPackageAgeDays": 21,
  "allowedPackages": ["eslint", "prettier"],
  "constraints": { "majorVersionDelay": { "*": 60 } }
}
```

#### Aggressive
```json
{
  "minPackageAgeDays": 3,
  "allowedPackages": ["eslint", "@types/node", "vitest"],
  "constraints": { "majorVersionDelay": { "*": 14 } }
}
```

## Commit Signing

To provide confidence in the commits being made, the commit is made and signed as a USTP-owned GitHub account reserved for purposes like this. This requires a GPG key to be generated for the USTP account. Here is one workflow for getting this set up.

?> Note that on the DOJ laptop you will need to install Git from the Software Center to be able to run Git Bash.

### Create a new key

1. In Git Bash, Run `gpg --full-generate-key`
1. Select `RSA and RSA` for the kind of key
1. Choose a sufficiently strong keysize, preferably the longest possible
1. Choose an expiration period
1. Enter the name you want to be associated with the key (e.g. `GitHub Actions [Bot]`)
1. Enter the email address associated with the account
    1. Note that if it is desirable to obscure the actual email address you can use the GitHub account's no-reply email address
1. No entry is required for the `Comment` prompt
1. Type `o` and the enter key
1. Create a strong passphrase *
1. Note the key id *
1. Add an authentication key
    1. Run `gpg --expert --edit-key <the key id>` without the angle brackets
    1. Run `addkey`
    1. Select `RSA (set your own capabilities)`
    1. Select `a`, `s`, `e`, and finally `q` to make this key purely an authentication key
    1. Select the same keysize as the primary key
    1. Select the same expiration time as the primary key
    1. Type `quit` and `y` to save changes
1. Run `gpg --armor --export <the key id>` without the angle brackets
    1. Note the public key *
1. Run `gpg --armor --export-secret-key <the key id>` without the angle brackets
    1. Note the private key *
1. Add the public key to GitHub at `https://github.com/settings/keys`
    1. Click `New GPG key`
    1. Save the public key with a memorable name
1. Add the private key to the repository secret named `BOT_PRIVATE_KEY`
1. Add the passphrase used to create the key to the repository secret named `BOT_PASSPHRASE`

!> Items marked with an asterisk `*` should be stored in KeePass or some other secure way of keeping keys/secrets

### Key Expiration

Before the key expires, the expiration date should be extended using the following steps.

?> Note that this can actually happen after expiration, but any commits signed with an expired key will be unable to be verified by GitHub.

1. In Git Bash, Run `gpg --edit-key <the key id>` without the angle brackets
1. Run `expire` to extend the expiration of the primary key
1. Run `key n` and `expire` to extend the expiration of the `n`th subkey
    1. Repeat for all subkeys
    1. Alternately you can run `key n` for all subkeys and then `expire` to extend all at once with a prompt to confirm editing multiple subkeys
1. Export the public and private keys as described above and store as described with one exception
    1. It is not necessary to store the public key multiple times on the GitHub account, just the most recent
    1. Delete and recreate the GPG key on the GitHub account
