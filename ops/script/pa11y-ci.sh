#!/bin/bash

pwd
pushd gui/
pwd
ls
npm run start:pa11y &
npx wait-on http://localhost:3000
popd
ping http://localhost:3000

pkill -f "npm run start:pa11y"
exit 0
