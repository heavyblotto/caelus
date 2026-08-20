/** Shared id helpers: the generator and the parsers must slug names the
 *  same way or the graph and the parse results drift apart. */

/** Slug a display name into an id segment: lowercase, apostrophes dropped,
 *  runs of spaces/underscores collapsed to `-`. `"Purva Phalguni"` and the
 *  atom form `"Purva_Phalguni"` both become `purva-phalguni`. */
export function slug(name: string): string {
  return name.toLowerCase().replace(/['\u2019]/g, "").replace(/[\s_]+/g, "-");
}

/** Title-case an engine body id: `mean_node` -> `Mean Node`. */
export function bodyLabel(id: string): string {
  return id.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
