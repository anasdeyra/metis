# Approbation (approval) flow

Company-side approval of travel booked in self-service: a traveler's
reservation waits for one or more approvers to validate or reject it.

## Entry conditions
- The dossier was created in **SBT mode** (`dossier.fromSBT`, set at hold when
  the booking token belongs to a client user — 4-level Keycloak group).
  ⚠️ Whether an agent impersonating the client (toggle ON) sets it is not
  established. A flight added in OFF to a dossier created in ON does **not**
  trigger approval (MET2-2980).
- pg-boss is running (`IS_PGBOSS_INIT === 'true'`).
- Trigger point: right after the order is created —
  `scheduleApprovalJobs(dossierId, travelerProfileId)`
  (`api-aerial/src/queue/queue.js`, called from `dossier.utils.js`).

## Configuration (per traveler profile)
`profil.roleConfiguration.approbation` plus `profil.approver1..3`
(deduplicated, in order):

| Key | Values |
|---|---|
| `approvalFlows` | `VALIDATE_FIRST_RESPONSE`, `EACH_MUST_APPROVE`, `CASCADING_VALIDATION` |
| `triggers[travelType]` | per `AERIEN` / `HOTEL` / `TRAIN` / `VOITURE`: `{ trigger, value }` |
| `relaunchApproval` | reminder delay: `AFTER_6H` / `12H` / `24H` / `48H` |
| `autoApprovalPeriod` | `AFTER_xH`, `END_OF_DAY` (Europe/Paris), or `NEVER` |

**Triggers**: `NON_COMPLIANCE` (reservation carries out-of-policy `reasons`),
`SUPERIOR_BOOKING` (total price > `value`), `ANY_BOOKING`. Cars are always
treated as compliant.

## Flows

| Flow | Who is notified | Approved when | Rejected when |
|---|---|---|---|
| `VALIDATE_FIRST_RESPONSE` | all approvers | first approval | first rejection |
| `EACH_MUST_APPROVE` | all approvers | every approver approved | any rejection |
| `CASCADING_VALIDATION` | approver 1 only, then the next after each approval | last approver approved | any rejection |

## States
Per reservation (pnr / hotel / rail / car), `approvalStatus` is an array of
`{ profileId, status: PENDING | APPROVED | REJECTED }`. The derived
`approvalState` is `pending`, `approved`, `rejected` or `cancelled`. No flow
or empty status means `approved` (`computeApprovalState`).

## Pipeline
1. api-aerial `scheduleApprovalJobs` → queue `approbation-circuit`.
2. api-dashboard worker `processApproval`
   (`api-dashboard/src/queue/workers.js`) evaluates triggers per travel type
   and emails the approvers to notify.
3. Reminder (`relaunchApproval`) and auto-approval (`autoApproval`) pg-boss
   jobs are scheduled. Their ids are stored on the reservation
   (`relaunchApprovalJobId`, `autoApprovalJobId`).
4. Approver acts: `POST /check-approbation` (may this user act now?),
   `POST /change-status` — `api-aerial/src/controllers/approbation.controller.js`
   → `utils/approbation.utils.js` (`handleFirstResponseFlow`,
   `handleEachMustApproveFlow`, `handleCascadingFlow`).
5. Validation or rejection emails; jobs for answered approvers are deleted;
   each step logged to `approbation_log`. Live UI updates via SSE
   (`front-reservation/app/composables/useApprovalSSE.ts`).

## Exceptions
- Reservation cancelled (status `3`) → approval stops; pending jobs are
  deleted and approvers get a cancellation email.
- Missing approval config on the traveler profile → the API throws.

## Open questions ⚠️
- Does a pending or rejected approval **block issuance**, or only notify? Not
  established from the code read. Ask before building on either assumption.
- Who may configure flows and triggers (company admin vs agency) — see
  `api-dashboard/src/controllers/approbations.controller.js`.

## Distinctions
- Approval state ≠ PNR status ≠ credit limit (a separate financial ceiling).
- Approbation (company travel policy) ≠ agency options.
- Compliance (`reasons`, out-of-policy justification) ≠ `motifDeplacement`
  (trip purpose).

## Related
[OBT / SBT mode](../concepts/obt-mode.md) · [booking lifecycle](booking-lifecycle.md)
