import { pickRebookSeed } from '@/utils/rebook';

describe('pickRebookSeed', () => {
  const completed = (over: Record<string, unknown> = {}) => ({
    id: 1,
    status: 'completed',
    categoryName: 'Cleaning',
    jobTitle: 'Deep clean the kitchen',
    description: 'Two bedroom flat, oven included.',
    createdAt: '2026-08-01T09:00:00.000Z',
    ...over,
  });

  it('carries the category, title and description forward', () => {
    expect(pickRebookSeed([completed()])).toEqual({
      categoryName: 'Cleaning',
      jobTitle: 'Deep clean the kitchen',
      description: 'Two bedroom flat, oven included.',
    });
  });

  it('offers nothing when there is no history', () => {
    expect(pickRebookSeed([])).toBeNull();
    expect(pickRebookSeed(null)).toBeNull();
    expect(pickRebookSeed(undefined)).toBeNull();
  });

  /**
   * The case the card exists to avoid: a job in flight is not a job to repeat,
   * and booking one again raises a duplicate for work already in hand.
   */
  it('ignores jobs that are still running', () => {
    const live = ['pending', 'accepted', 'inspecting', 'quoting', 'scheduled', 'in_progress', 'reviewing'];
    live.forEach((status) => {
      expect(pickRebookSeed([completed({ status })])).toBeNull();
    });
  });

  it('ignores cancelled jobs', () => {
    expect(pickRebookSeed([completed({ status: 'cancelled' })])).toBeNull();
  });

  it('takes the most recent finished job, whatever order they arrive in', () => {
    const seed = pickRebookSeed([
      completed({ id: 1, categoryName: 'Plumbing', createdAt: '2026-07-01T09:00:00.000Z' }),
      completed({ id: 2, categoryName: 'Cleaning', createdAt: '2026-08-20T09:00:00.000Z' }),
      completed({ id: 3, categoryName: 'Painting', createdAt: '2026-08-02T09:00:00.000Z' }),
    ]);
    expect(seed?.categoryName).toBe('Cleaning');
  });

  it('skips a finished job with no category, since there is nothing to book', () => {
    const seed = pickRebookSeed([
      completed({ id: 1, categoryName: 'Plumbing', createdAt: '2026-07-01T09:00:00.000Z' }),
      completed({ id: 2, categoryName: '   ', createdAt: '2026-08-20T09:00:00.000Z' }),
    ]);
    expect(seed?.categoryName).toBe('Plumbing');
  });

  /** A category with no write-up is still worth a shortcut. */
  it('allows an empty title and description', () => {
    expect(pickRebookSeed([completed({ jobTitle: null, description: undefined })])).toEqual({
      categoryName: 'Cleaning',
      jobTitle: '',
      description: '',
    });
  });

  it('survives a record with no createdAt', () => {
    const seed = pickRebookSeed([
      completed({ id: 1, categoryName: 'Plumbing', createdAt: null }),
      completed({ id: 2, categoryName: 'Cleaning', createdAt: '2026-08-20T09:00:00.000Z' }),
    ]);
    expect(seed?.categoryName).toBe('Cleaning');
  });

  it('reads the status regardless of case or padding', () => {
    expect(pickRebookSeed([completed({ status: ' Completed ' })])?.categoryName).toBe('Cleaning');
  });
});
