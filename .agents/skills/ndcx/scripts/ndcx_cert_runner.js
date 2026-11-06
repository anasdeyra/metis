/**
 * NDC[X] certification run helper (TEST host only — the sales point URL must be an
 * Amadeus test URL, `*test.webservices*`; the script refuses anything else).
 *
 * Drives the metis `api-aerial` builders/mappers (services/AMADEUS_NDCX/ndcx.service.js +
 * utils/AMADEUS_NDCX/*), so every call it makes is a real product wire message, and lets
 * ndcxLogger drop the RQ/RS XML into `<api-aerial>/use cases/NDCX/` exactly as the app does
 * with NODE_ENV=development. No DB writes beyond the read-only sales-point lookup.
 *
 * Sub-commands (a state file carries the ids between them):
 *   shop     --route CDG-JFK --dates 2026-12-07,2026-12-14 --pax 2ADT,1CNN,1INF
 *            [--direct] [--carrier AA] [--state <file>]
 *   price    --state <file> --journey <n> [--upsell]          (n = a shopping offer index)
 *   pick     --state <file> --variant <bundleOfferId>         (choose an OtherOffers bundle)
 *   create   --state <file> [--payment cash|card] [--card VI|CA]
 *            [--services SSR[:seg|all][,SSR...]] [--free-mode h1|h2]   (ancillaries at checkout, see below)
 *   services --state <file> [--order] [--dump <dir>] [--tag X]   (Travel_ServiceList on the priced offer, or on the order)
 *   ancprice --state <file> --services AVML,SPEQ,... [--dump <dir>] [--qty-free]   (2nd Travel_OfferPrice only, no booking)
 *   change   --state <file> --services VGML,WCHR [--free] [--dump <dir>]   (Travel_OrderChange on a HELD order)
 *   setpax   --state <file> --pax 2ADT,1CNN,1INF [--surname X]  (rebuild names, keep the priced offer)
 *   pay      --state <file>                                    (amount/currency read live)
 *   retrieve --state <file> [--dump <dir>] [--tag X]            (--dump writes the node-soap reply + mapped view)
 *   quote    --state <file>        (Travel_OrderReshop cancel quote: VOID or REFUND)
 *   cancel   --state <file>        (Travel_OrderCancel — held order = cancel, ticketed = void/refund)
 *
 * Voluntary flight change (NDCX-FLIGHTMODIFICATION-PLAN.md §10.2) — product exchange builders, no DB:
 *   xshop    --state <file> --date YYYY-MM-DD [--bound n] [--origin X --dest Y] [--cabin C]
 *            [--auto|--no-auto] [--ignore-gate] [--retain-mode product|fixed|none] [--pax-fix] [--log f.jsonl]
 *   xprice   --state <file> [--candidate n] [--pax-fix] [--dump dir] [--log f.jsonl]   (Reshop #2 only)
 *   xchange  --state <file> [--candidate n] --commit [--pax-fix] [--log f.jsonl]       (Reshop #2 + OrderChange)
 *   --retain-mode fixed / --pax-fix simulate the two parser fixes found on 2026-11-05 (bag allowance under
 *   ServiceDefinitionRef; repeated PassengerRefs / Service/PaxRefID on multi-pax items).
 *
 * Non-bag ancillaries (NDCX-ANCILLARIES-PLAN.md Task 0) — HELD orders on the TEST host only, never `pay`:
 *   shop → price → services --dump d → ancprice --services AVML,SPEQ,WCHR   (F6: free items dropped by the 2nd OfferPrice)
 *   shop → price → create --services VGML,WCHR,BIKE → retrieve --dump d → cancel   (ADR-82 H1; --free-mode h2 = 2nd SelectedOffer)
 *   create → services --order → change --services VGML,WCHR --free → retrieve → cancel   (ADR-83 / F7 on our builder)
 *
 * Typical certification chains:
 *   upfront upsell   shop → price → price --upsell → pick → create --payment card → pay → retrieve
 *   connecting + card shop → price → create --payment card → pay → retrieve → quote → cancel
 *   hold, no ticket   shop → price → create → retrieve → cancel
 *   domestic cash     shop --direct → price → create --payment cash → pay → retrieve
 *
 * Where the host application lives (`--src <dir>` › `$NDCX_AERIAL_SRC` ›
 * `<skill>/../../../../api-aerial/src`). Credentials come from that app's own sales-point
 * lookup (needs DB + VPN), never from this script.
 *
 * Card payments use the Amadeus TEST cards (references/09-queues-sync-errors-testdata.md) and
 * reach the host through the same encrypted enrolment blob the front persists; PAN/CVV never
 * hit stdout and are masked in the XML by ndcxLogger (ADR-72). Purge the state file's
 * EncCardNumber/EncCvv/payerInfo.cvv once a run is done.
 */

const path = require("path");
const fs = require("fs");

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : fallback;
}
function flag(name) {
  return process.argv.includes("--" + name);
}
const cmd = process.argv[2];
if (!cmd || cmd.startsWith("--")) {
  console.error("usage: node ndcx_cert_runner.js <shop|price|pick|create|services|ancprice|change|setpax|pay|retrieve|quote|cancel> [options]");
  process.exit(2);
}

/** Host application (`api-aerial/src`): --src › $NDCX_AERIAL_SRC › sibling of the skill folder. */
function resolveSrc() {
  const explicit = arg("src") || process.env.NDCX_AERIAL_SRC;
  if (explicit) return path.resolve(explicit);
  const guess = path.resolve(__dirname, "..", "..", "..", "..", "api-aerial", "src");
  if (fs.existsSync(path.join(guess, "utils", "AMADEUS_NDCX", "offer.utils.js"))) return guess;
  console.error(
    "Cannot locate api-aerial/src — pass --src <path> or set NDCX_AERIAL_SRC.\n" +
      `Looked for: ${guess}`,
  );
  process.exit(2);
}

const SRC = resolveSrc();
process.chdir(SRC);
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.NEXTCLOUD = "false";
process.env.ACTIVE_CRONTASK = "false";
process.env.IS_PGBOSS_INIT = "false";

const { getSalesPoint } = require(SRC + "/services/AMADEUS/amadeusServiceFactory");
const { NdcxService } = require(SRC + "/services/AMADEUS_NDCX/ndcx.service");
const { createNdcxShoppingPayload, mapNdcxShoppingReply } = require(SRC + "/utils/AMADEUS_NDCX/shopping.utils");
const { createNdcxOfferPricePayload } = require(SRC + "/utils/AMADEUS_NDCX/offer.utils");
const { mapNdcxOfferPriceReply } = require(SRC + "/utils/AMADEUS_NDCX/offerPriceReply.mapper");
const { mapNdcxOfferPriceUpsellReply } = require(SRC + "/utils/AMADEUS_NDCX/offerPriceUpsell.mapper");
const { createNdcxOrderCreatePayload, createNdcxOrderRetrievePayload } = require(SRC + "/utils/AMADEUS_NDCX/order.utils");
const { createNdcxServiceListPayload } = require(SRC + "/utils/AMADEUS_NDCX/serviceList.utils");
const { mapNdcxServiceListReply } = require(SRC + "/utils/AMADEUS_NDCX/serviceListReply.mapper");
const { createNdcxAncillaryOfferPricePayload } = require(SRC + "/utils/AMADEUS_NDCX/ancillaryOffer.utils");
const { createNdcxOrderChangePayload } = require(SRC + "/utils/AMADEUS_NDCX/orderChange.utils");
const { createNdcxOrderPayPayload, applyNdcxEnrollmentStatusText } = require(SRC + "/utils/AMADEUS_NDCX/orderPay.utils");
const { createNdcxOrderCancelPayload } = require(SRC + "/utils/AMADEUS_NDCX/orderCancel.utils");
const {
  createNdcxOrderReshopCancelPayload,
  extractNdcxOrderItemIds,
  extractNdcxOrderItemLabels,
} = require(SRC + "/utils/AMADEUS_NDCX/orderReshop.utils");
const { mapNdcxOrderReshopCancelQuote } = require(SRC + "/utils/AMADEUS_NDCX/orderReshopReply.mapper");
const { mapNdcxOrderViewReply } = require(SRC + "/utils/AMADEUS_NDCX/orderViewReply.mapper");
const { encryptData } = require(SRC + "/utils/Encryption/dataEncrypt");
const {
  listNdcxBounds,
  resolveNdcxExchangeContext,
  resolveNdcxCurrentCabinCode,
  readNdcxAirlineOwnerCode,
  resolveNdcxRetainServiceIds,
  createNdcxOrderReshopShopPayload,
  createNdcxOrderReshopPricePayload,
  extractNdcxPricedExchangeOffer,
  createNdcxOrderChangeExchangePayload,
  resolveNdcxExchangePaymentAmount,
  resolveNdcxExchangeOwnerCodes,
} = require(SRC + "/utils/AMADEUS_NDCX/orderExchange.utils");
const { mapNdcxExchangeShopReply } = require(SRC + "/utils/AMADEUS_NDCX/orderExchangeReply.mapper");
const { readCurrencyDecimals } = require(SRC + "/utils/AMADEUS_NDCX/amount.utils");
const { extractNdcxOrderPaxList } = require(SRC + "/utils/AMADEUS_NDCX/updatePax.utils");
const { resolveNdcxFlightChangeSupport } = require(SRC + "/utils/AMADEUS_NDCX/carrierCapabilities");

const SALES_POINT_ID = Number(arg("salespoint", 1));

/** Amadeus TEST cards (references/09-queues-sync-errors-testdata.md — test environment only). */
const TEST_CARDS = {
  AA: { VI: { number: "4434260000000008", exp: "0139", cvv: "123" }, CA: { number: "5577810000000004", exp: "0139", cvv: "123" } },
  AC: { VI: { number: "4988438843884305", exp: "0330", cvv: "737" }, CA: { number: "2222400010000008", exp: "0330", cvv: "737" } },
};

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
// Default inside the host app's (gitignored) capture folder; override with --state.
const STATE_DIR = path.resolve(SRC, "..", "use cases", "NDCX", "cert-runs", "state");
fs.mkdirSync(STATE_DIR, { recursive: true });
const STATE_PATH = path.resolve(arg("state", path.join(STATE_DIR, "run.json")));
function loadState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}
function saveState(patch) {
  const state = loadState();
  const next = { ...state, ...patch };
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

let SVCP = null;
async function salesPoint() {
  if (SVCP) return SVCP;
  const sp = await getSalesPoint(SALES_POINT_ID);
  const data = sp.data || sp;
  if (!String(data["Amadeus-url"]).includes("test.webservices")) {
    console.error("REFUSING: sales point url is not an Amadeus TEST host: " + data["Amadeus-url"]);
    process.exit(3);
  }
  SVCP = data;
  return data;
}

// ---------------------------------------------------------------------------
// pax
// ---------------------------------------------------------------------------
const TITLES = { ADT: ["MR", "MRS"], CHD: ["MSTR"], CNN: ["MSTR"], INF: ["MISS"] };
const GENDERS = { ADT: ["M", "F"], CHD: ["M"], CNN: ["M"], INF: ["F"] };
const GIVEN_NAMES = { ADT: ["JEAN", "MARIE"], CHD: ["LUC"], CNN: ["LUC"], INF: ["EVA"] };
function buildPaxs(spec, surname) {
  // "2ADT,1CNN,1INF" -> [ADT, ADT, CNN, INF], one shared family surname (the shape the host
  // accepted on 2026-10-13: MR JEAN / MRS MARIE / MSTR LUC / MISS EVA <SURNAME>).
  const paxs = [];
  let n = 0;
  const used = {};
  for (const chunk of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = chunk.match(/^(\d+)([A-Z]+)$/);
    if (!m) throw new Error(`Bad pax spec chunk: ${chunk}`);
    for (let i = 0; i < Number(m[1]); i++) {
      const ptc = m[2];
      used[ptc] = (used[ptc] || 0) + 1;
      const k = used[ptc] - 1;
      n += 1;
      const isChild = ptc === "CHD" || ptc === "CNN";
      const isInf = ptc === "INF";
      const birth = isInf ? "2026-02-10" : isChild ? "2018-05-10" : k === 0 ? "1985-03-12" : "1987-07-21";
      const givenName = (GIVEN_NAMES[ptc] || ["ALEX"])[Math.min(k, (GIVEN_NAMES[ptc] || ["ALEX"]).length - 1)];
      const gender = (GENDERS[ptc] || ["M"])[Math.min(k, (GENDERS[ptc] || ["M"]).length - 1)];
      const title = (TITLES[ptc] || ["MR"])[Math.min(k, (TITLES[ptc] || ["MR"]).length - 1)];
      paxs.push({
        id: `PAX${n}`,
        ptc,
        other: { rgpd: false, isValid: true },
        cartesFidelities: [],
        cartesSubscriptions: [],
        individualInfo: {
          titleName: title,
          surname: surname || "CERTTEST",
          givenName,
          birthdate: birth,
          entreprise: "",
        },
        gender,
        birthDate: birth,
        docs: null,
        docsList: [],
        contactInfo: null,
        profileId: null,
        remarques: [{ type: "CANAL", remarke: "OFFLINE", service: "ALL" }],
        seamanBook: null,
        _other: { isInf, isChild, birthdate: birth, gender },
      });
    }
  }
  // One shared contact on the first two adults (Create_06: contact e-mail).
  const contact = {
    emailAddress: [{ email: "cert.test@example.com", type: "HOME" }],
    phoneNumber: [{ number: "+33600000001", type: "MOBILE" }],
  };
  paxs.filter((p) => p.ptc === "ADT").forEach((p) => {
    p.contactInfo = contact;
  });
  return paxs;
}

/** en_US-free date formatting: YYYY-MM-DD -> DDMMYY handled by the builders themselves. */
function routeBody({ route, dates, paxs, direct, carrier }) {
  const [depCode, arrCode] = route.split("-");
  if (!depCode || !arrCode) throw new Error("--route must be ORIG-DEST, e.g. CDG-JFK");
  const dateList = dates.split(",").map((s) => s.trim());
  return {
    paxs,
    flights: [
      {
        locationCodeDep: depCode,
        locationCodeArv: arrCode,
        dates: [dateList[0]],
      },
      ...(dateList[1] ? [{ locationCodeDep: arrCode, locationCodeArv: depCode, dates: [dateList[1]] }] : []),
    ],
    option: { directFlight: !!direct },
    ...(carrier
      ? { selectedAirline: [{ gds: "AMADEUS_NDCX", code: carrier, PreferLevel: "Preferred" }] }
      : {}),
    agenceInfo: { devise: "EUR" },
  };
}

// ---------------------------------------------------------------------------
// summaries
// ---------------------------------------------------------------------------
function arr(v) {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}
function textOf(n) {
  return n && typeof n === "object" ? (n._text ?? n.$value ?? n) : n;
}
function sumOfferPriceReply(rs) {
  return {
    OfferID: rs.OfferID,
    ResponseID: rs.ResponseID,
    OwnerCode: rs.OwnerCode,
    TotalPrice: rs.TotalPrice,
    OfferExpirationDateTime: rs.OfferExpirationDateTime,
    OrderItems: (rs.OrderItems || []).map((i) => ({
      OfferItemID: i.OfferItemID,
      PaxRefID: i.PaxRefID,
      price: i.Price?.TotalAmount ?? i.Price?.BaseAmount?.price,
    })),
    Errors: rs.Errors,
    bundles: rs.bundles?.map((b) => ({
      offerId: b.offerId,
      fareName: b.fareName,
      cabinType: b.cabinType,
      price: b.price,
      priceDelta: b.priceDelta,
      bagsCount: b.bagsCount,
      isCheapest: b.isCheapest,
    })),
  };
}

// ---------------------------------------------------------------------------
// non-bag ancillaries (NDCX-ANCILLARIES-PLAN.md Task 0)
// ---------------------------------------------------------------------------
function dumpJson(dir, name, value) {
  const d = path.resolve(dir);
  fs.mkdirSync(d, { recursive: true });
  const file = path.join(d, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
  return file;
}

/** Body of the ServiceList call: keyed on the priced offer (pre-booking) or on the order (post-booking). */
function serviceListBody(st, { order }) {
  if (order) {
    if (!st.orderId) throw new Error("Run `create` first (no orderId in state)");
    return { OrderID: st.orderId, OwnerCode: st.order?.OwnerCode || st.offer?.OwnerCode, paxs: st.paxs };
  }
  const offer = st.offer;
  if (!offer?.OfferID) throw new Error("Run `price` first (no priced offer in state)");
  return {
    OfferID: offer.OfferID,
    OwnerCode: offer.OwnerCode,
    ShoppingResponseId: offer.ResponseID,
    // The real ServiceID off the OfferPrice reply (SER1 on LO/EY/AI/KQ/SV/AC, Psvc… on QF) — never "1".
    OfferIdList: (offer.OrderItems || []).map((item) => ({
      OfferItemID: item.OfferItemID,
      ServiceID: item.service?.ServiceID ?? item.ServiceID ?? "1",
    })),
    paxs: st.paxs,
  };
}

/** timing: "preBooking" | "postBooking" | "postIssuance" — only read by mappers that know it (ADR-79). */
async function fetchServiceList(svc, sp, st, { order, timing }) {
  const body = serviceListBody(st, { order });
  const payload = createNdcxServiceListPayload(body, sp);
  const reply = await svc.travelServiceList(payload);
  const mapped = mapNdcxServiceListReply(reply, body, { timing: timing ?? (order ? "postBooking" : "preBooking") });
  return { body, payload, reply, mapped };
}

function printServiceCatalogue(mapped) {
  const items = mapped.Offer.OfferItem;
  for (const def of mapped.DataLists.ServiceDefinition) {
    const its = items.filter((i) => i.Service?.ServiceDefinitionRefID === def.ServiceDefinitionID);
    const prices = its.map((i) => i.UnitPrice?.TotalAmount).filter((a) => a != null);
    const c = def.classification || {};
    const exposure = its[0]?.exposure ? `${its[0].exposure.sell ? "SELL" : "hide"}/${its[0].exposure.channel ?? "-"}` : "-";
    console.log(
      [
        def.ServiceDefinitionID,
        def.Name,
        `${c.rfic ?? textOf(def.ReasonForIssuanceCode) ?? "?"}/${c.subCode ?? textOf(def.ReasonForIssuanceSubCode) ?? "?"}`,
        `ssr=${c.ssrCode ?? "-"}`,
        `type=${c.type ?? "-"}`,
        `exp=${exposure}`,
        `n=${its.length}`,
        prices.length
          ? `${Math.min(...prices).toFixed(2)}..${Math.max(...prices).toFixed(2)} ${its[0]?.UnitPrice?.CurCode ?? ""}`
          : "-",
      ].join(" | "),
    );
  }
}

/** "AVML,WCHR:all,BIKE:1" → [{ ssr, scope }]. scope: "all" | "first" | 1-based segment index. */
function parseServiceSpec(spec) {
  return String(spec || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [ssr, scope] = chunk.split(":");
      return { ssr: ssr.toUpperCase(), scope };
    });
}

/**
 * One single-segment item per (SSR, segment, pax): the cheapest, never one the mapper marked
 * `preferred === false` (ADR-80). Free items default to every segment, chargeable ones to the
 * first. Deliberately does NOT filter on `exposure.sell`: the spike must be able to ask the host
 * for something metis would hide (that is the point of a spike).
 */
function pickServiceItems(mapped, spec, pax) {
  const segs = mapped.DataLists.PaxSegment.map((x) => x.PaxSegmentID);
  const picked = [];
  for (const { ssr, scope } of spec) {
    const candidates = mapped.Offer.OfferItem.filter(
      (i) => i.classification?.ssrCode === ssr && !i.blocked && i.preferred !== false && i.Eligibility?.PaxRefID === pax,
    );
    if (!candidates.length) {
      console.log(`  [pick] no item for ${ssr} / ${pax}`);
      continue;
    }
    const cheapest = Math.min(...candidates.map((i) => i.UnitPrice?.TotalAmount ?? Infinity));
    const targetSegs =
      scope === "all" || (!scope && cheapest === 0)
        ? segs
        : [segs[(scope && scope !== "first" ? Number(scope) : 1) - 1]].filter(Boolean);
    for (const seg of targetSegs) {
      const here = candidates
        .filter(
          (i) =>
            i.Eligibility.FlightAssociations.PaxSegmentRefID.length === 1 &&
            i.Eligibility.FlightAssociations.PaxSegmentRefID[0] === seg,
        )
        .sort((a, b) => (a.UnitPrice.TotalAmount ?? Infinity) - (b.UnitPrice.TotalAmount ?? Infinity));
      const item = here[0];
      if (!item) {
        console.log(`  [pick] no single-segment ${ssr} item on ${seg}`);
        continue;
      }
      picked.push({
        OfferItemID: item.OfferItemID,
        PaxRefID: [pax],
        unit: item.classification.unit,
        free: item.UnitPrice.TotalAmount === 0,
        freeToken: item.freeToken ?? undefined,
        serviceOfferId: mapped.Offer.OfferID,
        _ssr: ssr,
        _seg: seg,
        _price: item.UnitPrice.TotalAmount,
        _name: item.classification.label,
      });
    }
  }
  return picked;
}

function printPicked(picked) {
  for (const x of picked) {
    console.log(
      `  [pick] ${x._ssr.padEnd(5)} ${x._seg.padEnd(6)} ${x.OfferItemID} price=${x._price} ${x.free ? "FREE" : "CHARGEABLE"} ${x._name}`,
    );
  }
}

/** The 2nd Travel_OfferPrice on the priced air offer + chosen services (free ones too only for the F6 probe). */
async function repriceAncillaries(svc, sp, st, rows, { qtyFree }) {
  const offer = st.offer;
  const body = {
    OfferID: offer.OfferID,
    OwnerCode: offer.OwnerCode,
    ShoppingResponseId: offer.ResponseID,
    OfferIdList: (offer.OrderItems || []).map((i) => ({ OfferItemID: i.OfferItemID, PaxRefID: i.PaxRefID })),
    // `free`/`freeToken` are deliberately NOT forwarded: for `ancprice` the point is to send free
    // items anyway and watch the host drop them (F6); for `create` only chargeable rows come here.
    services: rows.map((r) => ({
      OfferItemID: r.OfferItemID,
      PaxRefID: r.PaxRefID,
      unit: r.unit,
      ...(r._price === 0 && !qtyFree ? {} : { Qty: 1 }),
    })),
    paxs: st.paxs,
  };
  const payload = createNdcxAncillaryOfferPricePayload(body, sp);
  const reply = await svc.travelOfferPrice(payload);
  const mapped = mapNdcxOfferPriceReply(reply, body);
  return { body, payload, reply, mapped };
}

/** Compact view of every Service on an AMA_TravelOrderViewRS (raw node-soap reply) — what Task 0 Step 7 needs. */
function summarizeOrderServices(reply) {
  const r = reply?.Response ?? {};
  const out = { services: [], definitions: [] };
  for (const item of arr(r.Order?.OrderItem)) {
    for (const sv of arr(item.Service)) {
      out.services.push({
        orderItemId: textOf(item.OrderItemID),
        serviceId: textOf(sv.ServiceID),
        paxRefId: textOf(sv.PaxRefID),
        status: textOf(sv.StatusCode),
        associations: sv.ServiceAssociations ?? null,
        price: textOf(item?.Price?.TotalAmount),
      });
    }
  }
  for (const d of arr(r.DataLists?.ServiceDefinitionList?.ServiceDefinition)) {
    out.definitions.push({
      id: textOf(d.ServiceDefinitionID),
      name: textOf(d.Name),
      ssr: textOf(d.BookingInstructions?.SSRCode) ?? textOf(d.ServiceCode),
      rfic: textOf(d.ReasonForIssuanceCode),
      rfisc: textOf(d.ReasonForIssuanceSubCode),
      desc: arr(d.Description).map((x) => textOf(x?.DescText)).filter(Boolean),
    });
  }
  return out;
}

/** --pax-fix: every host pax ref of a raw AddOfferItem (repeated FareDetail/PassengerRefs and Service/PaxRefID). */
function readAllPaxRefs(rawItem) {
  const fromFare = arr(rawItem?.FareDetail).flatMap((fd) => arr(fd?.PassengerRefs).flatMap((r) => String(textOf(r) ?? "").split(/\s+/)));
  const fromSvc = arr(rawItem?.Service).flatMap((sv) => arr(sv?.PaxRefID).map(textOf));
  return [...new Set([...fromFare, ...fromSvc].filter(Boolean))];
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------
async function run() {
  const sp = await salesPoint();
  const svc = await NdcxService.create(sp, { timeout: 120000 });
  try {
    if (cmd === "shop") {
      const paxs = buildPaxs(arg("pax", "1ADT"), arg("surname"));
      const body = routeBody({
        route: arg("route"),
        dates: arg("dates"),
        paxs,
        direct: flag("direct"),
        carrier: arg("carrier"),
      });
      const payload = createNdcxShoppingPayload(body);
      const reply = await svc.masterPricerSearch(payload);
      const mapped = mapNdcxShoppingReply(reply, body);

      const segmentsById = new Map((mapped.DataLists.PaxSegment || []).map((s) => [s.PaxSegmentID, s]));
      const offers = [];
      for (const od of mapped.OriginListFlights || []) {
        for (const flight of od.flights || []) {
          for (const offer of flight.offertList || []) {
            const segIds = (offer.segments || []).flat();
            const segs = segIds.map((id) => {
              const s = segmentsById.get(id);
              return s
                ? `${s.Dep?.IATALocationCode}-${s.Arrival?.IATALocationCode} ${String(s.Dep?.AircraftScheduledDateTime || "").slice(5, 16)} ${s.MarketingCarrierInfo?.CarrierDesigCode || ""}${s.MarketingCarrierInfo?.MarketingCarrierFlightNumberText || ""}`
                : id;
            });
            offers.push({
              originDestID: od.OriginDestID,
              paxJourneyID: flight.PaxJourneyID,
              offerID: offer.OfferID,
              OfferIdList: offer.OfferIdList,
              validatingCarrier: offer.validatingCarrier,
              ShoppingResponseId: offer.ShoppingResponseId,
              OfferExpirationDateTime: offer.OfferExpirationDateTime,
              TotalPrice: offer.TotalPrice,
              cabin: offer.cabin,
              fareFamilyRef: offer.fareFamilyRef,
              isFareFamily: offer.isFareFamily,
              segCount: segs.length,
              segments: segs,
            });
          }
        }
      }
      saveState({ itinerary: body, paxs, shopping: { offers, currency: mapped.currency }, step: "shopping" });
      console.log(`SHOP OK — ${offers.length} NDC offers (state: ${STATE_PATH})`);
      offers.forEach((o, i) => {
        console.log(
          `  [${i}] ${o.originDestID}/${o.paxJourneyID} ${o.validatingCarrier} ${o.segCount}seg ${(o.TotalPrice?.BaseAmount ?? "?")} ${o.TotalPrice?.TotalAmount?.CurCode ?? ""} offer=${o.offerID} family=${o.isFareFamily} expires=${o.OfferExpirationDateTime} :: ${o.segments.join(" | ")}`,
        );
      });
      return;
    }

    if (cmd === "price") {
      const st = loadState();
      const offers = st.shopping?.offers || [];
      const idx = Number(arg("journey", "0"));
      const offer = offers[idx];
      if (!offer) throw new Error(`No shopping offer at index ${idx} (state has ${offers.length})`);
      const body = {
        OfferID: offer.offerID,
        AirlineDesigCode: offer.validatingCarrier,
        OfferIdList: offer.OfferIdList,
        ShoppingResponseId: offer.ShoppingResponseId,
        OwnerCode: offer.validatingCarrier,
        OfferExpirationDateTime: offer.OfferExpirationDateTime,
        TotalPrice: offer.TotalPrice,
        oras: ["AMADEUS_NDCX"],
        paxs: st.paxs,
        agenceInfo: { id_sales_point: SALES_POINT_ID, devise: "EUR" },
        ...(flag("upsell") ? { upSell: true } : {}),
      };
      const payload = createNdcxOfferPricePayload(body, sp);
      const reply = await svc.travelOfferPrice(payload);
      const rs = flag("upsell") ? mapNdcxOfferPriceUpsellReply(reply, body) : mapNdcxOfferPriceReply(reply, body);
      const summary = sumOfferPriceReply(rs);
      const variantId = arg("variant");
      const bundle = variantId ? (rs.bundles || []).find((b) => b.offerId === variantId) : null;
      if (variantId && !bundle) throw new Error("--variant offerId not found among bundles");
      const chosen = bundle ? { ...bundle.offerPrice, DataLists: rs.DataLists } : rs;
      saveState({
        step: variantId ? "reprice-variant" : flag("upsell") ? "upsell-priced" : "priced",
        offer: {
          OfferID: chosen.OfferID,
          ResponseID: chosen.ResponseID,
          OwnerCode: chosen.OwnerCode,
          OfferExpirationDateTime: chosen.OfferExpirationDateTime,
          OrderItems: chosen.OrderItems,
          TotalPrice: chosen.TotalPrice,
          DataLists: chosen.DataLists,
        },
        pricedSummary: summary,
        ...(flag("upsell") ? { bundles: rs.bundles || [], offerDataLists: rs.DataLists } : {}),
      });
      console.log(`PRICE OK${flag("upsell") ? " (UPSELL)" : ""}${variantId ? " (variant " + variantId + ")" : ""}`);
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    if (cmd === "pick") {
      const st = loadState();
      const bundles = st.pricedSummary?.bundles || [];
      const variantId = arg("variant");
      if (!variantId) throw new Error("--variant <offerId> is required (see pricedSummary.bundles)");
      const reply = st.bundles;
      if (!reply) throw new Error("Run `price --upsell` first (no bundles in state)");
      const bundle = reply.find((b) => b.offerId === variantId);
      if (!bundle) throw new Error("variant not found among stored bundles");
      const chosen = { ...bundle.offerPrice, DataLists: st.offerDataLists };
      saveState({
        step: "variant-picked",
        offer: {
          OfferID: chosen.OfferID,
          ResponseID: chosen.ResponseID,
          OwnerCode: chosen.OwnerCode,
          OfferExpirationDateTime: chosen.OfferExpirationDateTime,
          OrderItems: chosen.OrderItems,
          TotalPrice: chosen.TotalPrice,
        },
        pickedBundle: { offerId: bundle.offerId, fareName: bundle.fareName, price: bundle.price },
      });
      console.log(`PICK OK bundle=${variantId} price=${bundle.price} fare=${bundle.fareName} offerItems=${chosen.OrderItems?.length}`);
      return;
    }

    if (cmd === "services") {
      // Travel_ServiceList on the priced offer (pre-booking) or, with --order, on the order.
      const st = loadState();
      const order = flag("order");
      const timing = arg("timing");
      const { body, payload, reply, mapped } = await fetchServiceList(svc, sp, st, { order, timing });
      const tag = `${(body.OwnerCode || "XX")}${arg("tag") ? "-" + arg("tag") : ""}${order ? "-order" : ""}`;
      saveState({ serviceList: mapped, serviceListMeta: { order, at: new Date().toISOString() } });
      const byType = {};
      for (const i of mapped.Offer.OfferItem) byType[i.classification?.type] = (byType[i.classification?.type] || 0) + 1;
      console.log(
        `SERVICELIST ${body.OwnerCode}${order ? " (order " + body.OrderID + ")" : ""}: items=${mapped.Offer.OfferItem.length} defs=${mapped.DataLists.ServiceDefinition.length} segs=${mapped.DataLists.PaxSegment.map((x) => x.PaxSegmentID).join(",")} offer=${mapped.Offer.OfferID} byType=${JSON.stringify(byType)} errors=${JSON.stringify(mapped.Errors)}`,
      );
      printServiceCatalogue(mapped);
      const dump = arg("dump");
      if (dump) {
        // The node-soap-parsed reply is exactly what the mapper sees in production → fixture material.
        console.log("DUMP", dumpJson(dump, `${tag}.reply.json`, reply));
        dumpJson(dump, `${tag}.mapped.json`, mapped);
        dumpJson(dump, `${tag}.request.json`, { body: { ...body, paxs: (body.paxs || []).map((x) => x.ptc) }, payload });
      }
      return;
    }

    if (cmd === "ancprice") {
      // 2nd Travel_OfferPrice only — no booking. Re-runs the F6 probe: free items are expected to be dropped.
      const st = loadState();
      const spec = parseServiceSpec(arg("services"));
      if (!spec.length) throw new Error("--services AVML,SPEQ,... is required");
      const sl = flag("fresh") || !st.serviceList ? (await fetchServiceList(svc, sp, st, { order: false })).mapped : st.serviceList;
      // One item per SSR on the FIRST segment, whatever its price (the point is to see which survive).
      const picked = pickServiceItems(sl, spec.map((x) => ({ ...x, scope: x.scope ?? "first" })), st.paxs[0].id);
      printPicked(picked);
      const { reply, mapped } = await repriceAncillaries(svc, sp, st, picked, { qtyFree: flag("qty-free") });
      const airIds = new Set((st.offer.OrderItems || []).map((i) => i.OfferItemID));
      const survivors = (mapped.OrderItems || []).filter((i) => !airIds.has(i.OfferItemID));
      console.log(`OFFERPRICE-2 ${st.offer.OwnerCode}: errors=${JSON.stringify(mapped.Errors ?? [])} total=${JSON.stringify(mapped.TotalPrice)} items=${(mapped.OrderItems || []).length} sent=${picked.length} ancillaryItemsReturned=${survivors.length}`);
      for (const i of survivors) console.log("  returned", i.OfferItemID, JSON.stringify(i.Price?.TotalAmount ?? i.Price), JSON.stringify(i.PaxRefID));
      for (const x of picked) {
        console.log(`  ${x._ssr.padEnd(5)} ${x.free ? "FREE      " : "CHARGEABLE"} ${survivors.some((i) => i.OfferItemID === x.OfferItemID) ? "KEPT" : "DROPPED"}`);
      }
      const dump = arg("dump");
      if (dump) {
        const tag = `${st.offer.OwnerCode}-anc-${spec.map((x) => x.ssr).join("_")}`;
        console.log("DUMP", dumpJson(dump, `${tag}.reply.json`, reply));
        dumpJson(dump, `${tag}.mapped.json`, mapped);
      }
      return;
    }

    if (cmd === "change") {
      // Travel_OrderChange on a HELD order (never a ticketed one): ServiceList keyed on the order,
      // then the free services through the product's own builder (ADR-83, F7).
      const st = loadState();
      if (!st.orderId) throw new Error("Run `create` first (no orderId in state)");
      if (!flag("free")) throw new Error("`change` only drives the FREE (FreeOnly) path in this runner; pass --free");
      const spec = parseServiceSpec(arg("services"));
      if (!spec.length) throw new Error("--services VGML,WCHR is required");
      const { mapped } = await fetchServiceList(svc, sp, st, { order: true, timing: "postBooking" });
      saveState({ serviceList: mapped, serviceListMeta: { order: true, at: new Date().toISOString() } });
      console.log(`SERVICELIST (order ${st.orderId}): items=${mapped.Offer.OfferItem.length} defs=${mapped.DataLists.ServiceDefinition.length} offer=${mapped.Offer.OfferID} resp=${mapped.Offer.ResponseID} errors=${JSON.stringify(mapped.Errors)}`);
      // --host-pax: the host renumbers passengers after OrderCreate (NDCX-CONTEXT.md §3); resolve the
      // host's PaxID by name from the order-keyed ServiceList instead of assuming PAX{n}.
      const hostPaxId = flag("host-pax")
        ? (mapped.DataLists.Pax || []).find((x) => [].concat(x?.Individual?.GivenName ?? []).map(String).includes(st.paxs[0].individualInfo.givenName))?.PaxID ?? st.paxs[0].id
        : st.paxs[0].id;
      if (hostPaxId !== st.paxs[0].id) console.log(`  [host-pax] ${st.paxs[0].id} -> ${hostPaxId}`);
      const picked = pickServiceItems(mapped, spec.map((x) => ({ ...x, scope: x.scope ?? "all" })), hostPaxId);
      printPicked(picked);
      if (!picked.length) throw new Error("nothing to change: no matching item");
      if (picked.some((x) => !x.free)) throw new Error("a picked item is chargeable; refusing a no-payment change (use the app for chargeable adds)");
      const body = {
        OrderID: st.orderId,
        OwnerCode: st.order?.OwnerCode || st.offer?.OwnerCode,
        OfferID: mapped.Offer.OfferID,
        ShoppingResponseId: mapped.Offer.ResponseID,
        FreeOnly: true,
        AncillaryOfferIdList: picked.map(({ OfferItemID, PaxRefID, free, freeToken }) => ({ OfferItemID, PaxRefID, free, freeToken })),
        paxs: st.paxs,
      };
      const payload = createNdcxOrderChangePayload({ status: 1 }, body, sp); // status 1 = held
      if (flag("host-pax")) payload.Request.DataLists.PaxList.Pax[0].PaxID = hostPaxId;
      if (arg("dump")) dumpJson(arg("dump"), `${body.OwnerCode}-change.request.json`, payload);
      if (flag("dry-run")) {
        console.log("DRY-RUN payload", JSON.stringify(payload.Request.ChangeOrder, null, 1));
        return;
      }
      const reply = await svc.travelOrderChange(payload);
      const view = mapNdcxOrderViewReply(reply, {});
      const errs = arr(view?.Errors);
      console.log(`CHANGE ${errs.length ? "ERRORS" : "OK"} order=${st.orderId} items=${picked.length}`, errs.length ? JSON.stringify(errs) : "");
      if (arg("dump")) dumpJson(arg("dump"), `${body.OwnerCode}-change.reply.json`, reply);
      const sum = summarizeOrderServices(reply);
      console.log(`  services on reply: ${sum.services.length}`);
      for (const x of sum.services) console.log("   ", JSON.stringify(x));
      return;
    }

    if (cmd === "xshop" || cmd === "xprice" || cmd === "xchange") {
      // Voluntary flight change (NDCX-FLIGHTMODIFICATION-PLAN.md §10.2): the product's exchange builders,
      // same call order as order.controller.js handleFlightReshop / commitFlightChange, no DB.
      const st = loadState();
      if (!st.orderId) throw new Error("Run `create` first (no orderId in state)");
      const owner = st.order?.OwnerCode || st.offer?.OwnerCode;
      const pre = await svc.travelOrderRetrieve(createNdcxOrderRetrievePayload({ OrderID: st.orderId, OwnerCode: owner }, sp));
      const preView = mapNdcxOrderViewReply(pre, {});
      const ticketed = arr(preView?.TicketDocInfo).length > 0;
      const pnrStatus = Number(arg("status", ticketed ? 2 : 1));
      const airline = readNdcxAirlineOwnerCode(pre) ?? owner;
      const hostPaxList = extractNdcxOrderPaxList(pre);
      const log = (entry) => {
        const file = arg("log");
        const row = { at: new Date().toISOString(), cmd, carrier: airline, orderId: st.orderId, pnrStatus, ...entry };
        if (file) fs.appendFileSync(path.resolve(file), JSON.stringify(row) + "\n");
        return row;
      };

      if (cmd === "xshop") {
        const bounds = listNdcxBounds(pre);
        const boundIdx = Number(arg("bound", "0"));
        const bound = bounds[boundIdx];
        if (!bound) throw new Error(`No bound ${boundIdx} (order has ${bounds.length})`);
        if (!arg("date")) throw new Error("--date YYYY-MM-DD is required");
        const flights = [{ origin: arg("origin", bound.origin), destination: arg("dest", bound.destination), date: arg("date") }];
        const context = resolveNdcxExchangeContext(pre, { changedBounds: [boundIdx], flights });
        const support = resolveNdcxFlightChangeSupport(airline, pnrStatus, { dateOnly: context.dateOnly, hasInfant: context.hasInfant });
        console.log(`GATE ${airline} status=${pnrStatus} dateOnly=${context.dateOnly} allowed=${support.allowed} autoExch=${support.autoExchRequestInd} ${support.reason ?? ""} ${(support.warnings || []).join(" / ")}`);
        if (!support.allowed && !flag("ignore-gate")) {
          console.log("XSHOP SKIPPED (gate)", JSON.stringify(log({ bounds, flights, gate: support.reason })));
          return;
        }
        // --retain-mode product (default) | fixed (also resolve ServiceAssociations/ServiceDefinitionRef/PaxSegmentRefID,
        // the shape SQ/TU/LO use for the free bag allowance) | none (no RetainServiceID at all).
        const retainMode = arg("retain-mode", "product");
        const retainSource =
          retainMode === "fixed"
            ? (() => {
                const copy = JSON.parse(JSON.stringify(pre));
                for (const item of arr(copy?.Response?.Order?.OrderItem)) {
                  for (const sv of arr(item?.Service)) {
                    const sa = sv?.ServiceAssociations;
                    const nested = arr(sa?.ServiceDefinitionRef).flatMap((r) => arr(r?.PaxSegmentRefID));
                    if (sa && nested.length && !sa.PaxSegmentRefID && !sa.PaxJourneyRefID) sa.PaxSegmentRefID = nested;
                  }
                }
                return copy;
              })()
            : pre;
        const retain = retainMode === "none" ? {} : resolveNdcxRetainServiceIds(retainSource, context.changedPaxJourneyIds);
        console.log(`RETAIN (${retainMode}) ${JSON.stringify(retain)}`);
        const cabinCode = arg("cabin") || resolveNdcxCurrentCabinCode(pre, context.changedPaxJourneyIds);
        const autoExch = flag("no-auto") ? false : flag("auto") ? true : support.autoExchRequestInd;
        const payload = createNdcxOrderReshopShopPayload(
          {
            OrderID: st.orderId,
            OwnerCode: owner,
            originDestRequests: flights,
            deleteOrderItems: extractNdcxOrderItemIds(pre).map((id) => ({ orderItemRefId: id, retainServiceIds: retain[id] ?? [] })),
            paxs: hostPaxList.map((p) => ({ hostPaxId: p.PaxID, ptc: p.PTC, givenName: p.givenName, surname: p.surname })),
            cabin: cabinCode ? { typeCode: cabinCode } : undefined,
            autoExchRequestInd: autoExch,
          },
          sp,
        );
        const t0 = Date.now();
        let reply;
        try {
          reply = await svc.travelOrderReshop(payload);
        } catch (e) {
          console.log("XSHOP TRANSPORT ERROR", JSON.stringify(log({ bounds, flights, ms: Date.now() - t0, transportError: String(e.message).slice(0, 300) })));
          process.exitCode = 1;
          return;
        }
        const ms = Date.now() - t0;
        if (arg("dump")) dumpJson(arg("dump"), `${airline}-xshop.reply.json`, reply);
        const shop = mapNdcxExchangeShopReply(reply);
        // --pax-fix: simulate reading every Service/PaxRefID of an item (LO 2 ADT sends them repeated).
        if (flag("pax-fix")) {
          const rawOffers = arr(reply?.Response?.ReshopResults?.ReshopOffers?.ReshopOffer);
          for (const c of shop.Candidates) {
            const raw = rawOffers.find((o) => textOf(o?.OfferID) === c.OfferId);
            for (const it of c.OfferItems) {
              if (it.PaxRefIds?.length) continue;
              const rawItem = arr(raw?.AddOfferItem).find((x) => textOf(x?.OfferItemID) === it.OfferItemId);
              it.PaxRefIds = readAllPaxRefs(rawItem);
            }
          }
        }
        const candidates = shop.Candidates.map((c) => ({
          OfferId: c.OfferId,
          OwnerCode: c.OwnerCode,
          expires: c.OfferExpirationDateTime,
          total: c.TotalPrice,
          diff: c.Differential ? { sign: c.Differential.sign, total: c.Differential.totalAmount, cur: c.Differential.currency } : null,
          OfferItems: c.OfferItems,
          flights: c.Journeys.map((j) => j.Segments.map((s) => `${s.MarketingCarrierCode}${s.MarketingCarrierFlightNumber} ${s.Departure.IATA_LocationCode}-${s.Arrival.IATA_LocationCode} ${String(s.Departure.AircraftScheduledDateTime).slice(0, 16)}`).join(" + ")),
        }));
        saveState({ xshop: { at: new Date().toISOString(), pnrStatus, ShoppingResponseId: shop.ShoppingResponseId, candidates } });
        const row = log({ bounds, flights, cabin: cabinCode, autoExch, retainMode, retain, ms, useCase: shop.UseCase, candidates: candidates.length, errors: shop.Errors, warnings: shop.Warning, first: candidates.slice(0, 3).map(({ OfferItems, ...c }) => c) });
        console.log(`XSHOP ${shop.Errors.length ? "ERRORS" : "OK"} ${airline} status=${pnrStatus} ${flights[0].origin}-${flights[0].destination} ${flights[0].date} candidates=${candidates.length} ${ms}ms`);
        if (shop.Errors.length) console.log("  errors", JSON.stringify(shop.Errors));
        candidates.slice(0, Number(arg("show", "8"))).forEach((c, i) =>
          console.log(`  [${i}] ${c.diff ? c.diff.sign + " " + c.diff.total + " " + c.diff.cur : "nodiff"} total=${c.total?.amount ?? "?"} items=${c.OfferItems.length} exp=${c.expires} :: ${c.flights.join(" | ")}`),
        );
        void row;
        return;
      }

      const xs = st.xshop;
      if (!xs?.candidates?.length) throw new Error("Run `xshop` first (no candidates in state)");
      const cand = xs.candidates[Number(arg("candidate", "0"))];
      if (!cand) throw new Error("No such candidate");
      const pricePayload = createNdcxOrderReshopPricePayload(
        {
          OrderID: st.orderId,
          OwnerCode: owner,
          offerRefId: cand.OfferId,
          offerOwnerCode: cand.OwnerCode,
          shoppingResponseId: xs.ShoppingResponseId,
          offerItems: cand.OfferItems.map((i) => ({ offerItemRefId: i.OfferItemId, paxRefIds: i.PaxRefIds })),
        },
        sp,
      );
      const t0 = Date.now();
      const priceReply = await svc.travelOrderReshop(pricePayload);
      const priced = extractNdcxPricedExchangeOffer(priceReply, readCurrencyDecimals(priceReply?.Response));
      if (arg("dump")) dumpJson(arg("dump"), `${airline}-${cmd}-price.reply.json`, priceReply);
      if (flag("pax-fix")) {
        const rawOffer = arr(priceReply?.Response?.ReshopResults?.ReshopOffers?.ReshopOffer)[0];
        for (const it of priced.OfferItems ?? []) {
          if (it.PaxRefIds?.length) continue;
          const rawItem = arr(rawOffer?.AddOfferItem).find((x) => textOf(x?.OfferItemID) === it.OfferItemId);
          it.PaxRefIds = readAllPaxRefs(rawItem);
        }
      }
      const ms = Date.now() - t0;
      const pricedSummary = {
        OfferId: priced.OfferId,
        total: priced.TotalPrice,
        diff: priced.Differential ? { sign: priced.Differential.sign, total: priced.Differential.totalAmount, cur: priced.Differential.currency } : null,
        shopDiff: cand.diff,
        items: priced.OfferItems?.length,
        errors: priced.Errors,
      };
      console.log(`XPRICE ${priced.Errors?.length || !priced.OfferId ? "ERRORS" : "OK"} ${airline} status=${pnrStatus} ${ms}ms`, JSON.stringify(pricedSummary));
      if (cmd === "xprice") {
        log({ ms, ...pricedSummary });
        return;
      }

      // xchange: Travel_OrderChange commit. Held = no PaymentInfo; ticketed = the saved FOP when add-collect.
      if (!flag("commit")) throw new Error("xchange commits the exchange on the host; pass --commit");
      if (priced.Errors?.length || !priced.OfferId) {
        log({ ms, ...pricedSummary, committed: false });
        return;
      }
      const held = pnrStatus === 1;
      const support = resolveNdcxFlightChangeSupport(airline, pnrStatus, { hasInfant: hostPaxList.some((p) => p.PTC === "INF") });
      const pay = resolveNdcxExchangePaymentAmount(priced.Differential, support.residualAutoRefund);
      const { validatingCarrierCode } = resolveNdcxExchangeOwnerCodes(owner, priced.ValidatingCarrierCode, airline);
      const pnr = {
        paymentMethod: st.pnr?.Payment,
        paymentTypeCode: st.pnr?.paymentTypeCode,
        EnrollmentStatusText: st.pnr?.EnrollmentStatusText,
        CardBrandCode: st.pnr?.CardBrandCode,
        ExpirationDate: st.pnr?.ExpirationDate,
        CardHolderName: st.pnr?.CardHolderName,
        pnrList: [{ ownerIataCode: owner }],
      };
      const changePayload = createNdcxOrderChangeExchangePayload(
        {
          OrderID: st.orderId,
          OwnerCode: validatingCarrierCode,
          offerId: priced.OfferId,
          offerOwnerCode: priced.OwnerCode,
          shoppingResponseId: priced.ShoppingResponseId,
          offerItems: priced.OfferItems.map((item) => ({ offerItemRefId: item.OfferItemId, paxRefIds: item.PaxRefIds })),
          paxs: hostPaxList.map((p) => ({ hostPaxId: p.PaxID, ptc: p.PTC, givenName: p.givenName, surname: p.surname })),
          pnrStatus: held ? 1 : 2,
          amount: pay.amount,
          currency: pay.currency,
          pnr,
        },
        sp,
      );
      const t1 = Date.now();
      let changeReply;
      try {
        changeReply = await svc.travelOrderChange(changePayload);
      } catch (e) {
        console.log("XCHANGE TRANSPORT ERROR", JSON.stringify(log({ ...pricedSummary, transportError: String(e.message).slice(0, 300) })));
        process.exitCode = 1;
        return;
      }
      const view = mapNdcxOrderViewReply(changeReply, {});
      const errs = arr(view?.Errors);
      const tickets = arr(view?.TicketDocInfo).map((t) => ({ number: textOf(t?.Ticket?.TicketNumber), coupons: (t?.Ticket?.Coupon ?? []).map((c) => textOf(c?.CouponStatusCode)) }));
      const row = log({ ...pricedSummary, paid: pay.amount, committed: !errs.length, changeMs: Date.now() - t1, changeErrors: errs, total: textOf(view?.Order?.TotalPrice?.TotalAmount), tickets });
      console.log(`XCHANGE ${errs.length ? "ERRORS" : "OK"}`, JSON.stringify(row));
      return;
    }

    if (cmd === "setpax") {
      // Rebuild the pax list from --pax/--surname without touching the priced offer
      // (names are not part of pricing; PTCs must stay identical).
      const st = loadState();
      const paxs = buildPaxs(arg("pax", st.paxSpec || "2ADT,1CNN,1INF"), arg("surname"));
      saveState({ paxs });
      console.log("SETPAX OK", paxs.map((p) => `${p.id}:${p.ptc}:${p.individualInfo.titleName} ${p.individualInfo.givenName} ${p.individualInfo.surname}/${p.gender}/${p.birthDate}`).join(" | "));
      return;
    }

    if (cmd === "create") {
      const st = loadState();
      const offer = st.offer;
      if (!offer?.OfferID) throw new Error("Run `price` first (no priced offer in state)");
      const paymentMode = arg("payment", "cash");
      const cardBrand = arg("card", offer.OwnerCode === "AA" ? "VI" : "VI");
      const payment =
        paymentMode === "cash"
          ? { Payment: "Cash", PaymentInfoID: "PAY1", paymentTypeCode: "CA" }
          : (() => {
              const card = (TEST_CARDS[offer.OwnerCode] || TEST_CARDS.AA)[cardBrand];
              if (!card) throw new Error(`No test card ${cardBrand} for ${offer.OwnerCode}`);
              return {
                Payment: "Credit Card",
                PaymentInfoID: "PAY1",
                paymentTypeCode: "CC",
                CardBrandCode: cardBrand,
                ExpirationDate: card.exp,
                CardHolderName: "TEST TESTCARD",
                EncCardNumber: encryptData(card.number),
                EncCvv: encryptData(card.cvv),
                payerInfo: {
                  payerFirstName: "TEST",
                  payerLastName: "TESTCARD",
                  payerEmail: "cert.test@example.com",
                },
              };
            })();
      applyNdcxEnrollmentStatusText({ payment });
      const body = {
        oras: ["AMADEUS_NDCX"],
        OfferID: offer.OfferID,
        OfferIdList: offer.OrderItems,
        ShoppingResponseId: offer.ResponseID,
        OwnerCode: offer.OwnerCode,
        Fare: offer.OrderItems.flatMap((i) => i.Fare ?? []),
        paxs: st.paxs,
        payment,
        agenceInfo: { id_sales_point: SALES_POINT_ID, devise: "EUR" },
      };

      // --services (NDCX-ANCILLARIES-PLAN.md Task 0 Step 3): non-bag ancillaries at checkout.
      //   chargeable → 2nd Travel_OfferPrice, then AncillaryOfferIdList (as AmadeusNdcxAdapter.bookFlight does)
      //   free       → never repriced (F6); appended to the SelectedOffer of OrderCreate:
      //                --free-mode h1 (default): same SelectedOffer as the air items (ADR-82 as written, F8)
      //                --free-mode h2          : a 2nd SelectedOffer on the ServiceList OfferID/ResponseID
      let freeRows = [];
      let freeMode = null;
      let serviceOffer = null;
      if (arg("services")) {
        const sl = st.serviceList;
        if (!sl || st.serviceListMeta?.order) throw new Error("Run `services` first (pre-booking ServiceList of THIS priced offer)");
        const picked = pickServiceItems(sl, parseServiceSpec(arg("services")), st.paxs[0].id);
        printPicked(picked);
        if (!picked.length) throw new Error("--services selected nothing");
        const chargeable = picked.filter((x) => !x.free);
        freeRows = picked.filter((x) => x.free);
        freeMode = arg("free-mode", "h1");
        serviceOffer = { OfferID: sl.Offer.OfferID, ResponseID: sl.Offer.ResponseID, OwnerCode: offer.OwnerCode };
        if (chargeable.length) {
          const rp = await repriceAncillaries(svc, sp, st, chargeable, { qtyFree: false });
          if (rp.mapped.Errors?.length) throw new Error("2nd OfferPrice refused: " + JSON.stringify(rp.mapped.Errors));
          const airIds = new Set(offer.OrderItems.map((i) => i.OfferItemID));
          body.OfferID = rp.mapped.OfferID;
          body.ShoppingResponseId = rp.mapped.ResponseID;
          body.OfferIdList = rp.mapped.OrderItems.filter((i) => airIds.has(i.OfferItemID));
          body.AncillaryOfferIdList = rp.mapped.OrderItems
            .filter((i) => i.OfferItemID && !airIds.has(i.OfferItemID))
            .map((i) => ({ OfferItemID: i.OfferItemID, PaxRefID: Array.isArray(i.PaxRefID) ? i.PaxRefID : [i.PaxRefID].filter(Boolean) }));
          console.log(`  [reprice] ancillary items returned=${body.AncillaryOfferIdList.length} for ${chargeable.length} chargeable sent; total=${JSON.stringify(rp.mapped.TotalPrice)}`);
          if (body.AncillaryOfferIdList.length !== chargeable.length) throw new Error("the 2nd OfferPrice did not return every chargeable item — aborting before creating anything");
        }
      }

      // H1 goes through the PRODUCT builder (FreeServiceOfferIdList, ADR-82/90: the freeToken of every
      // item is verified there), so the spike exercises the real code path. H2 is an experiment that does
      // not exist in the product: the runner patches a second SelectedOffer in by hand.
      if (freeRows.length && freeMode !== "h2") {
        body.FreeServiceOfferIdList = freeRows.map((x) => ({
          OfferItemID: x.OfferItemID,
          PaxRefID: x.PaxRefID,
          freeToken: x.freeToken,
          serviceOfferId: x.serviceOfferId,
        }));
      }
      const payload = createNdcxOrderCreatePayload(body, sp);
      if (freeRows.length && freeMode === "h2") {
        const freeItems = freeRows.map((x) => ({ OfferItemID: x.OfferItemID, PaxRefID: x.PaxRefID }));
        // The pre-booking ServiceList usually answers ShoppingResponseID "NOT_USED": then the AIR response id is the only real one.
        const responseRef = serviceOffer.ResponseID && serviceOffer.ResponseID !== "NOT_USED" ? serviceOffer.ResponseID : body.ShoppingResponseId;
        payload.Request.CreateOrder.SelectedOffer = [
          payload.Request.CreateOrder.SelectedOffer,
          { OfferID: serviceOffer.OfferID, OwnerCode: serviceOffer.OwnerCode, ShoppingResponseRefID: responseRef, SelectedOfferItem: freeItems },
        ];
      }
      if (freeRows.length) console.log(`  [free] ${freeRows.length} free item(s) booked as ${freeMode === "h2" ? "a 2nd SelectedOffer (H2, experimental)" : "FreeServiceOfferIdList (H1)"}`);
      if (arg("dump")) dumpJson(arg("dump"), `${offer.OwnerCode}-create.request.json`, payload);
      if (flag("dry-run")) {
        console.log("DRY-RUN SelectedOffer", JSON.stringify(payload.Request.CreateOrder.SelectedOffer, null, 1));
        return;
      }
      const reply = await svc.travelOrderCreate(payload);
      if (arg("dump")) dumpJson(arg("dump"), `${offer.OwnerCode}-create.reply.json`, reply);
      const orderId = textOf(reply?.Response?.Order?.OrderID);
      const bookingRefs = arr(reply?.Response?.Order?.BookingRef).map((b) => textOf(b?.BookingID));
      const errs = arr(reply?.Response?.Error ?? reply?.Error).map((e) => ({
        code: textOf(e?.Code),
        desc: textOf(e?.DescText),
      }));
      saveState({
        step: "created",
        pnr: payment,
        orderId,
        bookingRefs,
        order: { OrderID: orderId, OwnerCode: offer.OwnerCode },
      });
      console.log(`CREATE OK order=${orderId} pnr=${bookingRefs.join(",")} payment=${paymentMode}`);
      if (errs.length) console.log("CREATE ERRORS", JSON.stringify(errs, null, 2));
      return;
    }

    if (cmd === "pay") {
      const st = loadState();
      if (!st.orderId) throw new Error("Run `create` first (no orderId in state)");
      const offer = st.offer;
      // Fresh retrieve: the pay amount/currency come from the live order (ADR-73).
      const pre = await svc.travelOrderRetrieve(
        createNdcxOrderRetrievePayload({ OrderID: st.orderId, OwnerCode: offer.OwnerCode }, sp),
      );
      const view = mapNdcxOrderViewReply(pre, {});
      const total = textOf(view?.Order?.TotalPrice?.TotalAmount);
      const currency = view?.Order?.TotalPrice?.TotalAmount?._attributes?.CurCode ?? "EUR";
      const pnr = {
        paymentMethod: st.pnr?.Payment,
        paymentTypeCode: st.pnr?.paymentTypeCode,
        EnrollmentStatusText: st.pnr?.EnrollmentStatusText,
        CardBrandCode: st.pnr?.CardBrandCode,
        ExpirationDate: st.pnr?.ExpirationDate,
        CardHolderName: st.pnr?.CardHolderName,
        totalPrice: total,
        currency,
        pnrList: [{ ownerIataCode: offer.OwnerCode }],
      };
      const payload = createNdcxOrderPayPayload(
        pnr,
        { OrderID: st.orderId, OwnerCode: offer.OwnerCode, Amount: total, CurCode: currency },
        sp,
      );
      const reply = await svc.travelOrderPay(payload);
      const tickets = arr(reply?.Response?.TicketDocInfos?.TicketDocInfo).map((t) => ({
        number: textOf(t?.TicketDocument?.TicketDocNbr),
        coupons: (t?.TicketDocument?.Coupon ?? []).map((c) => textOf(c?.Status)),
      }));
      const errs = arr(reply?.Response?.Error ?? reply?.Error).map((e) => ({
        code: textOf(e?.Code),
        desc: textOf(e?.DescText),
      }));
      saveState({ step: "paid", tickets });
      console.log(`PAY OK order=${st.orderId} amount=${total} ${currency} tickets=${tickets.map((t) => t.number).join(",")}`);
      if (errs.length) console.log("PAY ERRORS", JSON.stringify(errs, null, 2));
      return;
    }

    if (cmd === "retrieve") {
      const st = loadState();
      const owner = st.order?.OwnerCode || st.offer?.OwnerCode;
      const reply = await svc.travelOrderRetrieve(
        createNdcxOrderRetrievePayload({ OrderID: st.orderId, OwnerCode: owner }, sp),
      );
      const view = mapNdcxOrderViewReply(reply, {});
      const tickets = arr(view?.TicketDocInfo).map((t) => ({
        number: textOf(t?.Ticket?.TicketNumber),
        coupons: (t?.Ticket?.Coupon ?? []).map((c) => textOf(c?.CouponStatusCode)),
      }));
      const summary = {
        orderId: st.orderId,
        status: textOf(view?.Order?.StatusCode),
        total: textOf(view?.Order?.TotalPrice?.TotalAmount) + " " + (view?.Order?.TotalPrice?.TotalAmount?._attributes?.CurCode ?? ""),
        pnr: arr(view?.Order?.BookingRef).map((b) => textOf(b?.BookingID)),
        tickets,
        errors: view?.Errors ?? null,
      };
      console.log("RETRIEVE", JSON.stringify(summary, null, 2));
      // Task 0 Step 7: what persistence needs to know about the Service rows of a retrieve.
      const sum = summarizeOrderServices(reply);
      console.log(`  services=${sum.services.length} definitions=${sum.definitions.length}`);
      for (const x of sum.services) console.log("  svc", JSON.stringify(x));
      for (const x of sum.definitions) console.log("  def", JSON.stringify(x));
      const dump = arg("dump");
      if (dump) {
        const tag = `${owner}${arg("tag") ? "-" + arg("tag") : ""}`;
        console.log("DUMP", dumpJson(dump, `${tag}-orderview.reply.json`, reply));
        dumpJson(dump, `${tag}-orderview.mapped.json`, view);
      }
      return;
    }

    if (cmd === "quote") {
      const st = loadState();
      const owner = st.order?.OwnerCode || st.offer?.OwnerCode;
      const pre = await svc.travelOrderRetrieve(
        createNdcxOrderRetrievePayload({ OrderID: st.orderId, OwnerCode: owner }, sp),
      );
      const payload = createNdcxOrderReshopCancelPayload(
        { OrderID: st.orderId, OwnerCode: owner, orderItemIds: extractNdcxOrderItemIds(pre) },
        sp,
      );
      const quote = mapNdcxOrderReshopCancelQuote(await svc.travelOrderReshop(payload), {
        labels: extractNdcxOrderItemLabels(pre),
      });
      const ticketState = arr(mapNdcxOrderViewReply(pre, {}).TicketDocInfo).map((t) => ({
        number: textOf(t?.Ticket?.TicketNumber),
        coupons: (t?.Ticket?.Coupon ?? []).map((c) => textOf(c?.CouponStatusCode)),
      }));
      saveState({ step: "quoted", quote: { UseCase: quote.UseCase, RefundItems: quote.RefundItems } });
      console.log("QUOTE", JSON.stringify({ ...quote, ticketState }, null, 2));
      return;
    }

    if (cmd === "cancel") {
      const st = loadState();
      const owner = st.order?.OwnerCode || st.offer?.OwnerCode;
      const payload = createNdcxOrderCancelPayload({ OrderID: st.orderId, OwnerCode: owner }, sp);
      let failed = null;
      try {
        const reply = await svc.travelOrderCancel(payload);
        const coupons = JSON.stringify(reply?.Response ?? {}).match(/"Status":"?[A-Z]"?/g);
        console.log("CANCEL OK coupon statuses=" + JSON.stringify(coupons));
      } catch (e) {
        failed = { name: e.name, message: String(e.message).slice(0, 500) };
        console.log("CANCEL ERROR", JSON.stringify(failed));
      }
      // Verification retrieve (a cancelled order may become unretrievable: 119 expected).
      try {
        const post = await svc.travelOrderRetrieve(
          createNdcxOrderRetrievePayload({ OrderID: st.orderId, OwnerCode: owner }, sp),
        );
        const view = mapNdcxOrderViewReply(post, {});
        console.log(
          "POST-CANCEL RETRIEVE",
          JSON.stringify(
            {
              status: textOf(view?.Order?.StatusCode),
              tickets: arr(view?.TicketDocInfo).map((t) => ({
                number: textOf(t?.Ticket?.TicketNumber),
                coupons: (t?.Ticket?.Coupon ?? []).map((c) => textOf(c?.CouponStatusCode)),
              })),
              errors: view?.Errors ?? null,
            },
            null,
            2,
          ),
        );
      } catch (e) {
        console.log("POST-CANCEL RETRIEVE ERR", String(e.message).slice(0, 300));
      }
      if (failed) process.exitCode = 1;
      return;
    }

    console.error("unknown command: " + cmd);
    process.exit(2);
  } finally {
    await svc.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL", e.name, String(e.message).slice(0, 800));
    process.exit(1);
  });
