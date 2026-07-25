import React from 'react';
import { Button } from './ui/Button';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}) => {
  return (
    <Button
      title={title}
      onPress={onPress}
      variant={variant}
      size="large"
      fullWidth
      loading={loading}
      disabled={disabled}
      style={{ marginBottom: 24 }}
    />
  );
};