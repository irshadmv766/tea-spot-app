import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Icon row + label + padding (excluding bottom inset). */
export const TAB_BAR_BASE_HEIGHT = 78;

export function useSafeLayout() {
  const insets = useSafeAreaInsets();

  return {
    insets,
    top: insets.top,
    bottom: insets.bottom,
    /** Padding for scroll content above the tab bar. */
    scrollBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 16,
    tabBarPaddingBottom: Math.max(insets.bottom, 8) + 8,
  };
}