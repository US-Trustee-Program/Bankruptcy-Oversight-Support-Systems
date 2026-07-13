#!/usr/bin/env python3
"""
Pre-commit hook to prevent the `trusteeCaseAppointmentsCollection` resource in
ops/cloud-deployment/lib/cosmos/mongo/cosmos-collections.bicep from declaring
an `indexes` property.

Why: that resource's `resource:` block intentionally omits `indexes` entirely
so ARM never reconciles indexes on the collection -- the collection's real
indexes are managed out-of-band via index-trustee-case-appointments.js. Adding
an `indexes` property (even `indexes: []`) switches ARM into declarative
replace mode and drops the out-of-band indexes on the next deploy. `shardKey`
is safe and expected; it does not trigger index reconciliation.
"""

import re
import sys

BICEP_FILE = 'ops/cloud-deployment/lib/cosmos/mongo/cosmos-collections.bicep'
RESOURCE_NAME = 'trusteeCaseAppointmentsCollection'

EXIT_SUCCESS = 0
EXIT_FAILURE = 1


def find_resource_block(text, resource_name):
    """Return the source text of the named Bicep resource block, or None."""
    match = re.search(rf'resource\s+{resource_name}\b[^{{]*{{', text)
    if not match:
        return None

    depth = 1
    start = match.end()
    pos = start
    while pos < len(text) and depth > 0:
        if text[pos] == '{':
            depth += 1
        elif text[pos] == '}':
            depth -= 1
        pos += 1

    return text[match.start():pos]


def strip_line_comments(text):
    """Strip `//` line comments so matches inside comments are ignored."""
    return re.sub(r'//.*', '', text)


def main():
    try:
        with open(BICEP_FILE, encoding='utf-8') as f:
            text = f.read()
    except FileNotFoundError:
        return EXIT_SUCCESS

    block = find_resource_block(text, RESOURCE_NAME)
    if block is None:
        return EXIT_SUCCESS

    if re.search(r'\bindexes\s*:', strip_line_comments(block)):
        print(
            f"ERROR: {RESOURCE_NAME} in {BICEP_FILE} must not declare an "
            "`indexes` property.\n"
            "ARM reconciles `indexes` declaratively on every deploy and will "
            "drop the indexes managed out-of-band by "
            "index-trustee-case-appointments.js. See the comment on that "
            "resource for details."
        )
        return EXIT_FAILURE

    return EXIT_SUCCESS


if __name__ == '__main__':
    sys.exit(main())
