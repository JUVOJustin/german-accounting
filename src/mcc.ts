import type { AccountSuggestion, Confidence, MCCSuggestion } from "./types.js";

interface AlternativeRaw {
  konto: string;
  condition: string;
}

interface MappingRaw {
  mcc: string;
  mcc_name: string;
  category: string;
  skr03: {
    primary: string;
    confidence: Confidence;
  };
  skr04_primary: string;
  alternatives: AlternativeRaw[];
  needs_beleg: boolean;
  ust_abzug: boolean;
  notes?: string | null;
}

interface MappingData {
  mappings: MappingRaw[];
}

/**
 * Maps ISO 18245 MCC codes to SKR03/SKR04 account suggestions.
 *
 * Range entries (e.g. "3000-3350") are expanded into individual MCC keys
 * at construction time, so every lookup is O(1).
 */
export class MCCMapper {
  private readonly index: ReadonlyMap<string, MappingRaw>;

  constructor(data: MappingData) {
    const map = new Map<string, MappingRaw>();

    for (const mapping of data.mappings) {
      if (mapping.mcc.includes("-")) {
        const [startStr, endStr] = mapping.mcc.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        for (let code = start; code <= end; code++) {
          map.set(code.toString().padStart(4, "0"), mapping);
        }
      } else {
        map.set(mapping.mcc, mapping);
      }
    }

    this.index = map;
  }

  /**
   * Returns an account suggestion for the given MCC code.
   *
   * @param mcc - 4-digit MCC code string (e.g. "5812")
   * @param skr - Which chart of accounts to target. Defaults to "SKR03".
   * @returns MCCSuggestion, or undefined if the MCC is not in the dataset.
   *
   * When skr="SKR04", the primary account is the skr04_primary value.
   * The primary name is null (no SKR04 name lookup in v0.1) and alternatives
   * is an empty array.
   */
  suggestAccount(
    mcc: string,
    skr: "SKR03" | "SKR04" = "SKR03"
  ): MCCSuggestion | undefined {
    const mapping = this.index.get(mcc);
    if (!mapping) return undefined;

    if (skr === "SKR04") {
      if (!mapping.skr04_primary) return undefined;
      const primary: AccountSuggestion = {
        konto: mapping.skr04_primary,
        name: null,
        confidence: mapping.skr03.confidence,
        condition: null,
      };
      return {
        mcc,
        mcc_name: mapping.mcc_name,
        category: mapping.category,
        primary,
        alternatives: [],
        needs_beleg: mapping.needs_beleg,
        ust_abzug: mapping.ust_abzug,
        notes: mapping.notes ?? null,
      };
    }

    const primary: AccountSuggestion = {
      konto: mapping.skr03.primary,
      name: null,
      confidence: mapping.skr03.confidence,
      condition: null,
    };

    const alternatives: AccountSuggestion[] = mapping.alternatives.map(
      (alt) => ({
        konto: alt.konto,
        name: null,
        confidence: mapping.skr03.confidence,
        condition: alt.condition,
      })
    );

    return {
      mcc,
      mcc_name: mapping.mcc_name,
      category: mapping.category,
      primary,
      alternatives,
      needs_beleg: mapping.needs_beleg,
      ust_abzug: mapping.ust_abzug,
      notes: mapping.notes ?? null,
    };
  }

  /** Total number of unique MCC codes (including expanded range entries). */
  get size(): number {
    return this.index.size;
  }
}
