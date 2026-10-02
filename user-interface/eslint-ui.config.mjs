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
    // GHSA-p98j-92pf-mc4p / SNYK-JS-DOMPURIFY-20361471 needs two preconditions
    // together: sanitize() with IN_PLACE on a live node, plus a node-removing
    // afterSanitize* hook. CAMS uses neither, and banning both is what lets the
    // .snyk entry claim mitigated-by-design rather than incidentally unused.
    // Lifting either rule re-arms the class — re-read the advisory first.
    //
    // The selectors match syntax, not values: dotted and string-literal keys both
    // error, but an alias (const { addHook } = DOMPurify) or a key built at runtime
    // escapes. This is a tripwire against intent, not a boundary against evasion.
    //
    // eslint-ui-test.config.mjs imports this config, so the ban covers UI tests and
    // test/bdd as well — intended, since a hook registered from a test is just as
    // live. dev-tools/eslint-rule-manifest.json pins which files the rules reach.
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='addHook'], CallExpression[callee.property.value='addHook']",
          message:
            'DOMPurify.addHook() is banned: node-removing hooks are a precondition of the GHSA-p98j-92pf-mc4p XSS class. Sanitize with a config object instead.',
        },
        {
          selector: "Property[key.name='IN_PLACE'], Property[key.value='IN_PLACE']",
          message:
            'DOMPurify IN_PLACE mode is banned: in-place sanitization of a live node is a precondition of the GHSA-p98j-92pf-mc4p XSS class. Pass a string to sanitize() and use the returned string.',
        },
      ],
    },
  },
);

export default eslintUiConfig;
