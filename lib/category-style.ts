import { categoryColors } from "./theme";

const ICONS = [
  "package-variant",
  "leaf",
  "cube-outline",
  "account-hard-hat",
  "store",
] as const;

export function categoryAccent(name: string | null): {
  color: string;
  icon: (typeof ICONS)[number];
} {
  const key = (name ?? "Other").toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % 997;
  }
  const idx = hash % categoryColors.length;
  return {
    color: categoryColors[idx],
    icon: ICONS[idx % ICONS.length],
  };
}