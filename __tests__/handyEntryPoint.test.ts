import fs from 'fs';
import path from 'path';

/**
 * The Handy button must not ask for a new chat.
 *
 * Handy remembers the conversation you were in and reopens it, and every piece
 * of that worked: the store, the ten-hour window, the restore. It just never
 * ran, because the floating button - the way almost everybody opens Handy -
 * passed newChat on the way in, which wipes the memory before the restore is
 * reached. The whole feature was defeated by one parameter on the door.
 *
 * Read from the source because that is where the bug was: nothing about the
 * session code was wrong, so no test of it could have caught this.
 */
describe('the Handy floating button', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'home', 'AiSparkleFab.tsx'),
    'utf8',
  );

  it('does not start a new conversation', () => {
    /** Ignore the comment that explains why, and check the code itself. */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/newChat/);
  });

  it('still opens Handy', () => {
    expect(source).toMatch(/AiAssistantScreen/);
  });
});
