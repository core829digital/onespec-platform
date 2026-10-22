/**
 * Turbopack loader for convex-test's dist/index.js (the in-browser demo database).
 *
 * convex-test falls back to `import.meta.glob("../../../convex/**\/*.*s")` when no modules are passed. Turbopack now
 * implements import.meta.glob, so that fallback pulled every file under convex/ (generated .d.ts included) into the client
 * bundle and the build failed. The demo always passes its own module map (src/demo/convex-modules.generated.ts), so the
 * fallback is replaced by `undefined`. If convex-test changes the line, the build stops here instead of shipping the glob.
 */
const FALLBACK = 'import.meta.glob("../../../convex/**/*.*s")';

module.exports = function convexTestNoGlob(source) {
  if (!source.includes(FALLBACK)) {
    throw new Error(
      "convex-test-no-glob: the import.meta.glob fallback was not found in convex-test/dist/index.js; review this loader after the convex-test upgrade.",
    );
  }
  return source.split(FALLBACK).join("undefined");
};
