/**
 * caelus-widgets — Encyclopedia widgets for caelus.
 *
 * A plate is a widget at rest: the SSR output of a widget at its
 * initial parameters is the build-time figure, the no-JS fallback,
 * and the print version, from one code path. Widget kinds export from
 * their own subpaths so an article loads only what it uses; this root
 * exports the shared system.
 */
export * from "./spec.js";
export * from "./registry.js";
export * from "./frame.js";
export * from "./console.js";
