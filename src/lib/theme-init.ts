/**
 * The one inline script in the root layout: applies the saved light theme before first paint (no flash).
 * The widget's Content-Security-Policy allows it by its SHA-256 hash (see widget-csp.ts), so the CSP never needs 'unsafe-inline'
 * and the root layout stays free of per-request nonces.
 */
export const THEME_INIT = `try{var t=localStorage.getItem('onespec-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}`;
