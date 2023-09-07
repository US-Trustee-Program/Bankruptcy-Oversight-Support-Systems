#!/usr/bin/env python

# DESCRIPTION: Script to help parse bicep 'output' json file.

import sys
import json

filename = sys.argv[1]
fieldName = sys.argv[2]

f = open(filename)
data = json.load(f)

print(data[fieldName]['value'])

f.close()
