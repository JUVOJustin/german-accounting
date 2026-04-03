import skr03Data from "./data/skr03.json";
import skr04Data from "./data/skr04.json";
import mccData from "./data/mcc_skr_mapping.json";

import { Kontenrahmen } from "./kontenrahmen.js";
import { MCCMapper } from "./mcc.js";

export type {
  Konto,
  AccountSuggestion,
  MCCSuggestion,
  Confidence,
  KontoTyp,
} from "./types.js";
export { Kontenrahmen } from "./kontenrahmen.js";
export { MCCMapper } from "./mcc.js";

/**
 * Pre-loaded SKR03 chart of accounts singleton.
 *
 * @example
 * import { SKR03 } from "german-accounting";
 * const konto = SKR03.get("4650");
 * // { konto: "4650", name: "Bewirtungskosten", klasse: 4, ... }
 */
export const SKR03 = new Kontenrahmen(skr03Data as any);

/**
 * Pre-loaded SKR04 chart of accounts singleton.
 * Derived from SKR03 cross-references. Each account has a `skr03` back-reference.
 *
 * @example
 * import { SKR04 } from "german-accounting";
 * const konto = SKR04.get("6640");
 */
export const SKR04 = new Kontenrahmen(skr04Data as any);

const _mapper = new MCCMapper(mccData as any);

/**
 * Returns an account suggestion for a given MCC code.
 *
 * @param mcc - 4-digit ISO 18245 MCC code (e.g. "5812")
 * @param skr - Target chart of accounts. Defaults to "SKR03".
 * @returns MCCSuggestion with primary account and alternatives, or undefined if unmapped.
 *
 * @example
 * import { suggestAccount } from "german-accounting";
 *
 * const suggestion = suggestAccount("5812");
 * // { mcc: "5812", primary: { konto: "4650", confidence: "high" }, ... }
 *
 * const skr04 = suggestAccount("5812", "SKR04");
 * // { primary: { konto: "6640", name: null, ... }, alternatives: [] }
 *
 * suggestAccount("9999"); // undefined — MCC not in dataset
 */
export function suggestAccount(
  mcc: string,
  skr: "SKR03" | "SKR04" = "SKR03"
) {
  return _mapper.suggestAccount(mcc, skr);
}
