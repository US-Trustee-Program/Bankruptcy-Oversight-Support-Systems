import type { DocsPageContext } from './render-docs-page.js';

// Links the page to the GitHub Actions run that rendered it; undefined outside Actions.
export function resolveRun(env: NodeJS.ProcessEnv): DocsPageContext['run'] {
  const { GITHUB_RUN_ID, GITHUB_SERVER_URL, GITHUB_REPOSITORY } = env;
  if (!GITHUB_RUN_ID || !GITHUB_SERVER_URL || !GITHUB_REPOSITORY) {
    return undefined;
  }
  return {
    id: GITHUB_RUN_ID,
    url: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
  };
}
