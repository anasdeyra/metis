# NDC[X] scripts

| Script | What it is |
|---|---|
| `ndcx_search.py` | Standalone reference client — WS-Security header 4.0, MasterPricer search, OfferID extraction. `--dry-run` needs no credentials. Use it as a portable smoke test / as the reference for building a request by hand. |
| `ndcx_cert_runner.js` | **End-to-end certification runner.** Drives a whole flow (shopping → pricing → upsell → order → payment → retrieve → void/refund quote → cancel) through the *metis `api-aerial`* builders and mappers, so every message is a real product payload, and lets its logger drop the RQ/RS XML into the capture folder. |
| `ndcx_package_cert_runs.js` | Turns raw captures into per-case evidence bundles (per-step RQ+RS, `README.md`, `INDEX.md`, zips) from a small JSON manifest. |
| `cert-runs.2026-10-18.json` | The manifest of the three runs listed below — the worked example of that format. |

## `ndcx_cert_runner.js`

Prerequisites: the host app (`api-aerial`) checked out and its dependencies installed, its
sales-point config reachable (DB + VPN), and an Amadeus **test** sales point. The script
refuses any sales-point URL that is not `*test.webservices*`. Credentials are never passed
on the command line — they come from the app's own sales-point lookup.

```bash
node ndcx_cert_runner.js <shop|price|pick|create|services|ancprice|change|setpax|pay|retrieve|quote|cancel> [options]
```

Host app location: `--src <api-aerial/src>` › `$NDCX_AERIAL_SRC` › `../../../../api-aerial/src`
next to the skill folder. State (ids carried between steps) defaults to
`<api-aerial>/use cases/NDCX/cert-runs/state/run.json`; override with `--state`.

The certification chains, in order:

```bash
S="--state run.json"

# 1) upfront upsell + card + ticketing (Offer_06, Create_05, Payment_*)
node ndcx_cert_runner.js shop  --route CDG-JFK --dates 2026-12-07,2026-12-14 --pax 2ADT,1CNN,1INF --carrier AA $S
node ndcx_cert_runner.js price --journey 0 $S                     # no upsell flag = the normal pricing call
node ndcx_cert_runner.js price --journey 0 --upsell $S            # Offer_06: OtherOffers + new ShoppingResponseID
node ndcx_cert_runner.js pick  --variant <offerId from bundles> $S
node ndcx_cert_runner.js create --payment card --card VI $S       # Create_05 when the picked offer is a bundle
node ndcx_cert_runner.js pay   $S                                 # reads amount/currency from a live retrieve
node ndcx_cert_runner.js retrieve $S

# 2) connecting itinerary + card, then same-day void (Cancel_02/03)
node ndcx_cert_runner.js shop --route CDG-LAX --dates 2026-12-07,2026-12-14 --pax 2ADT,1CNN,1INF --carrier AA --state conn.json
node ndcx_cert_runner.js price --journey <n> --state conn.json    # pick a journey whose bounds both have 2 segments
node ndcx_cert_runner.js create --payment card --state conn.json
node ndcx_cert_runner.js pay --state conn.json
node ndcx_cert_runner.js retrieve --state conn.json
node ndcx_cert_runner.js quote --state conn.json                  # expect UseCase=VOID inside the same day
node ndcx_cert_runner.js cancel --state conn.json                 # coupons -> V

# 3) held then cancelled before ticketing
node ndcx_cert_runner.js shop --route CDG-JFK --dates ... --state hold.json
node ndcx_cert_runner.js price --journey 0 --state hold.json
node ndcx_cert_runner.js create --payment card --state hold.json  # no `pay`
node ndcx_cert_runner.js cancel --state hold.json                 # bare Travel_OrderCancel, no quote

# 4) 2 ADT domestic one-way cash
node ndcx_cert_runner.js shop --route JFK-ORD --dates 2026-12-07 --pax 2ADT --direct --carrier AA --state cash.json
node ndcx_cert_runner.js price --journey 0 --state cash.json
node ndcx_cert_runner.js create --payment cash --state cash.json
node ndcx_cert_runner.js pay --state cash.json
```

### Non-bag ancillaries (meals, sports, lounge, fast track, assistance) — `NDCX-ANCILLARIES-PLAN.md` Task 0

Four additions, all driving the product's own builders and mappers. **Held orders on the TEST host only:
never `pay`, never issue, and `cancel` every order the same session.** The sub-commands that create
something (`create --services`, `change`) honour `--dry-run`, which builds the payload, prints it and sends
nothing — use it first.

```bash
S="--state kq.json"
node ndcx_cert_runner.js shop  --route PAR-NBO --dates 2026-12-07,2026-12-14 --pax 1ADT --carrier KQ $S
node ndcx_cert_runner.js price --journey <first KQ index> $S          # then everything below inside the ~30 min OTL

# 1) Travel_ServiceList on the priced offer: one line per definition
#    (id | name | rfic/rfisc | ssr | type | exposure | n | price). --dump writes the node-soap-PARSED reply
#    (<carrier>.reply.json = exactly what the mapper sees, i.e. fixture material), the mapped reply and the request.
node ndcx_cert_runner.js services --dump out/ $S

# 2) F6 re-run: the 2nd Travel_OfferPrice only, no booking. Expected: free items DROPPED, chargeable ones KEPT.
node ndcx_cert_runner.js ancprice --services AVML,SPEQ,WCHR --dump out/ $S

# 3) ADR-82 spike: book at checkout. SSR[:all|first|<n>] ; free items default to every segment, chargeable
#    ones to the first. Chargeable -> 2nd OfferPrice -> AncillaryOfferIdList; free -> FreeServiceOfferIdList
#    (H1, the product builder, freeToken verified). --free-mode h2 = hand-patched 2nd SelectedOffer (experiment).
node ndcx_cert_runner.js create --payment cash --services VGML,WCHR,BIKE:1 --dry-run $S
node ndcx_cert_runner.js create --payment cash --services VGML,WCHR,BIKE:1 --dump out/ $S
node ndcx_cert_runner.js retrieve --dump out/ $S                       # also lists every Service and ServiceDefinition (Task 0 step 7)
node ndcx_cert_runner.js cancel $S                                     # held order: bare Travel_OrderCancel

# 4) ADR-83 / F7: ServiceList keyed on the HELD order, then a FreeOnly OrderChange (no PaymentInfo) through
#    createNdcxOrderChangePayload. --free is mandatory: this runner never drives a paid change.
node ndcx_cert_runner.js create --payment cash $S                      # plain held order
node ndcx_cert_runner.js services --order --dump out/ $S               # keyed on the order
node ndcx_cert_runner.js change --services VGML,WCHR --free --dry-run $S
node ndcx_cert_runner.js change --services VGML,WCHR --free $S
node ndcx_cert_runner.js retrieve --dump out/ $S && node ndcx_cert_runner.js cancel $S
```

Needs `ENCRYPTION_KEY` (loaded from the app's `.environment/.env`): the free-service tokens (ADR-90) are
minted by the mapper and verified by the builders with it. Status: written and syntax-checked on
2026-10-21 but **not yet run live** — the test host was unreachable that day (VPN down), so there is no
worked-example row for these runs yet; add one (order, PNR, final status) when the spike is done.

**Run 2026-10-21 (KQ PAR-NBO, 1 ADT, TEST host):** held order `KQ706ZDY7VP00` (PNR ZDY7VP / 1A ZDYOW7) — `create --services VGML,WCHR,BIKE:1` (H1: free items present on the retrieve as `_FSSR8..11`, HK, 0), then `change --services BLND --free --host-pax` (FreeOnly accepted, `_FSSR39/40`), then `cancel` (post-cancel 119). `--host-pax` resolves the host's renumbered PaxID (our PAX1 came back as PAX2) from the order-keyed ServiceList by name.

Notes that cost real debugging time:

- **`shop` prints every NDC offer with its segment count.** Choose the index by what the
  itinerary must prove: 1 segment per bound = direct, 2 = connecting. `price --journey <n>`
  takes that index.
- **One offer = a whole round trip.** MasterPricer sells the combination: the same `OfferID`
  appears on both bounds, and its per-bound journeys are fixed by the recommendation. Pricing
  any bound's card prices the combination.
- **Offers expire (OTL, 15–30 min).** `price` after the expiry is refused client-side; re-shop.
- **Pax names matter.** One shared family surname with distinct given names, titles and
  genders (MR JEAN / MRS MARIE / MSTR LUC / MISS EVA) is what the host accepts; a different
  surname per passenger gets `39138 FAIL TO CREATE PAX NAME IN 1A PNR` from AA. `setpax`
  rebuilds the names without invalidating a priced offer.
- **Card payments** use the Amadeus test cards (`references/09-queues-sync-errors-testdata.md`)
  through the same encrypted enrolment blob the front persists. PAN/CVV never reach stdout,
  and the logger masks them in the XML. Purge `EncCardNumber` / `EncCvv` / `payerInfo.cvv`
  from the state file when a run is finished.
- `quote` **before** `cancel` on a ticketed order: the reshop quote is what distinguishes
  Void from Refund (`UseCase`) and carries the amounts. A held order cancels directly.

## `ndcx_package_cert_runs.js`

```bash
node ndcx_package_cert_runs.js --manifest cert-runs.2026-10-18.json \
  [--logs "<api-aerial>/use cases/NDCX"] [--out <logs>/cert-runs/cases]
```

Every case in the manifest has a `window` (local write-time range), the `labels` of the steps
in chronological order, a `summary` block (order / PNR / amount / payment / tickets /
outcome) and free-form `notes`. The script fails loudly if the number of captured calls does
not match the number of labels — that mismatch is how a forgotten step (or a window that
overlaps two runs) shows up. `zip` uses `Compress-Archive` on Windows and `zip` elsewhere.

## Worked example — 2026-10-18 (AA, test host nodea1, office NCEPF3273)

Four live runs, executed from the skill:

| Case | Order | PNR | Amount | Payment | Tickets | Outcome |
|---|---|---|---|---|---|---|
| `C1-domestic-cash` | AA001HB2X21A3 | IAXGEZ | 266.16 EUR | cash | 0015762157896-97 | ticketed, coupons `O` (JFK-ORD AA3162, 2 ADT) |
| `C2-direct-upsell-card` | AA001XYYX21A3 | IFYALV | 1947.82 EUR | card VI | 0015762157888-91 | ticketed, coupons `O` |
| `C3-connect-card-void` | AA001S7ZX21A3 | IGWENS | 2011.82 EUR | card VI | 0015762157892-95 | ticketed then **voided same day**, 16 coupons `V` |
| `C4-hold-cancel-before-ticketing` | AA001R9ZX21A3 | ILONKF | 1519.82 EUR | card on file | none | **cancelled before ticketing** (119) |

- Case 1 is the US-domestic one-way pair the checklist asks for (2 ADT / domestic / one way /
  direct / cash / booking and ticketing) — the run that needed no upsell, only the plain
  `shop --direct → price → create --payment cash → pay → retrieve` chain.

- Case 2 also carries the wire proof for two Mandatory criteria: **Offer_06** (9
  `OtherOffers` bundles answered to the `FarePreferences@PreferencesContext="Upsell"` request)
  and **Create_05** (the create re-uses an `OtherOffers` `OfferID` together with the updated
  `ShoppingResponseID`). Case 3 doubles as the Void complex template (2 ADT + 1 CHD + 1 INF,
  FR↔US with connections, pay, void) and case 4 is the held-order cancel.
- The captures themselves (raw RQ/RS, per step, zipped) belong to the workspace that produced
  them (`api-aerial/use cases/NDCX/cert-runs/cases/`, gitignored) — this folder keeps the
  runner, the manifest and the numbers.
