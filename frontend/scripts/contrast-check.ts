import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * WCAG 2.x contrast guard for semantic theme tokens.
 * Parses tokens.css + themes.css and checks key foreground/background pairs.
 */

type Rgb = { r: number; g: number; b: number };

type ThemeName = "dark" | "light" | "high-contrast" | "system-light" | "system-dark";

type ContrastPair = {
  label: string;
  foreground: string;
  background: string;
  minRatio: number;
};

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function readThemeFile(relative: string) {
  return readFileSync(`${repoRoot}/${relative}`, "utf8");
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function srgbToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: Rgb) {
  const red = srgbToLinear(r);
  const green = srgbToLinear(g);
  const blue = srgbToLinear(b);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: Rgb, background: Rgb) {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseHex(value: string): Rgb | null {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!match) {
    return null;
  }

  const hex = match[1];
  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function parseRgb(value: string): Rgb | null {
  const match = value.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (!match) {
    return null;
  }

  return {
    r: Number.parseFloat(match[1]),
    g: Number.parseFloat(match[2]),
    b: Number.parseFloat(match[3]),
  };
}

function parseAlpha(value: string): number {
  const match = value.trim().match(/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/);
  return match ? clamp01(Number.parseFloat(match[1])) : 1;
}

function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return {
    r: Math.round(foreground.r * alpha + background.r * (1 - alpha)),
    g: Math.round(foreground.g * alpha + background.g * (1 - alpha)),
    b: Math.round(foreground.b * alpha + background.b * (1 - alpha)),
  };
}

function resolveColor(rawValue: string | undefined, vars: Record<string, string>, canvas?: Rgb): Rgb | null {
  if (!rawValue) {
    return null;
  }

  const value = rawValue.trim();

  if (value.startsWith("var(")) {
    const varName = value.match(/^var\((--[^,)]+)/)?.[1];
    return varName ? resolveColor(vars[varName], vars, canvas) : null;
  }

  const alpha = parseAlpha(value);
  const rgb = parseHex(value) ?? parseRgb(value);
  if (!rgb) {
    return null;
  }

  if (alpha < 1 && canvas) {
    return blend(rgb, canvas, alpha);
  }

  return rgb;
}

function extractCustomProperties(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const propertyPattern = /(--[\w-]+)\s*:\s*([^;]+);/g;

  for (const match of block.matchAll(propertyPattern)) {
    vars[match[1]] = match[2].trim();
  }

  return vars;
}

function extractRuleBlocks(css: string): Array<{ selector: string; body: string; media?: string }> {
  const blocks: Array<{ selector: string; body: string; media?: string }> = [];
  const mediaPattern = /@media[^{]+\{([\s\S]*?\})\s*\}/g;

  let remaining = css;
  for (const mediaMatch of css.matchAll(mediaPattern)) {
    const mediaQuery = mediaMatch[0].slice(0, mediaMatch[0].indexOf("{")).trim();
    const inner = mediaMatch[1];
    const rulePattern = /([^{]+)\{([^}]*)\}/g;

    for (const ruleMatch of inner.matchAll(rulePattern)) {
      blocks.push({
        selector: ruleMatch[1].trim(),
        body: ruleMatch[2],
        media: mediaQuery,
      });
    }

    remaining = remaining.replace(mediaMatch[0], "");
  }

  const rulePattern = /([^{]+)\{([^}]*)\}/g;
  for (const ruleMatch of remaining.matchAll(rulePattern)) {
    const selector = ruleMatch[1].trim();
    if (selector.startsWith("@")) {
      continue;
    }

    blocks.push({
      selector,
      body: ruleMatch[2],
    });
  }

  return blocks;
}

function mergeVars(base: Record<string, string>, overrides: Record<string, string>) {
  return { ...base, ...overrides };
}

function buildThemeVariables(tokensCss: string, themesCss: string): Record<ThemeName, Record<string, string>> {
  const tokenBlocks = extractRuleBlocks(tokensCss);
  const themeBlocks = extractRuleBlocks(themesCss);

  const rootBlock = tokenBlocks.find((block) => block.selector.trim().endsWith(":root"));
  const base = rootBlock ? extractCustomProperties(rootBlock.body) : {};

  const lightOverrides = themeBlocks.find((block) => block.selector.includes('[data-theme="light"]'));
  const highContrastOverrides = themeBlocks.find((block) => block.selector.includes('[data-theme="high-contrast"]'));
  const systemLightOverrides = themeBlocks.find(
    (block) => block.selector.includes('[data-theme="system"]') && block.media?.includes("prefers-color-scheme: light"),
  );

  return {
    dark: base,
    light: mergeVars(base, lightOverrides ? extractCustomProperties(lightOverrides.body) : {}),
    "high-contrast": mergeVars(base, highContrastOverrides ? extractCustomProperties(highContrastOverrides.body) : {}),
    "system-light": mergeVars(base, systemLightOverrides ? extractCustomProperties(systemLightOverrides.body) : {}),
    "system-dark": base,
  };
}

function themePairs(): ContrastPair[] {
  return [
    { label: "Body text on page background", foreground: "--color-fg", background: "--color-bg", minRatio: 4.5 },
    { label: "Muted text on page background", foreground: "--color-fg-muted", background: "--color-bg", minRatio: 4.5 },
    { label: "Brand text on page background", foreground: "--color-brand", background: "--color-bg", minRatio: 3 },
    { label: "Nav label on header background", foreground: "--color-nav-fg", background: "--color-header-bg", minRatio: 4.5 },
    { label: "Inverse text on brand surface", foreground: "--color-fg-inverse", background: "--color-brand", minRatio: 4.5 },
    { label: "Low risk text on low risk surface", foreground: "--color-risk-low", background: "--color-risk-low-bg", minRatio: 4.5 },
    { label: "Medium risk text on medium risk surface", foreground: "--color-risk-medium", background: "--color-risk-medium-bg", minRatio: 4.5 },
    { label: "High risk text on high risk surface", foreground: "--color-risk-high", background: "--color-risk-high-bg", minRatio: 4.5 },
  ];
}

function checkTheme(theme: ThemeName, vars: Record<string, string>) {
  const pageBackground = resolveColor(vars["--color-bg"], vars);
  assert.ok(pageBackground, `[contrast-check] ${theme}: missing --color-bg`);

  for (const pair of themePairs()) {
    const backgroundCanvas = pair.background === "--color-bg" ? undefined : pageBackground;
    const fg = resolveColor(vars[pair.foreground], vars, pageBackground);
    const bg = resolveColor(vars[pair.background], vars, backgroundCanvas) ?? pageBackground;

    assert.ok(fg, `[contrast-check] ${theme}: could not resolve ${pair.foreground}`);
    assert.ok(bg, `[contrast-check] ${theme}: could not resolve ${pair.background}`);

    const ratio = contrastRatio(fg, bg);
    assert.ok(
      ratio >= pair.minRatio,
      `[contrast-check] FAILED ${theme} — ${pair.label}\n  ${pair.foreground} on ${pair.background}\n  ratio ${ratio.toFixed(2)}:1 (required ${pair.minRatio}:1)`,
    );

    console.log(`[contrast-check] ok: ${theme} — ${pair.label} (${ratio.toFixed(2)}:1)`);
  }
}

function main() {
  const tokensCss = readThemeFile("src/theme/tokens.css");
  const themesCss = readThemeFile("src/theme/themes.css");
  const themes = buildThemeVariables(tokensCss, themesCss);

  for (const theme of Object.keys(themes) as ThemeName[]) {
    checkTheme(theme, themes[theme]);
  }

  console.log("\ncontrast checks passed for dark, light, high-contrast, system-light, and system-dark.");
}

main();
