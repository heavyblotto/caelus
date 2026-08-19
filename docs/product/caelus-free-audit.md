# Caelus Free — the build plan for the app

2026-08-16. Written after the first time anyone opened the app in a browser.

This supersedes the sequence in [build-plan.md](./build-plan.md) §3 until it
is finished. That document is not wrong about the destination; it ordered
the work by capability and never once required that a person could use the
result. This one orders the work by what a person can do, and nothing in it
is complete until someone has opened it and done that.

---

## 1. What is actually there

Measured in Chromium against the dev server, every route, 1280x900.

| Route | Controls | SVG nodes | Words | What a visitor can actually do |
|---|---|---|---|---|
| `/free` | 14 | 8 | 182 | Type a birth date into clipped 35px boxes. The sky panel renders empty. |
| `/free/chart` | 18 | **0** | 82 | Nothing. The submit button is cream on cream and invisible. |
| `/free/today` | 11 | **0** | 130 | Read today's sky. Real data. The only working page. |
| `/free/people` | 18 | **0** | 95 | Nothing without a saved chart. |
| `/free/places` | 10 | **0** | 65 | Nothing. Tells you to go to another page. |
| `/free/times` | 11 | **0** | 53 | Nothing. Tells you to go to another page. |
| `/free/tools` | 27 | **0** | 340 | Some of the calendars work. |
| `/free/learn` | 822 | **0** | 201 | Follow one of 812 links. It is a link farm. |
| `/free/journal` | 10 | **0** | 141 | Nothing. The page is written in the future tense. |

**Zero SVG nodes on every route.** The chart wheel does not render anywhere
in the product. `MultiWheel`, `ChartWheel`, `PairedView`, `InteractiveWheel`
and `ChartSphere` are all built, all tested, and none of them is on screen.
The central object of an astrology app has never been drawn.

Three pages average 73 words and 10 controls. They are not surfaces. They
are signposts pointing at each other.

### The root cause of the framing

Every hub route is the same stamped wrapper. Six files, byte-identical
structure, two strings different:

```tsx
<section data-lane="almanac">
  <div className="free-wrap">
    <div className="free-eyebrow">Places</div>
    <h1>Where in the world your chart changes.</h1>
  </div>
  <PlacesHub />          {/* the actual workspace, below the fold */}
</section>
```

The workspace components are mounted and correctly wired, exactly as the
proposal's IA maps them. Someone then built a landing-page header template
and stamped it on top of all six, so every route opens by announcing which
route it is before showing the instrument.

**And the headlines were lifted from the proposal's own IA annotations.**
The IA tree reads:

```
├── Places — astrocartography, relocation charts, local-sky parans,
│            "where in the world your chart changes"
├── Tools  — ephemeris, the Planetarium, Chart Lab, similar skies, ...
```

Those are notes describing the hubs *to a reader of the plan*. They were
copied verbatim onto the pages as product copy. The plan's description of
the app became the app's description of itself. The proposal calls Chart
"the natal workspace"; what shipped is a page whose first two hundred
pixels announce that it is the Chart page.

The fix is deletion, not rewriting. Strip the wrapper from all six routes
and let the workspace be the page. This is a small diff and it removes most
of what a visitor currently sees.

### Why the record said otherwise

`handoff.md` says M2, M3 and M4 are "built and live." Every session that
wrote that sentence, including the one that found this, verified its work
with typechecks, unit tests over the pure layer, and prose lints. None of
them ran the app. The repo has 3,440 engine conformance checks and not one
check that a page renders. A button with cream text on a cream background
passes every gate that exists.

Two of the gates are worse than absent. `npm run lint:prose` extracts copy
into `.free-prose-extract.md` and the extractor is scraping TypeScript, so
the linter has been grading function calls and reporting zero errors.
`build-plan.md` §5 lists WCAG contrast in both themes as a launch check; it
has never been run.

---

## 2. The rule this plan exists to enforce

**A thing is done when someone has opened it in a browser and used it.**

Not when it typechecks. Not when the pure layer has 500 passing checks. Not
when the corpus harness is green. Those are necessary and they are not the
bar, and treating them as the bar is the single decision that produced
section 1.

Every milestone below ends with a screenshot and a named task a person
completed. If that has not happened, the milestone is not done, whatever
the tests say.

---

## 3. The sequence

### A0 — Make the front door work

Nothing else can be judged until a person can get a chart on screen. This
is small and it is blocking everything.

1. Fix the invisible submit button. `.free-btn` sets a light-lane text
   colour and the Chart page is the light lane, so the label is cream on
   cream. Audit every button and input for computed contrast in both lanes.
2. Fix the birth-date inputs. Three boxes at 35px clip "MM" and "DD". The
   whole birth form is styled for the dark lane and rendered on the light
   one.
3. Fix the empty sky panel on `/free`. `SkyStage` draws star field,
   constellation figures, planets and horizon, and is producing nothing.
4. Render the wheel on `/free/chart`. `PairedView` is built and mounted and
   producing zero SVG nodes. Find out why and fix it.

**Done when:** a person types a birth date, a time and a city, presses a
button they can see, and looks at their own chart wheel.

### A1 — One person, end to end

The product is one reader with one chart. Every other surface is a variation
on that and none of them matters until it works.

1. Chart hub: wheel, placements list, the Reading, honesty chips. All the
   pieces exist in `lib/free/reading.ts`. Get them on screen.
2. Persist the person and confirm the saved chart flows to Today, Times,
   Places and People, which are all empty today because nothing is saved.
3. Walk the whole app as that person and screenshot every route.

**Done when:** the nine routes each show something computed from a real
birth chart, and the screenshots are in the repo.

### A2 — Kill the signposts

Three pages exist to tell you to go to another page. That is not a surface.

1. `/free/places` and `/free/times` render their instrument with the saved
   chart, or they do not ship as nav items.
2. `/free/journal` and `/free/learn` are written in the future tense
   describing features that do not exist. Either build them or make them
   visibly unbuilt. A page that does not work must not look like a page
   that works.
3. `/free/learn` is 822 links and 201 words. Decide what it is.

**Done when:** no route in the nav is a description of itself.

### A3 — Rewrite every line of product copy

The copy is written in the vocabulary of the people building it, in a
literary voice that hides the fact that it does not say anything.

Specimens, all live today: *"Warming the instruments…"* is a loading
message. *"How to read everything this app can draw"* — draw is the
rendering verb from the codebase. *"Without a birth time the time-lord lanes
stay off"* — lanes is a variable name in `timeline.ts`. *"This page draws
your chart across the world."* *"The heavier instruments, free in the
browser."*

The hub lines name nothing a reader can do:

| Now | What it should have said |
|---|---|
| The people in your life, each with a chart. | Compare two birth charts and see what runs between them. |
| Where in the world your chart changes. | Find the cities where your chart puts a planet on the horizon. |
| Your year ahead on one timeline. | See when a transit starts, peaks and ends. |
| The heavier instruments, free in the browser. | Search the next two months for a date that matches your conditions. |
| A diary that remembers the sky. | (Nothing. There is no diary.) |

The standard: **a sentence names something the reader does and something
they get.** No noun phrases standing in for sentences. No word that exists
because it is what the code calls the thing. No page that introduces
itself.

The owner's locked copy is exempt and unchanged: "There is more going on
than your sign.", "Show me my sky", "Write it down", "Computed here on your
screen.", "Written here, kept here."

**Done when:** every line of product copy has been read aloud by a person
who did not write it.

### A4 — Gates that would have caught this

Built after A0-A3, not before, because a gate against a broken app just
fails forever.

1. **Render check in CI.** Load every route headless, fail on a page with
   zero interactive content, fail on a route that throws, snapshot the DOM
   node counts so a page silently emptying itself breaks the build.
2. **Contrast check.** Computed foreground against computed background for
   every text node, both lanes, both themes, fail under WCAG AA. This alone
   catches the invisible button.
3. **Fix the prose extractor.** It is scraping TypeScript into the file
   vale lints. Until that is fixed `lint:prose` is theatre.
4. **A vocabulary gate.** A banned list for the words in A3 — draw, render,
   instrument, lane, surface, engine, projection, atom, corpus — in
   user-facing copy. The corpus lints prove this project can build these
   well; none of that machinery was ever pointed at the product copy.

**Done when:** reverting the A0 fixes makes CI fail.

---

## 4. What is not in this plan, and why

**Content.** The corpus is roughly 4,100 essays and it is finished enough.
B3's review pass has one wave of ten landed and two waves outstanding; B5,
B6 and B8 are unwritten. None of it is on the critical path, because none of
it is visible in an app nobody can open. It resumes after A2.

**New surfaces.** Four were added the day this was written — a power query,
a horary page, progressions and directions, a what-if explorer — all built
against an app the builder had never opened. No new surface ships until A2
is done.

**M5 through M7.** Unchanged in substance, deferred in time. The Journal,
the Vedic surfaces, the Composer, the graph and the Planetarium are all
still the plan. They are not the plan while the front door is broken.

---

## 5. The thing to remember

This project built an engine with 3,440 conformance checks, a corpus with
seven bespoke lints including two invented in the last day, a reference-first
rule for every mathematical claim, and an adversarial review pass run by
thirty agents.

Then it shipped a submit button nobody could see, on a page with no chart on
it, under a headline about drawing.

Every one of those checks measures something a machine can hold. Not one of
them required a person to look. That is the whole failure, and it is a
failure of what got measured, not of effort.
