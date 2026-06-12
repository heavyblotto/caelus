declare module "tz-lookup" {
  /** Coordinates -> IANA zone id, offline (~70 KB embedded map). */
  function tzLookup(lat: number, lon: number): string;
  export default tzLookup;
}
