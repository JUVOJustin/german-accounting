import { describe, it, expect } from "vitest";
import { suggestAccount, MCCMapper } from "../src/index.js";
import mccData from "../src/data/mcc_skr_mapping.json";

describe("suggestAccount() — basic lookup", () => {
  it("returns a suggestion for a known MCC", () => {
    const suggestion = suggestAccount("5812");
    expect(suggestion).toBeDefined();
    expect(suggestion?.mcc).toBe("5812");
    expect(suggestion?.primary.konto).toBeTruthy();
    expect(suggestion?.primary.confidence).toMatch(/^(high|medium|low)$/);
  });

  it("returns undefined for unknown MCC", () => {
    expect(suggestAccount("9999")).toBeUndefined();
    expect(suggestAccount("0000")).toBeUndefined();
    expect(suggestAccount("")).toBeUndefined();
  });

  it("includes mcc_name and category", () => {
    const suggestion = suggestAccount("5812");
    expect(suggestion?.mcc_name).toBeTruthy();
    expect(suggestion?.category).toBeTruthy();
  });

  it("includes needs_beleg and ust_abzug booleans", () => {
    const suggestion = suggestAccount("5812");
    expect(typeof suggestion?.needs_beleg).toBe("boolean");
    expect(typeof suggestion?.ust_abzug).toBe("boolean");
  });
});

describe("suggestAccount() — MCC range expansion", () => {
  it("resolves an MCC within the airline range (3000-3350)", () => {
    const first = suggestAccount("3000");
    const middle = suggestAccount("3175");
    const last = suggestAccount("3350");

    expect(first).toBeDefined();
    expect(middle).toBeDefined();
    expect(last).toBeDefined();

    // All should point to the same airline category
    expect(first?.category).toBe(middle?.category);
    expect(middle?.category).toBe(last?.category);
  });

  it("resolves an MCC within the car-rental range (3351-3500)", () => {
    const suggestion = suggestAccount("3400");
    expect(suggestion).toBeDefined();
    expect(suggestion?.mcc_name).toContain("Car Rental");
  });

  it("resolves an MCC within the lodging range (3501-3999)", () => {
    const suggestion = suggestAccount("3750");
    expect(suggestion).toBeDefined();
    expect(suggestion?.mcc_name).toContain("Lodging");
  });

  it("boundary: first code in airline range", () => {
    expect(suggestAccount("3000")).toBeDefined();
  });

  it("boundary: last code in airline range", () => {
    expect(suggestAccount("3350")).toBeDefined();
  });

  it("boundary: 3351 is car-rental range, not airline", () => {
    const airline = suggestAccount("3350");
    const carRental = suggestAccount("3351");
    expect(airline).toBeDefined();
    expect(carRental).toBeDefined();
    expect(airline?.mcc_name).toContain("Airlines");
    expect(carRental?.mcc_name).toContain("Car Rental");
  });
});

describe("suggestAccount() — alternatives", () => {
  it("returns alternatives when present", () => {
    // MCC 5812 is restaurant — should have alternatives for business meal vs. private
    const suggestion = suggestAccount("5812");
    expect(Array.isArray(suggestion?.alternatives)).toBe(true);
  });

  it("alternatives have konto and condition", () => {
    // Find any MCC that has alternatives
    const mapper = new MCCMapper(mccData as any);
    // Try a few known MCCs with alternatives
    const suggestion = mapper.suggestAccount("4511"); // Airlines
    if (suggestion && suggestion.alternatives.length > 0) {
      expect(suggestion.alternatives[0].konto).toBeTruthy();
      expect(suggestion.alternatives[0].condition).toBeTruthy();
    }
  });
});

describe("suggestAccount() — SKR04 path", () => {
  it("returns SKR04 primary when skr='SKR04'", () => {
    const skr03 = suggestAccount("5812", "SKR03");
    const skr04 = suggestAccount("5812", "SKR04");

    expect(skr03).toBeDefined();
    expect(skr04).toBeDefined();
    expect(skr04?.primary.konto).not.toBe(skr03?.primary.konto);
  });

  it("SKR04 alternatives is always empty in v0.1", () => {
    const suggestion = suggestAccount("5812", "SKR04");
    expect(suggestion?.alternatives).toHaveLength(0);
  });

  it("SKR04 primary name is null in v0.1", () => {
    const suggestion = suggestAccount("5812", "SKR04");
    expect(suggestion?.primary.name).toBeNull();
  });

  it("returns undefined for unknown MCC in SKR04 path", () => {
    expect(suggestAccount("9999", "SKR04")).toBeUndefined();
  });
});

describe("suggestAccount() — digital goods MCCs (5815-5818)", () => {
  it("maps MCC 5817 (SaaS) to software account", () => {
    const suggestion = suggestAccount("5817");
    expect(suggestion).toBeDefined();
    expect(suggestion?.mcc_name).toContain("Applications");
    expect(suggestion?.primary.konto).toBe("4964");

    const skr04Suggestion = suggestAccount("5817", "SKR04");
    expect(skr04Suggestion?.primary.konto).toBe("6837");
  });

  it("maps MCC 5815 (digital media)", () => {
    expect(suggestAccount("5815")).toBeDefined();
  });

  it("maps MCC 5816 (games)", () => {
    expect(suggestAccount("5816")).toBeDefined();
  });

  it("maps MCC 5818 (large digital merchant)", () => {
    expect(suggestAccount("5818")).toBeDefined();
  });
});

describe("MCCMapper size", () => {
  it("has significantly more entries than raw mappings due to range expansion", () => {
    const mapper = new MCCMapper(mccData as any);
    // 230 raw mappings, but ranges expand to ~600+ individual codes
    // Range 3000-3350 = 351 codes, 3351-3500 = 150, 3501-3999 = 499
    // That's 1000 extra codes from ranges alone
    expect(mapper.size).toBeGreaterThan(230);
  });
});
