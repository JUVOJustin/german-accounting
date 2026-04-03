## MCC Mapping Contribution

**MCC code:** <!-- e.g. 5817 -->
**MCC name:** <!-- e.g. Digital Goods: Applications (SaaS) -->

### Suggested mapping

| Field | Value |
|-------|-------|
| SKR03 primary | <!-- 4-digit account, e.g. 4969 --> |
| SKR03 confidence | <!-- high / medium / low --> |
| SKR04 primary | <!-- 4-digit account, e.g. 6300 --> |
| needs_beleg | <!-- true / false --> |
| ust_abzug | <!-- true / false --> |

### Alternatives (if any)

| Account | Condition |
|---------|-----------|
| <!-- konto --> | <!-- when to use instead of primary --> |

### Rationale

<!-- Why this account? Cite your source (DATEV, SKR documentation, Steuerberater guidance, etc.) -->

### Checklist

- [ ] I have run `npm test` and all tests pass
- [ ] The account number exists in `skr03.json`
- [ ] `skr04_primary` is a valid 4-digit string
- [ ] `confidence` is set to `high` only if the MCC strongly implies this account with no ambiguity
- [ ] If the category name includes "Not Elsewhere Classified" or similar catch-alls, confidence is `medium` or `low`
- [ ] I have added a `notes` field if there are accounting edge cases (e.g. non-deductibility, VAT exemptions)
