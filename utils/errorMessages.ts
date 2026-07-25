/**
 * Utility functions for user-friendly error messages
 */

export interface ApiError {
  message?: string;
  details?: {
    data?: {
      error?: string;
      message?: string;
    };
    error?: string;
    message?: string;
  };
  status?: number;
  statusText?: string;
  isNetworkError?: boolean;
}

/**
 * Extracts a user-friendly error message from API error
 */
export const getErrorMessage = (error: ApiError | Error | any, defaultMessage: string = 'Something went wrong. Please try again.'): string => {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return formatApiErrorMessage(error);
  }

  // 1. Network errors – handle first (user has no connection)
  const errorMessage = (error?.message || '').toLowerCase();
  if (error?.isNetworkError ||
      errorMessage.includes('network') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('network request failed') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('network connection') ||
      errorMessage.includes('no internet') ||
      errorMessage.includes('offline') ||
      (error?.name === 'TypeError' && errorMessage.includes('fetch'))) {
    return 'No internet connection. Check your network and try again.';
  }

  // 2. Try to extract a clear backend message up front (before generic status-based fallbacks)
  const rawBackendMessage =
    (error?.details?.data?.error ||
      error?.details?.data?.message ||
      error?.details?.error ||
      error?.details?.message ||
      error?.message ||
      '') as string;
  const rawBackendMessageLower = rawBackendMessage.toLowerCase();

  if (
    rawBackendMessage &&
    // Ignore very generic wrappers – we want real validation text like `"field" must be a positive number`
    !rawBackendMessageLower.includes('request failed with status') &&
    !rawBackendMessageLower.includes('something went wrong') &&
    !rawBackendMessageLower.includes('invalid information provided') &&
    !rawBackendMessageLower.includes('failed to') // e.g. \"Failed to send quotation\"
  ) {
    return formatApiErrorMessage(rawBackendMessage);
  }

  // 3. HTTP status codes – use explicit user messages before raw backend text
  const status = error?.status ?? error?.response?.status;
  if (typeof status === 'number') {
    // 401 / 403 – invalid credentials or forbidden
    if (status === 401 || status === 403) {
      return 'Invalid email or password. Please try again.';
    }
    // 500+ – server error, avoid exposing technical details
    if (status >= 500) {
      return 'We could not complete that just now. Please try again in a moment.';
    }
    // 4xx – use status-specific messages
    if (status >= 400 && status < 500) {
      const statusMsg = getStatusErrorMessage(status);
      if (statusMsg) return statusMsg;
    }
  }

  // 3. Technical backend errors (e.g. DB schema) – treat as server error
  const rawMsg = (error?.message || error?.details?.data?.error || error?.details?.error || '').toLowerCase();
  if (rawMsg.includes('column') && (rawMsg.includes('does not exist') || rawMsg.includes('do not exist'))) {
    return 'We could not complete that just now. Please try again in a moment.';
  }

  // Check nested error structure (API format)
  if (error?.details?.data?.error) {
    return formatApiErrorMessage(error.details.data.error);
  }

  if (error?.details?.data?.message) {
    return formatApiErrorMessage(error.details.data.message);
  }

  if (error?.details?.error) {
    return formatApiErrorMessage(error.details.error);
  }

  if (error?.details?.message) {
    return formatApiErrorMessage(error.details.message);
  }

  // Check top-level error message
  if (error?.message && error.message !== 'Failed' && error.message !== 'Request failed') {
    return formatApiErrorMessage(error.message);
  }

  // Check status codes for common errors
  if (error?.status) {
    return getStatusErrorMessage(error.status);
  }

  // Fallback to default message
  return defaultMessage;
};

/**
 * Formats API error messages to be more user-friendly
 */
const formatApiErrorMessage = (message: string): string => {
  if (!message) return 'Something went wrong. Please try again.';

  // Handle "Provider already has categories" error - extract category names
  if (message.includes('Provider already has the following categories:')) {
    // Extract category names from the error message
    const categoriesMatch = message.match(/categories:\s*([^.]+)/);
    if (categoriesMatch && categoriesMatch[1]) {
      const categoryNames = categoriesMatch[1].split(',').map(c => c.trim()).filter(c => c);
      if (categoryNames.length > 0) {
        // Format category names to be more readable
        const formattedCategories = categoryNames
          .map(cat => {
            // Convert camelCase to readable format (e.g., "airConditioning" -> "Air Conditioning")
            return cat
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();
          })
          .join(', ');
        
        return `Some categories are already added to your profile: ${formattedCategories}. Please select different categories or remove existing ones first.`;
      }
    }
    // Fallback if we can't extract categories
    return 'Some of these categories are already added to your profile. Please select different categories or remove existing ones first.';
  }

  // Common API error patterns to make more user-friendly
  const errorMappings: { [key: string]: string } = {
    'Scheduled date cannot be in the past': 'Please select a future date and time for your visit.',
    'date cannot be in the past': 'Please select a future date and time for your visit.',
    'You must accept the request before requesting a visit': 'Please accept the request first, then schedule your visit.',
    'You have not accepted this request': 'Please accept the request first, then try again.',
    'You must accept the request before sending a quotation': 'Please accept the request first, then send your quotation.',
    'User already Exists. Sign In instead.': 'An account with this email or phone number already exists. Please sign in instead.',
    'Invalid email or password': 'The email or password you entered is incorrect. Please try again.',
    'User not found': 'No account found with these details. Please check and try again.',
    'Invalid token': 'Your session has expired. Please sign in again.',
    'Token expired': 'Your session has expired. Please sign in again.',
    'Unauthorized': 'Please sign in to continue.',
    'Forbidden': 'You don\'t have permission to perform this action.',
    'Not found': 'The requested item could not be found.',
    'Network request failed': 'No internet connection. Check your network and try again.',
    'Network connection failed': 'No internet connection. Check your network and try again.',
    'Failed to fetch': 'No internet connection. Check your network and try again.',
    'TypeError: Network request failed': 'No internet connection. Check your network and try again.',
    'timeout': 'The request took too long. Please check your connection and try again.',
    'Duplicate categories are not allowed': 'You have selected duplicate categories. Please select each category only once.',
    'You have already accepted this request': 'You have already accepted this request. You can schedule a visit or send a quotation.',
    'Service request is not available for acceptance': 'This request is no longer available for acceptance.',
    'A visit has already been requested for this request': 'A visit has already been scheduled. The client will be notified.',
    'app client does not exist': 'Your account needs to be set up properly. Please complete your profile setup or contact support.',
    'property app client does not exist': 'Your account setup is incomplete. Please complete your profile setup first.',
  };

  // Check for exact matches first
  if (errorMappings[message]) {
    return errorMappings[message];
  }

  // Check for partial matches (case-insensitive)
  const lowerMessage = message.toLowerCase();
  for (const [key, value] of Object.entries(errorMappings)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }

  // If message is too technical, provide a generic friendly message
  if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
    return 'No internet connection. Check your network and try again.';
  }

  if (message.includes('500') || message.includes('Internal Server Error')) {
    return 'We could not complete that just now. Please try again in a moment.';
  }

  if (message.includes('400') || message.includes('Bad Request')) {
    return 'Invalid information provided. Please check your input and try again.';
  }

  if (message.includes('401') || message.includes('Unauthorized')) {
    return 'Please sign in to continue.';
  }

  if (message.includes('403') || message.includes('Forbidden')) {
    return 'You don\'t have permission to perform this action.';
  }

  if (message.includes('404') || message.includes('Not Found')) {
    return 'The requested item could not be found.';
  }

  if (message.includes('429') || message.includes('Too Many Requests')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Return the original message if it's already user-friendly
  // Otherwise, return a generic message
  if (message.length < 100 && !message.includes('Error:') && !message.includes('Exception')) {
    return message;
  }

  return 'Something went wrong. Please try again.';
};

/**
 * Gets user-friendly error message based on HTTP status code
 */
const getStatusErrorMessage = (status: number): string => {
  const statusMessages: { [key: number]: string } = {
    400: 'Invalid information provided. Please check your input and try again.',
    401: 'Please sign in to continue.',
    403: 'You don\'t have permission to perform this action.',
    404: 'The requested item could not be found.',
    408: 'The request took too long. Please try again.',
    409: 'This action conflicts with existing data. Please check and try again.',
    422: 'Invalid information provided. Please check your input and try again.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'Something went wrong. Please try again in a moment.',
    502: 'We are temporarily unavailable. Please try again later.',
    503: 'The service is temporarily unavailable. Please try again later.',
    504: 'The request took too long. Please try again.',
  };

  return statusMessages[status] || 'Something went wrong. Please try again.';
};

/**
 * Gets a user-friendly error message for specific error types
 */
export const getSpecificErrorMessage = (error: ApiError | Error | any, context?: string): string => {
  const defaultMessages: { [key: string]: string } = {
    'provider_login': 'Login failed. Please check your email and password, then try again.',
    'user_login': 'Login failed. Please check your email and password, then try again.',
    'request_visit': 'Failed to request visit. Please try again.',
    'request_visit_must_accept': 'Please accept the request first, then request a visit.',
    'pay_logistics_fee': 'Failed to pay logistics fee. Please try again.',
    'pay_logistics_fee_not_requested':
      'The provider has not requested a site visit yet. You can pay the visit fee once they send a visit request.',
    'decline_visit': 'Failed to decline visit. Please try again.',
    'decline_visit_not_requested':
      'The provider has not requested a site visit yet. You can decline once they send a visit request.',
    'accept_quotation': 'Failed to accept quotation. Please try again.',
    'create_request': 'Failed to create service request. Please try again.',
    'update_job_details': 'Failed to update job details. Please check your information and try again.',
    'update_date_time': 'Failed to update date and time. Please try again.',
    'get_requests': 'Failed to load your requests. Please pull down to refresh.',
    'cancel_request': 'Failed to cancel request. Please try again.',
    'get_categories': 'Failed to load categories. Please try again.',
    'search_categories': 'Failed to search categories. Please try again.',
    'save_location': 'Failed to save location. Please try again.',
    'get_location': 'Failed to load location. Please try again.',
    'send_quotation': 'Failed to send quotation. Please check your details and try again.',
    'search_location': 'Location search is temporarily unavailable. Please enter your location manually.',
    'provider_profile_setup': 'Failed to complete profile setup. Please try again.',
    'add_categories': 'Failed to save categories. Some categories may already be added to your profile. Please select different categories or try again.',
    'accept_request': 'Failed to accept request. Please try again.',
    'reject_request': 'Failed to reject request. Please try again.',
    'get_request_details': 'Failed to load request details. Please try again.',
    'select_provider': 'Failed to select provider. Please try again.',
    'get_accepted_providers': 'Failed to load accepted providers. Please try again.',
    'get_accepted_requests': 'Failed to load accepted requests. Please try again.',
    'get_available_requests': 'Failed to load available requests. Make sure you have registered categories and set your location.',
    'reject_quotation': 'Failed to reject quotation. Please try again.',
    'get_provider_quotations': 'Failed to load quotations. Please try again.',
    'pay_for_service': 'Payment failed. Please check your PIN and wallet balance, then try again.',
    'complete_service_request': 'Failed to complete job. Please ensure payment is completed and try again.',
    'start_work_order': 'Failed to start work order. Please try again.',
    'provider_mark_complete': 'Failed to mark work complete. Please try again.',
    'initialize_deposit': 'Failed to initialize deposit. Please try again.',
    'verify_deposit': 'Failed to verify deposit. Please try again.',
    'withdraw': 'Withdrawal failed. Check your PIN and balance, then try again.',
  };

  const defaultMessage = context ? defaultMessages[context] || 'Something went wrong. Please try again.' : 'Something went wrong. Please try again.';

  if (context === 'decline_visit') {
    const raw = (
      error?.details?.data?.error ||
      error?.details?.data?.message ||
      error?.details?.error ||
      error?.message ||
      ''
    )
      .toString()
      .toLowerCase();
    if (raw.includes('no visit') && raw.includes('requested')) {
      return defaultMessages.decline_visit_not_requested;
    }
  }

  if (context === 'pay_logistics_fee') {
    const raw = (
      error?.details?.data?.error ||
      error?.details?.data?.message ||
      error?.details?.error ||
      error?.message ||
      ''
    )
      .toString()
      .toLowerCase();
    if (raw.includes('no visit') && raw.includes('requested')) {
      return defaultMessages.pay_logistics_fee_not_requested;
    }
  }

  return getErrorMessage(error, defaultMessage);
};
