import { userApi } from '@/services/api';
import { useBackendResource } from '@/hooks/useBackendResource';
import { refreshBackendData } from '@/services/refresh';

export type Profile = { name: string; username: string };
type State = { profile: Profile; loading: boolean; error: string | null };
export const NAME_MAX = 40;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export type ProfileErrors = { name?: string; username?: string };

export function normalizeProfile(input: Profile): Profile {
  return {
    name: input.name.trim().replace(/\s+/g, ' '),
    username: input.username.trim().replace(/^@/, '').toLowerCase(),
  };
}
export function validateProfile(input: Profile): ProfileErrors {
  const profile = normalizeProfile(input);
  const errors: ProfileErrors = {};
  if (!profile.name) errors.name = 'Name cannot be blank.';
  else if (profile.name.length > NAME_MAX) errors.name = `Keep it under ${NAME_MAX} characters.`;
  if (!profile.username) errors.username = 'Username cannot be blank.';
  else if (profile.username.length < USERNAME_MIN || profile.username.length > USERNAME_MAX)
    errors.username = `Use ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  else if (!/^[a-z0-9_.]+$/.test(profile.username)) errors.username = 'Letters, numbers, dots and underscores only.';
  return errors;
}
export function useProfile(): State {
  const resource = useBackendResource(async () => {
    const profile = await userApi.me();
    return { name: [profile.first_name, profile.last_name].filter(Boolean).join(' '), username: profile.username };
  });
  return { profile: resource.data ?? { name: '', username: '' }, loading: resource.loading, error: resource.error };
}
export async function saveProfile(input: Profile): Promise<void> {
  const errors = validateProfile(input);
  if (errors.name || errors.username) throw new Error(errors.name ?? errors.username);
  const current = await userApi.me();
  const [firstName, ...rest] = normalizeProfile(input).name.split(' ');
  await userApi.updateProfile({ firstName, lastName: rest.join(' '), country: current.country });
  refreshBackendData();
}
