export type KontoTyp = "aufwand" | "ertrag" | "aktiv" | "passiv";
export type Confidence = "high" | "medium" | "low";

/**
 * A single account in the Standardkontenrahmen (SKR03 or SKR04).
 */
export interface Konto {
  /** 4-digit account number, zero-padded (e.g. "4650") */
  readonly konto: string;
  readonly name: string;
  readonly klasse: number;
  readonly typ: KontoTyp;
  readonly gruppe: string;
  readonly untergruppe?: string;
  readonly ust_relevant: boolean;
  readonly steuerschluessel: readonly number[];
  /** Cross-reference to corresponding SKR04 account number (SKR03 only) */
  readonly skr04?: string | null;
  /** Cross-reference to corresponding SKR03 account number (SKR04 only) */
  readonly skr03?: string | null;
  readonly notes?: string | null;
}

/**
 * A single account suggestion within an MCCSuggestion.
 */
export interface AccountSuggestion {
  readonly konto: string;
  readonly name: string | null;
  readonly confidence: Confidence;
  readonly condition: string | null;
}

/**
 * Result of suggestAccount() — the primary SKR account for a given MCC,
 * plus alternatives with conditions under which they apply.
 */
export interface MCCSuggestion {
  readonly mcc: string;
  readonly mcc_name: string;
  readonly category: string;
  readonly primary: AccountSuggestion;
  readonly alternatives: readonly AccountSuggestion[];
  readonly needs_beleg: boolean;
  readonly ust_abzug: boolean;
  readonly notes: string | null;
}
