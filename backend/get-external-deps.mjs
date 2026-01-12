#!/usr/bin/env node
import { EXTERNAL_DEPENDENCIES } from './esbuild-shared.mjs';

// Output external dependencies, one per line, filtering out wildcards
// and converting package patterns to actual package names for copying
const deps = EXTERNAL_DEPENDENCIES.filter((dep) => !dep.includes('*')).map((dep) => {
  // Remove trailing slashes if any
  return dep.replace(/\/$/, '');
});

console.log(deps.join('\n'));
