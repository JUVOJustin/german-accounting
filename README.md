# german-accounting

Machine-readable SKR03/SKR04 chart of accounts with MCC-to-account mapping for German SME accounting. MIT licensed — code and data.

The only open source dataset combining enriched SKR03/SKR04 metadata with ISO 18245 MCC codes mapped to specific German accounts. Use it from any language: download the JSON files directly or install the npm package for a typed TypeScript API.

```bash
npm install german-accounting
```

---

## Quick start

```typescript
import { SKR03, suggestAccount } from "german-accounting";

// Look up an account
const konto = SKR03.get("4650");
// { konto: "4650", name: "Bewirtungskosten", klasse: 4, typ: "aufwand",
//   ust_relevant: true, steuerschluessel: [9], skr04: "6640", ... }

// Categorize a card transaction by MCC
const suggestion = suggestAccount("5812"); // restaurant
// {
//   mcc: "5812",
//   mcc_name: "Eating Places, Restaurants",
//   primary: { konto: "4650", confidence: "high", condition: null },
//   alternatives: [{ konto: "1800", condition: "If private meal" }],
//   needs_beleg: true,
//   ust_abzug: true
// }

// SaaS subscriptions (GitHub, Slack, Notion, Figma...)
suggestAccount("5817").primary.konto; // "4969" — Software-Nutzungsrechte

// Target SKR04 instead of SKR03
suggestAccount("5812", "SKR04").primary.konto; // "6640"

// Returns undefined for unknown MCCs — no throws
suggestAccount("9999"); // undefined
```

---

## API

### `SKR03` / `SKR04`

Pre-loaded chart-of-accounts singletons. Both are instances of `Kontenrahmen`.

```typescript
SKR03.get("4650")           // → Konto | undefined
SKR03.search("Reisekosten") // → readonly Konto[]  (case-insensitive substring)
SKR03.klasse(4)             // → readonly Konto[]  (all Klasse 4 expense accounts)
SKR03.exists("4650")        // → boolean
SKR03.size                  // → number
```

### `suggestAccount(mcc, skr?)`

```typescript
suggestAccount(mcc: string, skr?: "SKR03" | "SKR04"): MCCSuggestion | undefined
```

MCC range entries (airlines `3000–3350`, hotels `3351–3500`, car rentals `3501–3999`) are expanded at load time. Any code in those ranges resolves correctly.

When `skr = "SKR04"`, the primary account is the `skr04_primary` value. `name` is `null` and `alternatives` is empty (no SKR04 name data in v0.1).

### Types

```typescript
interface Konto {
  konto: string;                                   // "4650"
  name: string;                                    // "Bewirtungskosten"
  klasse: number;                                  // 4
  typ: "aufwand" | "ertrag" | "aktiv" | "passiv";
  gruppe: string;
  untergruppe?: string;
  ust_relevant: boolean;
  steuerschluessel: readonly number[];
  skr04?: string | null;   // cross-ref to SKR04 account (SKR03 only)
  skr03?: string | null;   // back-ref to SKR03 account (SKR04 only)
  notes?: string | null;
}

interface MCCSuggestion {
  mcc: string;
  mcc_name: string;
  category: string;
  primary: AccountSuggestion;
  alternatives: readonly AccountSuggestion[];
  needs_beleg: boolean;
  ust_abzug: boolean;
  notes: string | null;
}

interface AccountSuggestion {
  konto: string;
  name: string | null;
  confidence: "high" | "medium" | "low";
  condition: string | null;
}
```

---

## Data files

The JSON files are the primary product. Download them from [GitHub Releases](https://github.com/german-accounting/german-accounting/releases) to use without Node.

| File | Contents |
|------|----------|
| [`src/data/skr03.json`](src/data/skr03.json) | 289 SKR03 accounts with enriched metadata and SKR04 cross-references |
| [`src/data/skr04.json`](src/data/skr04.json) | 254 SKR04 accounts derived from SKR03 cross-references |
| [`src/data/mcc_skr_mapping.json`](src/data/mcc_skr_mapping.json) | 230 MCC mappings with confidence levels and alternatives |

JSON Schemas are in [`schemas/`](schemas/) and validated by CI on every push.

### Data schema — `skr03.json`

```jsonc
{
  "meta": { "version": "2026.1", "last_updated": "2026-04-03", ... },
  "klassen": [{ "klasse": 0, "name": "Anlage- und Kapitalkonten" }, ...],
  "konten": [
    {
      "konto": "4650",
      "name": "Bewirtungskosten",
      "klasse": 4,
      "typ": "aufwand",
      "gruppe": "Betriebliche Aufwendungen",
      "ust_relevant": true,
      "steuerschluessel": [9, 8],
      "skr04": "6640"
    }
  ]
}
```

### Data schema — `mcc_skr_mapping.json`

```jsonc
{
  "meta": { "version": "2026.1", ... },
  "mappings": [
    {
      "mcc": "5812",
      "mcc_name": "Eating Places, Restaurants",
      "category": "Food & Beverage",
      "skr03": { "primary": "4650", "confidence": "high" },
      "skr04_primary": "6640",
      "alternatives": [
        { "konto": "1800", "condition": "If private meal" }
      ],
      "needs_beleg": true,
      "ust_abzug": true
    }
  ]
}
```

---

## Contributing

### Add or fix an MCC mapping

1. Edit `mcc_skr_mapping.json`. Required fields: `mcc`, `mcc_name`, `category`, `skr03.primary`, `skr03.confidence`, `skr04_primary`, `needs_beleg`, `ust_abzug`.
2. Run `npm test` — CI gate verifies that all referenced accounts exist in `skr03.json`.
3. Open a PR using the [MCC mapping template](.github/PULL_REQUEST_TEMPLATE/mcc_mapping.md). Include the account number, confidence level, your rationale, and your source (DATEV docs, Steuerberater guidance, SKR documentation).

**Confidence guidelines:**
- `high` — the MCC strongly implies a specific account with no real ambiguity (e.g., fuel stations → Kfz-Betriebskosten)
- `medium` — likely correct but depends on context (e.g., office supply store → could be Bürobedarf or a larger asset)
- `low` — genuinely ambiguous; the mapping is a reasonable default but alternatives are common

### Add or fix SKR03 accounts

Edit `skr03.json` directly. All fields from the schema are required. Run `npm test` to verify referential integrity before opening a PR.

---

## Versioning

Data is versioned independently from the package using a year-based scheme (`2026.1`, `2026.2`, ...). The package version tracks the API.

---

## License

[MIT](LICENSE) — code and data.
