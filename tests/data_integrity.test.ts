/**
 * Referential integrity tests for the data files.
 * These tests are the CI gate: they catch any contribution that references
 * a non-existent account number.
 */
import { describe, it, expect } from "vitest";
import { SKR03, SKR04 } from "../src/index.js";
import mccData from "../src/data/mcc_skr_mapping.json";
import skr03Data from "../src/data/skr03.json";
import skr04Data from "../src/data/skr04.json";

const mappings = mccData.mappings;

/**
 * A designation that ends in a German function word is almost certainly a
 * PDF line-wrap truncation (e.g. "Verbindlichkeiten gegenüber" instead of
 * "Verbindlichkeiten gegenüber Kreditinstituten, vor Restlaufzeitdifferenzierung").
 */
const TRUNCATED_LABEL =
  /\s(?:gegenüber|und|oder|für|aus|auf|vor|der|des|dem|den|im|in|mit|ohne|bis|zur|zum|von|an|bei|nach|über|unter|sowie|als|durch|andere|anderen|eines|einer)$/iu;

/** Balance-sheet side / P&L type implied by the start of the designation. */
const TYP_BY_NAME: Array<[RegExp, string]> = [
  [/^(?:Erlöse\b|Erträge\b|Umsatzerlöse\b)/u, "ertrag"],
  [/^(?:Anleihen\b|Verbindlichkeiten\b|Rückstellungen?\b|Erhaltene\b)/u, "passiv"],
  [/^(?:Forderungen\b|Ausleihungen\b|Kasse\b|Bank\b)/u, "aktiv"],
];

function typMismatches(konten: Array<{ konto: string; name: string; typ: string }>, label: string): string[] {
  const invalid: string[] = [];
  for (const konto of konten) {
    for (const [pattern, expected] of TYP_BY_NAME) {
      if (pattern.test(konto.name) && konto.typ !== expected) {
        invalid.push(`${label} ${konto.konto} "${konto.name}": typ "${konto.typ}", expected "${expected}"`);
      }
    }
  }
  return invalid;
}

describe("MCC mapping — referential integrity", () => {
  it("all primary SKR03 accounts exist in skr03.json", () => {
    const missing: string[] = [];
    for (const mapping of mappings) {
      const primary = mapping.skr03.primary;
      if (!SKR03.exists(primary)) {
        missing.push(`MCC ${mapping.mcc}: primary "${primary}" not in SKR03`);
      }
    }
    expect(missing).toHaveLength(0);
  });

  it("all alternative SKR03 accounts exist in skr03.json", () => {
    const missing: string[] = [];
    for (const mapping of mappings) {
      for (const alt of mapping.alternatives) {
        if (!SKR03.exists(alt.konto)) {
          missing.push(
            `MCC ${mapping.mcc}: alternative "${alt.konto}" not in SKR03`
          );
        }
      }
    }
    expect(missing).toHaveLength(0);
  });

  it("all skr04_primary values are 4-digit strings", () => {
    const invalid: string[] = [];
    for (const mapping of mappings) {
      if (!/^\d{4}$/.test(mapping.skr04_primary)) {
        invalid.push(
          `MCC ${mapping.mcc}: skr04_primary "${mapping.skr04_primary}" is not 4 digits`
        );
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("all SKR04 primary accounts exist in skr04.json", () => {
    const missing = mappings
      .filter((mapping) => !SKR04.exists(mapping.skr04_primary))
      .map((mapping) => `MCC ${mapping.mcc}: ${mapping.skr04_primary}`);

    expect(missing).toHaveLength(0);
  });

  it("skr04_primary follows the SKR03 primary's cross-reference when one exists", () => {
    const invalid: string[] = [];
    for (const mapping of mappings) {
      const linked = SKR03.get(mapping.skr03.primary)?.skr04;
      if (linked != null && linked !== mapping.skr04_primary) {
        invalid.push(
          `MCC ${mapping.mcc}: skr04_primary "${mapping.skr04_primary}" but SKR03 ${mapping.skr03.primary} links to "${linked}"`
        );
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("no duplicate MCC codes", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const mapping of mappings) {
      if (seen.has(mapping.mcc)) {
        duplicates.push(mapping.mcc);
      }
      seen.add(mapping.mcc);
    }
    expect(duplicates).toHaveLength(0);
  });

  it("all MCC ranges are well-formed (start < end, both 4 digits)", () => {
    const invalid: string[] = [];
    for (const mapping of mappings) {
      if (mapping.mcc.includes("-")) {
        const [startStr, endStr] = mapping.mcc.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (
          !/^\d{4}$/.test(startStr) ||
          !/^\d{4}$/.test(endStr) ||
          start >= end
        ) {
          invalid.push(`MCC range "${mapping.mcc}" is malformed`);
        }
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("records public MCC sources and the date they were checked", () => {
    expect(mccData.meta.source_checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mccData.meta.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining("ISO 18245"),
          url: expect.stringMatching(/^https:\/\//),
        }),
        expect.objectContaining({
          title: expect.stringContaining("Mastercard"),
          url: expect.stringMatching(/^https:\/\//),
        }),
      ])
    );
  });

  it("uses the network-assigned car-rental and lodging MCC ranges", () => {
    const byMcc = new Map(mappings.map((mapping) => [mapping.mcc, mapping]));

    expect(byMcc.get("3351-3500")?.mcc_name).toContain("Car Rental");
    expect(byMcc.get("3501-3999")?.mcc_name).toContain("Lodging");
  });

  it("confidence values are only high/medium/low", () => {
    const valid = new Set(["high", "medium", "low"]);
    const invalid: string[] = [];
    for (const mapping of mappings) {
      if (!valid.has(mapping.skr03.confidence)) {
        invalid.push(
          `MCC ${mapping.mcc}: confidence "${mapping.skr03.confidence}" is invalid`
        );
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("all required fields are present", () => {
    const missing: string[] = [];
    const required = [
      "mcc",
      "mcc_name",
      "category",
      "skr04_primary",
      "needs_beleg",
      "ust_abzug",
    ] as const;

    for (const mapping of mappings) {
      for (const field of required) {
        if (mapping[field] === undefined || mapping[field] === null || mapping[field] === "") {
          missing.push(`MCC ${mapping.mcc}: missing required field "${field}"`);
        }
      }
      if (!mapping.skr03?.primary) {
        missing.push(`MCC ${mapping.mcc}: missing skr03.primary`);
      }
    }
    expect(missing).toHaveLength(0);
  });
});

describe("SKR03 — structural integrity", () => {
  it("groups every account within its declared account class", () => {
    for (const konto of skr03Data.konten) {
      const klasse = skr03Data.klassen.find(
        (entry) =>
          entry.klasse === konto.klasse &&
          Number(konto.konto) >= entry.range[0] &&
          Number(konto.konto) <= entry.range[1]
      );

      expect(konto.gruppe.trim()).not.toBe("");
      expect(klasse).toBeDefined();
    }
  });

  it("all accounts have required fields", () => {
    const invalid: string[] = [];
    const required = ["konto", "name", "klasse", "typ", "gruppe", "ust_relevant", "steuerschluessel"] as const;

    for (const konto of SKR03.klasse(0).concat(
      SKR03.klasse(1),
      SKR03.klasse(2),
      SKR03.klasse(3),
      SKR03.klasse(4),
      SKR03.klasse(5),
      SKR03.klasse(6),
      SKR03.klasse(7),
      SKR03.klasse(8),
      SKR03.klasse(9)
    )) {
      for (const field of required) {
        if (konto[field] === undefined) {
          invalid.push(`SKR03 ${konto.konto}: missing required field "${field}"`);
        }
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("all account numbers are 4-digit strings", () => {
    const invalid: string[] = [];
    for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      for (const konto of SKR03.klasse(k)) {
        if (!/^\d{4}$/.test(konto.konto)) {
          invalid.push(`SKR03 konto "${konto.konto}" is not 4 digits`);
        }
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("skr04 cross-references are 4-digit strings or null", () => {
    const invalid: string[] = [];
    for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      for (const konto of SKR03.klasse(k)) {
        if (konto.skr04 != null && !/^\d{4}$/.test(konto.skr04)) {
          invalid.push(
            `SKR03 ${konto.konto}: skr04 cross-ref "${konto.skr04}" is not 4 digits`
          );
        }
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("typ values are only aufwand/ertrag/aktiv/passiv", () => {
    const valid = new Set(["aufwand", "ertrag", "aktiv", "passiv"]);
    const invalid: string[] = [];
    for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      for (const konto of SKR03.klasse(k)) {
        if (!valid.has(konto.typ)) {
          invalid.push(`SKR03 ${konto.konto}: typ "${konto.typ}" is invalid`);
        }
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("has unique account numbers and complete source labels", () => {
    const accountNumbers = skr03Data.konten.map((konto) => konto.konto);
    expect(new Set(accountNumbers).size).toBe(accountNumbers.length);

    for (const konto of skr03Data.konten) {
      expect(konto.name.length).toBeGreaterThan(1);
      expect(konto.name).not.toMatch(/[,-]$/);
      expect(konto.name).not.toMatch(TRUNCATED_LABEL);
      expect(konto.name).not.toMatch(/\p{L}\d+\)/u);
      expect(konto.name).not.toMatch(/Wasse r|Bürobedar f|Arbeitnehme r|Geschäftsoder/);
    }
  });

  it("keeps typ consistent with the account designation", () => {
    expect(typMismatches(skr03Data.konten, "SKR03")).toHaveLength(0);
  });
});

describe("SKR04 — structural integrity", () => {
  it("groups every account within its declared account class", () => {
    for (const konto of skr04Data.konten) {
      const klasse = skr04Data.klassen.find(
        (entry) =>
          entry.klasse === konto.klasse &&
          Number(konto.konto) >= entry.range[0] &&
          Number(konto.konto) <= entry.range[1]
      );

      expect(konto.gruppe.trim()).not.toBe("");
      expect(klasse).toBeDefined();
    }
  });

  it("keeps exact-label cross-references symmetric and semantically aligned", () => {
    const linkedSkr03 = SKR03.search("").filter((konto) => konto.skr04 != null);
    const linkedSkr04 = SKR04.search("").filter((konto) => konto.skr03 != null);

    expect(linkedSkr03.length).toBeGreaterThanOrEqual(150);
    expect(linkedSkr04).toHaveLength(linkedSkr03.length);

    for (const skr03 of linkedSkr03) {
      const skr04 = SKR04.get(skr03.skr04!);
      expect(skr04?.skr03).toBe(skr03.konto);
      expect(skr04?.name).toBe(skr03.name);
      expect(skr04?.typ).toBe(skr03.typ);
      expect(skr04?.ust_relevant).toBe(skr03.ust_relevant);
      expect(skr04?.steuerschluessel).toEqual(skr03.steuerschluessel);
    }
    for (const skr04 of linkedSkr04) {
      expect(SKR03.get(skr04.skr03!)?.skr04).toBe(skr04.konto);
    }
  });

  it("all account numbers are 4-digit strings", () => {
    const invalid: string[] = [];
    for (const konto of skr04Data.konten) {
      if (!/^\d{4}$/.test(konto.konto)) {
        invalid.push(`SKR04 konto "${konto.konto}" is not 4 digits`);
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("skr03 back-references are 4-digit strings or null", () => {
    const invalid: string[] = [];
    for (const konto of skr04Data.konten) {
      if (konto.skr03 != null && !/^\d{4}$/.test(konto.skr03)) {
        invalid.push(
          `SKR04 ${konto.konto}: skr03 back-ref "${konto.skr03}" is not 4 digits`
        );
      }
    }
    expect(invalid).toHaveLength(0);
  });

  it("has at least 200 accounts", () => {
    expect(skr04Data.konten.length).toBeGreaterThanOrEqual(200);
  });

  it("has unique account numbers and complete source labels", () => {
    const accountNumbers = skr04Data.konten.map((konto) => konto.konto);
    expect(new Set(accountNumbers).size).toBe(accountNumbers.length);

    for (const konto of skr04Data.konten) {
      expect(konto.name.length).toBeGreaterThan(1);
      expect(konto.name).not.toMatch(/[,-]$/);
      expect(konto.name).not.toMatch(TRUNCATED_LABEL);
      expect(konto.name).not.toMatch(/\p{L}\d+\)/u);
      expect(konto.name).not.toMatch(/Wasse r|Bürobedar f|Arbeitnehme r|Geschäftsoder/);
    }
  });

  it("keeps typ consistent with the account designation", () => {
    expect(typMismatches(skr04Data.konten, "SKR04")).toHaveLength(0);
  });
});
