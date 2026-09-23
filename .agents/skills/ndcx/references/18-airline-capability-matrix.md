# NDC[X] airline capability matrix (per carrier, per channel)

> Source: 26_06_15_NDC Difference per airline table.xlsx, sheet "Table par airline" (dated 2026-06-15)

## Carriers

| Code | Airline | IT provider | Airline status |
|---|---|---|---|
| AA | American Airlines | Accelya | Production |
| EK | Emirates | Accelya | Production |
| LH | Lufthansa Group (LH, OS, SN, LX, EN, 4Y, AZ) | Accelya | Production |
| QF | Qantas | Accelya | Production |
| UA | United Airlines | Accelya | Production |
| SM | Air Cairo | Altéa NDC | Production |
| AC | Air Canada | Altéa NDC | Production |
| AI | Air India | Altéa NDC | Production |
| CX | Cathay Pacific | Altéa NDC | Production |
| EY | Etihad | Altéa NDC | Production |
| BR | Eva Air | Altéa NDC | Production |
| AY | Finnair | Altéa NDC | Production |
| KQ | Kenya Airways | Altéa NDC | Production |
| LO | LOT Polish Airlines | Altéa NDC | Production |
| MH | Malaysia Airlines | Altéa NDC | Production |
| NP | Nile Air | Altéa NDC | Production |
| QR | Qatar Airways | Altéa NDC | Production |
| SV | Saudia | Altéa NDC | Production |
| SK | Scandinavian Airlines | Altéa NDC | Production |
| SQ | Singapore Airlines | Altéa NDC | Production |
| TP | TAP Air Portugal | Altéa NDC | Production |
| TU | Tunisair | Altéa NDC | Production |
| AF/KL | Air France / KLM | In house provider | Production |
| BA | British Airways | In house provider | Production |
| IB | Iberia | In house provider | Production |
| 6E | IndiGo | Navitaire | Production |
| VY | Vueling | Navitaire | Production |

## How to use this file

Every carrier in the source sheet is documented twice, once per
distribution channel:

- **WBS** - Amadeus Web Services (the NDC[X] web-services / API channel).
  **This is the relevant channel for web-services integrations**; if you are
  building against the Amadeus APIs, read the WBS value and ignore SECO.
- **SECO** - Selling Connect / Selling Platform Connect, the agent-facing
  desktop UI channel.

For most features both channels carry the same value. Where they differ, this
file marks the carrier with the channel it applies to, e.g. `AA(WBS only)` in a
Supported list means supported on WBS but not on SECO.

Value legend (the source sheet carries **no** legend of its own; this reading is
inferred from the data, where `1` and `0` are the only numeric values used):

- `1` -> **Supported**
- `0` -> **Not supported**
- empty cell -> **Not documented** (only ~120 cells; treat as unknown, not as a
  refusal - confirm with Amadeus)
- `Note (Xnn)` -> **Note-qualified**: supported/limited per the note text, see
  `## Notes referenced` at the end of this file
- any other free text (`Max 9`, `Piece`, `to be clarified`, `N/A`, ...) -> the
  carrier-specific value itself, reproduced verbatim under **Values**

`to be clarified` and `N/A` are the sheet's own wording and are reproduced as
values, not translated into supported/not supported.

For machine querying use the flattened sibling files instead:
`airline-matrix.csv` (one row per feature x carrier x channel) and
`airline-notes.csv` (note texts).

## Feature support by flow

### Global info

#### Global info

- **IATA Accredited agency**
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

#### Delegation flow

- **Different OID same IATA number (including GoLite)**
  - Supported: AA, EK, LH, QF, UA, SM, AC, CX, BR, KQ, LO, SV, SQ, AF/KL, 6E, VY
  - Not supported: AI, EY, MH, NP, QR, SK, TP, TU
  - Note-qualified: AY (D07), BA (D07), IB (D07)

- **Booking with TIDS (Issuance with IATA Number)**
  - Supported: AA, QF, UA, MH, SV
  - Not supported: EK, LH, SM, AC, AI, EY, BR, AY, KQ, LO, NP, QR, SK, TP, TU, AF/KL, BA, IB, 6E, VY
  - Note-qualified: CX (D08), SQ (D08)

- **Booking and issuance/servicing with different IATA numbers**
  - Supported: SM, KQ, LO, SV
  - Not supported: EK, LH, AC, AI, EY, BR, MH, NP, QR, SK, TP, TU, 6E, VY
  - Note-qualified: AA (D08), QF (D08), UA (D08), CX (D08), AY (D05), SQ (D08), AF/KL (D08), BA (D05), IB (D05)

#### Global info

- **Office ID Mandatory profile info: Travel Agency email in office profile**
  - Supported: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, 6E, VY
  - `to be clarified`: EK, LH, QF
  - `Email+phone`: IB

- **Shopping configuration**
  - `N/A`: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - `to be clarified`: EK, LH, QF
  - `Must be done to limit parallel calls based on type of fare.`: AF/KL, BA, IB
  - `Different offer granularity`: 6E, VY

- **Minimum API version**
  - `From MP 20.2`: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - `to be clarified`: EK, LH, QF, BA, IB, 6E, VY

### Cross API features

#### API features

- **Airline portal available to service NDC bookings**
  - Supported: SQ, TP
  - Not supported: AA(WBS), UA(WBS), AC, CX, EY, BR, AY, KQ, MH, QR, SV, SK, TU, AF/KL
  - `Sparx AA UI`: AA(SECO)
  - `to be clarified`: EK, LH, QF, BA, IB, 6E, VY
  - `United For Business`: UA(SECO)
  - `Seller UI`: SM, AI, LO, NP

- **Support interline offers**
  - Supported: AA, QF, AI, CX, AY, LO, SQ, TP
  - Not supported: UA, SM, AC, EY, BR, KQ, MH, NP, QR, SV, SK, TU, AF/KL
  - `to be clarified`: EK, LH, BA, IB, 6E, VY

- **Dynamic or Continuous pricing**
  - Not supported: SM, AI, CX, EY, BR, KQ, LO, MH, NP, SV, SK, TP, TU, AF/KL
  - `CP`: AA, QF, UA, AC, AY, QR, SQ
  - `to be clarified`: EK, LH, BA, IB, 6E, VY

- **Airline distribution surcharge**
  - `N/A`: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SQ, TP, TU
  - `YR fee`: SK
  - `OB fee`: AF/KL
  - `Tax (OA-AG)`: BA
  - `Surcharge`: IB, 6E, VY

### Shopping

#### Shopping

- **Passenger type** _(Input)_
  - Supported: EK, LH, QF, AF/KL, BA, IB
  - Note-qualified: AA (S01), UA (S03), SM (S02), AC (S02), AI (S02), CX (S02), EY (S02), BR (S02), AY (S02), KQ (S02), LO (S02), MH (S02), NP (S02), QR (S02), SV (S02), SK (S02), SQ (S02), TP (S02), TU (S02)
  - `to be clarified`: 6E, VY

- **PTC: Infant** _(Input)_
  - Supported: EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Note-qualified: AA (S07)

- **PTC: Unaccompanied Minor (UM)** _(Input)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **PTC: Seaman** _(Input)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, TP, TU, AF/KL, BA, IB, 6E, VY
  - Note-qualified: SQ (S06)

- **Maximum number of bound** _(Input)_
  - `Max 6`: AA, EK, LH, QF, UA, AI, EY, BR, SV, SQ, IB
  - `Max 4`: SM, AC, CX, AY, MH, NP, QR, TP, AF/KL
  - `Max 5`: KQ
  - `Max 2`: LO, SK, TU, BA
  - `Max 3`: 6E, VY

- **Maximum number of passenger** _(Input)_
  - `Max 9`: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Cabin selection** _(Input)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - `Bound level`: AA, EK, LH, QF, UA

- **Itinerary type** _(Input)_
  - Supported: AF/KL, BA, IB, 6E, VY
  - `All`: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU

- **Currency override** _(Input)_
  - Supported: AA, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: EK, LH, AF/KL, BA, IB, 6E, VY

- **Request for public fares** _(Input)_
  - Supported: AA, EK, LH, QF, UA, AF/KL, BA, IB, 6E, VY
  - Note-qualified: SM (S05), AC (S05), AI (S05), CX (S05), EY (S05), BR (S05), AY (S05), KQ (S05), LO (S05), MH (S05), NP (S05), QR (S05), SV (S05), SK (S05), SQ (S05), TP (S05), TU (S05)

- **Request for private fares** _(Input)_
  - Supported: AA(SECO only), EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY
  - Note-qualified: AY (s09)
  - `Except bulk fare`: AA(WBS)

- **Request for corporate fares** _(Input)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, IB
  - Not supported: VY
  - `CLID needed`: AF/KL, BA
  - `Promo code`: 6E

- **Request for Seaman** _(Input)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, TP, TU, AF/KL, BA, IB, 6E, VY
  - Note-qualified: SQ (S06)

- **Corporate codes** _(Input)_
  - Not supported: 6E, VY
  - Note-qualified: SM (S13), AC (S13), AI (S13), CX (S13), EY (S13), BR (S13), AY (S13), KQ (S13), LO (S13), MH (S13), NP (S13), QR (S13), SV (S13), SK (S13), SQ (S13), TP (S13), TU (S13), AF/KL (S18)
  - `Up to 12`: AA(WBS), LH(WBS)
  - `Up to 6`: AA(SECO), LH(SECO)
  - `Only 1`: EK, QF, UA
  - `N/A`: BA, IB

- **Corporate identifier (CLID)** _(Input)_
  - Not supported: UA, SM, AC, AI, CX, EY, BR, KQ, LO, NP, SV, TP, TU, 6E, VY
  - `SSR CLID`: AA, EK, LH, AY, MH, SK, SQ, BA
  - `ABN/QCI`: QF
  - `OSI Deal Code`: QR
  - `OSI OIN or SSR CLID`: AF/KL
  - `SSR CLID, OIN`: IB

- **Frequent Flyer number (from MP 20.2)** _(Input)_
  - Not supported: AA(WBS), EK(WBS), LH(WBS), QF(WBS), UA(WBS), 6E, VY
  - Note-qualified: AA(SECO) (S22), EK(SECO) (S22), LH(SECO) (S22), QF(SECO) (S22bis), UA(SECO) (S22), SM (S22), AC (S22), AI (S22), CX (S22), EY (S22), BR (S22), AY (S22), KQ (S22), LO (S22), MH (S22), NP (S22), QR (S22), SV (S22), SK (S22), SQ (S22), TP (S22), TU (S22), AF/KL (S22), BA (S22), IB (S22)

- **Air promocode** _(Input)_
  - Supported: EY, AY, LO, QR, SQ
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, BR, KQ, MH, NP, SV, SK, TP, TU, AF/KL, BA, IB, 6E, VY

- **Search by Free baggage allowance** _(Input)_
  - Not supported: AA, EK, LH, QF, UA
  - Note-qualified: SM (S05), AC (S05), AI (S05), CX (S05), EY (S05), BR (S05), AY (S05), KQ (S05), LO (S05), MH (S05), NP (S05), QR (S05), SV (S05), SK (S05), SQ (S05), TP (S05), TU (S05), AF/KL (S05), BA (S05), IB (S05), 6E (S05), VY (S05)

- **Time options (departure, arrival, window)** _(Input)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, QF, UA
  - Note-qualified: BA (S05), IB (S05), 6E (S05), VY (S05)
  - `Departure time only`: AF/KL

- **Exchangeable / refundable fares option** _(Input)_
  - Not supported: AA, EK, LH, QF, UA
  - Note-qualified: SM (S05), AC (S05), AI (S05), CX (S05), EY (S05), BR (S05), AY (S05), KQ (S05), LO (S05), MH (S05), NP (S05), QR (S05), SV (S05), SK (S05), SQ (S05), TP (S05), TU (S05), AF/KL (S05), BA (S05), IB (S05), 6E (S05), VY (S05)

- **Calendar search (+/- 3 days)** _(Input)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Radius search** _(Input)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Flight categories (non-stop, direct)** _(Input)_
  - Not supported: AA, EK, LH, QF, UA
  - Note-qualified: SM (S05), AC (S05), AI (S05), CX (S05), EY (S05), BR (S05), AY (S05), KQ (S05), LO (S05), MH (S05), NP (S05), QR (S05), SV (S05), SK (S05), SQ (S05), TP (S05), TU (S05), 6E (S05), VY (S05)
  - `Non-stop only`: AF/KL, BA, IB

- **Flight categories (connection number)** _(Input)_
  - Supported: AA, EK, LH, QF, UA
  - Note-qualified: SM (S05), AC (S05), AI (S05), CX (S05), EY (S05), BR (S05), AY (S05), KQ (S05), LO (S05), MH (S05), NP (S05), QR (S05), SV (S05), SK (S05), SQ (S05), TP (S05), TU (S05), AF/KL (S05), BA (S05), IB (S05), 6E (S05), VY (S05)

- **Search by flight number** _(Input)_
  - Supported: AF/KL
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, BA, IB, 6E, VY

- **Upsells (Shopping)** _(Output)_
  - Supported: AA(SECO only), LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Not supported: EK, LO
  - Note-qualified: AA(WBS) (S14), UA (S14)

- **Display Non discounted amount for Promo code** _(Output)_
  - Supported: QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, UA, AF/KL, BA, IB, 6E, VY

- **Fare type** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Fare family name** _(Output)_
  - Supported: AA, EK, LH, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Not supported: QF

- **Cabin** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Checked baggage allowance** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Exchangeable/refundable attribute** _(Output)_
  - Supported: AA, EK, LH, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E
  - Not supported: QF, VY

- **Display commissions** _(Output)_
  - Supported: AA, QF
  - Not supported: EK, LH, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Ticket designator** _(Output)_
  - Supported: AA, EK, LH
  - Not supported: QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Brand code / Fare family (from MP 21.4)** _(Output)_
  - Supported: AA, EK, LH, UA
  - Not supported: QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Payment time limit** _(Output)_
  - Supported: AA, EK, LH, QF, UA, BA, IB
  - Not supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, 6E, VY

- **Elapsed flying time at flight level** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Flight mileage** _(Output)_
  - Supported: AA, EK, LH, QF, UA
  - Not supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Offer per bound (from MP 23.2) (Shop by bound)** _(Output)_
  - Supported: AA, QF, 6E, VY
  - Not supported: EK, LH, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB

- **Offer time limit** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

### Pricing options Fares & PTC (OfferPrice)

#### Price

- **BIN number** _(Input)_
  - Supported: EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, 6E, VY
  - Not supported: AA, UA, IB

- **Frequent flyer number** _(Input)_
  - Not supported: EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Note-qualified: AA (?)

- **Checked baggage allowance** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Carry-on baggage allowance** _(Output)_
  - Supported: AA, EK, LH, QF, AF/KL, BA, IB, 6E, VY
  - Not supported: UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU

- **Fare type** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Cabin information** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **RBD** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Fare family name** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Fare family description** _(Output)_
  - Supported: AA, EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB, 6E, VY
  - Not supported: UA, BA

- **Exchange/Cancel conditions** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Display commissions** _(Output)_
  - Supported: AA, QF
  - Not supported: EK, LH, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Credit card surcharge** _(Output)_
  - Supported: 6E, VY
  - `No fees`: AA, IB
  - `OB fee`: EK, LH, QF, UA, AF/KL
  - `NA`: SM
  - `No fee`: AC, EY, BR, MH, NP, SV, TP, TU
  - `OB fees`: AI, CX, AY, KQ, LO, QR, SK, SQ
  - `Tax (DU)`: BA

- **Airline, airport and aircraft** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, BA, IB, 6E, VY
  - `Code only`: AF/KL

- **Miles accrual** _(Output)_
  - Supported: AF/KL
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, BA, IB, 6E, VY

- **Secure flight indicator** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Price Guarantee Time Limit (PGTL)** _(Output)_
  - Supported: BA
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB
  - `to be clarified`: 6E, VY

- **Payment time limit** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Not supported: CX

- **Offer time limit** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Upsells (Pricing)** _(Output)_
  - Supported: AA, LH, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, IB
  - Not supported: EK, QF, 6E, VY
  - Note-qualified: UA (S14)
  - `Max 20 upsell`: AF/KL
  - `Same cabin only`: BA

### Booking (OrderCreate) (Order before payment)

#### Book

- **Create : Traveler's Name** _(Input)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Create : Name length: Max Nbr of characters** _(Input)_
  - `59 characters`: AA, EK, LH, UA, BA
  - `56 characters`: QF
  - `Max 59`: SM, AI, CX, EY, AY, KQ, LO, MH, NP, QR, SQ, AF/KL, IB, 6E
  - `Max 51`: AC, BR, SK, TP, TU
  - `Max 38`: SV
  - `to be clarified`: VY

- **Create : Traveler's Gender code** _(Input)_
  - Supported: EK, LH, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, 6E, VY
  - `M, F and X`: AA
  - `M, F, X and U`: QF
  - `M and F`: UA
  - `X not supported`: AF/KL, BA, IB

- **Create : Traveler's Title (Check accepted title with airline)** _(Input)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - `15 characters`: AA, EK, LH, QF, UA

- **Create : Traveler's Date of Birth (Digit only)** _(Input)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Create : Traveler's Contact details (SSR CTC)** _(Input)_
  - Supported: AA, EK, LH, QF, UA, IB, 6E, VY
  - Note-qualified: SM (B01), AC (B01), AI (B01), CX (B01), EY (B01), BR (B01), AY (B01), KQ (B01), LO (B01), MH (B01), NP (B01), QR (B01), SV (B01), SK (B01), SQ (B01), TP (B01), TU (B01), AF/KL (B02)
  - `Digit only`: BA

- **Create : Traveler's Contact details (SSR CTCR)** _(Input)_
  - Supported: AA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - `Reject if for all pax`: EK, LH, QF, UA
  - `Rejected if for all pax`: BA, IB
  - `to be clarified`: 6E, VY

- **Create : Traveler's Contact details (SSR CTCE - Email)** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Create : Traveler's Contact details (SSR CTCM - Mobile phone)** _(Output)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB, 6E
  - Not supported: VY
  - Note-qualified: AA (B09), EK (B09), LH (B09), QF (B09), UA (B09), BA (B11)

- **Create : Traveler's Contact details (SSR DOCO - Visa )** _(Input)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA
  - `Only stored in 1A PNR`: IB, 6E, VY

- **Create : Traveler's Contact details (SSR DOCS - Passeport )** _(Input)_
  - Supported: AA, EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - Note-qualified: UA (B06), BA (B12)
  - `Only stored in 1A PNR`: IB, 6E, VY

- **Create : Traveler's Contact details (SSR DOCA - Address )** _(Input)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - Not supported: 6E, VY
  - Note-qualified: BA (B08), IB (B08)

- **Create : Traveler's Frequent flyer** _(Input)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB, 6E
  - Not supported: VY
  - `Digit only`: BA

- **Create: Add other ancillary services than bag and seat (After OfferPrice)** _(Input)_
  - Supported: QF, UA, SM, AC, AI, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB, 6E, VY
  - Not supported: AA, EK, CX
  - Note-qualified: LH (A1)
  - `Free AAS only`: BA

- **Create: Add Bag (After OfferPrice)** _(Input)_
  - Supported: QF, UA, AF/KL, IB, 6E, VY
  - Not supported: AA, EK, AC, CX
  - Note-qualified: LH (A1), SM (A03), AI (A04), EY (A04), MH (A04), QR (A03), SV (A04), SQ (A02)
  - `Piece`: BR, AY, KQ, LO, SK, TP, TU
  - `Weigth`: NP
  - `Free AAS only`: BA

- **Create: Add Seat (After OfferPrice)** _(Input)_
  - Supported: AA, QF, UA, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB, 6E, VY
  - Not supported: EK
  - Note-qualified: LH (A1)
  - `Chargeable only`: SM
  - `Free AAS only`: BA

- **Tax breakdown** _(Output)_
  - Supported: AA, EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Not supported: UA

- **Free baggage allowance - type (checked and carry-on)** _(Output)_
  - Supported: AA, EK, LH, QF, 6E, VY
  - Not supported: UA
  - `Checked only`: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB

- **Free baggage allowance - details (quantity and size)** _(Output)_
  - Supported: AA, EK, LH, QF, UA, 6E, VY
  - `Quantity only`: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB

- **Coupon status** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - `to be clarified`: 6E, VY

- **Surcharges** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - `to be clarified`: 6E, VY

- **Commissions** _(Output)_
  - Supported: AA, QF
  - Not supported: EK, LH, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Price Guarantee Time Limit - PGTL (Last Date to Ticket - LD)** _(Output)_
  - Supported: EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, 6E, VY
  - Not supported: AA, UA, AF/KL, BA, IB

- **Payment Time Limit - PTL (Ticketing Time Limit - TTL)** _(Output)_
  - Supported: AA, EK, LH, QF, SM, AC, AI, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Not supported: CX
  - Note-qualified: UA (SD03)

- **Credit card fee amount** _(Output)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, QF, UA, AF/KL
  - `Tax (DU)`: BA
  - `No fees`: IB
  - Not documented (blank): 6E, VY

- **No show conditions** _(Output)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - Not supported: AA, EK, LH, QF, UA, BA, IB, 6E, VY

- **Cancel conditions** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Change conditions** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Fare type** _(Output)_
  - Supported: AA, EK, LH, QF, UA, BA, IB
  - Not supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, 6E, VY

- **Fare basis** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Display fare brand (fare family name)** _(Output)_
  - Supported: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - `to be clarified`: EK, LH, QF, 6E, VY

- **RBD** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Cabin** _(Output)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

### Payment (OrderPay)

#### Pay

- **Ticket stock (Airline stock: Issued by the airline - Neutral stock: Issued by a Ticketing System Provider (TSP))**
  - Not supported: 6E, VY
  - `Neutral stock`: AA, EK, LH, QF
  - `Airline stock`: UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - `to be clarified`: BA, IB

- **Payment with installments**
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB(SECO), 6E, VY
  - `BR`: IB(WBS)

- **Deferred payment**
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Payment of Same-day flights (within 24h and check-in window)**
  - Supported: LH, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, VY
  - Not supported: UA, 6E
  - Note-qualified: AA (SD01), EK (SD02), QF (SD01)

- **Payment with FOP Cash**
  - Supported: EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: VY
  - Note-qualified: UA (P01), 6E (P03)
  - `Except for seat`: AA

- **Payment with credit (Use retained credit)**
  - Supported: AA, UA
  - Not supported: EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **3DSv2 One step**
  - Supported: AF/KL(WBS only), BA(WBS only), IB(WBS only)
  - Not supported: AA, EK, LH, QF, UA, SM, AC(SECO), AI, CX, EY(SECO), BR, AY(SECO), KQ(SECO), LO(SECO), MH, NP, QR(SECO), SV, SK(SECO), SQ(SECO), TP(SECO), TU(SECO), AF/KL(SECO), BA(SECO), IB(SECO), 6E, VY
  - Note-qualified: AC(WBS) (P06), EY(WBS) (P06), AY(WBS) (P06), KQ(WBS) (P06), LO(WBS) (P06), QR(WBS) (P06), SK(WBS) (P06), SQ(WBS) (P06), TP(WBS) (P06), TU(WBS) (P06)

- **Payment with lodge card**
  - Not supported: SM, KQ
  - Not documented (blank): AA, EK, LH, QF, UA, AC, AI, CX, EY, BR, AY, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Payment with FOP Credit card**
  - Supported: AA, EK, LH, QF, UA, AC, AI, CX, EY, AY, LO, NP, QR, SK, SQ, TP, TU, AF/KL, IB, 6E, VY
  - Not supported: SM, BR, KQ, MH
  - Note-qualified: BA (P04)
  - `on-going`: SV

- **Card holder name** _(Input)_
  - Supported: AA, UA, AC, BA, 6E, VY
  - Not supported: SM, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - `to be clarified`: EK, LH, QF, AF/KL, IB

- **Card holder postal address** _(Input)_
  - Supported: AA, EK, AC, BA, VY
  - Not supported: SM, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, 6E
  - Note-qualified: UA (P08)
  - `to be clarified`: LH, QF, AF/KL, IB

- **Card holder email address** _(Input)_
  - Not documented (blank): AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Credit card number and expiry date** _(Input)_
  - Supported: AA, EK, LH, QF, UA, AC, AF/KL, BA, IB
  - Not supported: SM, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - `to be clarified`: 6E, VY

- **CVV required for payment with credit card** _(Input)_
  - Supported: BA, IB, 6E
  - Not supported: AA, EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, VY
  - Note-qualified: UA (P09)

- **Visa (VI)** _(Input)_
  - Supported: AA, EK, LH, QF, UA, AC, AI, CX, EY, AY, LO, NP, QR, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Not supported: SM, BR, KQ, MH, SV

- **Master Card (CA)** _(Input)_
  - Supported: AA, EK, LH, QF, UA, AC, AI, CX, EY, AY, LO, NP, QR, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Not supported: SM, BR, KQ, MH, SV

- **American Express (AX)** _(Input)_
  - Supported: AA, EK, LH, QF, UA, AC, AI, CX, EY, AY, LO, NP, QR, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Not supported: SM, BR, KQ, MH, SV

- **Diners Club (DC)** _(Input)_
  - Supported: AA, EK, LH, QF, UA, AC, AI, EY, AY, LO, QR, SK, SQ, TP, AF/KL, BA, IB, 6E
  - Not supported: SM, CX, BR, KQ, MH, NP, SV, TU, VY

- **Discover (DS)** _(Input)_
  - Supported: AA, QF, UA, AI, EY, QR, SK, TP, AF/KL, BA
  - Not supported: EK, LH, SM, AC, CX, BR, AY, KQ, LO, MH, NP, SV, SQ, TU, IB, 6E, VY

- **JCB (JC)** _(Input)_
  - Supported: QF, UA, AI, CX, EY, SK, TP, AF/KL
  - Not supported: AA, EK, LH, SM, AC, BR, AY, KQ, LO, MH, NP, QR, SV, SQ, TU, BA, IB, 6E, VY

- **Airplus UATP (TP)** _(Input)_
  - Supported: AA, EK, LH, QF, UA, AC, AI, CX, EY, AY, QR, SK, SQ, TP, AF/KL, BA, IB
  - Not supported: SM, BR, KQ, LO, MH, NP, SV, TU, 6E, VY

- **IATA Easy Pay (EP)** _(Input)_
  - Supported: EY, AY, LO, SQ, TU, AF/KL
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, BR, KQ, MH, NP, QR, SV, SK, TP, BA, IB, 6E, VY

- **Reporting: ARC**
  - Supported: AA, EK, LH, QF, UA, AC, EY, BR, AY, LO, QR, SK, SQ, TP
  - Not supported: SM, AI, CX, KQ, MH, NP, SV, TU, 6E, VY
  - Note-qualified: AF/KL (P5), BA (P5), IB (P5)

- **Reporting: BSP**
  - Supported: AA, EK, LH, QF, SM, AI, EY, BR, AY, LO, MH, SV, SK, TP, TU, AF/KL, BA, IB
  - Not supported: KQ, NP, 6E, VY
  - Note-qualified: UA (P07)
  - `Canada only`: AC
  - `Sales closure = HKG time zone`: CX
  - `Sales closure = 1am GMT`: QR
  - `Sales closure = Midnight POS`: SQ

- **Reporting: Direct reporting**
  - Supported: UA, KQ, LO, QR, BA, IB
  - Not supported: AA, EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, MH, NP, SV, SK, TP, TU, AF/KL, 6E, VY
  - `Non BSP markets only`: SQ

- **Payment Time Limit Zone**
  - `Local POS`: AA, EK, LH, QF, UA
  - `GMT`: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

### Update (OrderReshop, OrderChange)

#### Update

- **Schedule driven exchange**
  - Supported: EK, LH, QF
  - Not supported: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Fare driven exchange**
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB
  - Not supported: 6E, VY
  - `Max 2 bounds`: BA

- **Voluntary change : Date / Time** _(Before payment)_
  - Supported: AI, CX, EY, AY, LO, QR, SV, SQ, TU, AF/KL
  - Not supported: AA, EK, UA, SM, AC, BR, KQ, MH, NP, SK, TP, BA, IB, 6E, VY
  - Not documented (blank): LH, QF

- **Voluntary change : Itinerary (Modify unpaid order)** _(Before payment)_
  - Supported: AA, QF, UA, AI, CX, EY, AY, LO, QR, SV, SQ, TU, AF/KL
  - Not supported: EK, LH, SM, AC, BR, KQ, MH, NP, SK, TP, BA, IB, 6E, VY

- **Voluntary change : Automatic Reprice** _(Before payment)_
  - Not supported: AA, UA, AF/KL, IB, 6E, VY
  - Note-qualified: EK (PB01), LH (PB01), QF (PB01), SM (PB01), AC (PB01), AI (PB01), CX (PB01), EY (PB01), BR (PB01), AY (PB01), KQ (PB01), LO (PB01), MH (PB01), NP (PB01), QR (PB01), SV (PB01), SK (PB01), SQ (PB01), TP (PB01), TU (PB01), BA (PB01)

- **Voluntary change : Voluntary Reprice** _(Before payment)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, QF, UA, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Voluntary Reprice with change of BIN/FOP** _(Before payment)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, QF, UA, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Voluntary Reprice (Add/Modify Promocode)** _(Before payment)_
  - Supported: EY, AY, LO, QR, SQ
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, BR, KQ, MH, NP, SV, SK, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Voluntary Reprice (Add/Modify CLID)** _(Before payment)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Voluntary Reprice (Add/Modify Corpocode)** _(Before payment)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, QF, UA, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Add Bag** _(Before payment)_
  - Not supported: AC, CX
  - Note-qualified: SM (A03), AI (A04), EY (A04), MH (A04), QR (A03), SV (A04), SQ (A02)
  - `to be clarified`: AA, EK, LH, QF, UA, AF/KL, BA, IB, 6E, VY
  - `Piece`: BR, AY, KQ, LO, SK, TP, TU
  - `Weigth`: NP

- **Voluntary change : Add Seat** _(Before payment)_
  - Supported: AA, EK, LH, QF, UA, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, VY
  - Not supported: IB, 6E
  - `Chargeable only`: SM

- **Voluntary change : Add free services** _(Before payment)_
  - Supported: AA, SM, AC, AI, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA
  - Not supported: EK, LH, QF, UA, CX, IB, 6E, VY

- **Voluntary change : Add other chargeable ancillary services** _(Before payment)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, VY
  - Not supported: IB, 6E

- **Voluntary change : Traveler's Name** _(Before payment)_
  - Supported: CX, LO, TP, AF/KL
  - Not supported: EK, LH, QF, UA, SM, AC, AI, EY, BR, AY, KQ, MH, NP, QR, SV, SK, SQ, TU, BA, IB, 6E, VY
  - Note-qualified: AA (PB04)

- **Voluntary change : Traveler's Contact details (delete + add)** _(Before payment)_
  - Supported: AA, EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: UA, 6E, VY

- **Voluntary change : Traveler's Frequent flyer** _(Before payment)_
  - Supported: AA, EK, LH, QF, UA, BA, IB
  - Not supported: 6E, VY
  - Note-qualified: SM (PB03), AC (PB03), AI (PB03), CX (PB03), EY (PB03), BR (PB03), AY (PB03), KQ (PB03), LO (PB03), MH (PB03), NP (PB03), QR (PB03), SV (PB03), SK (PB03), SQ (PB03), TP (PB03), TU (PB03), AF/KL (PB05)

- **Voluntary change : Traveler's Passport details delete + add)** _(Before payment)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - `to be clarified`: AF/KL, BA, IB, 6E, VY

- **Voluntary change : Number of traveler (Split)** _(Before payment)_
  - Supported: AA, EK, QF
  - Not supported: LH, UA
  - `1 passenger`: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - `to be clarified`: AF/KL, BA, IB, 6E, VY

- **Voluntary change : Remarks** _(Before payment)_
  - Supported: AA, UA, AF/KL, BA, IB
  - Not supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, 6E, VY
  - `to be clarified`: EK, LH, QF

- **Queuing of voluntary change done with the airline: Traveler's Name** _(Airline updates)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - Not supported: AA, EK, LH, QF, UA, IB, 6E
  - Note-qualified: BA (I01)
  - `to be clarified`: VY

- **Queuing of voluntary change done with the airline: Contact details** _(Airline updates)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, QF, UA, AF/KL, IB, 6E
  - Note-qualified: BA (I01)
  - `to be clarified`: VY

- **Queuing of voluntary change done with the airline: Travel documents** _(Airline updates)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, QF, UA, AF/KL, BA, IB, 6E
  - `to be clarified`: VY

- **Queuing of voluntary change done with the airline: Flights** _(Airline updates)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Note-qualified: AA (I01), EK (I01), LH (I01), QF (I01), UA (I01), BA (I01), IB (I01), 6E (I01), VY (I01)
  - Not documented (blank): AF/KL

- **Queuing of voluntary change done with the airline: Ancillary services** _(Airline updates)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - Note-qualified: AA (I01), EK (I01), LH (I01), QF (I01), UA (I01), BA (I01), IB (I01), 6E (I01), VY (I01)

- **Voluntary change : Date / Time** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Voluntary change : Time only (No change from original date)** _(Exchange)_
  - Supported: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: 6E, VY
  - `to be clarified`: EK, LH, QF, AF/KL, BA, IB

- **Voluntary change : Class / Cabin** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: 6E, VY
  - `Same or higher`: AF/KL, BA, IB

- **Voluntary change : Itinerary before departure** _(Exchange)_
  - Supported: AA, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: LH, BA, 6E, VY
  - Note-qualified: AF/KL (E04)
  - `Update required by airline`: EK
  - `Planned for 26.2`: IB

- **Voluntary change : Itinerary partially flown** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB
  - Not supported: 6E, VY
  - `Only 1 time`: BA

- **Voluntary change : Exchange with credit (Reuse credit)** _(Exchange)_
  - Supported: AA, QF, UA
  - Not supported: EK, LH, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Exchange (Instant payment)** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Voluntary change : Exchange (Deferred payment)** _(Exchange)_
  - Supported: QF(WBS only)
  - Not supported: AA, EK, LH, QF(SECO), UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Exchange with infant (Date of birth for infant only)** _(Exchange)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: AA, UA, 6E, VY
  - `to be clarified`: EK, LH, QF

- **Voluntary change : Exchange with corpo code** _(Exchange)_
  - Supported: AA, LH, QF, UA
  - Not supported: EK, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Exchange with waiver code** _(Exchange)_
  - Supported: QF
  - Not supported: AA, EK, LH, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Retain services on unchanged flights** _(Exchange)_
  - Supported: AA, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA
  - Not supported: IB, 6E, VY
  - Note-qualified: EK (E06), LH (E06)

- **Voluntary change: Ancillary services rebooked by the airline on the new flights** _(Exchange)_
  - Supported: BA
  - Not supported: IB, 6E, VY
  - Note-qualified: AA (E07), EK (E07), LH (E07), QF (E07), UA (E07), SM (E07), AC (E07), AI (E07), CX (E07), EY (E07), BR (E07), AY (E07), KQ (E07), LO (E07), MH (E07), NP (E07), QR (E07), SV (E07), SK (E07), SQ (E07), TP (E07), TU (E07), AF/KL (E07)

- **Voluntary change : Add new Bag** _(Post payment)_
  - Not supported: AC, CX
  - Note-qualified: SM (A03), AI (A04), EY (A04), MH (A04), QR (A03), SV (A04), SQ (A02)
  - `to be clarified`: AA, EK, LH, QF, UA, AF/KL, BA, IB, 6E, VY
  - `Piece`: BR, AY, KQ, LO, SK, TP, TU
  - `Weigth`: NP

- **Voluntary change : Add new Seat** _(Post payment)_
  - Supported: AC, AI, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: CX, 6E, VY
  - `to be clarified`: AA, EK, LH, QF, UA
  - `Chargeable only`: SM

- **Voluntary change : Add new other ancillary services than bag and seat** _(Post payment)_
  - Supported: SM, AC, AI, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, VY
  - Not supported: AA, UA, CX, 6E
  - `to be clarified`: EK, LH, QF

- **Voluntary change : Exchange Ancillary services** _(Exchange)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Exchange Seat** _(Exchange)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Auto refund of residual value** _(Exchange)_
  - Supported: AC, CX, KQ, MH, SV, SK, SQ, BA
  - Not supported: AA, EK, LH, QF, UA, SM, AI, EY, BR, LO, NP, QR, TP, TU, AF/KL, IB, 6E, VY
  - `to be clarified`: AY

- **Voluntary change : Exchange of exchange** _(Exchange)_
  - Supported: UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY
  - `Up to 3`: AA, EK, LH
  - `Up to 6`: QF

- **Reshop Input: Account code / Corporate code** _(Exchange)_
  - Supported: QF
  - Not supported: AA, EK, LH, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Reshop input: Cabin option** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Reshop Output: Global netting** _(Exchange)_
  - Supported: QF, AF/KL, BA, IB
  - Not supported: 6E, VY
  - `No netting`: AA, EK, LH, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU

- **Reshop Output: Upsell proposals** _(Exchange)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Reshop Output: Fare conditions** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - Not supported: 6E, VY
  - `At pricing only`: BA, IB

- **Reshop Output: FBA (Free baggage allowance)** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: 6E, VY
  - `At pricing only`: AF/KL, BA, IB

- **Reshop Output: Cabin name** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: 6E, VY

- **Reshop Output: Cabin code** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, BA, IB
  - Not supported: 6E, VY
  - `At pricing only`: AF/KL

- **Reshop Output: Fare type information** _(Exchange)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not supported: AA, EK, LH, QF, UA, 6E, VY

- **Voluntary change : Traveler's Name (After issuance)** _(Exchange)_
  - Supported: AA, AF/KL
  - Not supported: EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, BA, IB, 6E, VY

- **Voluntary change : Traveler's Contact details  (After issuance)** _(Exchange)_
  - Supported: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: EK, LH, QF, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Traveler's Frequent flyer (After issuance)** _(Exchange)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AF/KL, BA, IB, 6E, VY

- **Voluntary change : Traveler's Passport details (After issuance)** _(Exchange)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary change : Number of traveler (Split) (After issuance)** _(Exchange)_
  - Supported: AA, EK, QF, AF/KL, BA
  - Not supported: LH, UA, IB, 6E, VY
  - `1 passenger`: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU

### Cancel (OrderCancel)

#### Cancel

- **Voluntary cancel : Full itinerary** _(Before payment)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary cancel : Part of the itinerary** _(Before payment)_
  - Supported: VY
  - Not supported: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, 6E
  - `to be clarified`: EK, LH, QF, AF/KL, BA, IB

- **Voluntary cancel : Ancillary services** _(Before payment)_
  - Supported: VY
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E

- **Voluntary cancel : Seat** _(Before payment)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary cancel : Full itinerary (Void)** _(Post payment)_
  - Supported: AA, EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, IB
  - Not supported: 6E
  - Note-qualified: UA (C01), BA (C03), VY (C07)
  - `no amount returned`: AF/KL

- **Voluntary cancel : Full itinerary (Refund)** _(Post payment)_
  - Supported: AA, EK, LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB, 6E
  - Note-qualified: UA (C04/C16), BA (C09), VY (C06)

- **Voluntary cancel : Partially flown (Refund)** _(Post payment)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, 6E
  - Not supported: IB, VY
  - Note-qualified: BA (C09)

- **Voluntary cancel : Retain credit** _(Post payment)_
  - Supported: AA, QF, UA, AC, AY, QR, SK, SQ
  - Not supported: EK, LH, SM, AI, CX, EY, BR, KQ, LO, MH, NP, SV, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary cancel : Exchanged tickets (Void)** _(Post payment)_
  - Not supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Note-qualified: AA (C09), QF (C09), UA (C09)
  - `Rejected by 1A`: EK, LH

- **Voluntary cancel : Exchanged tickets (Refund)** _(Post payment)_
  - Supported: AA, QF, UA, AC, CX, EY, AY, LO, MH, QR, SV, SQ, AF/KL
  - Not supported: IB, 6E, VY
  - Note-qualified: EK (C14), LH (C14), SM (C11), AI (C11), BR (C11), KQ (C11), NP (C11), SK (C11), TP (C11), TU (C11), BA (C05)

- **Voluntary cancel : Ancillary services only (Void)** _(Post payment)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Voluntary cancel : Ancillary services only (Refund)** _(Post payment)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

### Involuntary changes and queue synchro

#### Invol. Update

- **Automatic synchro: Cancelation for PTL reached.** _(Airline updates)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Note-qualified: AA (I01), EK (I01), LH (I01), QF (I01), UA (I01)

- **Automatic synchro: Cancelation for fake or duplicate name.** _(Airline updates)_
  - Supported: AF/KL, BA
  - Not supported: IB, 6E, VY
  - Note-qualified: AA (I01), EK (I01), LH (I01), QF (I01), UA (I01), SM (I01), AC (I01), AI (I01), CX (I01), EY (I01), BR (I01), AY (I01), KQ (I01), LO (I01), MH (I01), NP (I01), QR (I01), SV (I01), SK (I01), SQ (I01), TP (I01), TU (I01)

- **Acceptance after involuntary change** _(Before payment)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, IB, 6E
  - `to be clarified`: BA, VY

- **Manual synchronisation of flights and chargeable services** _(Airline updates)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Manual synchronisation of tickets** _(Airline updates)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB
  - Not documented (blank): 6E, VY

- **Manual synchronisation of EMD** _(Airline updates)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - Not supported: AA, EK, LH, QF, UA, BA, IB, 6E
  - Not documented (blank): VY

- **Automatic synchro: flight time change. Q7C257 - REA2** _(Airline updates)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Automatic synchro: schedule (time, flight routing) change. Q7C257 - REA1** _(Airline updates)_
  - Supported: AA, EK, LH, QF, UA, SM, AI, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY
  - Note-qualified: AC (E07), CX (E07), EY (E07)

- **Automatic synchro: flight cancelation. Q7C257 - REA3** _(Airline updates)_
  - Supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, IB, 6E, VY

- **Automatic synchronisation after NO SHOW. Q1C261 - REA113** _(Airline updates)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, QF, UA, VY
  - Note-qualified: AF/KL (I01), BA (I01), IB (I01), 6E (I01)

- **Acceptance after involuntary change** _(Post payment)_
  - Supported: LH, QF, UA, SM, AC, AI, CX, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL
  - Not supported: EK, IB, 6E, VY
  - Note-qualified: EY (I10), BA (I02)
  - `With waiver code`: AA

- **Exchange after involuntary change** _(Post payment)_
  - Supported: LH, UA, AC, AI, CX, AY, LO, SV, SK, SQ, BA, IB
  - Not supported: EK, 6E, VY
  - Note-qualified: SM (I11), EY (I11), BR (I11), KQ (I11), MH (I11), NP (I11), QR (I11), TP (I11), TU (I11), AF/KL (I14)
  - `With waiver code`: AA, QF

- **Cancelation after involuntary change** _(Post payment)_
  - Supported: UA, QR, SV, SQ, AF/KL, BA
  - Not supported: AC, AI, IB, 6E, VY
  - Note-qualified: AA (I12), EK (I12), LH (I12), QF (I12), SM (I12), CX (I12), EY (I12), BR (I12), AY (I12), KQ (I12), LO (I12), MH (I12), NP (I12), SK (I12), TP (I12), TU (I12)

### Market specific

#### Market specific

- **LATAM Tax/Fiscal ID - AR, BO, BZ, CO, CR, HN, GT, NI, PE, SV, VE** _(Input)_
  - Supported: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: EK, LH, QF, AF/KL, BA, 6E, VY
  - `Except INF`: IB

- **LATAM Tax/Fiscal ID - Ecuador** _(Input)_
  - Supported: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: AA, EK, LH, QF, UA, AF/KL, BA, IB, 6E, VY

- **Indian GST, for flights from/to India** _(Input)_
  - Supported: LH, QF, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, VY
  - Not supported: AA, EK, UA, IB
  - Note-qualified: 6E (M06)

- **UK youth tax discount, for flight departing from UK (CHD, CNN, INF, INS)** _(Input)_
  - Supported: LH, QF, VY
  - Not supported: AA, EK, UA, IB, 6E
  - `OK CHD or Bxx / KO for Cxx`: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - `OK CHD / KO Cxx or Bxx`: AF/KL
  - `PTC C12-C15`: BA

- **Spanish resident information (Spanish domestic market only)** _(Input)_
  - Not supported: AA, EK, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU, AF/KL, BA, 6E
  - Note-qualified: IB (M03), VY (M04)

- **US DoT mandate: Display operating carrier info** _(Input)_
  - Supported: AA, LH, QF, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - Not supported: 6E
  - `to be clarified`: EK, BA, IB, VY
  - `At shopping & pricing only`: AF/KL

- **Resident San Andres Island special discount** _(Input)_
  - Not supported: AA, UA
  - `to be clarified`: EK, LH, QF, AF/KL, BA, IB, 6E, VY
  - `1 with PTC STR`: SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU

- **Manual Approval Code (MAC) for CC payment Ecuador and Colombia** _(Input)_
  - Not supported: AA, UA, SM, AC, AI, CX, EY, BR, AY, KQ, LO, MH, NP, QR, SV, SK, SQ, TP, TU
  - `to be clarified`: EK, LH, QF, AF/KL, BA, IB, 6E, VY

## Notes referenced

Note texts are from the `Active notes` sheet. Refs marked (archived) resolve only in the `Archived notes` sheet; refs marked (unresolved) appear in the matrix but in neither notes sheet.

| Ref | Source | Text |
|---|---|---|
| A02 | active | Piece and weight concept, depends on routes. Please check airline policy https://www.singaporeair.com/en_UK/gr/travel-info/baggage/checked-baggage/ |
| A03 | active | piece and weight concepts, depends on routes |
| A04 | active | piece and weight concepts, depends on routes. Only piece is supported |
| A1 | active | Confirmation received <2s after booking (matrix writes `A1`) |
| B01 | active | Max 1 phone/email per pax (can be 1 phone + 1 mail) |
| B02 | active | Passenger email is mandatory if contact is shared |
| B06 | active | Passport information not stored in UA PNR |
| B08 | active | only address at origin considered, destination ignored |
| B09 | active | No label and country dialing code |
| B11 | active | Country dialing code concatenated with phone number |
| B12 | active | Residence and citizenship country codes, birthdate and gender are mandatory |
| C01 | active | VOID period until 6am GMT the next day |
| C03 | active | VOID is not available for split orders. If an order has been split please contact BA service desk. |
| C04 | active | Residual value returned as Future flight credit; TA needs to access airline.com to benefit from it. |
| C05 | active | For codeshare flights, if a refund transaction fails, contact the operating airline for assistance. |
| C06 | active | Cancellation is supported by airline but reimbursement is subject to airline's rules |
| C07 | active | Vueling offers a 2‑hour cancellation window after ticket issuance. Once cancelled via NDC API, airline to be contacted for full refund. |
| C09 | active | Ancillaries will be refunded, seats will be refunded if canceled within 24 hours from issuance |
| C11 | active | In case of reissuance, refund is possible only for exchange with additional collection |
| C14 | active | Cancellation of partially flown exchanged orders not supported by airline. SPRK needed |
| C16 | active | Refund of taxes on order with non-refundable fares must be requested through BSPLink or IAR (ARC) |
| D05 | active | Golite not supported. The airline only works with IATA numbers. |
| D07 | active | Delegation possible within the same agency. Airline to be contacted for set-up. |
| D08 | active | Agent should contact the airline to set-up the delegation flows on top of EOS agreements between Amadeus OIDs as ultimately airlines have their own security layer to control activity at IATA number |
| E04 | active | One way cannot become Round trip or Open jaw |
| E06 | active | Airline to be contacted, services not returned in NDC APIs by airline |
| E07 | active | Airline to be contacted to reassign the ancillary services to the new flights. |
| I01 | active | Manual synchronization only |
| I02 | active | Acceptance is supported but when this is a minor change, BA rejects the accept. ERK is recommended to update Amadeus PNR. |
| I10 | archived | Airline should be contacted for services post disruption. |
| I11 | active | Exchange possible but penalties are not waived via TP. Airline to be contacted. |
| I12 | active | Cancel possible but penalties are not waived via 1A TP. Airline to be contacted or cancellation to be done via BSP Link |
| I14 | active | One exchange is authorized for free by the airline. Penalties might apply for more than one exchange. |
| M03 | active | Travel_OrderViewRS from version 1.8 |
| M04 | archived | verification status is not sent back from the provider, and thus the Travel Order PNR will always display NOVERIFICADO. Travellers will be able to verify their status on https://tickets.vueling.com/CheckResident.aspx |
| M06 | active | Indian GST is applied at booking level. It is not possible to specify diferent GST info per pax |
| P01 | active | Only for Europe, Middle East, Africa and United States points of sale. |
| P03 | active | Sales in cash will not be reported in the AIR, in the MBO and in the sales report, as the reconciliation with the ABR file agents will receive from IATA. |
| P04 | active | CC is not accepted in some LATAM countries - please check with the airline. |
| P06 | active | At payment with WBS, AuthenticationTokenValue and DirectoryServerTrxID need to be base64 encoded |
| P07 | active | EMDs are not reported to BSP |
| P08 | active | -Billing Address is mandatory for payment with AMEX and from MX point of sale - For other location, billing Address is not mandatory but highly recommended |
| P09 | active | Not required but highly recommended |
| P5 | active | Reporting is done via BSP who send a RET to ARC (matrix writes `P5`) |
| PB01 | active | Repricing not exposed to Travel Sellers, it is trigger at payment when Price Guarantee Time Limit is reach. |
| PB03 | active | Only Add frequent Flyer is supported by the airline |
| PB04 | active | Reference of Original payment used during booking needs to be sent in the request, Waiver code required in input for Name update of paid AA orders |
| PB05 | active | The airline allow the modification of an existing FQTV number but not adding a new one |
| S01 | active | Supported PTC: ADT, CHD/CNN, C15 |
| S02 | active | Possible values are: ADT, B15, BNN, C15, CHD, CMA, CMP, DIS, EMI, FFY, HOF, IIT, INF, INN, INS, ITF, ITS, ITX, JCB, JNF, JNN, JNS, LBR, LIF, LNN, MED, MIC, MIF, MIL, MIS, OFW, SEA, SPS, SNN, SRC, STR, STU, TUR, VFR, YSB, YTH. |
| S03 | active | PTC supported: ADT, SRS, YTH, CHD/CNN, C15, INS, INF |
| S05 | active | Option not supported by the airline, post filtering is applied |
| S06 | active | For seaman fares, name of cruise, pork of embarkment date time or vessel name, next port must be sent offline to SQ assistance |
| S07 | active | If an infant (INF) is included in the booking, exchanges are not permitted due to airline (AA) restrictions. |
| S13 | active | Only first corporate code is taken by ANDC for content search |
| S14 | active | Upsells are available but without displaying the baggage allowance (airline limitation) |
| S18 | active | Only 1 corporate code. Should be associated to the airline. |
| S22 | active | only one frequent flyer number per passenger is supported by Amadeus Travel Platform for a given airline; In case of multiple frequent flyer numbers of a given airline per passenger provided at shopping, they are ignored. |
| S22bis | active | only one frequent flyer number per passenger is supported by Amadeus Travel Platform for a given airline; In case of multiple frequent flyer numbers of a given airline per passenger provided at shopping, they are ignored. (matrix writes `S22bis`) |
| SD01 | active | Payment Time Limit is reduced by the airline |
| SD02 | archived | OrderCreate is blocked by the airline. |
| SD03 | active | Sellers can now create book and hold PNR’s within 25 hours of departure |
| s09 | active | AY negotiated fares: TMC, Student, Seat Only, Marine, Tour operator, Visit Home (matrix writes `s09`) |
