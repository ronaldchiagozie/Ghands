import {
  buildReviewerDisplayName,
  flattenReviewRecord,
  isGenericReviewerLabel,
  reviewAvatarUrl,
} from '@/utils/reviewerDisplayName';

describe('reviewerDisplayName', () => {
  it('ignores generic reviewerName and uses nested first/last name', () => {
    expect(
      buildReviewerDisplayName({
        reviewerName: 'Client',
        reviewer: { firstName: 'Ada', lastName: 'Okonkwo' },
        comment: 'Great work',
      }),
    ).toBe('Ada Okonkwo');
  });

  it('uses clientName when present', () => {
    expect(
      buildReviewerDisplayName({
        clientName: 'Ronald Bendee',
        rating: 5,
      }),
    ).toBe('Ronald Bendee');
  });

  it('falls back to userName when not generic', () => {
    expect(
      buildReviewerDisplayName({
        reviewerName: 'Client',
        userName: 'ronald_bendee',
        userId: 12,
      }),
    ).toBe('ronald_bendee');
  });

  it('treats Client as generic', () => {
    expect(isGenericReviewerLabel('Client')).toBe(true);
    expect(isGenericReviewerLabel('Ada')).toBe(false);
  });

  it('flattenReviewRecord merges nested user', () => {
    const flat = flattenReviewRecord({
      id: 1,
      user: { firstName: 'Jane', lastName: 'Doe' },
    });
    expect(flat.firstName).toBe('Jane');
    expect(flat.id).toBe(1);
  });

  it('reviewAvatarUrl reads nested profile image', () => {
    expect(
      reviewAvatarUrl({
        client: { profileImageUrl: 'https://cdn.example/a.jpg' },
      }),
    ).toBe('https://cdn.example/a.jpg');
  });
});
