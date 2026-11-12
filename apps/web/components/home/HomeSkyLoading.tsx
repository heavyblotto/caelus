/** The home sky tile at rest, shown until the engine has computed the
 *  instant. Shared by the Next island and the Astro one so both builds hold
 *  the same place on the bench while the sky loads. */
export default function HomeSkyLoading() {
  return (
    <section className="tile home-sky-tile" aria-busy="true">
      <div className="tile__h">
        <b>SKY</b>
        <span>Computed in this browser</span>
        <i>computing</i>
      </div>
      <p className="empty">computing the New York sky…</p>
    </section>
  );
}
