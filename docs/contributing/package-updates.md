# NPM Pack Updates

We have a GitHub Actions Workflow that automatically runs every Wednesday at 10 UTC. This workflow does several things:

1. Sets up the GitHub runner with commit-signing information
1. Iterates over NPM projects
  1. Runs `npm update --save`
1. Commits the changes
1. Pushes to the repository
1. Creates a pull request
1. Iterates over NPM projects
  1. Runs `npm outdated`, storing the output
1. Adds a comment to the pull request noting any packages that are outdated
1. Iterates over NPM projects
  1. Runs `npm audit`, storing the output
1. Adds a comment to the pull request noting any projects that had audit findings

## Commit Signing

To provide confidence in the commits being made, the commit is made and signed as a USTP-owned GitHub account reserved for purposes like this. This requires a GPG key to be generated for the USTP account. Here is one workflow for getting this set up.

?> Note that on the DOJ laptop you will need to install Git from the Software Center to be able to run Git Bash.

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
