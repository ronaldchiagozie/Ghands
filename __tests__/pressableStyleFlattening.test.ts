import fs from 'fs';
import path from 'path';

/**
 * No Pressable may style itself with a function.
 *
 * NativeWind wraps every element in this app and flattens a
 * `style={({ pressed }) => ...}` prop on a Pressable, dropping it in silence.
 * There is no error and no warning - the component simply renders without its
 * background, border, padding or centring, and looks like a layout bug that
 * has nothing to do with the line that caused it.
 *
 * It has cost four separate visible faults: the account setup card's rows
 * stacked, an alert lost its button backgrounds, the whole chat history screen
 * arrived as bare lines of text, and the assistant's floating mark was only
 * ever centred by luck of the icon filling the button. Each was found by
 * somebody looking at a screenshot and asking what happened.
 *
 * So it is a build failure now rather than a thing to remember. Put the
 * visuals on an inner View; keep press feedback in `android_ripple`, or in
 * state if it has to be visible on both platforms.
 */
const ROOTS = ['app', 'components', 'hooks', 'lib', 'utils'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('Pressable styles', () => {
  const repoRoot = path.join(__dirname, '..');

  const files = ROOTS
    .map((dir) => path.join(repoRoot, dir))
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => walk(dir));

  it('scans a real set of files, so a passing run means something', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('are never functions', () => {
    const offenders: string[] = [];

    files.forEach((file) => {
      /** Comments explain the rule and quote the pattern; only code counts. */
      const code = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      code.split('\n').forEach((line, index) => {
        if (/style=\{\s*\(\s*\{?\s*pressed/.test(line)) {
          offenders.push(`${path.relative(repoRoot, file)}:${index + 1}`);
        }
      });
    });

    expect(offenders).toEqual([]);
  });
});
