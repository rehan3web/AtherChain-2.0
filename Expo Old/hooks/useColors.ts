import colors from "@/constants/colors";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Returns the design tokens for the current color scheme.
 * Respects the in-app theme toggle (ThemeContext) over the system setting.
 */
export function useColors() {
  const { theme } = useTheme();
  const palette =
    theme === "light"
      ? colors.light
      : (colors as any).dark ?? colors.light;
  return { ...palette, radius: colors.radius };
}
