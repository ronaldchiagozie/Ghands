import { router } from 'expo-router';

import { CallState } from '@/app/CallScreen';
import { logCallDebug } from '@/utils/callDebugLog';

interface CallParams {
  callState: CallState;
  callerName: string;
  callerId?: string;
  callerImage?: string;
  jobTitle?: string;
  jobDescription?: string;
  orderNumber?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string;
  jobStatus?: string;
  requestId?: string;
  isProvider?: boolean;
}

/**
 * Navigate to CallScreen with proper parameters
 * This utility function ensures consistent call navigation across the app
 */
export function initiateCall(params: CallParams) {
  logCallDebug('callUtils.initiateCall: navigate', {
    callState: params.callState,
    requestId: params.requestId,
    callerName: params.callerName,
    isProvider: params.isProvider,
  });
  router.push({
    pathname: '/CallScreen',
    params: {
      callState: params.callState,
      callerName: params.callerName,
      callerId: params.callerId,
      callerImage: params.callerImage,
      jobTitle: params.jobTitle || 'Service Request',
      jobDescription: params.jobDescription || 'Service request in progress',
      orderNumber: params.orderNumber,
      scheduledDate: params.scheduledDate,
      scheduledTime: params.scheduledTime,
      location: params.location,
      jobStatus: params.jobStatus || 'In Progress',
      requestId: params.requestId,
      isProvider: params.isProvider ? 'true' : 'false',
    },
  } as any);
}

/**
 * Initiate an outgoing call from the current user
 */
export function makeCall(
  recipientName: string,
  recipientId?: string,
  jobDetails?: {
    title?: string;
    description?: string;
    orderNumber?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    location?: string;
    status?: string;
    requestId?: string;
  },
  isProvider?: boolean,
  /** Missing here meant an outgoing call could never show the other person's photo, however real the source data was - see callerImage on showIncomingCall below, which always had it. */
  callerImage?: string
) {
  initiateCall({
    callState: 'outgoing',
    callerName: recipientName,
    callerId: recipientId,
    callerImage,
    jobTitle: jobDetails?.title,
    jobDescription: jobDetails?.description,
    orderNumber: jobDetails?.orderNumber,
    scheduledDate: jobDetails?.scheduledDate,
    scheduledTime: jobDetails?.scheduledTime,
    location: jobDetails?.location,
    jobStatus: jobDetails?.status,
    requestId: jobDetails?.requestId,
    isProvider: isProvider || false,
  });
}

/**
 * Show incoming call screen
 */
export function showIncomingCall(
  callerName: string,
  callerId?: string,
  callerImage?: string,
  jobDetails?: {
    title?: string;
    description?: string;
    orderNumber?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    location?: string;
    status?: string;
    requestId?: string;
  },
  isProvider?: boolean
) {
  initiateCall({
    callState: 'incoming',
    callerName,
    callerId,
    callerImage,
    jobTitle: jobDetails?.title,
    jobDescription: jobDetails?.description,
    orderNumber: jobDetails?.orderNumber,
    scheduledDate: jobDetails?.scheduledDate,
    scheduledTime: jobDetails?.scheduledTime,
    location: jobDetails?.location,
    jobStatus: jobDetails?.status,
    requestId: jobDetails?.requestId,
    isProvider: isProvider || false,
  });
}
