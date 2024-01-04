# Troubleshooting

Recurring issues and their fixes can be documented here.

## Pre-commit Auto-update Failures

A couple of times we have had errors on the `pre-commit ci` run which have been the result of new
rules in eslint. To fix this, ensure that the versions of eslint are updated in all Node projects by
running `npm update` or `npm i eslint@latest`.

## Security Issues Flagged for HTML Links

A security issue has come up for links in the JSX where we have written raw HTML links using the
anchor tag `<a>`.

When an HREF is set using a variable, the security scan will complain. To resolve this, stick to
using the React provided `<Link>` component. The link component will do a much better job ensuring
that bad code doesn't get written out to the HTML document.
