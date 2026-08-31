// No-op stub for @swc/core (native binding blocked by Windows Smart App Control).
// next-intl imports { transform } for its SWC message-extractor, which this
// project never enables. Calling it throws a clear error instead of the module
// crashing at load time.
function unavailable() {
  return Promise.reject(
    new Error("@swc/core is stubbed in this project; the next-intl SWC message-extractor is not available.")
  );
}
function unavailableSync() {
  throw new Error("@swc/core is stubbed in this project; the next-intl SWC message-extractor is not available.");
}
export const transform = unavailable;
export const transformSync = unavailableSync;
export const parse = unavailable;
export const parseSync = unavailableSync;
export const print = unavailable;
export const printSync = unavailableSync;
export const minify = unavailable;
export const minifySync = unavailableSync;
export const bundle = unavailable;
export default { transform, transformSync, parse, parseSync, print, printSync, minify, minifySync, bundle };
