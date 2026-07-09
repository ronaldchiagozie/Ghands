import AsyncStorage from '@react-native-async-storage/async-storage';
import { extractUserIdFromToken } from '../utils/tokenUtils';
import { getSecureItem, setSecureItem, removeSecureItems } from '../utils/secureStorage';

// ============================================================================
// STORAGE KEYS
// ============================================================================
const AUTH_TOKEN_KEY = '@ghands:auth_token';
const REFRESH_TOKEN_KEY = '@ghands:refresh_token';
const USER_ID_KEY = '@ghands:user_id';
const COMPANY_ID_KEY = '@ghands:company_id';

// ============================================================================
// AUTH SERVICE
// ============================================================================
/**
 * AuthService handles all authentication-related operations:
 * - Token storage and retrieval
 * - User ID management
 * - Company ID management
 * 
 * This service is separate from ApiClient to maintain clean separation:
 * - ApiClient = HTTP transport layer only
 * - AuthService = Authentication/identity logic
 */
class AuthService {
  /**
   * Validates token format (JWT or UUID)
   */
  private isValidToken(token: string | null | undefined): boolean {
    if (token === null || token === undefined) return false;
    if (typeof token !== 'string') return false;
    
    const trimmed = String(token).trim();
    if (!trimmed || trimmed.length < 10) return false;
    
    // Check JWT format (3 parts separated by dots)
    const parts = trimmed.split('.');
    if (parts.length === 3) {
      return parts.every(part => part.length > 0);
    }
    
    // Check UUID format
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(trimmed)) {
      return true;
    }
    
    return trimmed.length >= 10;
  }

  /**
   * Get authentication token from storage
   * 
   * @returns Token string or null if not found/invalid
   */
  async getAuthToken(): Promise<string | null> {
    try {
      const token = await getSecureItem(AUTH_TOKEN_KEY);
      if (!token || token === 'null' || token === 'undefined' || (typeof token === 'string' && token.trim() === '')) {
        return null;
      }
      
      if (!this.isValidToken(token)) {
        // Invalid token - clean up storage
        await this.clearAuthTokens();
        return null;
      }
      
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Save authentication token to storage
   * 
   * @param token - The token to save
   */
  async setAuthToken(token: string): Promise<void> {
    try {
      await setSecureItem(AUTH_TOKEN_KEY, token);
      const { resetAuthSessionGate } = await import('../utils/enforceAuthSession');
      resetAuthSessionGate();
    } catch {
      /* storage failure – caller handles missing token */
    }
  }

  /**
   * Get refresh token from storage
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await getSecureItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Save refresh token to storage
   */
  async setRefreshToken(token: string): Promise<void> {
    try {
      await setSecureItem(REFRESH_TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  }

  /**
   * Get user ID from storage or extract from token
   * 
   * @returns User ID or null if not found
   */
  async getUserId(): Promise<number | null> {
    try {
      // First, try to get from storage
      const userId = await AsyncStorage.getItem(USER_ID_KEY);
      if (userId) {
        const parsed = parseInt(userId, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
      
      // If not in storage, try to extract from token
      const token = await this.getAuthToken();
      if (token && this.isValidToken(token)) {
        const extractedUserId = extractUserIdFromToken(token);
        if (extractedUserId) {
          await this.setUserId(extractedUserId);
          return extractedUserId;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Save user ID to storage
   */
  async setUserId(userId: number): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_ID_KEY, userId.toString());
    } catch {
      /* ignore */
    }
  }

  /**
   * Get company/provider ID from storage or extract from token
   * 
   * @returns Company ID or null if not found
   */
  async getCompanyId(): Promise<number | null> {
    try {
      // First, try to get from storage
      const companyId = await AsyncStorage.getItem(COMPANY_ID_KEY);
      if (companyId) {
        const parsed = parseInt(companyId, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
      
      // If not in storage, try to extract from token
      const token = await this.getAuthToken();
      if (token && this.isValidToken(token)) {
        const extractedUserId = extractUserIdFromToken(token);
        if (extractedUserId) {
          await AsyncStorage.setItem(COMPANY_ID_KEY, extractedUserId.toString());
          return extractedUserId;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Save company/provider ID to storage
   */
  async setCompanyId(companyId: number): Promise<void> {
    try {
      await AsyncStorage.setItem(COMPANY_ID_KEY, companyId.toString());
    } catch {
      /* ignore */
    }
  }

  /**
   * Clear all authentication data from storage
   * 
   * Use this when:
   * - User logs out
   * - Token is invalid/expired
   * - Authentication fails
   */
  async clearAuthTokens(): Promise<void> {
    try {
      await removeSecureItems([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY]);
      await AsyncStorage.multiRemove([USER_ID_KEY, COMPANY_ID_KEY]);
    } catch {
      /* ignore */
    }
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    return token !== null && this.isValidToken(token);
  }
}

// Export singleton instance
export const authService = new AuthService();
