export type PasswordErrors = { current?: string; next?: string; confirm?: string };

// Local format checks only. The backend verifies the current password.
export function validatePasswordChange(current: string, next: string, confirm: string): PasswordErrors {
  const errors: PasswordErrors = {};
  if (!current.trim()) errors.current = 'Enter a made-up current password.';
  if (next.length < 8 || !next.trim()) errors.next = 'Use at least 8 characters.';
  else if (next.length > 128) errors.next = 'Use no more than 128 characters.';
  else if (next === current) errors.next = 'Choose a different new password.';
  if (!confirm) errors.confirm = 'Confirm your new password.';
  else if (confirm !== next) errors.confirm = 'Passwords do not match.';
  return errors;
}
