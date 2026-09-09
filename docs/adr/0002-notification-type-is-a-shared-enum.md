---
status: accepted
---

# Notification type is a shared cross-provider enum, not per-provider codes

Every provider that sends us order change notifications maps its own airline
vocabulary onto one shared `Notification.type` enum, and consumers — the agent
inbox, the folder banner, the badge count — branch only on that enum. Turkish
Airlines had invented 21 for a schedule change, which no consumer understood, so
those notifications counted towards the bell badge while rendering with no label
and no banner. TK now maps onto the existing codes like every other provider:

| Concept | Code | Also written by |
|---|---|---|
| Schedule change | `1` | GOKYTE |
| SSR / service status change | `6` | GOKYTE |
| Option (payment deadline) change | `7` | — |

## Considered options

Widening every frontend consumer to understand a TK-only dialect was rejected:
it would have spread one provider's vocabulary across eight surfaces and set the
precedent that the next airline may invent codes too.

**`2` was considered for the option change and rejected.** `2` is already
`TTL_EXPIRED` in the inbox. An option change moves the payment deadline; it does
not expire it. Reusing `2` would have labelled a live, still-bookable order
"deadline expired" — so the option change keeps `7`, which the inbox already
labels `option-change` and which existing rows already carry.

## Consequences

- A data migration remaps existing `21` rows to `1`, or notifications already
  received stay invisible for the life of the table. `7` and `6` rows are left
  alone because they are already the codes we keep.
- Turkish Airlines' option change maps onto the shared "deadline" semantics but
  deliberately does **not** reuse the legacy expiry behaviour of setting the PNR
  to status 5. Their option change moves the deadline *earlier* on an order that
  is still live and still bookable, and status 5 combined with the TTL gates
  whether the action buttons render at all — so marking it expired would hide
  the buttons the agent needs. The new deadline is written to the PNR's TTL and
  the status is left alone.
- Remarks carry a stable machine token rather than a human sentence, so the
  frontend can translate them into all five locales. Existing providers write
  raw airline strings that the UI string-sniffs; that is the pattern being moved
  away from, not extended.
