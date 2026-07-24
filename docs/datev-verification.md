# Verifying the datasets against the official DATEV charts

The SKR03/SKR04 datasets in this package claim to match the official DATEV
charts. `scripts/verify-datev.mjs` makes that claim testable: it parses the
official DATEV chart PDFs and checks every account in
[`src/data/skr03.json`](../src/data/skr03.json) and
[`src/data/skr04.json`](../src/data/skr04.json) against them.

Use it whenever the datasets change, and — most importantly — when a **new
chart year** is published, to find every account whose number, reservation
status, or designation changed.

## 1. Download the charts from DATEV

DATEV publishes the chart PDFs publicly:

| Chart | Document | DATEV Art.-Nr. |
|---|---|---|
| SKR 03 | "DATEV-Kontenrahmen Standardkontenrahmen – Prozessgliederungsprinzip (SKR 03)" | 11174 |
| SKR 04 | "DATEV-Kontenrahmen Standardkontenrahmen – Abschlussgliederungsprinzip (SKR 04)" | 11175 |

Find them via [datev.de](https://www.datev.de) (search for "Kontenrahmen
SKR 03" / "SKR 04" or the Art.-Nr.) and download the PDF for the year you want
to verify against. Save both files into a `datev/` folder in the repository
root, e.g.:

```
datev/skr03-2026.pdf
datev/skr04-2026.pdf
```

> **Never commit these PDFs.** They are DATEV's copyrighted documents
> ("Eigenformular, Nachdruck – auch auszugsweise – nicht gestattet") and must
> stay out of the repository. The `datev/` folder is gitignored for that
> reason. This is also why CI cannot run this check — it is a local,
> deterministic end-to-end test.

## 2. Run the verification

```bash
npm ci
npm run verify:datev -- datev/skr03-2026.pdf datev/skr04-2026.pdf
```

Exit code `0` means both datasets are fully consistent with the charts. A
clean run looks like:

```
SKR03: chart has 2149 named + 1214 reserved accounts; dataset 286 accounts, 286 verified, 0 findings
SKR04: chart has 2329 named + 1451 reserved accounts; dataset 222 accounts, 222 verified, 0 findings
```

For every dataset account the script checks that:

1. the account **number exists** as a named account in the chart,
2. the number is **not marked `R` (reserved)** in the chart, and
3. the dataset **designation matches** the chart designation
   (whitespace-, hyphenation- and footnote-normalized, case-insensitive).

It does **not** verify the enriched metadata (`typ`, `gruppe`,
`ust_relevant`, `steuerschluessel`, MCC suggestions) — the chart PDFs do not
carry that information in machine-checkable form. Structural rules for those
fields live in `tests/data_integrity.test.ts`.

## 3. Upgrading to a new chart year

1. Download the new year's PDFs (see above) into `datev/`.
2. Run the script against them. Every finding is an account whose number was
   freed/reserved or whose designation changed in the new year.
3. Update `src/data/skr03.json` / `src/data/skr04.json` accordingly
   (designations must be copied verbatim from the chart), and review the
   enriched metadata of every changed account by hand.
4. Bump `meta.version`, `meta.source`, and `meta.last_updated` in both data
   files.
5. Re-run the script until it is clean, then run `npm test`.

## How the parser works (maintenance notes)

The chart PDFs are two-column pages; each half-page column is
`sidebar | function code | account number | designation`. The parser
(`scripts/verify-datev.mjs`, using the [`mupdf`](https://www.npmjs.com/package/mupdf)
WASM bindings as a dev dependency) reconstructs words with x/y positions and
applies the chart's layout grammar:

- **Per-page calibration**: the left number column x is the mode of all
  4-digit token positions in a fixed band; the right column sits a constant
  offset (`HALF_OFFSET`) to its right. Pages with fewer than 10 number tokens
  (title, legend, footnotes) are skipped.
- **Zones**: only words within `ZONE_WIDTH` right of a number column belong
  to that column's entries; this excludes the neighbouring sidebar.
- **Entries**: a line starting with a 4-digit number (optionally prefixed by
  a DATEV function code such as `AM`, `AV`, `F`, `K`, `R`, `S`) starts an
  account; following lines in the zone are designation continuations.
  `R`-rows without text are reserved numbers; `-NN` tokens extend an entry to
  a number range (e.g. `3300 -09`).
- **Headings**: bold lines that neither start an entry nor continue a bold
  entry are section headings and end the current entry. (DATEV prints main
  accounts bold too, so boldness alone does not identify a heading.)
- **Cleanup**: footnote markers (`Rücklagen17)`) are stripped and hyphenated
  line wraps (`gegen-` + `über`) are rejoined.

If DATEV changes the page geometry in a future year, re-derive the constants
at the top of the script (they are documented inline) by dumping word
positions for one page.
