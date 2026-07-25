import { JOB_TIMELINE } from '@/lib/jobTimelineTheme';
import {
  getVisitDeclinedDescription,
  isVisitCompletedOrPaid,
  isVisitPaid,
} from '@/utils/visitStatus';

export type NegotiationStepVisual = {
  description: string;
  status: string;
  isActive: boolean;
  isCompleted: boolean;
  isDeclined: boolean;
  isSkipped: boolean;
  accent: string;
  dotColor: string;
  lineColor: string;
  showRequestVisit?: boolean;
  canEdit?: boolean;
};

type Audience = 'client' | 'provider';

function pendingStep(description: string): NegotiationStepVisual {
  return {
    description,
    status: 'Pending',
    isActive: false,
    isCompleted: false,
    isDeclined: false,
    isSkipped: false,
    accent: '#F3F4F6',
    dotColor: JOB_TIMELINE.pendingDot,
    lineColor: JOB_TIMELINE.railMuted,
    showRequestVisit: false,
    canEdit: false,
  };
}

function activeStep(description: string, extras?: Partial<NegotiationStepVisual>): NegotiationStepVisual {
  return {
    description,
    status: 'Active',
    isActive: true,
    isCompleted: false,
    isDeclined: false,
    isSkipped: false,
    accent: '#FEF9C3',
    dotColor: JOB_TIMELINE.activeDot,
    lineColor: JOB_TIMELINE.activeDot,
    showRequestVisit: false,
    canEdit: false,
    ...extras,
  };
}

function skippedStep(description: string): NegotiationStepVisual {
  return {
    description,
    status: 'Skipped',
    isActive: false,
    isCompleted: false,
    isDeclined: false,
    isSkipped: true,
    accent: JOB_TIMELINE.pendingSoft,
    lineColor: JOB_TIMELINE.railMuted,
    showRequestVisit: false,
    canEdit: false,
  };
}

const DIRECT_QUOTATION_SKIP_NOTE = 'Direct quotation chosen.';

function completedStep(description: string, status = 'Done'): NegotiationStepVisual {
  return {
    description,
    status,
    isActive: false,
    isCompleted: true,
    isDeclined: false,
    isSkipped: false,
    accent: JOB_TIMELINE.completeSoft,
    dotColor: JOB_TIMELINE.sage,
    lineColor: JOB_TIMELINE.sage,
    showRequestVisit: false,
    canEdit: false,
  };
}

function declinedStep(description: string): NegotiationStepVisual {
  return {
    description,
    status: 'Declined',
    isActive: false,
    isCompleted: false,
    isDeclined: true,
    isSkipped: false,
    accent: JOB_TIMELINE.declinedSoft,
    dotColor: JOB_TIMELINE.declinedDot,
    lineColor: JOB_TIMELINE.railMuted,
    showRequestVisit: false,
    canEdit: false,
  };
}

/** Inspection (visit) and quotation are parallel options — only one should be "active" at a time. */
export function getInspectionNegotiationStep(input: {
  audience: Audience;
  providerHasAccepted: boolean;
  quotationSent: boolean;
  hasVisitRequested: boolean;
  visitDeclined: boolean;
  visitPaid: boolean;
  visitScheduleText: string;
  visitRequest?: Record<string, unknown> | null;
  /** When true, a visit happened even if visitRequest was dropped from API (e.g. after quote). */
  visitOccurred?: boolean;
}): NegotiationStepVisual {
  const {
    audience,
    providerHasAccepted,
    quotationSent,
    hasVisitRequested,
    visitDeclined,
    visitPaid,
    visitScheduleText,
    visitRequest,
    visitOccurred,
  } = input;

  const visitHappened = visitOccurred ?? hasVisitRequested;

  if (!providerHasAccepted) {
    return pendingStep(audience === 'provider' ? 'Accept before taking action.' : 'Waiting for a provider.');
  }

  if (visitDeclined) {
    const declineNote = getVisitDeclinedDescription(visitRequest, audience);
    const suffix = quotationSent
      ? audience === 'client'
        ? ' Quotation received.'
        : ' Quotation sent.'
      : audience === 'provider'
        ? ' Request a new visit or send a quote.'
        : ' Provider can request again or send a quote.';
    return declinedStep(`${declineNote}${suffix}`);
  }

  if (quotationSent && visitHappened) {
    if (visitPaid || isVisitCompletedOrPaid(visitRequest)) {
      const schedule =
        visitScheduleText && !/^(\s*—\s*|tbd|pending)$/i.test(visitScheduleText.trim())
          ? visitScheduleText.replace(/^for\s+/i, '')
          : null;
      return completedStep(
        schedule
          ? audience === 'client'
            ? `Site visit completed (${schedule}).`
            : `Site visit completed for ${schedule}.`
          : audience === 'client'
            ? 'Site visit completed.'
            : 'Site visit completed.'
      );
    }
    return completedStep(
      audience === 'client' ? 'Site visit completed. Quotation received.' : 'Visit completed. Quotation sent.'
    );
  }

  if (quotationSent && !visitHappened) {
    return skippedStep(DIRECT_QUOTATION_SKIP_NOTE);
  }

  if (visitHappened || hasVisitRequested) {
    if (visitPaid || isVisitPaid(visitRequest)) {
      return completedStep(`Visit confirmed for ${visitScheduleText}.`);
    }
    return activeStep(
      `Visit requested for ${visitScheduleText}.`,
      { status: audience === 'client' ? 'Active' : 'Waiting' },
    );
  }

  return activeStep(
    audience === 'provider' ? 'Request a visit or send a quote directly.' : 'Waiting for inspection or quotation.',
    { showRequestVisit: audience === 'provider' },
  );
}

export function getQuotationNegotiationStep(input: {
  audience: Audience;
  providerHasAccepted: boolean;
  quotationSent: boolean;
  hasVisitRequested: boolean;
  visitDeclined: boolean;
  visitPaid: boolean;
  visitBlocksQuote: boolean;
  visitOccurred?: boolean;
}): NegotiationStepVisual {
  const {
    audience,
    providerHasAccepted,
    quotationSent,
    hasVisitRequested,
    visitDeclined,
    visitPaid,
    visitBlocksQuote,
    visitOccurred,
  } = input;

  const visitHappened = visitOccurred ?? hasVisitRequested;

  if (!providerHasAccepted) {
    return pendingStep(audience === 'provider' ? 'Send quote after accepting.' : 'No quote yet.');
  }

  if (quotationSent) {
    return completedStep(
      audience === 'client' ? 'Quote received.' : 'Waiting for client review.',
      audience === 'client' ? 'Received' : 'Sent'
    );
  }

  if (visitDeclined && !quotationSent) {
    return activeStep(
      audience === 'client'
        ? 'Waiting for provider to send a quotation.'
        : 'Send a quote — visit was declined.',
    );
  }

  if (visitBlocksQuote) {
    return pendingStep('Visit payment comes first.');
  }

  if (visitHappened && visitPaid) {
    return activeStep(
      audience === 'provider' ? 'Prepare the quote after visit.' : 'Provider is preparing the quote.'
    );
  }

  if (!visitHappened && !visitDeclined) {
    return pendingStep(
      audience === 'provider' ? 'Send a quote directly or after a visit.' : 'Waiting for quotation.'
    );
  }

  return pendingStep(audience === 'provider' ? 'Prepare the quote.' : 'Waiting for quotation.');
}

export function timelineStepBadgeLabel(step: {
  isCompleted?: boolean;
  isActive?: boolean;
  isDeclined?: boolean;
  isSkipped?: boolean;
  status?: string;
}): string {
  if (step.isCompleted) return 'Done';
  if (step.isDeclined) return 'Declined';
  if (step.isSkipped) return 'Skipped';
  if (step.isActive) return 'Active';
  return step.status || 'Pending';
}

export function timelineStepBadgeTextColor(step: {
  isCompleted?: boolean;
  isActive?: boolean;
  isDeclined?: boolean;
  isSkipped?: boolean;
}): string {
  if (step.isCompleted) return JOB_TIMELINE.sageChipText;
  if (step.isDeclined) return JOB_TIMELINE.declinedChipText;
  if (step.isSkipped) return JOB_TIMELINE.pendingChipText;
  if (step.isActive) return JOB_TIMELINE.activeChipText;
  return JOB_TIMELINE.pendingChipText;
}
