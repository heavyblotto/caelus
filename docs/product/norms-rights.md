# Composer norm packs — rights check

2026-08-16. Runs the check required by [build-plan.md](./build-plan.md) §6.3
(decision rule: redistributable → ship in `caelus-composer`; otherwise →
fetch from source on first use, cache on device, attribute). Research was
done through search and mirrors; the sandbox network blocks ugent.be,
Springer, OSF, and web.archive.org directly, and each such gap is noted
where it matters.

## 1. Concreteness ratings (Brysbaert, Warriner & Kuperman 2014)

**Source.** Brysbaert, M., Warriner, A.B., & Kuperman, V. (2014).
Concreteness ratings for 40 thousand generally known English word lemmas.
*Behavior Research Methods*, 46, 904–911. doi:10.3758/s13428-013-0403-5.

**Canonical URLs.** The authors' page at <http://crr.ugent.be/archives/1330>
(Excel and text files) and the journal's electronic supplementary material
at <https://link.springer.com/article/10.3758/s13428-013-0403-5>.

**Terms found.** No license text at all. The paper distributes the data "in
an Excel file, provided as supplementary materials" of a non-open-access
Psychonomic Society article, and the group's standard phrasing for its
norms is "freely available for research purposes" (verbatim in the abstract
of their companion Dutch norms paper,
<https://pubmed.ncbi.nlm.nih.gov/24831463/>). No CC license, no
redistribution grant, and no commercial-use statement could be located on
any mirror or catalog entry checked (GitHub mirrors such as
<https://github.com/ArtsEngine/concreteness> carry the citation only). The
crr.ugent.be page itself was unreachable from this sandbox, so its exact
wording is unverified.

**Analysis.** "Freely available for research purposes" is not a
redistribution license. Caelus Free is a free product, but bundling the
table in an MIT-licensed npm package would republish it for any use,
commercial ones included, which nothing found here permits.

**Verdict: fetch-and-cache.** The app downloads the table from
crr.ugent.be (Springer supplementary as fallback) on first use of the
Composer and caches it on the device.

**Attribution line.** "Concreteness ratings from Brysbaert, Warriner &
Kuperman (2014), *Behavior Research Methods* 46, 904–911. Used with
attribution; not redistributed."

**Fallback.** The Lancaster Sensorimotor Norms (Lynott, Connell, Brysbaert,
Brand & Carney 2020, *BRM*; ~39,707 words) cover similar ground with
perceptual-strength dimensions, come from an open-access article, and are
hosted on OSF at <https://osf.io/7emr6/>. The OSF project's declared
license could not be read from this sandbox and must be confirmed before
relying on it. Emailing Brysbaert for a redistribution grant is also
realistic; he has granted one before (see §2).

## 2. SUBTLEX-US word frequencies (Brysbaert & New 2009)

**Source.** Brysbaert, M., & New, B. (2009). Moving beyond Kučera and
Francis. *Behavior Research Methods*, 41(4), 977–990.

**Canonical URL.** Ghent Experimental Psychology,
<https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus>
(74,286 word forms, zipped Excel and text).

**Terms found.** The authors publish the lists as "freely available for
research purposes." A broader grant exists, but it was made to one project:
the wordfreq README (<https://github.com/rspeer/wordfreq>) records, "I
(Robyn Speer) have obtained permission by e-mail from Marc Brysbaert to
distribute these wordlists in wordfreq, to be used for any purpose, not
just for academic use, under these conditions:" (1) "Wordfreq and code
derived from it must credit the SUBTLEX authors," (2) "It must remain clear
that SUBTLEX is freely available data," and "These terms are similar to the
Creative Commons Attribution-ShareAlike license." The openlexicon catalog
labels its SUBTLEX-US copy "LICENSE: CC-BY-SA"
(<https://github.com/chrplr/openlexicon/blob/master/datasets-info/SUBTLEX-US/README-SUBTLEXus.md>),
which appears to trace back to that same grant.

**Analysis.** The raw ugent tables carry no public redistribution license;
the any-purpose permission names wordfreq and code derived from it, which
`caelus-composer` is not.

**Verdict: fetch-and-cache** for the raw SUBTLEX-US tables. Two routes can
upgrade this to ship-in-package: derive the frequency pack from wordfreq's
data files, which are redistributable under CC-BY-SA 4.0 (the pack's data
file would carry that license beside the package's MIT code, as wordfreq
pairs CC-BY-SA data with Apache code); or email Brysbaert for the same
grant wordfreq received. Either route keeps the SUBTLEX credit and the
"freely available data" notice.

**Attribution line.** "Word frequencies from SUBTLEX-US (Brysbaert & New
2009, *Behavior Research Methods* 41, 977–990), Ghent University. SUBTLEX
is freely available data."

**Fallback.** wordfreq itself (<https://github.com/rspeer/wordfreq>,
Apache-2.0 code, CC-BY-SA 4.0 data) blends SUBTLEX with Wikipedia and
OpenSubtitles sources and is redistributable today; a Wikipedia-only
frequency list is a weaker but license-clean floor.

## 3. Sabian symbols (batch B6 rights check)

The 360 symbols were produced in 1925 by Marc Edmund Jones and Elsie
Wheeler as unpublished notes. Jones circulated a longer mimeographed
version to Sabian Assembly students in 1931 and published the original
notations in *The Sabian Symbols in Astrology* (Sabian Publishing Society,
1953). The 1925/1931 materials were limited distributions to students, so
whether they count as publication is a genuine legal question, and the
answer decides everything: published-1925 text is public domain, while a
1953 first publication whose copyright was renewed runs to 2049. One
bookseller (astrolearn.com) asserts the 1953 edition "is in the Public
Domain," but no renewal record confirming or refuting that could be found
in this check, and the Sabian Assembly continues to assert rights.
Rudhyar's 1973 rewordings in *An Astrological Mandala* are under copyright
either way.

**Verdict: uncertain.** The status is not established well enough to ship
Jones's text. Write original degree symbols for B6, per the build plan's
fallback. If someone later pulls the 1980–81 renewal records from the
Copyright Office catalog and finds no renewal for the 1953 book, the Jones
wording opens up.
