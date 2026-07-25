// Re-export for backward compatibility
export { apiClient, extractResponseData } from './client';
export { profileService } from './profile';
export { locationService } from './location';
export type { LocationSearchResult, LocationDetails, SavedLocation, UpdateLocationPayload } from './location';
export { authService } from './auth';
export { passwordResetService } from './passwordReset';
export type { UserSignupPayload, UserSignupResponse, UserLoginPayload, UserLoginResponse, CompanySignupPayload, CompanySignupResponse } from './auth';
export { serviceRequestService } from './serviceRequest';
export type {
  ServiceCategory,
  CreateServiceRequestPayload,
  CreateServiceRequestResponse,
  UpdateJobDetailsPayload,
  UpdateJobDetailsResponse,
  UpdateDateTimePayload,
  UpdateDateTimeResponse,
  ServiceRequest,
  QuotationWithProvider,
} from './serviceRequest';
export { walletService } from './wallet';
export type { PayForServicePayload, PayForServiceResponse, Bank, BankAccount, ResolveAccountResponse } from './wallet';
export { notificationService } from './notification';
export type { Notification, NotificationsListResult } from './notification';
export { providerService } from './provider';
export type {
  Provider,
  ProviderSignupPayload,
  ProviderSignupResponse,
  ProviderLoginPayload,
  ProviderLoginResponse,
  ProviderLocationPayload,
  ProviderQuotationListItem,
  AvailableRequest,
} from './provider';
export { communicationService } from './communication';
export type { Message, SendMessagePayload, SendMessageResponse, GetMessagesResponse, UnreadCountResponse } from './communication';
export { aiService } from './ai';
export type {
  AiStatus,
  AiChatRequest,
  AiChatResponse,
  AiResponseType,
  AiEstimate,
  AiBookingSuggestion,
  AiConversationSummary,
  AiConversationMessage,
  AiConversationDetail,
  AiQuickBookingRequest,
  AiQuickBookingResponse,
  AiQuickBookingProvider,
} from './ai';
export type {
  LocationData,
  NearbyProvider,
  QuotationMaterial,
  Quotation,
  SendQuotationPayload,
  SendQuotationResponse,
} from './types';
