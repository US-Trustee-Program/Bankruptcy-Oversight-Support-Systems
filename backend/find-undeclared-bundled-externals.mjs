/**
 * Extract the package name from a require() specifier.
 * Handles scoped packages (@scope/name) and subpaths (name/subpath).
 *
 * Examples:
 *   'uuid' => 'uuid'
 *   '@azure/storage-blob' => '@azure/storage-blob'
 *   '@azure/storage-blob/dist/foo' => '@azure/storage-blob'
 *   'uuid/dist/index' => 'uuid'
 *
 * @param {string} spec - The full require() specifier
 * @returns {string} The package name (without subpath)
 */
function packageNameOf(spec) {
  const parts = spec.split('/');
  if (spec.startsWith('@')) {
    // Scoped package: @scope/name[/subpath...]
    // Return @scope/name
    return parts.slice(0, 2).join('/');
  }
  // Unscoped package: name[/subpath...]
  // Return name
  return parts[0];
}

/**
 * Find externals that appear as require() calls in a bundle but are not declared
 * in the function app's own package.json dependencies.
 *
 * This guards against the case where esbuild marks a package as EXTERNAL,
 * the bundler includes require() calls for it, but the package was never added
 * to the app's own dependencies — resulting in "Cannot find module" at runtime.
 *
 * Matching is done on PACKAGE NAME, not full specifier, so subpath requires
 * (e.g., '@azure/storage-blob/dist/foo') are matched against the package name
 * ('@azure/storage-blob') in both the external and declared dependency lists.
 *
 * @param {Object} options
 * @param {string} options.bundleSource - The source code of the built bundle (typically dist/index.js)
 * @param {string[]} options.externalDependencies - The list of packages marked EXTERNAL by esbuild
 * @param {string[]} options.declaredDependencies - The list of dependencies declared in the app's package.json
 * @returns {string[]} Array of package names that appear in require() but are not declared
 */
export function findUndeclaredBundledExternals({
  bundleSource,
  externalDependencies,
  declaredDependencies,
}) {
  // Regex to match require("spec") or require('spec').
  // Captures the spec between quotes.
  const requireRegex = /require\(["']([^"']+)["']\)/g;

  const declaredSet = new Set(declaredDependencies);
  const externalSet = new Set(externalDependencies);
  const undeclared = new Set();

  let match;
  while ((match = requireRegex.exec(bundleSource)) !== null) {
    const requiredSpec = match[1];
    const packageName = packageNameOf(requiredSpec);

    // Only care about package names that are in the external list.
    // (Everything else was bundled and doesn't need to be declared.)
    if (!externalSet.has(packageName)) {
      continue;
    }

    // If it's an external but not declared, flag it.
    if (!declaredSet.has(packageName)) {
      undeclared.add(packageName);
    }
  }

  return Array.from(undeclared);
}
