import { eslintTsConfig } from '../eslint-shared.config.mjs';
// @eslint-react/eslint-plugin is ESM-only (no CJS export) — must use top-level import
import eslintReact from '@eslint-react/eslint-plugin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const reactHooks = require('eslint-plugin-react-hooks');

/**
 * eslintUiConfig
 *
 * This ConfigArray is intended to be the eslint configuration for non-test TypeScript
 * family files (e.g. `.ts`, `.tsx`) in the frontend project.
 */
const eslintUiConfig = tsEslint.config(
  eslintTsConfig,
  jsxA11y['flatConfigs']['recommended'],
  eslintReact.configs['recommended-typescript'],
  reactHooks.configs.flat['recommended-latest'],
  {
    // Override react-hooks rules to be warnings instead of errors
    // This allows us to track issues without blocking PRs
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      // Disabled due to known bug causing false positives: https://github.com/facebook/react/issues/34775
      'react-hooks/refs': 'off',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
      // Downgrade @eslint-react rules that have pre-existing violations to warnings
      // so the ESLint v10 migration doesn't block PRs for pre-existing issues
      '@eslint-react/rules-of-hooks': 'warn',
      '@eslint-react/no-create-ref': 'warn',
      '@eslint-react/error-boundaries': 'warn',
    },
  },
  {
    // DOMPurify's hook API and IN_PLACE mode are the two preconditions of the
    // XSS class described by GHSA-p98j-92pf-mc4p / SNYK-JS-DOMPURIFY-20361471:
    // a node-removing afterSanitize* hook detaches a subtree whose event
    // handlers the post-walk neutralization pass never disarms, because that
    // pass only covers DOMPurify.removed. Neither feature is needed anywhere in
    // CAMS — every call site passes a string to sanitize() and gets a string
    // back — so banning them keeps that whole class of advisory unreachable
    // rather than merely unused, which is what lets us treat the finding as
    // mitigated by design. Lifting a rule here re-arms the class; pair any
    // removal with a fresh read of the current DOMPurify advisories.
    //
    // Scope note: this config is also imported by eslint-ui-test.config.mjs, so
    // the ban reaches UI tests and test/bdd as well as UI source. That is
    // intended — a hook registered from a test would be just as live.
    // dev-tools/eslint-rule-manifest.json pins that blast radius.
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='addHook']",
          message:
            'DOMPurify.addHook() is banned: node-removing hooks are a precondition of the GHSA-p98j-92pf-mc4p XSS class. Sanitize with a config object instead.',
        },
        {
          selector: "Property[key.name='IN_PLACE']",
          message:
            'DOMPurify IN_PLACE mode is banned: in-place sanitization of a live node is a precondition of the GHSA-p98j-92pf-mc4p XSS class. Pass a string to sanitize() and use the returned string.',
        },
      ],
    },
  },
);

export default eslintUiConfig;
