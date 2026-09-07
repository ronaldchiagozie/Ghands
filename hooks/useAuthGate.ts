import { authService } from '@/services/api';
import { useAuthRole } from '@/hooks/useAuth';
import { useRoleSwitching } from '@/hooks/useRoleSwitching';
import { useEffect, useState } from 'react';

/**
 * Role + token for tab layouts - avoids sending logged-in users to login/auth by mistake.
 */
export function useAuthGate() {
  const { role, isLoading: roleLoading } = useAuthRole();
  const isSwitchingRole = useRoleSwitching();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      try {
        const token = await authService.getAuthToken();
        if (mounted) setHasToken(!!token);
      } catch {
        if (mounted) setHasToken(false);
      }
    };

    void sync();
    return () => {
      mounted = false;
    };
  }, [role, isSwitchingRole]);

  return {
    role,
    hasToken: hasToken === true,
    isLoading: roleLoading || hasToken === null,
    isSwitchingRole,
  };
}
