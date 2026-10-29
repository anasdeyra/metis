# Réponse à Deyra — checklist NDC[X] Prime (brouillon du 18/10/2026)

> À relire/ajuster avant envoi. Tous les cas ont été rejoués en environnement de **test**
> Amadeus (host nodea1, office NCEPF3273) ; transporteur **AA** sauf mention.

Salut Deyra 👋

Point complet sur la checklist NDC[X] Prime.

## 1. Cas de test — 6/6 OK

| # | Cas | PNR de test | Sort |
|---|---|---|---|
| 1 | 2 ADT / domestique / aller simple / direct / **cash** / réservation + émission | **IAXGEZ** — order `AA001HB2X21A3`, JFK-ORD AA3162, 266,16 € | ✅ 18/10 |
| 2 | 2 ADT + 1 CHD + 1 INF / international / A-R direct / **upsell au pricing** / CB / réservation + émission | **IFYALV** — order `AA001XYYX21A3`, 1 947,82 € | ✅ 18/10 |
| 3 | 2 ADT + 1 CHD + 1 INF / international / A-R **avec correspondance** / CB | **IGWENS** — order `AA001S7ZX21A3`, 2 011,82 € | ✅ 18/10 |
| 4 | Annulation avant émission | **ILONKF** — order `AA001R9ZX21A3` | ✅ 18/10 |
| 5 | Void le jour même | **IGWENS** — 16 coupons passés en `V` | ✅ 18/10 |
| 6 | Remboursement total après émission | order `NDCX-AI09882JGKO00` — 741,69 € remboursés, sans pénalité | ✅ 16/10 |

Réserve sur le #6 : le remboursement dépend du transporteur — **AI rembourse 100 %** ; KQ et
SQ ne rendent que les taxes ; **AA a renvoyé `Error 11 UNABLE TO PROCESS`** en test (commande
restée ticketed). Le cas « remboursement total » est démontré, mais pas sur AA.

## 2. Services — 11 des 12 de ta liste

Cochés : les 7 du parcours NDC[X] (Fare_MasterPricerTravelBoardSearch, Travel_OfferPrice,
Travel_OrderCreate, Travel_OrderPay, Travel_OrderRetrieve, Travel_OrderReshop
void + remboursement, Travel_OrderCancel) **+** les 4 legacy réellement appelés par le
moteur classique (PNR_AddMultiElements, PNR_Retrieve, Queue_List, Ticket_DisplayTST).

`Ticket_DisplayTSMP` n'est appelé **nulle part** dans le code — laissé décoché. (Si tu
préfères cocher les 12 pour ne pas avoir à l'expliquer, c'est un caractère à changer.)

## 3. Stateless

Oui pour tout le parcours NDC[X] : appels Travel_Management **sans session** (SOAP Header
4.0) → exigence SEM-01. Les 4 services legacy déclarés tournent en **session stateful** côté
moteur classique → SEM-02, comme la spec l'exige. Les deux chemins ne se mélangent jamais.

## 4. Header

SOAP Header **4.0** confirmé dans le code (`wsse:UsernameToken` + PasswordDigest double
SHA1, `awsse:Session`, `AMA_SecurityHostedUser/UserID@PseudoCityCode`).

## 5. Application

- **WSAP : `1ASIWMETMDI`** (valeur `Amadeus-wasp` en base, l'URL est montée `…/${wasp}`).
- **Application : `Metis Connect – api-aerial, v1.0.0`** (`src/package.json` = 1.0.0).
- Nom client : **Metis Digital** (gardé tel quel, à confirmer par Amadeus si leur compte
  porte un autre libellé).

## 6. Merge / prod — le seul point bloquant pour l'envoi : XND

La branche `deyra-met2-2422` n'est toujours pas dans `development` (62 commits). Le
correctif **XND** est écrit (arbre de travail, non commité) : la requête MasterPricer
classique envoie `XND` **par défaut**, `AMADEUS_EXCLUDE_NDC="false"` le désactive sans
redéploiement le jour où le parcours NDC[X] passe en prod. Il doit être **commité puis
déployé avant l'envoi** de la checklist — l'activation NDC côté Amadeus suit l'envoi.
Sans ça, les recherches de prod remonteront des recos NDC que le mapper classique ne sait
pas traiter (défaillance silencieuse, pas d'erreur franche).

## 7. Checklist

Le formulaire est rempli (`Checklist-NDC-Prime-booking-flow-and-Cancel-METIS.docx`) :
services, infos appli, les 3 critères, la case XND et les 6 cas cochés. **À envoyer dès que
le point 6 est réglé** (sinon on décoche XND avant envoi).

## 8. Questions à poser à Amadeus avant le 28/10 (un mail par sujet)

1. **Remboursement AA** : `Error 11 UNABLE TO PROCESS` sur une annulation totale après
   émission (test) — attendu ? Sous quelles conditions AA rembourse-t-il du NDC ?
2. **Option XND sur `Fare_MasterPricerCalendar`** (FMPCAQ 20.2) : documentée pour MPTB
   seulement — est-elle acceptée sur le calendrier ?
3. **Confirmation administrative** : WSAP de production et libellé exact du compte
   (« Metis Digital »).

Dis-moi si tu veux que je change quelque chose avant l'envoi.
