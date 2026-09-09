---
status: accepted
---

# Order warnings are persisted on the PNR and gate the servicing actions

An airline's warnings describe an order's *current state*, not the outcome of
the request that returned them: whether an involuntary situation has arisen,
whether a schedule change is still unfinalised, whether the passenger has a free
reissue or refund right. We persist those codes onto the PNR as orders are
retrieved, and the folder's servicing buttons are enabled or disabled based on
them.

## Considered options

Storing them against the notification that prompted the retrieve was rejected:
warnings would then exist only on orders whose warnings happened to arrive via a
notification, and would be missing on any order an agent simply opened.
Re-reading them live on every folder load was rejected because it makes opening
a dossier depend on an airline round-trip.

## Consequences

- Warnings must survive past the notification that surfaced them. An agent
  opening a disrupted dossier days later, by any route, has to see the same
  state.
- The entitlement, not the event, decides what the agent may do — a free-reissue
  right is the difference between offering "modify" and offering "cancel and
  refund", and the notification alone cannot express that. The notification
  stays the record of the event: a temporary retrieval failure yields only a
  generic change warning, so warnings can never be the sole trigger.
- Multi-warning responses are the normal case, not the exception. Turkish
  Airlines returns three warnings on a routine retrieve, so any code reading
  them must treat the field as a collection. Parsing it as a single object is
  the reason this signal was silently discarded until now.
- Warning codes are returned prefixed (`NDC-8006`, not `8006`). Comparisons
  against the bare number never match.
