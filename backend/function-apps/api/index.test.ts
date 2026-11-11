import fs from 'node:fs';
import path from 'node:path';

/**
 * index.ts is the API app's only entry point: a function's app.http() registration runs only if
 * index.ts imports it. A function file that is missing here builds and unit-tests fine but
 * returns 404 once deployed.
 */
describe('API function app entry point', () => {
  test('should import every *.function.ts handler', () => {
    const functionFiles = fs
      .readdirSync(__dirname, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.function.ts'))
      .filter((file) => !file.startsWith('node_modules') && !file.startsWith('dist'))
      .map((file) => file.replace(/\\/g, '/').replace(/\.ts$/, ''))
      .sort();

    const indexSource = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
    const importedFiles = [...indexSource.matchAll(/^import '\.\/(.+)';$/gm)]
      .map(([, file]) => file)
      .sort();

    expect(importedFiles).toEqual(functionFiles);
  });
});
