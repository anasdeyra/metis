# Dossier

## Definition
The **internal booking record** — metis' own aggregation of a booking across
providers. It is the hub entity everything else hangs off.

```
dossier ─┬─ dossier_has_traveler ── travelers (pax) ── tickets (ticket_aerial, T or EMD)
         │                         └─ price rows (status === 1 = active)
         ├─ pnr / pnrList ── airline record locators (ownerCode, terminal statuses)
         ├─ remarques (internal notes) / remarques GDS (written to the airline PNR)
         ├─ billing (facturation: segment, manual, v3) / margins / taxes
         ├─ approbations (approval logs) / order warnings
         └─ seaman / passive segments / split copies when applicable
```

## Business context
One dossier = one booking event for one client, regardless of provider
(AMADEUS, AMADEUS_NDCX, SABRE, AFKL, EK, …) and regardless of channel (TA or
OBT). The OBT UI calls it a **folder** (`front-reservation/app/pages/folder/`).

## Technical context
- Persistence lives in `api-aerial/src/utils/dossier.utils.js`
  (`dossierCreate`, `saveAfterRetreive`, `updateIssuance`) +
  `dossier.service.js` + `models/dossier.js`, `dossier_has_traveler.js`.
- Created **exactly once per booking, at hold** (order create). Pay and
  retrieve update it (`saveAfterRetreive` / `updateIssuance`) — calling
  `dossierCreate` twice orphans a row. OrderPay pairs **only** with
  `updateIssuance`; retrieve pairs with `saveAfterRetreive`.
- Provider-agnostic: dossier code is **shared across every provider** — prefer
  adding provider-specific call sites over editing shared function bodies, and
  name every shared-file touch in the PR description.
- Shared target shape for provider replies: `DossierCreatePayload.d.ts`
  (`._text`-wrapped IATA OrderViewRS).
- Travelers are re-keyed on the host's `PaxID` by name (`paxFromDataList`);
  ancillary/change flows must use the **host** pax ids, not metis' `PAX{n}`.

## Business rules
- Hold-before-pay is the norm (TA usage); the dossier exists from hold, before
  any payment or ticket.
- Terminal PNR statuses (`0` void, `3` annulé, `4` remboursé) are never
  rewritten by a resync (LOC-089, `pnrTerminalStatus.utils.js`).
- Dossier notes receive a `"PNR AMADEUS: <recloc>"` note on NDC[X] bookings.

## Distinctions
- Dossier (metis internal) ≠ PNR (airline record) ≠ Order (NDC record) ≠
  ticket (issued document). See [pnr-order-ticket.md](pnr-order-ticket.md).
- Remarque dossier (internal) ≠ remarque GDS (written to the airline).

## Synonyms
dossier (FR), folder (OBT UI), booking record.
