"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface HostThemeData {
  fontFamily?: string;
  fontStack?: string;
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  cssVariables?: Record<string, string>;
  computedStyles?: Record<string, string>;
}

interface FontDetectionResult {
  fontFamily: string;
  fontStack: string;
  confidence: number;
  source: "css-variable" | "computed-style" | "font-face" | "fallback";
}

interface ColorDetectionResult {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  confidence: number;
  source: "css-variable" | "meta-theme-color" | "computed-style" | "fallback";
}

/**
 * Detect the host site's font family by checking multiple sources in order of priority
 */
export function detectHostFont(): FontDetectionResult {
  if (typeof window === "undefined" || window.parent === window) {
    return { fontFamily: "system-ui", fontStack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", confidence: 0, source: "fallback" };
  }

  try {
    const doc = window.parent.document;
    const html = doc.documentElement;
    const body = doc.body;

    // 1. Check CSS custom properties (highest priority)
    const cssVars = [
      "--font-family",
      "--font-primary",
      "--font-main",
      "--body-font",
      "--base-font",
      "--font-sans",
    ];

    for (const varName of cssVars) {
      const value = getComputedStyle(html).getPropertyValue(varName).trim();
      if (value) {
        return {
          fontFamily: value.split(",")[0].replace(/['"]/g, "").trim(),
          fontStack: value,
          confidence: 0.95,
          source: "css-variable",
        };
      }
    }

    // 2. Check computed font-family on body/html
    const bodyFont = getComputedStyle(body).fontFamily;
    const htmlFont = getComputedStyle(html).fontFamily;
    
    if (bodyFont && bodyFont !== "initial" && bodyFont !== "inherit") {
      return {
        fontFamily: bodyFont.split(",")[0].replace(/['"]/g, "").trim(),
        fontStack: bodyFont,
        confidence: 0.85,
        source: "computed-style",
      };
    }

    if (htmlFont && htmlFont !== "initial" && htmlFont !== "inherit") {
      return {
        fontFamily: htmlFont.split(",")[0].replace(/['"]/g, "").trim(),
        fontStack: htmlFont,
        confidence: 0.8,
        source: "computed-style",
      };
    }

    // 3. Check @font-face declarations
    const fontFaces = Array.from(doc.fonts.values());
    if (fontFaces.length > 0) {
      const firstFont = fontFaces[0].family.replace(/['"]/g, "");
      return {
        fontFamily: firstFont,
        fontStack: fontFaces.map(f => f.family).join(", "),
        confidence: 0.7,
        source: "font-face",
      };
    }

    // 4. Check meta tags
    const fontMeta = doc.querySelector('meta[name="font-family"]')?.getAttribute("content");
    if (fontMeta) {
      return {
        fontFamily: fontMeta.split(",")[0].trim(),
        fontStack: fontMeta,
        confidence: 0.6,
        source: "computed-style",
      };
    }

    return { fontFamily: "system-ui", fontStack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", confidence: 0.3, source: "fallback" };
  } catch (error) {
    console.warn("Font detection failed:", error);
    return { fontFamily: "system-ui", fontStack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", confidence: 0.1, source: "fallback" };
  }
}

/**
 * Detect host site colors from multiple sources
 */
export function detectHostColors(): ColorDetectionResult {
  if (typeof window === "undefined" || window.parent === window) {
    return { primaryColor: "#16d19d", backgroundColor: "#ffffff", textColor: "#1d1d1f", accentColor: "#16d19d", confidence: 0.1, source: "fallback" };
  }

  try {
    const doc = window.parent.document;
    const html = doc.documentElement;
    const body = doc.body;

    // 1. Check CSS custom properties
    const colorVars = {
      primary: ["--primary-color", "--color-primary", "--accent-color", "--color-accent", "--brand-color", "--theme-color", "--primary"],
      background: ["--bg-color", "--background-color", "--color-bg", "--color-background", "--body-bg"],
      text: ["--text-color", "--color-text", "--color-foreground", "--body-color"],
      accent: ["--accent-color", "--color-accent", "--highlight-color", "--color-highlight"],
    };

    const detected: Partial<ColorDetectionResult> = {};
    let cssVarConfidence = 0;

    for (const [key, vars] of Object.entries(colorVars)) {
      for (const varName of vars) {
        const value = getComputedStyle(html).getPropertyValue(varName).trim();
        if (value && isValidColor(value)) {
          detected[key as keyof ColorDetectionResult] = value;
          cssVarConfidence = Math.max(cssVarConfidence, 0.95);
          break;
        }
      }
    }

    if (Object.keys(detected).length >= 3) {
      return { ...detected, primaryColor: detected.primaryColor || "#16d19d", backgroundColor: detected.backgroundColor || "#ffffff", textColor: detected.textColor || "#1d1d1f", accentColor: detected.accentColor || detected.primaryColor || "#16d19d", confidence: cssVarConfidence, source: "css-variable" } as ColorDetectionResult;
    }

    // 2. Check meta theme-color
    const metaThemeColor = doc.querySelector('meta[name="theme-color"]')?.getAttribute("content");
    if (metaThemeColor && isValidColor(metaThemeColor)) {
      return {
        primaryColor: metaThemeColor,
        backgroundColor: getComputedStyle(body).backgroundColor || "#ffffff",
        textColor: getComputedStyle(body).color || "#1d1d1f",
        accentColor: metaThemeColor,
        confidence: 0.8,
        source: "meta-theme-color",
      };
    }

    // 3. Check computed styles on body
    const bodyBg = getComputedStyle(body).backgroundColor;
    const bodyColor = getComputedStyle(body).color;
    const linkColor = getComputedStyle(doc.querySelector("a") || body).color;

    if (isValidColor(bodyBg) && isValidColor(bodyColor)) {
      return {
        primaryColor: linkColor && isValidColor(linkColor) ? linkColor : "#16d19d",
        backgroundColor: bodyBg,
        textColor: bodyColor,
        accentColor: linkColor && isValidColor(linkColor) ? linkColor : "#16d19d",
        confidence: 0.7,
        source: "computed-style",
      };
    }

    // 4. Check for common framework CSS variables
    const frameworkVars = {
      // Tailwind
      primary: getComputedStyle(html).getPropertyValue("--color-primary").trim() || getComputedStyle(html).getPropertyValue("--primary").trim(),
      background: getComputedStyle(html).getPropertyValue("--color-background").trim() || getComputedStyle(html).getPropertyValue("--background").trim(),
      text: getComputedStyle(html).getPropertyValue("--color-foreground").trim() || getComputedStyle(html).getPropertyValue("--foreground").trim(),
    };

    if (isValidColor(frameworkVars.primary) && isValidColor(frameworkVars.background) && isValidColor(frameworkVars.text)) {
      return {
        primaryColor: frameworkVars.primary,
        backgroundColor: frameworkVars.background,
        textColor: frameworkVars.text,
        accentColor: frameworkVars.primary,
        confidence: 0.75,
        source: "css-variable",
      };
    }

    return { primaryColor: "#16d19d", backgroundColor: "#ffffff", textColor: "#1d1d1f", accentColor: "#16d19d", confidence: 0.2, source: "fallback" };
  } catch (error) {
    console.warn("Color detection failed:", error);
    return { primaryColor: "#16d19d", backgroundColor: "#ffffff", textColor: "#1d1d1f", accentColor: "#16d19d", confidence: 0.1, source: "fallback" };
  }
}

function isValidColor(value: string): boolean {
  if (!value || value === "transparent" || value === "initial" || value === "inherit") return false;
  // Check for valid CSS color formats
  const colorRegex = /^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-z]+\(|currentcolor|transparent)$/i;
  return colorRegex.test(value.trim());
}

/**
 * Hook for detecting and syncing host theme
 */
export function useHostTheme() {
  const [theme, setTheme] = useState<HostThemeData>({});
  const [isDetecting, setIsDetecting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const detect = useCallback(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    
    setIsDetecting(true);
    try {
      const font = detectHostFont();
      const colors = detectHostColors();
      
      // Also get CSS variables
      const doc = window.parent.document;
      const html = doc.documentElement;
      const cssVars: Record<string, string> = {};
      const computedStyles: Record<string, string> = {};
      
      // Get all CSS custom properties
      const style = getComputedStyle(html);
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if (prop.startsWith("--")) {
          cssVars[prop] = style.getPropertyValue(prop).trim();
        }
      }

      setTheme({
        fontFamily: font.fontFamily,
        fontStack: font.fontStack,
        primaryColor: colors.primaryColor,
        backgroundColor: colors.backgroundColor,
        textColor: colors.textColor,
        accentColor: colors.accentColor,
        cssVariables: cssVars,
        computedStyles: computedStyles,
      });
    } catch (error) {
      console.warn("Host theme detection failed:", error);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      detect();
    }, 0);
    
    // Re-detect periodically in case host theme changes
    intervalRef.current = setInterval(detect, 5000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timeoutId);
    };
  }, [detect]);

  // Send detected theme to widget
  const sendThemeToWidget = useCallback((widgetFrame: HTMLIFrameElement) => {
    if (!widgetFrame.contentWindow || Object.keys(theme).length === 0) return;
    
    widgetFrame.contentWindow.postMessage({
      type: "onespec:host-theme",
      theme: {
        font: theme.fontStack || theme.fontFamily,
        accent: theme.accentColor || theme.primaryColor,
        bg: theme.backgroundColor,
      },
    }, "*");
  }, [theme]);

  return { theme, isDetecting, detect, sendThemeToWidget };
}

/**
 * Apply detected theme to widget via CSS custom properties
 */
export function applyThemeToWidget(widgetRoot: HTMLElement | null, theme: HostThemeData) {
  if (!widgetRoot) return;

  // Apply font
  if (theme.fontStack) {
    widgetRoot.style.setProperty("--tw-font", theme.fontStack);
  } else if (theme.fontFamily) {
    widgetRoot.style.setProperty("--tw-font", theme.fontFamily);
  }

  // Apply colors
  if (theme.accentColor) {
    widgetRoot.style.setProperty("--tw-accent", theme.accentColor);
    // Calculate readable ink color
    const ink = getReadableInkColor(theme.accentColor);
    widgetRoot.style.setProperty("--tw-accent-ink", ink);
  }

  if (theme.backgroundColor) {
    widgetRoot.style.setProperty("--tw-bg", theme.backgroundColor);
  }
}

/**
 * Calculate readable text color (black or white) for a given background color
 */
function getReadableInkColor(hexColor: string): string {
  const cleanHex = hexColor.replace("#", "");
  if (cleanHex.length !== 6 && cleanHex.length !== 8) return "#04231a";
  
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? "#04231a" : "#ffffff";
}

/**
 * Parse CSS color string to hex
 */
export function parseColorToHex(color: string): string {
  if (color.startsWith("#")) return color;
  
  const div = document.createElement("div");
  div.style.color = color;
  document.body.appendChild(div);
  const computed = getComputedStyle(div).color;
  document.body.removeChild(div);
  
  // Parse rgb(r, g, b) to hex
  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  
  return "#16d19d";
}

/**
 * Generate CSS custom properties for the widget based on host theme
 */
export function generateWidgetCSSVars(theme: HostThemeData): string {
  const vars: string[] = [];
  
  if (theme.fontStack) vars.push(`--tw-font: ${theme.fontStack};`);
  else if (theme.fontFamily) vars.push(`--tw-font: ${theme.fontFamily}, sans-serif;`);
  
  if (theme.accentColor) {
    vars.push(`--tw-accent: ${theme.accentColor};`);
    const ink = getReadableInkColor(theme.accentColor);
    vars.push(`--tw-accent-ink: ${ink};`);
  }
  
  if (theme.backgroundColor) vars.push(`--tw-bg: ${theme.backgroundColor};`);
  if (theme.textColor) vars.push(`--tw-text: ${theme.textColor};`);
  
  return vars.join(" ");
}