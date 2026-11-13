# Sales point (PDV)

## Definition
A **sales point** (*point de vente*, PDV) is an agency office that bookings
are made through. It holds the supplier credentials, currency, back-office
settings and billing rules used for every booking made under it.

An **agency** (*agence*) owns one or more sales points. Users and dossiers
belong to exactly one sales point.

## Business context
- The sales point decides *how* a booking reaches the suppliers: which Amadeus
  office and WSAP, which Sabre PCC, which airline-direct credentials, which
  NDC routing priority.
- It also decides *how the booking is accounted*: back-office format, billing
  package and rules, currency, accounting emails.
- Captures and test data are named after the test sales point (`AdenisPDV` in
  `api-aerial/use cases/NDCX/`).

## Technical context
- Model `api-aerial/src/models/sales_points.js`; service
  `api-aerial/src/services/sales_points.service.js`; admin CRUD in
  `api-dashboard/src/controllers/sales_points.controller.js`.
- Columns include `name`, `email`, `emailLowCost`, `emailOnline`,
  `country_code`, `facturationOrNot`, and back-office export settings
  `bo_code`, `type_bo`, `type_file`.
- Linked by `salesPointId` / `id_sales_point` from: dossier, users, profil,
  facturation segments and manual invoicing, pricing, agency options
  (`option_has_agence`), GDS remark templates, billing package and rules.
- **Configuration lives in `attribut` rows** (`type` = name, `value`), not in
  columns:

| Attribute | Purpose |
|---|---|
| `Amadeus-officeId` | Amadeus office (PseudoCityCode) |
| `Amadeus-wasp` | WSAP endpoint suffix (metis: `1ASIWMETMDI`) |
| `Amadeus-userId` / `-password` / `-url` | Amadeus credentials |
| `Amadeus-ndcx-enable` | Shows the NDC[X] carrier grid in the front |
| `Amadeus-bsp-region` / `Amadeus-currency` | BSP region, office currency |
| `Amadeus-queueScan` (`-mode`, `-removeItem`) | Queue scanning cron settings |
| `Sabre-iPCC` / `PCC` / `Sabre-EPR` / `Sabre-password` | Sabre credentials |
| `EK-PCC` / `EK-AGT` / `EK-PWD`, `BA-key` | Airline-direct credentials |
| `NDC-routing-priority` / `NDC-routing-fallback` | NDC router opt-in, see [provider-ora.md](provider-ora.md) |

- **Currency**: resolved once from the sales point before shopping dispatch
  (`resolveAgencyCurrency`, MET2-2199) and propagated to every provider.
- **Time zone**: `resolveSalesPointTimeZone` sets the "same day" in void rules
  (see [cancellation workflow](../workflows/cancellation-void-refund.md)).
- **Fare codes per sales point × airline**: `sales_point_amadeus_to_codes`,
  `code_type` = `TO` (tour-operator code, default) or `CORPORATE` (agency code
  sent on every search, MET2-2751). They combine with the agency network (GIE)
  codes and per-airline corporate codes — `api-aerial/src/utils/AMADEUS/network-code.utils.js`.
- Issuance debits credit per sales point (`recordIssuanceCredit`).

## Business rules
- Credentials and routing come from the **booking's** sales point. Never take
  them from a global env var or another sales point's attributes.
- NDC[X] carrier eligibility is fixed by the Amadeus office. The
  `Amadeus-ndcx-enable` attribute only controls visibility.

## Distinctions
- Sales point ≠ agency (one agency, many sales points).
- Office ID (`Amadeus-officeId`, PseudoCityCode) ≠ WSAP ≠ IATA agency number.
- Sales point attribute ≠ agency option: options (`optionHasAgence`) are
  feature flags with a validity window. Attributes are configuration values.

## Synonyms
point de vente, PDV, sales_point, office (loosely), agence (wrongly; that's
the parent).
