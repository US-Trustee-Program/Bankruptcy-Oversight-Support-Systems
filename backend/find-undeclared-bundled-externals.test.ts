import { describe, expect, test } from 'vitest';
import { findUndeclaredBundledExternals } from './find-undeclared-bundled-externals.mjs';

describe('findUndeclaredBundledExternals', () => {
  test('detects an external that appears in bundle but is not declared', () => {
    const bundleSource = 'const client = require("@azure/storage-queue");';
    const externalDependencies = ['@azure/storage-queue'];
    const declaredDependencies = ['@azure/storage-blob']; // storage-queue not declared
    const undeclared = findUndeclaredBundledExternals({
      bundleSource,
      externalDependencies,
      declaredDependencies,
    });
    expect(undeclared).toContain('@azure/storage-queue');
  });

  test('does not flag an external that is properly declared', () => {
    const bundleSource = 'const client = require("@azure/storage-queue");';
    const externalDependencies = ['@azure/storage-queue'];
    const declaredDependencies = ['@azure/storage-queue'];
    const undeclared = findUndeclaredBundledExternals({
      bundleSource,
      externalDependencies,
      declaredDependencies,
    });
    expect(undeclared).not.toContain('@azure/storage-queue');
  });

  test('ignores requires of packages that are not in externalDependencies', () => {
    const bundleSource = 'const path = require("path");';
    const externalDependencies = ['@azure/storage-queue'];
    const declaredDependencies = [];
    const undeclared = findUndeclaredBundledExternals({
      bundleSource,
      externalDependencies,
      declaredDependencies,
    });
    expect(undeclared).toHaveLength(0);
  });

  test('handles single quotes in require statements', () => {
    const bundleSource = "const client = require('@azure/storage-queue');";
    const externalDependencies = ['@azure/storage-queue'];
    const declaredDependencies = [];
    const undeclared = findUndeclaredBundledExternals({
      bundleSource,
      externalDependencies,
      declaredDependencies,
    });
    expect(undeclared).toContain('@azure/storage-queue');
  });

  test('finds multiple undeclared externals in bundle', () => {
    const bundleSource = `
      const queue = require("@azure/storage-queue");
      const blob = require("@azure/storage-blob");
    `;
    const externalDependencies = ['@azure/storage-queue', '@azure/storage-blob'];
    const declaredDependencies = [];
    const undeclared = findUndeclaredBundledExternals({
      bundleSource,
      externalDependencies,
      declaredDependencies,
    });
    expect(undeclared).toContain('@azure/storage-queue');
    expect(undeclared).toContain('@azure/storage-blob');
  });

  test('ignores requires of scoped packages with different scope', () => {
    const bundleSource = 'const client = require("@different/storage-queue");';
    const externalDependencies = ['@azure/storage-queue'];
    const declaredDependencies = [];
    const undeclared = findUndeclaredBundledExternals({
      bundleSource,
      externalDependencies,
      declaredDependencies,
    });
    expect(undeclared).toHaveLength(0);
  });

  test('flags subpath requires of undeclared packages by their package name', () => {
    const bundleSource = 'const internal = require("@azure/storage-blob/dist/foo");';
    const externalDependencies = ['@azure/storage-blob'];
    const declaredDependencies = []; // blob package not declared
    const undeclared = findUndeclaredBundledExternals({
      bundleSource,
      externalDependencies,
      declaredDependencies,
    });
    // Should flag the package name, not the subpath
    expect(undeclared).toContain('@azure/storage-blob');
  });

  test('does not flag subpath requires of declared packages', () => {
    const bundleSource = 'const internal = require("@azure/storage-blob/dist/foo");';
    const externalDependencies = ['@azure/storage-blob'];
    const declaredDependencies = ['@azure/storage-blob'];
    const undeclared = findUndeclaredBundledExternals({
      bundleSource,
      externalDependencies,
      declaredDependencies,
    });
    expect(undeclared).toHaveLength(0);
  });

  test('matches subpaths against package name, not full specifier', () => {
    const bundleSource = 'const internal = require("uuid/dist/index");';
    const externalDependencies = ['uuid'];
    const declaredDependencies = ['uuid'];
    const undeclared = findUndeclaredBundledExternals({
      bundleSource,
      externalDependencies,
      declaredDependencies,
    });
    // uuid is declared, so even the subpath should not be flagged
    expect(undeclared).toHaveLength(0);
  });
});
