function unavailable() {
  return Promise.reject(
    new Error("@swc/core is stubbed in this project; the next-intl SWC message-extractor is not available.")
  );
}
function unavailableSync() {
  throw new Error("@swc/core is stubbed in this project; the next-intl SWC message-extractor is not available.");
}
module.exports = {
  transform: unavailable, transformSync: unavailableSync,
  parse: unavailable, parseSync: unavailableSync,
  print: unavailable, printSync: unavailableSync,
  minify: unavailable, minifySync: unavailableSync,
  bundle: unavailable,
};
