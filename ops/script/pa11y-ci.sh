#!/bin/bash

# In GitHub Actions this runs from the /gui directory
npm run start:pa11y &
npx wait-on http://localhost:3000
popd
ping http://localhost:3000

pkill -f "npm run start:pa11y"
exit 0
