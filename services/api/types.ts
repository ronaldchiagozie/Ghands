// Shared API types and interfaces

export interface LocationData {
  placeId?: string;
  address?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
}

export interface LocationSearchResult {
  placeId: string;
  placeName: string;
  fullAddress: string;
  address: string;
  mainText?: string;
  secondaryText?: string;
}

export interface LocationDetails {
  placeId?: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  country: string;
  address: string;
}

export interface SavedLocation {
  placeId: string;
  placeName: string;
  fullAddress: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  country: string;
}

/** Payload for POST /api/user/update-location */
export interface UpdateLocationPayload {
  placeId?: string;
  address?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
}

export interface UserSignupPayload {
  email: string;
  password: string;
  phoneNumber?: string;
}

export interface UserSignupResponse {
  firstName: string;
  lastName: string;
  email: string;
  token: string;
  id?: number;
}

export interface UserLoginPayload {
  email: string;
  password: string;
}

export interface UserLoginResponse {
  id?: number;
  firstName?: string;
  lastName?: string;
  email: string;
  token: string;
  message?: string;
}

export interface CompanySignupPayload {
  email: string;
  phoneNumber: string;
  password: string;
}

/** Client (book services) company account — POST /api/user/company-signup */
export interface ClientCompanySignupPayload {
  companyName: string;
  companyPhoneNumber: string;
  companyEmail: string;
  companyPassword: string;
}

export interface ClientCompanySignupResponse {
  id?: number;
  companyName?: string;
  companyEmail?: string;
  companyPhoneNumber?: string;
  token: string;
}

export interface CompanySignupResponse {
  id: number;
  companyName: string;
  companyPhoneNumber: string;
  companyEmail: string;
  token: string;
}

export interface ServiceCategory {
  id?: number;
  name: string;
  displayName: string;
  description: string;
  providerCount: number;
  icon?: string;
}

export interface CreateServiceRequestPayload {
  userId: number;
  categoryName: string;
  jobTitle?: string;
  description?: string;
  comment?: string;
}

export interface CreateServiceRequestResponse {
  requestId: number;
  categoryName: string;
  status: string;
  message: string;
}

export interface UpdateJobDetailsPayload {
  jobTitle: string;
  description: string;
  comment?: string;
  location?: LocationData;
}

export interface NearbyProvider {
  id: number;
  name: string;
  verified: boolean;
  age: number;
  phoneNumber: string;
  location: {
    address: string;
    city: string;
    state: string;
  };
  distanceKm: number;
  minutesAway: number;
}

export interface UpdateJobDetailsResponse {
  requestId: number;
  jobTitle: string;
  description: string;
  location: string;
  locationVerifiedAt: string;
  nearbyProviders?: NearbyProvider[];
  message: string;
}

export interface UpdateDateTimePayload {
  scheduledDate: string;
  scheduledTime: string;
}

export interface UpdateDateTimeResponse {
  requestId: number;
  scheduledDate: string;
  scheduledTime: string;
  message: string;
}

export interface ServiceRequest {
  id: number;
  categoryName: string;
  jobTitle: string;
  description: string;
  comment?: string;
  location?: {
    formattedAddress?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    locationVerifiedAt?: string;
  };
  scheduledDate?: string;
  scheduledTime?: string;
  status: 'pending' | 'accepted' | 'inspecting' | 'quoting' | 'scheduled' | 'in_progress' | 'reviewing' | 'completed' | 'cancelled';
  nearbyProviders?: NearbyProvider[];
  user?: {
    id: number;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    phone?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
  selectedProvider?: {
    id: number;
    name: string;
    phoneNumber: string;
    email: string;
  };
  provider?: {
    id?: number;
    name?: string;
    phoneNumber?: string;
    email?: string;
  };
  client?: {
    id?: number;
    firstName?: string;
    lastName?: string;
    name?: string;
    phoneNumber?: string;
    phone?: string;
    email?: string;
  };
  providerName?: string;
  totalCost?: number | string;
  total_amount?: number | string;
  paymentAmount?: number | string;
  amount?: number | string;
  selectedAt?: string;
  selectionTimeoutAt?: string;
  visitRequest?: {
    scheduledDate?: string;
    scheduledTime?: string;
    logisticsCost?: number;
    logisticsStatus?: 'pending_payment' | 'paid' | 'cancelled';
    requestedAt?: string;
  };
}

export interface PayForServicePayload {
  requestId: number;
  amount: number;
  pin: string;
}

export interface PayForServiceResponse {
  reference: string;
  status: 'completed' | 'pending' | 'failed';
  amount: number;
  balance: number;
  requestId: number;
}

export interface Notification {
  id: number;
  userId: number;
  providerId?: number | null;
  companyId?: number | null;
  type: string;
  status: 'unread' | 'read';
  title: string;
  message: string;
  description?: string | null;
  requestId?: number | null;
  transactionId?: number | null;
  quotationId?: number | null;
  metadata?: Record<string, any> | null;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsListResult {
  notifications: Notification[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProviderSignupPayload {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  age: number;
  verified?: boolean;
  location?: LocationData;
  categories?: string[];
}

export interface ProviderSignupResponse {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string;
  verified: boolean;
  age: number;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  token: string;
  message: string;
}

export interface ProviderLoginPayload {
  email: string;
  password: string;
}

export interface ProviderLoginResponse {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string;
  verified: boolean;
  age: number;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  token: string;
  message: string;
}

export interface Provider {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string;
  verified: boolean;
  age: number;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive: boolean;
  categories: string[];
}

export interface ProviderLocationPayload {
  address?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

export interface AvailableRequest extends ServiceRequest {
  distanceKm: number;
  minutesAway: number;
}

export interface QuotationMaterial {
  name: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export interface SendQuotationPayload {
  laborCost: number;
  logisticsCost: number;
  materials?: QuotationMaterial[];
  findingsAndWorkRequired: string;
  serviceCharge?: number;
  tax?: number;
}

export interface Quotation {
  id: number;
  requestId: number;
  laborCost: number;
  logisticsCost: number;
  materials: QuotationMaterial[];
  findingsAndWorkRequired: string;
  serviceCharge: number;
  tax: number;
  total: number;
  status: 'draft' | 'pending' | 'accepted' | 'rejected' | 'expired';
  sentAt: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  message?: string;
}

export interface SendQuotationResponse {
  id: number;
  requestId: number;
  laborCost: number;
  logisticsCost: number;
  materials: QuotationMaterial[];
  findingsAndWorkRequired: string;
  serviceCharge: number;
  tax: number;
  total: number;
  status: 'pending';
  sentAt: string;
  message: string;
}

export interface QuotationWithProvider {
  id: number;
  provider: {
    id: number;
    name: string;
    verified: boolean;
    phoneNumber: string;
  };
  laborCost: number;
  logisticsCost: number;
  materials: QuotationMaterial[];
  findingsAndWorkRequired: string;
  serviceCharge: number;
  tax: number;
  total: number;
  status: 'draft' | 'pending' | 'accepted' | 'rejected' | 'expired';
  sentAt: string;
  submittedAt?: string;
}

export interface ProviderQuotationListItem {
  id: number;
  requestId: number;
  request: {
    id: number;
    jobTitle: string;
    description: string;
    status: string;
  };
  user: {
    id: number;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  };
  laborCost: number;
  logisticsCost: number;
  materials: QuotationMaterial[];
  total: number;
  status: 'draft' | 'pending' | 'accepted' | 'rejected' | 'expired';
  sentAt: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
}

export interface Message {
  id: number;
  requestId: number;
  senderId: number;
  senderType: 'user' | 'provider' | 'company';
  content: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null;
  isRead?: boolean;
}

export interface SendMessagePayload {
  content: string;
  type?: 'text';
}

export interface SendMessageResponse {
  id: number;
  requestId: number;
  senderId: number;
  senderType: 'user' | 'provider' | 'company';
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetMessagesResponse {
  messages: Message[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface UnreadCountResponse {
  count: number;
}
