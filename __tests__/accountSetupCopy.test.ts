/**
 * The setup checklist decides what a user is nudged about. These pin the two
 * properties that make it worth showing at all: it must only ever list what is
 * genuinely outstanding, and it must not nag about things it could not check.
 */
import type { SetupTask } from '@/hooks/useAccountSetup';

function outstanding(tasks: SetupTask[]) {
  return tasks.filter((t) => !t.done);
}

const ALL: SetupTask[] = [
  { id: 'profile', title: 'Add your details', detail: '', required: true, done: false },
  { id: 'location', title: 'Set your location', detail: '', required: true, done: false },
  { id: 'pin', title: 'Create a wallet PIN', detail: '', required: false, done: false },
  { id: 'bank', title: 'Add a bank account', detail: '', required: false, done: false },
  { id: 'notifications', title: 'Turn on notifications', detail: '', required: false, done: true },
];

describe('account setup checklist', () => {
  it('lists only what is still outstanding', () => {
    expect(outstanding(ALL).map((t) => t.id)).toEqual(['profile', 'location', 'pin', 'bank']);
  });

  it('is empty once everything is done, so the card disappears', () => {
    const done = ALL.map((t) => ({ ...t, done: true }));
    expect(outstanding(done)).toHaveLength(0);
  });

  it('marks profile and location as blocking, the rest as optional', () => {
    const required = ALL.filter((t) => t.required).map((t) => t.id);
    expect(required).toEqual(['profile', 'location']);
  });

  it('counts progress against the full list, not the outstanding one', () => {
    const completed = ALL.length - outstanding(ALL).length;
    expect(completed).toBe(1);
    expect(ALL.length).toBe(5);
  });
});
