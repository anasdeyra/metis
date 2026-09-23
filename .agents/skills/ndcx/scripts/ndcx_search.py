#!/usr/bin/env python3
"""
NDC[X] test-server connectivity + shopping search (Fare_MasterPricerTravelBoardSearch).

Derived from the Amadeus "WBS Implementation Guide NDC[X] v1.5" and the shipped
XML samples. Stateless call, SOAP Header 4.0, WS-Security UsernameToken /
PasswordDigest -- exactly the header shape in the sample queries.

Usage:
  export NDCX_WSAP="https://noded5.test.webservices.amadeus.com/WSAP"
  export NDCX_USER="WSUSER"          # your WSAP username
  export NDCX_PASS="........"        # plain-text WSAP password
  export NDCX_OFFICE="NCE1A0950"     # your NDC-activated Office ID (PseudoCityCode)

  python3 ndcx_search.py --from LON --to NYC --date 2026-10-15 \
      --return-date 2026-10-22 --adults 1 --carrier BA --ndc-only

  # dry run: print the SOAP envelope, send nothing
  python3 ndcx_search.py --from PAR --to JFK --date 2026-10-15 --dry-run
"""

import argparse
import base64
import hashlib
import os
import sys
import uuid
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    requests = None

MPTB_VERSION = "23_4"          # guide: Fare_MasterPricerTravelBoardSearch 23.4
ACTION = f"http://webservices.amadeus.com/FMPTBQ_{MPTB_VERSION}_1A"
DEFAULT_WSAP = "https://noded5.test.webservices.amadeus.com/WSAP"


# --------------------------------------------------------------------------
# WS-Security: PasswordDigest = Base64( SHA1( nonce + created + SHA1(pwd) ) )
# nonce is the RAW bytes; Created is the exact same string sent in the header.
# --------------------------------------------------------------------------
def build_security(username: str, password: str):
    nonce = os.urandom(16)
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    digest = hashlib.sha1(
        nonce + created.encode("utf-8") + hashlib.sha1(password.encode("utf-8")).digest()
    ).digest()
    return {
        "username": username,
        "nonce_b64": base64.b64encode(nonce).decode(),
        "digest_b64": base64.b64encode(digest).decode(),
        "created": created,
    }


def ddmmyy(iso_date: str) -> str:
    """2026-10-15 -> 151026 (MasterPricer date format)."""
    return datetime.strptime(iso_date, "%Y-%m-%d").strftime("%d%m%y")


def build_itineraries(args):
    legs = [(args.origin, args.destination, args.date)]
    if args.return_date:
        legs.append((args.destination, args.origin, args.return_date))
    out = []
    for i, (dep, arr, date) in enumerate(legs, start=1):
        out.append(f"""      <itinerary>
        <requestedSegmentRef>
          <segRef>{i}</segRef>
        </requestedSegmentRef>
        <departureLocalization>
          <departurePoint>
            <locationId>{dep}</locationId>
          </departurePoint>
        </departureLocalization>
        <arrivalLocalization>
          <arrivalPointDetails>
            <locationId>{arr}</locationId>
          </arrivalPointDetails>
        </arrivalLocalization>
        <timeDetails>
          <firstDateTimeDetail>
            <date>{ddmmyy(date)}</date>
          </firstDateTimeDetail>
        </timeDetails>
      </itinerary>""")
    return "\n".join(out)


def build_pax(args):
    """PTC blocks. Guide: use CNN (not CHD) for children; INF rides on an adult ref."""
    blocks, ref = [], 0
    if args.adults:
        travellers = ""
        for _ in range(args.adults):
            ref += 1
            travellers += f"\n          <traveller>\n            <ref>{ref}</ref>\n          </traveller>"
        blocks.append(f"      <paxReference>\n        <ptc>ADT</ptc>{travellers}\n      </paxReference>")
    if args.children:
        travellers = ""
        for _ in range(args.children):
            ref += 1
            travellers += f"\n          <traveller>\n            <ref>{ref}</ref>\n          </traveller>"
        blocks.append(f"      <paxReference>\n        <ptc>CNN</ptc>{travellers}\n      </paxReference>")
    for n in range(1, args.infants + 1):
        # infant attached to adult n
        blocks.append(
            "      <paxReference>\n        <ptc>INF</ptc>\n        <traveller>\n"
            f"          <ref>{n}</ref>\n          <infantIndicator>1</infantIndicator>\n"
            "        </traveller>\n      </paxReference>"
        )
    total_px = args.adults + args.children  # INF not counted in PX
    return "\n".join(blocks), total_px


def build_envelope(args, sec):
    pax_xml, total_px = build_pax(args)

    units = [f"""        <unitNumberDetail>
          <numberOfUnits>{total_px}</numberOfUnits>
          <typeOfUnit>PX</typeOfUnit>
        </unitNumberDetail>""",
             f"""        <unitNumberDetail>
          <numberOfUnits>{args.recommendations}</numberOfUnits>
          <typeOfUnit>RC</typeOfUnit>
        </unitNumberDetail>"""]
    if args.ndc_only:
        # value MUST be 100 (= 100% NDC), otherwise the criterion is ignored
        units.append("""        <unitNumberDetail>
          <numberOfUnits>100</numberOfUnits>
          <typeOfUnit>NDC</typeOfUnit>
        </unitNumberDetail>""")

    price_types = list(args.price_type) or ["RP"]
    if args.exclude_ndc:
        price_types.append("XND")
    pt_xml = "\n".join(f"            <priceType>{p}</priceType>" for p in price_types)

    carrier_xml = ""
    if args.carrier:
        carrier_xml = "      <travelFlightInfo>\n" + "".join(
            f"""        <companyIdentity>
          <carrierQualifier>{args.carrier_qualifier}</carrierQualifier>
          <carrierId>{c}</carrierId>
        </companyIdentity>\n""" for c in args.carrier
        ) + "      </travelFlightInfo>\n"

    corp_xml = ""
    if args.corporate_code:
        # Corporate Code search -> priceType RW + the corporate code
        corp_xml = f"""        <corporate>
          <corporateId>
            <identity>{args.corporate_code}</identity>
          </corporateId>
        </corporate>
"""

    return f"""<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ses="http://xml.amadeus.com/2010/06/Session_v3">
  <soap:Header>
    <add:MessageID xmlns:add="http://www.w3.org/2005/08/addressing">{uuid.uuid4()}</add:MessageID>
    <add:Action xmlns:add="http://www.w3.org/2005/08/addressing">{ACTION}</add:Action>
    <add:To xmlns:add="http://www.w3.org/2005/08/addressing">{args.endpoint}</add:To>
    <link:TransactionFlowLink xmlns:link="http://wsdl.amadeus.com/2010/06/ws/Link_v1" />
    <oas:Security xmlns:oas="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <oas:UsernameToken xmlns:oas1="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" oas1:Id="UsernameToken-1">
        <oas:Username>{sec['username']}</oas:Username>
        <oas:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{sec['nonce_b64']}</oas:Nonce>
        <oas:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{sec['digest_b64']}</oas:Password>
        <oas1:Created>{sec['created']}</oas1:Created>
      </oas:UsernameToken>
    </oas:Security>
    <AMA_SecurityHostedUser xmlns="http://xml.amadeus.com/2010/06/Security_v1">
      <UserID AgentDutyCode="SU" POS_Type="1" PseudoCityCode="{args.office}" RequestorType="U" />
    </AMA_SecurityHostedUser>
  </soap:Header>
  <soap:Body>
    <Fare_MasterPricerTravelBoardSearch>
      <numberOfUnit>
{chr(10).join(units)}
      </numberOfUnit>
{pax_xml}
      <fareOptions>
        <pricingTickInfo>
          <pricingTicketing>
{pt_xml}
          </pricingTicketing>
        </pricingTickInfo>
{corp_xml}      </fareOptions>
{carrier_xml}{build_itineraries(args)}
    </Fare_MasterPricerTravelBoardSearch>
  </soap:Body>
</soap:Envelope>"""


# --------------------------------------------------------------------------
# Response parsing: NDC recommendations are flagged priceType=N and carry an
# "OI" (offer index) ref pointing into offersGroup, where ShoppingResponseID
# (internalId), OfferID (uniqueOfferReference) and OfferItemIDs live.
# --------------------------------------------------------------------------
def summarize(xml_text: str):
    import re
    import xml.etree.ElementTree as ET

    def local(tag):
        return tag.split("}", 1)[-1]

    root = ET.fromstring(xml_text.encode("utf-8"))

    # SOAP faults first
    for el in root.iter():
        if local(el.tag) == "faultstring":
            print(f"SOAP FAULT: {el.text}")
            return
    errors = [el.text for el in root.iter() if local(el.tag) in ("freeText", "errorFreeText") and el.text]
    for e in dict.fromkeys(errors):
        if e and len(e) > 3:
            print(f"  [message] {e}")

    shopping_response_id = None
    for el in root.iter():
        if local(el.tag) == "internalId":
            shopping_response_id = el.text
            break

    offers = {}
    for og in root.iter():
        if local(og.tag) != "offers":
            continue
        ref = uor = None
        items, otl, ttl = [], None, None
        for ch in og.iter():
            t = local(ch.tag)
            if t == "reference" and ref is None:
                ref = ch.text
            elif t == "uniqueOfferReference":
                uor = ch.text
            elif t == "offerItemId":
                items.append(ch.text)
        for dt in og.iter():
            if local(dt.tag) == "dateAndTimeDetails":
                kv = {local(c.tag): c.text for c in dt}
                if kv.get("qualifier") == "OTL":
                    otl = f"{kv.get('date')} {kv.get('time')}"
                elif kv.get("qualifier") == "TTL":
                    ttl = f"{kv.get('date')} {kv.get('time')}"
        if ref:
            offers[ref] = {"offer_id": uor, "items": items, "otl": otl, "ttl": ttl}

    recs = []
    for rec in root.iter():
        if local(rec.tag) != "recommendation":
            continue
        num = ptype = amount = owner = None
        oi = None
        for ch in rec.iter():
            t = local(ch.tag)
            if t == "number" and num is None:
                num = ch.text
            elif t == "priceType" and ptype is None:
                ptype = ch.text
            elif t == "company" and owner is None:
                owner = ch.text
            elif t == "amount" and amount is None:
                amount = ch.text
        for rd in rec.iter():
            if local(rd.tag) == "referencingDetail":
                kv = {local(c.tag): c.text for c in rd}
                if kv.get("refQualifier") == "OI":
                    oi = kv.get("refNumber")
        recs.append({"n": num, "ndc": ptype == "N", "carrier": owner,
                     "amount": amount, "oi": oi})

    ndc = [r for r in recs if r["ndc"]]
    print(f"\nShoppingResponseID : {shopping_response_id}")
    print(f"Recommendations    : {len(recs)} total / {len(ndc)} NDC (priceType=N)")
    print(f"Offers in group    : {len(offers)}\n")
    for r in ndc[:10]:
        o = offers.get(r["oi"] or "", {})
        print(f"  #{r['n']:>3}  {r['carrier']}  {r['amount']}")
        print(f"        OfferID     : {o.get('offer_id')}")
        print(f"        OfferItemIDs: {', '.join(o.get('items') or [])}")
        print(f"        OTL {o.get('otl')}   TTL {o.get('ttl')}")
    if len(ndc) > 10:
        print(f"  ... {len(ndc) - 10} more NDC recommendations")
    print("\nNext step -> Travel_OfferPrice with ShoppingResponseID + OfferID + "
          "OfferItemID(s) + OwnerCode.")


def main():
    p = argparse.ArgumentParser(description="NDC[X] MasterPricer TravelBoard search")
    p.add_argument("--from", dest="origin", required=True, help="City/airport code, e.g. LON")
    p.add_argument("--to", dest="destination", required=True, help="City/airport code, e.g. NYC")
    p.add_argument("--date", required=True, help="Outbound date YYYY-MM-DD")
    p.add_argument("--return-date", help="Inbound date YYYY-MM-DD (omit for one-way)")
    p.add_argument("--adults", type=int, default=1)
    p.add_argument("--children", type=int, default=0, help="PTC CNN")
    p.add_argument("--infants", type=int, default=0, help="PTC INF, attached to adult N")
    p.add_argument("--carrier", action="append", default=[], help="Preferred carrier (repeatable)")
    p.add_argument("--carrier-qualifier", default="M",
                   choices=["M", "MNDC", "X", "XNDC"],
                   help="M=mandatory, MNDC=NDC only for carrier, X/XNDC=exclude")
    p.add_argument("--price-type", action="append", default=[],
                   help="RP public, RU unifares, RW corporate, ET e-ticket, MNR minirules")
    p.add_argument("--corporate-code", help="Corporate code (sends with RW)")
    p.add_argument("--ndc-only", action="store_true", help="NDC content only (units=100)")
    p.add_argument("--exclude-ndc", action="store_true", help="Add priceType XND")
    p.add_argument("--recommendations", type=int, default=250, help="RC cap")
    p.add_argument("--endpoint", default=os.environ.get("NDCX_WSAP", DEFAULT_WSAP))
    p.add_argument("--office", default=os.environ.get("NDCX_OFFICE", ""))
    p.add_argument("--user", default=os.environ.get("NDCX_USER", ""))
    p.add_argument("--password", default=os.environ.get("NDCX_PASS", ""))
    p.add_argument("--dry-run", action="store_true", help="Print envelope, do not send")
    p.add_argument("--save", help="Write request/response XML to this prefix")
    args = p.parse_args()

    if args.corporate_code and "RW" not in args.price_type:
        args.price_type.append("RW")

    sec = build_security(args.user or "WSUSER", args.password or "PLACEHOLDER")
    envelope = build_envelope(args, sec)

    if args.save:
        open(f"{args.save}_request.xml", "w").write(envelope)

    if args.dry_run:
        print(envelope)
        return

    missing = [n for n, v in (("NDCX_USER", args.user), ("NDCX_PASS", args.password),
                              ("NDCX_OFFICE", args.office)) if not v]
    if missing:
        sys.exit(f"Missing credentials: {', '.join(missing)}  (or use --dry-run)")
    if requests is None:
        sys.exit("pip install requests")

    print(f"POST {args.endpoint}\nSOAPAction: {ACTION}\nOffice: {args.office}")
    r = requests.post(
        args.endpoint,
        data=envelope.encode("utf-8"),
        headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": ACTION},
        timeout=90,
    )
    print(f"HTTP {r.status_code}  ({len(r.content)} bytes)")
    if args.save:
        open(f"{args.save}_response.xml", "w").write(r.text)
    try:
        summarize(r.text)
    except Exception as exc:  # noqa: BLE001
        print(f"(could not parse: {exc})")
        print(r.text[:3000])


if __name__ == "__main__":
    main()
