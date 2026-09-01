// Test stub for the `server-only` guard. The real package throws unless it is
// resolved under React's react-server condition, which vitest does not set;
// aliasing to this empty module lets server modules be unit tested. The guard
// is unaffected in the actual build.
export {};
