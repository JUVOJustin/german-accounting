import type { Konto } from "./types.js";

interface KontoRaw {
  konto: string;
  name: string;
  klasse: number;
  typ: string;
  gruppe: string;
  untergruppe?: string;
  ust_relevant: boolean;
  steuerschluessel: number[];
  skr04?: string | null;
  skr03?: string | null;
  notes?: string | null;
}

interface KontenrahmenData {
  konten: KontoRaw[];
}

/**
 * A loaded chart of accounts (Kontenrahmen). Wraps either skr03.json or skr04.json.
 *
 * Prefer the pre-built singletons `SKR03` and `SKR04` exported from the package root
 * rather than constructing this directly.
 */
export class Kontenrahmen {
  private readonly index: ReadonlyMap<string, Konto>;
  private readonly list: readonly Konto[];

  constructor(data: KontenrahmenData) {
    const konten = data.konten as Konto[];
    this.list = konten;
    const map = new Map<string, Konto>();
    for (const konto of konten) {
      map.set(konto.konto, konto);
    }
    this.index = map;
  }

  /** Look up an account by its 4-digit number. Returns undefined if not found. */
  get(konto: string): Konto | undefined {
    return this.index.get(konto);
  }

  /** Case-insensitive substring search across account names. */
  search(query: string): readonly Konto[] {
    const lower = query.toLowerCase();
    return this.list.filter((k) => k.name.toLowerCase().includes(lower));
  }

  /** All accounts in a given Klasse (0-9). */
  klasse(k: number): readonly Konto[] {
    return this.list.filter((konto) => konto.klasse === k);
  }

  /** Whether an account number exists in this chart. */
  exists(konto: string): boolean {
    return this.index.has(konto);
  }

  /** Total number of accounts. */
  get size(): number {
    return this.list.length;
  }
}
