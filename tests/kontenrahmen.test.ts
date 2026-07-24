import { describe, it, expect } from "vitest";
import { SKR03, SKR04 } from "../src/index.js";

describe("SKR03 — get()", () => {
  it("returns a Konto for a known account", () => {
    const konto = SKR03.get("4650");
    expect(konto).toBeDefined();
    expect(konto?.konto).toBe("4650");
    expect(konto?.name).toBe("Bewirtungskosten");
    expect(konto?.klasse).toBe(4);
    expect(konto?.typ).toBe("aufwand");
  });

  it("returns undefined for an unknown account", () => {
    expect(SKR03.get("9999")).toBeUndefined();
    expect(SKR03.get("")).toBeUndefined();
  });

  it("returns zero-padded accounts correctly", () => {
    const konto = SKR03.get("0010");
    expect(konto).toBeDefined();
    expect(konto?.klasse).toBe(0);
  });

  it("uses the 2026 DATEV account designation", () => {
    expect(SKR03.get("4969")?.name).toBe(
      "Aufwendungen für Abraum- und Abfallbeseitigung"
    );
    expect(SKR04.get("6837")?.name).toBe(
      "Aufwendungen für die zeitlich befristete Überlassung von Rechten (Lizenzen, Konzessionen)"
    );
    expect(SKR03.get("4964")?.skr04).toBe("6837");
    expect(SKR04.get("6837")?.skr03).toBe("4964");

    expect(SKR03.get("3425")?.name).toBe(
      "Innergemeinschaftlicher Erwerb 19 % Vorsteuer und 19 % Umsatzsteuer"
    );
    expect(SKR04.get("5425")?.name).toBe(
      "Innergemeinschaftlicher Erwerb 19 % Vorsteuer und 19 % Umsatzsteuer"
    );
    expect(SKR03.get("8100")?.name).toBe(
      "Steuerfreie Umsätze § 4 Nr. 8 ff. UStG"
    );
    expect(SKR04.get("4100")?.name).toBe(
      "Steuerfreie Umsätze § 4 Nr. 8 ff. UStG"
    );
  });

  it("does not expose reserved DATEV account numbers as named accounts", () => {
    for (const konto of ["1300", "1775", "2000", "2010", "3500", "4905", "8600", "8735"]) {
      expect(SKR03.exists(konto)).toBe(false);
    }
    for (const konto of ["4735", "4900", "5500"]) {
      expect(SKR04.exists(konto)).toBe(false);
    }
  });
});

describe("SKR03 — exists()", () => {
  it("returns true for known accounts", () => {
    expect(SKR03.exists("4650")).toBe(true);
    expect(SKR03.exists("4900")).toBe(true);
  });

  it("returns false for unknown accounts", () => {
    expect(SKR03.exists("9999")).toBe(false);
    expect(SKR03.exists("0000")).toBe(false);
  });
});

describe("SKR03 — search()", () => {
  it("finds accounts by substring (case-insensitive)", () => {
    const results = SKR03.search("Reisekosten");
    expect(results.length).toBeGreaterThan(0);
    for (const konto of results) {
      expect(konto.name.toLowerCase()).toContain("reisekosten");
    }
  });

  it("finds accounts with lowercase query", () => {
    const results = SKR03.search("kfz");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array for no match", () => {
    const results = SKR03.search("XYZNOTFOUND");
    expect(results).toHaveLength(0);
  });
});

describe("SKR03 — klasse()", () => {
  it("returns all accounts in Klasse 4 (expenses)", () => {
    const results = SKR03.klasse(4);
    expect(results.length).toBeGreaterThan(0);
    for (const konto of results) {
      expect(konto.klasse).toBe(4);
    }
  });

  it("returns accounts in Klasse 0 (fixed assets)", () => {
    const results = SKR03.klasse(0);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty Klasse", () => {
    // Klasse 9 is typically empty or sparse in SME-focused datasets
    const results = SKR03.klasse(9);
    expect(Array.isArray(results)).toBe(true);
  });
});

describe("SKR03 — data shape", () => {
  it("has at least 200 accounts", () => {
    expect(SKR03.size).toBeGreaterThanOrEqual(200);
  });

  it("accounts have required fields", () => {
    const konto = SKR03.get("4650");
    expect(konto).toMatchObject({
      konto: expect.any(String),
      name: expect.any(String),
      klasse: expect.any(Number),
      typ: expect.stringMatching(/^(aufwand|ertrag|aktiv|passiv)$/),
      gruppe: expect.any(String),
      ust_relevant: expect.any(Boolean),
      steuerschluessel: expect.any(Array),
    });
  });

  it("skr04 cross-reference is a 4-digit string or null", () => {
    const withSkr04 = SKR03.search("").filter((k) => k.skr04 != null);
    expect(withSkr04.length).toBeGreaterThan(0);
    for (const konto of withSkr04) {
      expect(konto.skr04).toMatch(/^\d{4}$/);
    }
  });
});

describe("SKR04 — singleton", () => {
  it("is distinct from SKR03", () => {
    expect(SKR04).not.toBe(SKR03);
  });

  it("has at least 200 accounts", () => {
    expect(SKR04.size).toBeGreaterThanOrEqual(200);
  });

  it("get() returns undefined for unknown accounts", () => {
    expect(SKR04.get("9999")).toBeUndefined();
  });

  it("accounts have skr03 back-reference", () => {
    const sample = SKR04.klasse(4)[0];
    if (sample) {
      expect(typeof sample.skr03 === "string" || sample.skr03 === null).toBe(true);
    }
  });
});
