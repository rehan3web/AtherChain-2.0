import colors from '@/constants/colors';
import { useTheme } from './useTheme';

/**
 * Shared semantic tokens for the saved app theme (system appearance until chosen).
 * Keeping every screen on this hook also themes sheets and receipt modals.
 */
export function useColors() {
  const { scheme } = useTheme();
  const palette = colors[scheme];
  return { ...palette, radius: colors.radius };
}
