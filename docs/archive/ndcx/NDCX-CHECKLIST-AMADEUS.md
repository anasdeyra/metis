# Checklist de certification Amadeus NDC[X] Prime — état au 2026-10-18

Fichier rempli : `~/Downloads/Checklist-NDC-Prime-booking-flow-and-Cancel-METIS.docx`
(l'original Amadeus est conservé intact à côté ; la version du 12/10 est gardée en
`…-METIS_2026-10-12.docx`).

> ## Mise à jour du 18/10 — ce qui a changé depuis le 12/10
>
> - **« Upsell at pricing »** : implémenté (ADR-60…67) et **prouvé en live** le 18/10 —
>   Offer_06 (9 `OtherOffers` répondus à `FarePreferences@PreferencesContext="Upsell"`) +
>   Create_05 (OfferID d'un bundle `OtherOffers` + `ShoppingResponseID` mis à jour) sur la
>   commande `AA001XYYX21A3` / PNR `IFYALV`. Le blocage n° 2 est levé, case cochée.
> - **Les 6 cas de test sont prouvés en live**, chacun avec son PNR (tableau plus bas).
>   Le cas 1 (2 ADT / domestique / aller simple / direct / cash) a été exécuté le 18/10 :
>   `AA001HB2X21A3` / PNR `IAXGEZ` (JFK-ORD AA3162, 266,16 EUR, billets …896-897).
> - **XND** : le correctif est dans l'arbre de travail (`AMADEUS_EXCLUDE_NDC !== "false"`,
>   actif par défaut) mais **ni commité ni déployé**. La case XND est cochée dans le
>   formulaire ; elle ne vaut que si le correctif est **déployé en production avant l'envoi**
>   (sinon la décocher — cf. § « 1. L'option XND » plus bas).
> - **Services** : 11 des 12 sont réellement utilisés par l'appli (vérifié dans le code) →
>   cochés ; seul `Ticket_DisplayTSMP` reste décoché (appelé nulle part).
> - Preuves : `api-aerial/use cases/NDCX/cert-runs/cases/` (C1…C4 : RQ/RS bruts par étape,
>   README par cas, zips ; `INDEX.md`), `use cases/NDCX/refund-test/results.md` (remboursement),
>   `cert-runs/logs/` (sorties console), `cert-runs/state/` (ids ; PAN/CVV purgés).

Échéance : **08/11/2026** (fin de projet Amadeus 09/11). Questions techniques à
`API.consulting.assistance@amadeus.com` au plus tard le **28/10**, objet contenant
« Metis Digital », un mail par sujet.

## Ce qui est coché, et pourquoi

### Services (11 cochés sur 13 lignes, `Ticket_DisplayTSMP` exclu)

| Service | Coché | Preuve dans le code |
|---|---|---|
| `Fare_MasterPricerTravelBoardSearch` | ✅ | `AMADEUS_NDCX/shopping.utils.js` → `shopping.controller.js` (`FMPTBQ_24_6_1A`) |
| `Travel_OfferPrice` | ✅ | `offer.controller.js` (`Travel_OfferPrice_1.3`) |
| `Travel_OrderCreate` | ✅ | `order.controller.js` (`Travel_OrderCreate_1.7`) |
| `Travel_OrderPay` | ✅ | `order.controller.js` (`Travel_OrderPay_1.7`) |
| `Travel_OrderRetrieve` | ✅ | `order.controller.js` (`Travel_OrderRetrieve_1.7`) |
| `Travel_OrderReshop` (void/refund) | ✅ | `orderReshop.utils.js` — quote d'annulation (`_1.6`) |
| `Travel_OrderCancel` | ✅ | `orderCancel.utils.js` (`Travel_OrderCancel_1.0`) |
| `PNR_AddMultiElements` | ✅ | Utilisé par le provider `AMADEUS` classique (`utils/AMADEUS/order.utils.js`, `passive-segment*.service.js`, `controllers/AMADEUS/*`) |
| `PNR_Retrieve` | ✅ | idem (`controllers/AMADEUS/order|cancel|pnr.controller.js`, `services/AMADEUS/*`) |
| `Queue_List` | ✅ | `controllers/AMADEUS/queue.controller.js:71` (`QDQLRQ_11_1_1A`) |
| `Ticket_DisplayTST` | ✅ | `controllers/AMADEUS/importPNR.controller.js:87`, `order.controller.js` (garde d'émission) |
| `Ticket_DisplayTSMP` | ❌ | appelé nulle part dans le repo (seulement déclaré dans `NdcxClient.js`) |

Les 4 services legacy cochés **sont utilisés par l'appli**, via le provider `AMADEUS`
classique (Edifact) — avec **session stateful** (`startSession: true` dans les chaînes
PNR/Queue/TST), donc conformes à **SEM-02**. Le parcours NDC[X] lui-même reste
strictement stateless (**SEM-01**). Décision du 18/10 : déclarer le périmètre applicatif
réel (11 services) plutôt que les seuls 7 services NDC[X].

> `Ticket_DisplayTSMP` reste décoché : aucun appel, même en legacy.

### Infos appli

| Champ | Valeur mise | Statut |
|---|---|---|
| Customer Name | `Metis Digital` | ✔️ retenu (c'est le nom du projet côté Amadeus : « Metis Digital - Standard API Consulting… ») |
| Application Name / Version | `Metis Connect – api-aerial, v1.0.0` | ✔️ `src/package.json` → `"version": "1.0.0"` ; « Metis Connect » = le produit (recap mensuel) |
| WSAP | `1ASIWMETMDI` | ✔️ attribut `Amadeus-wasp` en base (tous les points de vente) ; `ndcx.service.js:26` monte `${Amadeus-url}/${Amadeus-wasp}` → à confirmer tel quel côté production |
| SOAP Header | `4.0` | ✅ vérifié dans le code |

SOAP Header 4.0 confirmé : `NdcxClient.js:398-425` émet `wsa:MessageID` / `wsa:Action` /
`wsa:To`, `awsse:Session`, `AMA_SecurityHostedUser/UserID@PseudoCityCode` et le
`wsse:UsernameToken` avec `PasswordDigest` double-SHA1 (`security.js`).

### Critères (3/3 cochés)

- *All web services calls are stateless* — les appels du parcours NDC[X] (WSDL Travel
  Management) partent **sans session** ; les appels legacy déclarés (PNR/Queue/TST) utilisent
  au contraire une **session stateful** conforme à SEM-02. Les deux exigences sont couvertes
  par des chemins distincts, jamais mélangés.
- *Follows MasterPricer recommendation to book* — `shopping.utils.js` demande du NDC pur
  (`typeOfUnit=NDC`, `numberOfUnits=100`) et `offer.utils.js` reporte
  ShoppingResponseID + OfferID + OfferItemIDs + OwnerCode vers `Travel_OfferPrice`.
- *Creates the order properly* — `order.utils.js` + `orderViewReply.mapper.js`,
  couverts par des tests sur captures réelles.

### Cas de test (6/6 cochés, tous prouvés en live)

| Cas | Commande | PNR | Montant | Billets | Sort |
|---|---|---|---|---|---|
| 2 ADT / domestique / A-S / direct / **cash** | `AA001HB2X21A3` | `IAXGEZ` | 266,16 EUR cash | …896-897, coupons `O` | ✅ 18/10 (C1) |
| 2 ADT + 1 CHD + 1 INF / intl / A-R direct / **upsell au pricing** / CB | `AA001XYYX21A3` | `IFYALV` | 1947,82 EUR CB VI | …888-891, coupons `O` | ✅ 18/10 (C2) |
| 2 ADT + 1 CHD + 1 INF / intl / A-R **avec correspondance** / CB | `AA001S7ZX21A3` | `IGWENS` | 2011,82 EUR CB VI | …892-895, coupons `O` | ✅ 18/10 (C3) |
| Annulation avant émission | `AA001R9ZX21A3` | `ILONKF` | 1519,82 EUR (jamais débités) | aucun | ✅ 18/10 (C4), retrieve → 119 |
| Void le jour même | `AA001S7ZX21A3` | `IGWENS` | idem C3 | 16 coupons → `V` | ✅ 18/10 (C3 étapes 08-10) |
| Remboursement total après émission | `NDCX-AI09882JGKO00` | (AI) | 741,69 EUR remboursés (taxes 343,69, sans pénalité) | coupon `R` | ✅ 16/10 (`refund-test`) |

Chemins de code couverts : `orderPay.utils.js` (`Cash.CashInd` / `PaymentCard`),
`orderCancel.utils.js` (branche `CANCEL` sur `pnr.status`, sinon `resolveNdcxCancelOutcome`
→ `UseCase` du quote reshop), `isFullVoid` via `CouponStatusCode === "V"`, branche `REFUND`.

Réserve sur le remboursement : le quote AI est un remboursement **total** ; KQ et SQ ne
rendent que les taxes, et **AA a échoué** (`Error 11 UNABLE TO PROCESS`, commande restée
ticketed) — le remboursement dépend du transporteur, c'est documenté dans
`use cases/NDCX/refund-test/results.md`.

---

## Points d'attention avant envoi

### 1. L'option XND n'est PAS encore active en production

**Statut au 18/10 :** le correctif est écrit **dans l'arbre de travail** (13/10), il n'est
**ni commité ni déployé**. La case XND du formulaire est cochée, **sous réserve que le
correctif soit déployé en production avant l'envoi** — sinon la décocher (une case cochée
à tort serait une fausse déclaration, et le risque se matérialiserait ~14 jours ouvrés
après l'envoi).

C'est exactement le risque que Deyra a signalé, et il est confirmé par le code.

`XND` n'existait **nulle part** dans `api-aerial` avant le correctif du 13/10. La requête
MasterPricer du provider AMADEUS classique — celle qui tourne en prod pour toutes les
recherches — envoyait jusqu'ici :

```
api-aerial/src/utils/AMADEUS/shopping.utils.js:501
const basePriceTypes = ['ET', 'RP', 'TAC', 'RU'];   // + RF / RB / RW selon options
```

Pas de `XND` — le correctif du 13/10 (arbre de travail) pousse `'XND'` dans ce tableau,
sauf `AMADEUS_EXCLUDE_NDC="false"`. Non déployé à ce jour. Or le NDC[X] tourne sur **le même Office ID** que l'Amadeus classique
(même attribut `Amadeus-officeId` lu par `amadeusServiceFactory.js`). Dès qu'Amadeus
active le NDC sur l'OID à réception de la checklist, cette requête de prod se mettra
à ramener des recommandations NDC.

Et le mapper classique ne sait pas les traiter : aucun test sur
`priceTicketing.priceType === "N"` ni sur `refQualifier === "OI"` / `offersGroup` dans
`AMADEUS/shopping.utils.js`.

**Le mode de défaillance est pire qu'une erreur franche** (constat corrigé le 13/10
après analyse du mapper — la première rédaction annonçait un échec de tarification) :

- Rien ne lève. Les champs absents côté NDC sont absorbés par les `?.` et les
  `|| "N/A"` (`shopping.utils.js:2741-2747`), et `processSuccessfulResponse` avale les
  exceptions (`:1333-1336`, « Don't throw, return partial results »).
- `extractPriceClass` ne reconnaît pas la reco, donc `PriceClassRefID` vaut `null`. En
  mode `cheapestPerPriceClass` — **le défaut** (`resolveOfferSelectionMode:494`) — toutes
  les recos NDC s'effondrent dans un même panier et ressortent comme **l'offre la moins
  chère, non étiquetée, celle que l'agent clique en premier**.
- L'offre ne porte aucune référence Amadeus (`OfferID: null`) ; l'aval re-dérive depuis
  le numéro de vol et la RBD. Deux issues : soit `bookingClass: "N/A"` atteint
  `Fare_InformativePricingWithoutPNR` et ça erreur, soit une vraie RBD est présente et
  **l'appel réussit silencieusement en rendant le tarif public Edifact** — l'agent voit
  un prix qui change sans explication, rien ne casse bruyamment.

Autrement dit : pas de dégradation gracieuse, et un risque de mévente silencieuse.
L'urgence est plus haute que ce que laissait penser la première version de cette note.

**Correctif — implémenté le 13/10, non commité, en attente de relecture :**

```js
// api-aerial/src/utils/AMADEUS/shopping.utils.js:496
const isNdcExclusionEnabled = () => process.env.AMADEUS_EXCLUDE_NDC !== "false";
// ...puis dans generateFareOptions, après le literal basePriceTypes :
if (isNdcExclusionEnabled()) basePriceTypes.push('XND');
```

Actif par défaut, pour que la prod soit protégée sans variable à positionner — c'est
justement l'oubli contre lequel on se prémunit, Amadeus activant le NDC à *son*
calendrier après l'envoi. `AMADEUS_EXCLUDE_NDC="false"` le désactive sans redéploiement.
L'idiome `!== "false"` suit le garde-fou existant
`AMADEUS_ISSUANCE_GUARD_FAREBASIS` (`issuanceGuard.utils.js:133`).

**Portée : deux messages, pas un.** `generateFareOptions` alimente
`createShoppingPayload` (`Fare_MasterPricerTravelBoardSearch`, `FMPTBQ_24_6_1A`,
ligne 140) **et** `createCalendarShoppingPayload` (`Fare_MasterPricerCalendar`,
`FMPCAQ_20_2_1A`, ligne 210), dont les réponses passent par le même mapper. Les deux
sont couverts. Réserve à lever en pré-prod : `FMPCAQ` est en version 20.2 alors que XND
est documenté pour MPTB. `priceType` y est un `AlphaNumericString_Length0To3` sans
énumération, donc schema-valide — mais si Amadeus refuse le code sur le calendrier, la
dérogation est d'une ligne.

À ne surtout **pas** appliquer à `AMADEUS_NDCX/shopping.utils.js` : ce builder-là a son
propre tableau de `priceType` (ligne 100) et doit garder son
`numberOfUnits=100 / typeOfUnit=NDC`. Vérifié intact.

Variante par transporteur (`carrierQualifier = XNDC`) écartée : elle exige d'énumérer
les compagnies alors qu'on veut une exclusion globale, elle est MPTB 23.1+ donc ne
couvrirait pas le calendrier en 20.2, et notre bloc `travelFlightInfo` n'est émis que
conditionnellement.

Une fois **déployé en prod**, la case « The XND option is active … in production
environment » est légitime. Tant que ce n'est pas déployé, elle ne devrait pas être cochée —
la cocher serait une fausse déclaration à Amadeus, et le risque se matérialiserait en prod
sous ~14 jours ouvrés. **Arbitrage du 18/10 :** la case est cochée dans le formulaire, avec
le déploiement du correctif comme **prérequis bloquant avant l'envoi** ; si le déploiement
n'a pas lieu, décocher la case avant d'envoyer.

> Dette résiduelle, à ticketer séparément : il n'y a **aucune défense côté réponse**. Si
> XND est un jour désactivé, ou si une reco NDC passe malgré tout, le mapper la publiera
> toujours comme l'offre Edifact la moins chère. Un skip défensif sur
> `priceType === "N"` dans le mapper classique serait la ceinture en plus des bretelles.

### 2. « Upsell at pricing » — ~~non implémenté~~ → réglé le 18/10

**Fait :** flag `upSell` sur `Travel_OfferPrice` (`FarePreferences@PreferencesContext="Upsell"`),
lecture des `OtherOffers` (`offerPriceUpsell.mapper.js`), report des IDs d'un bundle vers
`Travel_OrderCreate`, garde-fous par transporteur (`carrierCapabilities.UPSELL_PRICING`).
Prouvé en live sur AA le 18/10 (Offer_06 + Create_05, commande `AA001XYYX21A3` / `IFYALV`) —
voir `use cases/NDCX/cert-runs/cases/C2-direct-upsell-card/`.

L'analyse ci-dessous (ce qu'Amadeus appelle « upsell at pricing » vs l'upsell au shopping)
reste la référence du besoin :

Le cas de test n°2 l'exige explicitement. Amadeus le définit ainsi
(`references/06-payment-and-features.md`) :

```
RQ : /AMA_TravelOfferPriceRQ/Request/ShoppingCriteria/FarePreferences/@PreferencesContext="Upsell"
RS : lire les offres alternatives dans OtherOffers
```

Dans notre code : aucun `FarePreferences` ni `PreferencesContext` dans
`AMADEUS_NDCX/offer.utils.js`, et aucune lecture de `OtherOffers` dans
`offerPriceReply.mapper.js`.

Ce qu'on fait aujourd'hui, c'est de l'**upsell au shopping** : `shopping.utils.js:111`
demande `feeType: "FFI"` (fare family info), l'agent choisit une famille tarifaire
dans les résultats, et on price cet OfferID-là. Ce n'est pas ce qu'Amadeus appelle
« upsell at pricing ».

Deux critères de certification **Mandatory** en dépendent dès qu'on déclare l'upsell :
- **Offer_06** — « UPSELL element is sent correctly »
- **Create_05** — « If UPSELLING is selected, the updated shopping response, OfferID,
  OfferItemIDs are included in the request »

Décision du 18/10 : implémenté, prouvé en live et coché.

---

## Reste à faire avant l'envoi (18/10)

1. **Committer puis déployer le correctif XND en production** (`deyra-met2-2422` →
   `development` → release). Tant que ce n'est pas fait, la case XND de la checklist
   est en avance de phase — c'est le seul point qui peut rendre le formulaire faux.
2. *Optionnel* : confirmer par Amadeus le libellé « Metis Digital » et le WSAP de prod
   (les valeurs tiennent, mais c'est leur référentiel).
3. Relire le formulaire rempli
   (`~/Downloads/Checklist-NDC-Prime-booking-flow-and-Cancel-METIS.docx`), puis l'envoyer
   à Deyra → Amadeus **avant le 08/11**.
4. Questions techniques éventuelles à `API.consulting.assistance@amadeus.com` **avant le 28/10**
   (objet « Metis Digital », un mail par sujet).

## Hors périmètre de cette checklist

`Travel_OrderChange`, `Travel_ServiceList`, `Travel_SeatAvailability` sont déjà
implémentés chez nous mais relèvent du guide *Ancillaries, Seats and Servicing* —
c'est le lot « Merchandising / échanges volontaires et involontaires / sièges NDC[X] »
que Deyra dit qu'on fait nous-mêmes. Ils ne figurent pas sur cette checklist-ci et
n'ont pas été cochés.
