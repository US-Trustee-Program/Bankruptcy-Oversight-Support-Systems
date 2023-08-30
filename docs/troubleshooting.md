# Troubleshooting

Recurring issues and their fixes can be documented here.

## Pre-commit Auto-update Failures

A couple of times we have had errors on the `pre-commit ci` run which have been the result of new rules in eslint.
To fix this, ensure that the versions of eslint are updated in all Node projects by running `npm update` or
`npm i eslint@latest`.
