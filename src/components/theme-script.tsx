import Script from "next/script";

const THEME_INIT = `
try {
  var t = localStorage.getItem('onespec-theme');
  if (t === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
} catch (e) {}
`;

export function ThemeScript() {
  return <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>;
}