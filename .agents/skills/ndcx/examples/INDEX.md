# NDC[X] XML sample index

> Source: the two sample packs shipped with the Amadeus NDC[X] implementation
> guides. These are **real request/response pairs** captured against the Amadeus
> test environment, and they are the authoritative shape reference — several
> request bodies exist in the guides only as screenshots, so when a `references/`
> file says `(diagram in source: ...)`, look here for the actual XML.

## Conventions applied by the build

- WS-Security `Username`, `Nonce`, `Password` digests, `SecurityToken` and
  `PseudoCityCode`/`OfficeId` are replaced with placeholders.
- XML is re-indented. Filenames are normalised; GMT timestamps stripped.
- Files that were larger than ~90 KB have had repeating elements
  (recommendations, offers, seat rows, service definitions) reduced to 3.
  Those files carry a `<!-- TRIMMED FOR SIZE -->` comment on line 1. Structure is
  intact; **do not treat the counts as representative**.
- The endpoint in `wsa:To` is the test node the capture was made against.

## Prime booking, refunds and voids (`examples/prime-booking/`)

### `AA-Prime-Booking-ProfileID-Transfer/`

Original scenario name: *AA _Prime Booking_ProfileID Transfer* — 11 XML message(s), 1 trimmed.

- `1-Fare-MasterPricerTravelBoardSearch-request--1.xml` — 2 KB *(trimmed; message 1 of 2 in one capture)*
- `1-Fare-MasterPricerTravelBoardSearch-request--2.xml` — 2 KB *(message 2 of 2 in one capture)*
- `1-Fare-MasterPricerTravelBoardSearchReply-response.xml` — 30 KB *(trimmed)*
- `2-OfferPriceRequest.xml` — 2 KB
- `2-OfferPriceResponse.xml` — 28 KB
- `3-OrderCreateRequest.xml` — 3 KB
- `3-OrderCreateResponse.xml` — 32 KB
- `4-OrderPayRequest.xml` — 2 KB
- `4-OrderPayResponse.xml` — 36 KB
- `5-OrderRetrieveRequest.xml` — 1 KB
- `5-OrderRetrieveResponse.xml` — 36 KB
- `PNR-offline-with-profile-transfer-remarks.txt` — 2 KB *(cryptic view / notes)*

### `AF-OIN-BLUEBIZ/`

Original scenario name: *AF_OIN_BLUEBIZ* — 6 XML message(s), 1 trimmed.

- `0---Read-Me-First.txt` — 1 KB *(cryptic view / notes)*
- `1-Query-Fare-MasterPricerTravelBoardSearch-23-1.xml` — 5 KB
- `1-Reply-Fare-MasterPricerTravelBoardSearch-23-1.xml` — 48 KB *(trimmed)*
- `2-Query-Travel-OfferPrice.xml` — 2 KB
- `2-Reply-Travel-OfferPrice.xml` — 51 KB
- `3-Query-Travel-OrderCreate.xml` — 3 KB
- `3-Reply-Travel-OrderCreate.xml` — 46 KB

### `AF-Public-SAF-Bundle/`

Original scenario name: *AF_Public SAF Bundle* — 12 XML message(s), 4 trimmed.

- `0---Cryptic-View.txt` — 7 KB *(cryptic view / notes)*
- `1-Query-Fare-MasterPricerTravelBoardSearch-23-2.xml` — 4 KB
- `1-Reply-Fare-MasterPricerTravelBoardSearch-23-2.xml` — 46 KB *(trimmed)*
- `2-Query-Travel-OfferPrice.xml` — 3 KB
- `2-Reply-Travel-OfferPrice.xml` — 54 KB
- `3-Query-Travel-OrderCreate.xml` — 5 KB
- `3-Reply-Travel-OrderCreate.xml` — 46 KB *(trimmed)*
- `4-Query-Travel-OrderPay.xml` — 2 KB
- `4-Reply-Travel-OrderPay.xml` — 52 KB *(trimmed)*
- `5-Query-Travel-OrderRetrieve.xml` — 2 KB
- `5-Reply-Travel-OrderRetrieve.xml` — 54 KB *(trimmed)*
- `6-Query-PNR-Retrieve-21-1.xml` — 1 KB
- `6-Reply-PNR-Retrieve-21-1.xml` — 41 KB

### `AF-Subscriber-Card/`

Original scenario name: *AF_Subscriber Card* — 16 XML message(s), 1 trimmed.

- `0---Read-Me-First.txt` — 1 KB *(cryptic view / notes)*
- `01.Fare-MasterPricerTravelBoardSearch.q.xml` — 4 KB
- `01.Fare-MasterPricerTravelBoardSearch.r.xml` — 14 KB *(trimmed)*
- `02.Travel-OfferPrice.q.xml` — 2 KB
- `02.Travel-OfferPrice.r.xml` — 15 KB
- `03.Travel-OrderCreate.q.xml` — 3 KB
- `03.Travel-OrderCreate.r.xml` — 23 KB
- `04.Travel-OrderPay.q.xml` — 2 KB
- `04.Travel-OrderPay.r.xml` — 20 KB
- `05.Travel-OrderRetrieve.q.xml` — 2 KB
- `05.Travel-OrderRetrieve.r.xml` — 22 KB
- `06.PNR-Retrieve.q.xml` — 1 KB
- `06.PNR-Retrieve.r.xml` — 1 KB
- `07.Travel-OrderReshop.q.xml` — 2 KB
- `07.Travel-OrderReshop.r.xml` — 1 KB
- `08.Travel-OrderCancel.q.xml` — 1 KB
- `08.Travel-OrderCancel.r.xml` — 1 KB

### `AV-2-ADT-1-CHD-Fiscal-Code/`

Original scenario name: *AV_2 ADT _1 CHD_Fiscal Code* — 20 XML message(s).

- `1-MPTB--1.xml` — 3 KB *(message 1 of 2 in one capture)*
- `1-MPTB--2.xml` — 34 KB *(trimmed; message 2 of 2 in one capture)*
- `10-OrderCancel-VOID--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `10-OrderCancel-VOID--2.xml` — 1 KB *(message 2 of 2 in one capture)*
- `2-OfferPrice--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `2-OfferPrice--2.xml` — 42 KB *(message 2 of 2 in one capture)*
- `3-OrderCreate--1.xml` — 4 KB *(message 1 of 2 in one capture)*
- `3-OrderCreate--2.xml` — 79 KB *(message 2 of 2 in one capture)*
- `4-OrderRetrieve--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `4-OrderRetrieve--2.xml` — 79 KB *(message 2 of 2 in one capture)*
- `5-PNR-Retrieve--1.xml` — 1 KB *(trimmed; message 1 of 2 in one capture)*
- `5-PNR-Retrieve--2.xml` — 23 KB *(message 2 of 2 in one capture)*
- `6-OrderPay-with-Cash--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `6-OrderPay-with-Cash--2.xml` — 48 KB *(trimmed; message 2 of 2 in one capture)*
- `7-OrderRetrieve-After-Payment--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `7-OrderRetrieve-After-Payment--2.xml` — 49 KB *(trimmed; message 2 of 2 in one capture)*
- `8-PNR-Retrieve-After-Payment--1.xml` — 1 KB *(trimmed; message 1 of 2 in one capture)*
- `8-PNR-Retrieve-After-Payment--2.xml` — 26 KB *(message 2 of 2 in one capture)*
- `9-OrderReshop--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `9-OrderReshop--2.xml` — 3 KB *(message 2 of 2 in one capture)*

### `AY-Booking-With-Profile-Transfer/`

Original scenario name: *AY_Booking With Profile Transfer* — 22 XML message(s).

- `1-Query-Fare-MasterPricerTravelBoardSearch.xml` — 3 KB
- `1-Reply-Fare-MasterPricerTravelBoardSearch.xml` — 55 KB
- `10-Query-Travel-OrderPay.xml` — 2 KB
- `10-Reply-Travel-OrderPay.xml` — 41 KB
- `11-Query-Travel-OrderRetrieve.xml` — 2 KB
- `11-Reply-Travel-OrderRetrieve.xml` — 42 KB
- `2-Query-Travel-OfferPrice.xml` — 2 KB
- `2-Reply-Travel-OfferPrice.xml` — 31 KB
- `3-Query-Travel-OrderCreate.xml` — 3 KB
- `3-Reply-Travel-OrderCreate.xml` — 40 KB
- `4-Query-PNR-Retrieve.xml` — 1 KB
- `4-Reply-PNR-Retrieve.xml` — 17 KB
- `5--Command-Cryptic-Profile-DisplayRQ.xml` — 1 KB
- `5-Command-Cryprtic-Profile-DisplayRS.xml` — 1 KB
- `6-Command-Cryptic-FP-transferRQ.xml` — 1 KB
- `6-Command-Cryptic-FP-transferRS.xml` — 1 KB
- `7-Query-PNR-AddMultiElements.xml` — 1 KB
- `7-Reply-PNR-AddMultiElements.xml` — 18 KB
- `8-Query-Security-SignOut.xml` — 1 KB
- `8-Reply-Security-SignOut.xml` — 1 KB
- `9-Query-Travel-OrderRetrieve.xml` — 2 KB
- `9-Reply-Travel-OrderRetrieve.xml` — 40 KB

### `BA-Redress-Passport-CC-Pymt/`

Original scenario name: *BA_Redress_Passport_CC Pymt* — 10 XML message(s), 2 trimmed.

- `0-Cryptic-View.txt` — 1 KB *(cryptic view / notes)*
- `1-Query-Fare-MasterPricerTravelBoardSearch-21-4.xml` — 3 KB
- `1-Reply-Fare-MasterPricerTravelBoardSearch-21-4.xml` — 24 KB *(trimmed)*
- `2-Query-Travel-OfferPrice.xml` — 2 KB
- `2-Reply-Travel-OfferPrice.xml` — 52 KB *(trimmed)*
- `3-Query-Travel-OrderCreate.xml` — 4 KB
- `3-Reply-Travel-OrderCreate.xml` — 18 KB
- `4-Query-Travel-OrderPay.xml` — 3 KB
- `4-Reply-Travel-OrderPay-REPRICE-WARNING-RETURNED.xml` — 16 KB
- `5-Query-Travel-OrderPay.xml` — 1 KB
- `5-Reply-Travel-OrderPay-DOCUMENTS-ISSUED.xml` — 18 KB

### `Car-Segment-Booked-Add-NDC-Flight/`

Original scenario name: *Car Segment Booked_Add NDC Flight* — 13 XML message(s), 1 trimmed.

- `1-Fare-MasterPricerTravelBoardSearch-request--1.xml` — 1 KB *(trimmed; message 1 of 2 in one capture)*
- `1-Fare-MasterPricerTravelBoardSearch-request--2.xml` — 2 KB *(message 2 of 2 in one capture)*
- `1-Fare-MasterPricerTravelBoardSearchReply-response.xml` — 34 KB *(trimmed)*
- `2-AMATravelOfferPriceRQ.20230330-041631910.request.xml` — 2 KB
- `2-AMATravelOfferPriceRQ.20230330-041634970.response.xml` — 26 KB
- `3-PNR-Retrieve.request.xml` — 1 KB
- `3-PNR-Retrieve.response.xml` — 37 KB
- `4-AMA-TravelOrderChangeRQ.request.xml` — 2 KB
- `4-AMA-TravelOrderViewRS.response.xml` — 25 KB
- `5-AMATravelOrderPayRQ.20230330-041728233.request.xml` — 1 KB
- `5-AMATravelOrderPayRQ.20230330-041737286.response.xml` — 29 KB
- `6-AMATravelOrderRetrieveRQ.20230330-041755809.request.xml` — 1 KB
- `6-AMATravelOrderRetrieveRQ.20230330-041759685.response.xml` — 29 KB

### `Contact-Refused-for-Multiple-Pax/`

Original scenario name: *Contact Refused for Multiple Pax* — 6 XML message(s), 2 trimmed.

- `11-Query-Travel-OfferPrice.xml` — 3 KB
- `11-Reply-Travel-OfferPrice.xml` — 95 KB *(trimmed)*
- `15-Query-Travel-OrderCreate.xml` — 5 KB
- `15-Reply-Travel-OrderCreate.xml` — 41 KB
- `3-Query-Fare-MasterPricerTravelBoardSearch-21-4.xml` — 3 KB
- `3-Reply-Fare-MasterPricerTravelBoardSearch-21-4.xml` — 54 KB *(trimmed)*
- `CTCR-notes.png` — 113 KB *(screenshot)*
- `PNR-Cryptic-View.png` — 61 KB *(screenshot)*

### `IB---FOP-CreateFormOfPayment-with-Card-Holder-Details-FROM-PNR/`

Original scenario name: *IB - FOP_CreateFormOfPayment_with Card Holder Details_FROM_PNR* — 25 XML message(s), 1 trimmed.

- `1-Query-Fare-MasterPricerTravelBoardSearch-23-2.xml` — 3 KB
- `1-Reply-Fare-MasterPricerTravelBoardSearch-23-2.xml` — 24 KB *(trimmed)*
- `10-Query-Travel-OrderRetrieve.xml` — 1 KB
- `10-Reply-Travel-OrderRetrieve.xml` — 20 KB
- `11-Query-Travel-OrderRetrieve.xml` — 1 KB
- `11-Reply-Travel-OrderRetrieve.xml` — 20 KB
- `12-Query-Travel-OrderPay.xml` — 2 KB
- `12-Reply-Travel-OrderPay.xml` — 21 KB
- `13-Query-Command-Cryptic-07-3.xml` — 1 KB
- `13-Reply-Command-Cryptic-07-3.txt` — 1 KB *(cryptic view / notes)*
- `14-Query-Command-Cryptic-07-3.xml` — 1 KB
- `14-Reply-Command-Cryptic-07-3.txt` — 1 KB *(cryptic view / notes)*
- `15-Query-Command-Cryptic-07-3.xml` — 1 KB
- `15-Reply-Command-Cryptic-07-3.txt` — 1 KB *(cryptic view / notes)*
- `16-Query-Command-Cryptic-07-3.xml` — 1 KB
- `16-Reply-Command-Cryptic-07-3.txt` — 1 KB *(cryptic view / notes)*
- `17-Query-Command-Cryptic-07-3.xml` — 1 KB
- `17-Reply-Command-Cryptic-07-3.txt` — 1 KB *(cryptic view / notes)*
- `3-Query-Travel-OfferPrice.xml` — 2 KB
- `3-Reply-Travel-OfferPrice.xml` — 23 KB
- `5-Query-Travel-OrderCreate.xml` — 3 KB
- `5-Reply-Travel-OrderCreate.xml` — 20 KB
- `6-Query-PNR-Retrieve-21-1.xml` — 1 KB
- `6-Reply-PNR-Retrieve-21-1.xml` — 14 KB
- `7-Query-FOP-CreateFormOfPayment-19-2-TFOPCQ-19-2-1A.xml` — 3 KB
- `7-Reply-FOP-CreateFormOfPayment-19-2-TFOPCQ-19-2-1A.xml` — 9 KB
- `8-Query-PNR-AddMultiElements-21-1.xml` — 1 KB
- `8-Reply-PNR-AddMultiElements-21-1.xml` — 15 KB
- `9-Query-Security-SignOut-04-1-VLSSOQ-04-1-1A.xml` — 1 KB
- `9-Reply-Security-SignOut-04-1-VLSSOQ-04-1-1A.xml` — 1 KB

### `IB-Family-with-Void/`

Original scenario name: *IB_Family with Void* — 14 XML message(s), 1 trimmed.

- `1---MPTB-Req.xml` — 3 KB
- `2---MPTB-Res.xml` — 54 KB *(trimmed)*
- `3---OfferPrice-Req.xml` — 1 KB
- `3---OfferPrice-Res.xml` — 59 KB
- `4---OrderCreate-Req.xml` — 4 KB
- `4---OrderView-Res.xml` — 53 KB
- `5---OrderRetrieve-Req.xml` — 1 KB
- `5---OrderView-Res.xml` — 51 KB
- `6---OrderPay-Req.xml` — 1 KB
- `6---OrderView-Res.xml` — 56 KB
- `7---OrderReshop-Req.xml` — 1 KB
- `7---OrderReshop-Res.xml` — 23 KB
- `8---OrderCancel-Req.xml` — 1 KB
- `8---OrderCancel-Res.xml` — 2 KB

### `QF-Family-Per-Bound-Per-PTC/`

Original scenario name: *QF_Family_Per Bound_Per PTC* — 8 XML message(s), 3 trimmed.

- `0---Cryptic-View.txt` — 7 KB *(cryptic view / notes)*
- `1---MPTB-Req.xml` — 2 KB
- `1---MPTB-Res.xml` — 61 KB *(trimmed)*
- `2---OfferPrice-Req.xml` — 2 KB
- `2---OfferPrice-Res.xml` — 80 KB
- `3---OrderCreate-Req.xml` — 3 KB
- `3---OrderView-Res.xml` — 93 KB *(trimmed)*
- `4---OrderPay-Req.xml` — 1 KB
- `4---OrderView-Res.xml` — 104 KB *(trimmed)*

### `SQ-PromoCode/`

Original scenario name: *SQ PromoCode* — 8 XML message(s), 1 trimmed.

- `1-Query-Fare-MasterPricerTravelBoardSearch-23-1.xml` — 4 KB
- `1-Reply-Fare-MasterPricerTravelBoardSearch-23-1.xml` — 42 KB *(trimmed)*
- `3-Query-Travel-OfferPrice.xml` — 2 KB
- `3-Reply-Travel-OfferPrice.xml` — 38 KB
- `5-Query-Travel-OrderCreate.xml` — 3 KB
- `5-Reply-Travel-OrderCreate.xml` — 41 KB
- `7-Query-Travel-OrderPay.xml` — 2 KB
- `7-Reply-Travel-OrderPay.xml` — 42 KB

### `VY-Family-DOCO-DOCA-DOCS/`

Original scenario name: *VY_Family_DOCO_DOCA_DOCS* — 14 XML message(s), 1 trimmed.

- `1---MPTB-req.xml` — 2 KB
- `1---MPTB-res.xml` — 33 KB *(trimmed)*
- `2---OfferPrice-req.xml` — 2 KB
- `2---OfferPrice-res.xml` — 17 KB
- `3---OrderCreate-req.xml` — 9 KB
- `3---OrderCreate-res.xml` — 30 KB
- `4---OrderPay-req.xml` — 1 KB
- `4---OrderView-rs.xml` — 33 KB
- `5---OrderRetrieve-req-res--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `5---OrderRetrieve-req-res--2.xml` — 33 KB *(message 2 of 2 in one capture)*
- `6---OrderReshop-req.xml` — 1 KB
- `6---OrderReshop-res.xml` — 3 KB
- `7---OrderCancel-req-res--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `7---OrderCancel-req-res--2.xml` — 2 KB *(message 2 of 2 in one capture)*

## Ancillaries, seats and servicing (`examples/servicing/`)

### `AA-Invol-Acceptance-Waiver-Code-Reissuance/`

Original scenario name: *AA_Invol Acceptance_Waiver Code_Reissuance* — 4 XML message(s).

- `2---Travel-OrderRetrieve--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `2---Travel-OrderRetrieve--2.xml` — 37 KB *(message 2 of 2 in one capture)*
- `3---Travel-OrderChange-with-Waiver-Code--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `3---Travel-OrderChange-with-Waiver-Code--2.xml` — 40 KB *(message 2 of 2 in one capture)*
- `Reissuance-Cryptic-View.txt` — 1 KB *(cryptic view (converted from docx))*

### `AFKL-Seat-Bundle-Travel-API-samples/`

Original scenario name: *AFKL Seat Bundle Travel API samples* — 12 XML message(s), 2 trimmed.

- `01-MasterPricerTravelBoardSearch.xml` — 2 KB
- `02-MasterPricerTravelBoardReply.xml` — 23 KB *(trimmed)*
- `03---TravelOfferPriceRQ.xml` — 1 KB
- `04---TravelOfferPriceRS.xml` — 20 KB
- `05---TravelSeatAvailabilityRQ.xml` — 1 KB
- `06---TravelSeatAvailabilityRS.xml` — 16 KB *(trimmed)*
- `07---TravelOfferPriceRQ.xml` — 1 KB
- `08---TravelOfferPriceRS.xml` — 20 KB
- `09---TravelOrderCreateRQ.xml` — 2 KB
- `10---TravelOrderViewRS.xml` — 29 KB
- `11---TravelOrderPayRQ.xml` — 1 KB
- `12---TravelOrderViewRS.xml` — 22 KB

### `AF-Bag-Seat-After-Pricing-2nd-OfferPrice/`

Original scenario name: *AF_Bag_Seat_After_Pricing_2nd OfferPrice* — 12 XML message(s), 2 trimmed.

- `42-Query-MPTB.xml` — 3 KB
- `42-Reply-MPTB.xml` — 33 KB *(trimmed)*
- `43-Query-Travel-OfferPrice.xml` — 2 KB
- `43-Reply-Travel-OfferPrice.xml` — 31 KB
- `44-Query-Travel-ServiceList.xml` — 2 KB
- `44-Reply-Travel-ServiceList.xml` — 34 KB
- `45-Query-Travel-SeatAvailability.xml` — 2 KB
- `45-Reply-Travel-SeatAvailability.xml` — 21 KB *(trimmed)*
- `46-Query-Travel-OfferPrice.xml` — 4 KB
- `46-Reply-Travel-OfferPrice.xml` — 40 KB
- `47-Query-Travel-OrderCreate.xml` — 4 KB
- `47-Reply-Travel-OrderCreate.xml` — 49 KB

### `QF-Involuntary-Exchange-Schedule-Driven/`

Original scenario name: *QF_Involuntary Exchange_Schedule Driven* — 8 XML message(s), 3 trimmed.

- `1---PNR-Retrieve-RQ.xml` — 1 KB *(trimmed)*
- `1---PNR-Retrieve-RS.xml` — 28 KB
- `2---Air-MultiAvailability-RQ.xml` — 1 KB
- `2---Air-MultiAvailability-RS.xml` — 55 KB
- `3---Travel-OrderReshop-RQ.xml` — 4 KB
- `3---Travel-OrderReshop-RS.xml` — 60 KB *(trimmed)*
- `4---Travel-OrderChange-RQ.xml` — 2 KB
- `4---Travel-OrderChange-RS.xml` — 85 KB *(trimmed)*

### `Retain-Credit-Flow/`

Original scenario name: *Retain Credit Flow* — 6 XML message(s).

- `1-Query-Travel-OrderRetrieve.xml` — 1 KB
- `1-Reply-Travel-OrderRetrieve.xml` — 33 KB
- `2-Query-Travel-OrderReshop.xml` — 2 KB
- `2-Reply-Travel-OrderReshop.xml` — 10 KB
- `3-Query-Travel-OrderCancel.xml` — 2 KB
- `3-Reply-Travel-OrderCancel.xml` — 1 KB

### `Reuse-Credit---Zero-Balance-Due/`

Original scenario name: *Reuse Credit - Zero Balance Due* — 12 XML message(s), 1 trimmed.

- `1-MPTB-req.xml` — 2 KB
- `1-MPTB-res.xml` — 14 KB
- `2-OfferPrice-req.xml` — 1 KB
- `2-OfferPrice-res.xml` — 91 KB *(trimmed)*
- `3-PNR-Retrieve-req-res--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `3-PNR-Retrieve-req-res--2.xml` — 17 KB *(message 2 of 2 in one capture)*
- `4-Travel-OrderCreate-req.xml` — 3 KB
- `4-Travel-OrderCreate-res.xml` — 55 KB
- `5-Travel-OrderReshop-req.xml` — 1 KB
- `5-Travel-OrderReshop-res.xml` — 58 KB
- `6-Travel-OrderChange-req.xml` — 2 KB
- `6-Travel-OrderChange-res.xml` — 58 KB

### `SQ-Family-Add-Seats-and-Bags-Post-Payment/`

Original scenario name: *SQ_Family_Add Seats and Bags Post Payment* — 22 XML message(s).

- `1---MPTB--1.xml` — 2 KB *(message 1 of 2 in one capture)*
- `1---MPTB--2.xml` — 33 KB *(trimmed; message 2 of 2 in one capture)*
- `10---Travel-OrderChange-Chargeable-Seats--1.xml` — 3 KB *(message 1 of 2 in one capture)*
- `10---Travel-OrderChange-Chargeable-Seats--2.xml` — 55 KB *(trimmed; message 2 of 2 in one capture)*
- `11---Travel-OrderRetrieve--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `11---Travel-OrderRetrieve--2.xml` — 56 KB *(trimmed; message 2 of 2 in one capture)*
- `2---Travel-OfferPrice--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `2---Travel-OfferPrice--2.xml` — 37 KB *(trimmed; message 2 of 2 in one capture)*
- `3---Travel-OrderCreate--1.xml` — 4 KB *(message 1 of 2 in one capture)*
- `3---Travel-OrderCreate--2.xml` — 61 KB *(trimmed; message 2 of 2 in one capture)*
- `4---Travel-OrderPay--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `4---Travel-OrderPay--2.xml` — 65 KB *(trimmed; message 2 of 2 in one capture)*
- `5---Travel-ServiceList--1.xml` — 2 KB *(message 1 of 2 in one capture)*
- `5---Travel-ServiceList--2.xml` — 13 KB *(trimmed; message 2 of 2 in one capture)*
- `6---Travel-OfferPrice-for-Bag-in-Weight--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `6---Travel-OfferPrice-for-Bag-in-Weight--2.xml` — 6 KB *(message 2 of 2 in one capture)*
- `7---Travel-OrderChange-for-Bag--1.xml` — 2 KB *(message 1 of 2 in one capture)*
- `7---Travel-OrderChange-for-Bag--2.xml` — 68 KB *(trimmed; message 2 of 2 in one capture)*
- `8---Travel-OrderChange-free-Ancillaries--1.xml` — 3 KB *(message 1 of 2 in one capture)*
- `8---Travel-OrderChange-free-Ancillaries--2.xml` — 56 KB *(trimmed; message 2 of 2 in one capture)*
- `9---Travel-SeatAvailability--1.xml` — 1 KB *(message 1 of 2 in one capture)*
- `9---Travel-SeatAvailability--2.xml` — 54 KB *(trimmed; message 2 of 2 in one capture)*

### `SQ-Family-Bag-in-Weight-PreBooking/`

Original scenario name: *SQ_Family_Bag in Weight_PreBooking* — 16 XML message(s), 7 trimmed.

- `0---Cryptic-View.txt` — 9 KB *(cryptic view / notes)*
- `1-Query-Fare-MasterPricerTravelBoardSearch-21-4.xml` — 2 KB
- `1-Reply-Fare-MasterPricerTravelBoardSearch-21-4.xml` — 39 KB *(trimmed)*
- `2-Query-Travel-OfferPrice.xml` — 1 KB
- `2-Reply-Travel-OfferPrice.xml` — 35 KB *(trimmed)*
- `3-Query-Travel-ServiceList.xml` — 1 KB
- `3-Reply-Travel-ServiceList.xml` — 12 KB *(trimmed)*
- `4-Query-Travel-OfferPrice.xml` — 3 KB
- `4-Reply-Travel-OfferPrice.xml` — 16 KB *(trimmed)*
- `5-Query-Travel-OrderCreate.xml` — 4 KB
- `5-Reply-Travel-OrderCreate.xml` — 50 KB *(trimmed)*
- `6-Query-Travel-OrderPay.xml` — 1 KB
- `6-Reply-Travel-OrderPay.xml` — 54 KB *(trimmed)*
- `7-Query-Travel-OrderRetrieve.xml` — 1 KB
- `7-Reply-Travel-OrderRetrieve.xml` — 55 KB *(trimmed)*
- `8-Query-PNR-Retrieve-21-1.xml` — 1 KB
- `8-Reply-PNR-Retrieve-21-1.xml` — 47 KB

### `Split-PNR-with-Void/`

Original scenario name: *Split PNR with Void* — 18 XML message(s), 4 trimmed.

- `1-Query-Fare-MasterPricerTravelBoardSearch.xml` — 3 KB
- `1-Reply-Fare-MasterPricerTravelBoardSearch.xml` — 50 KB *(trimmed)*
- `2-Query-Travel-OfferPrice.xml` — 3 KB
- `2-Reply-Travel-OfferPrice.xml` — 42 KB
- `3-Query-Travel-OrderCreate.xml` — 6 KB
- `3-Reply-Travel-OrderCreate.xml` — 80 KB *(trimmed)*
- `4-Query-Travel-OrderPay.xml` — 2 KB
- `4-Reply-Travel-OrderPay.xml` — 92 KB *(trimmed)*
- `5-Query-PNR-Retrieve.xml` — 1 KB
- `5-Reply-PNR-Retrieve.xml` — 34 KB
- `6-Query-Travel-OrderRetrieve.xml` — 1 KB
- `6-Reply-Travel-OrderRetrieve.xml` — 92 KB *(trimmed)*
- `7-Query-Travel-OrderChange.xml` — 2 KB
- `7-Reply-Travel-OrderChange.xml` — 41 KB
- `8-Query-Travel-OrderReshop.xml` — 2 KB
- `8-Reply-Travel-OrderReshop.xml` — 5 KB
- `9-Query-Travel-OrderCancel.xml` — 1 KB
- `9-Reply-Travel-OrderCancel.xml` — 1 KB
- `split-pnr-cryptic-view.txt` — 8 KB *(cryptic view / notes)*

### `UA-1-ADT-Fare-Driven-Exchange-with-AddCollect/`

Original scenario name: *UA_1 ADT_Fare Driven Exchange with AddCollect* — 14 XML message(s), 2 trimmed.

- `11-Query-Travel-OrderCreate.xml` — 3 KB
- `11-Reply-Travel-OrderCreate.xml` — 17 KB
- `15-Query-Travel-OrderPay.xml` — 2 KB
- `15-Reply-Travel-OrderPay.xml` — 19 KB
- `17-Query-Travel-OrderReshop.xml` — 3 KB
- `17-Reply-Travel-OrderReshop.xml` — 44 KB *(trimmed)*
- `19-Query-Travel-OrderReshop.xml` — 3 KB
- `19-Reply-Travel-OrderReshop.xml` — 21 KB
- `23-Query-Travel-OrderChange.xml` — 3 KB
- `23-Reply-Travel-OrderChange.xml` — 22 KB
- `5-Query-Fare-MasterPricerTravelBoardSearch-23-2.xml` — 3 KB
- `5-Reply-Fare-MasterPricerTravelBoardSearch-23-2.xml` — 27 KB *(trimmed)*
- `7-Query-Travel-OfferPrice.xml` — 2 KB
- `7-Reply-Travel-OfferPrice.xml` — 42 KB

### `Update-Pax-Phone-and-Email/`

Original scenario name: *Update Pax Phone and Email* — 6 XML message(s), 1 trimmed.

- `1---Travel-OrderRetrieve-RQ.xml` — 1 KB
- `1---Travel-OrderView-RS.xml` — 62 KB
- `2---Travel-OrderReshop-RQ.xml` — 1 KB
- `2---Travel-OrderReshop-RS.xml` — 1 KB
- `3---Travel-OrderChange-RQ.xml` — 1 KB
- `3---Travel-OrderView-RS.xml` — 45 KB *(trimmed)*
