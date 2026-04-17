export type ThemeImageMode = "light" | "dark";

const THEME_IMAGE_PATTERN = /^(.*)-(light|dark)(\.[^.]+)$/i;

export function parseThemeImageName(value: string) {
  const match = value.match(THEME_IMAGE_PATTERN);
  if (!match) {
    return null;
  }

  return {
    baseName: match[1],
    extension: match[3],
    mode: match[2].toLowerCase() as ThemeImageMode,
  };
}

export function stripThemeImageSuffix(value: string): string {
  const parsed = parseThemeImageName(value);
  if (!parsed) {
    return value;
  }

  return `${parsed.baseName}${parsed.extension}`;
}

export function getThemeImageVariant(value: string, mode: ThemeImageMode): string {
  const parsed = parseThemeImageName(value);
  if (!parsed) {
    return value;
  }

  return `${parsed.baseName}-${mode}${parsed.extension}`;
}

export function isThemeManagedImage(value: string): boolean {
  return parseThemeImageName(value) !== null;
}
