jest.mock('@/services/api', () => ({
  aiService: {
    sendMessage: jest.fn(),
    deleteConversation: jest.fn(async () => undefined),
  },
}));

jest.mock('@/utils/errorMessages', () => ({
  getSpecificErrorMessage: jest.fn(() => 'Something went wrong'),
}));

import { aiService } from '@/services/api';
import { generateHandyJobDraft } from '@/utils/handyJobDraft';

const sendMessage = aiService.sendMessage as jest.Mock;
const deleteConversation = aiService.deleteConversation as jest.Mock;

const LIMITS = {
  minTitleLength: 3,
  maxTitleLength: 200,
  minDescriptionLength: 10,
  maxDescriptionLength: 500,
};

function chatResponse(suggestion: unknown) {
  return {
    conversationId: 77,
    message: 'Here you go.',
    responseType: 'suggestion',
    suggestion,
  };
}

describe('generateHandyJobDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deleteConversation.mockResolvedValue(undefined);
  });

  it('returns the drafted title and description', async () => {
    sendMessage.mockResolvedValue(
      chatResponse({
        serviceType: 'Plumbing',
        jobTitle: 'Kitchen faucet leak repair',
        description: 'The kitchen faucet drips constantly and the cabinet below is damp.',
      })
    );

    const result = await generateHandyJobDraft({ categoryName: 'Plumbing', ...LIMITS });

    expect(result).toEqual({
      ok: true,
      draft: {
        jobTitle: 'Kitchen faucet leak repair',
        description: 'The kitchen faucet drips constantly and the cabinet below is damp.',
      },
    });
  });

  it('deletes the conversation it created so history stays clean', async () => {
    sendMessage.mockResolvedValue(
      chatResponse({
        serviceType: 'Plumbing',
        jobTitle: 'Kitchen faucet leak repair',
        description: 'The kitchen faucet drips constantly and the cabinet below is damp.',
      })
    );

    await generateHandyJobDraft({ categoryName: 'Plumbing', ...LIMITS });

    expect(deleteConversation).toHaveBeenCalledWith(77);
  });

  it('still deletes the conversation when the draft is unusable', async () => {
    sendMessage.mockResolvedValue(chatResponse({ serviceType: 'Plumbing', jobTitle: '', description: '' }));

    const result = await generateHandyJobDraft({ categoryName: 'Plumbing', ...LIMITS });

    expect(result.ok).toBe(false);
    expect(deleteConversation).toHaveBeenCalledWith(77);
  });

  it('rejects a draft that only fills one of the two fields', async () => {
    sendMessage.mockResolvedValue(
      chatResponse({ serviceType: 'Plumbing', jobTitle: 'Leaky tap', description: 'Too short' })
    );

    const result = await generateHandyJobDraft({ categoryName: 'Plumbing', ...LIMITS });

    expect(result.ok).toBe(false);
  });

  it('rejects a plain text reply that carries no suggestion', async () => {
    sendMessage.mockResolvedValue({
      conversationId: 77,
      message: 'Could you tell me more?',
      responseType: 'text',
    });

    const result = await generateHandyJobDraft({ categoryName: 'Plumbing', ...LIMITS });

    expect(result.ok).toBe(false);
    expect(deleteConversation).toHaveBeenCalledWith(77);
  });

  it('clamps an over-long description at a word boundary', async () => {
    sendMessage.mockResolvedValue(
      chatResponse({
        serviceType: 'Plumbing',
        jobTitle: 'Leaky tap repair',
        description: `${'word '.repeat(200)}end`,
      })
    );

    const result = await generateHandyJobDraft({ categoryName: 'Plumbing', ...LIMITS });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.description.length).toBeLessThanOrEqual(500);
    expect(result.draft.description.endsWith('word')).toBe(true);
  });

  it('surfaces an error instead of throwing when the request fails', async () => {
    sendMessage.mockRejectedValue(new Error('network down'));

    const result = await generateHandyJobDraft({ categoryName: 'Plumbing', ...LIMITS });

    expect(result).toEqual({ ok: false, error: 'Something went wrong' });
    expect(deleteConversation).not.toHaveBeenCalled();
  });

  it('does not reject when conversation cleanup fails', async () => {
    sendMessage.mockResolvedValue(
      chatResponse({
        serviceType: 'Plumbing',
        jobTitle: 'Kitchen faucet leak repair',
        description: 'The kitchen faucet drips constantly and the cabinet below is damp.',
      })
    );
    deleteConversation.mockRejectedValue(new Error('cleanup failed'));

    await expect(
      generateHandyJobDraft({ categoryName: 'Plumbing', ...LIMITS })
    ).resolves.toMatchObject({ ok: true });
  });
});
