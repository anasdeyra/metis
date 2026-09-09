---
status: accepted
---

# One notification per OCN message, deduplicated on order version

An order change notification can carry several change operations — Turkish
Airlines sends one per affected flight segment, so a three-segment reschedule
arrives as one message with three operations. We create a single notification
row per message, keep the per-operation detail in the row's detail payload, and
skip the row entirely if one already exists for the same order and order
version.

## Consequences

- A three-segment reschedule is one item in the agent's queue, which matches how
  it is actually resolved: accepting or refusing a schedule change acts on the
  whole order, not segment by segment. Per-operation rows would have meant three
  switches to flip for one decision, and they would have resolved together
  anyway since processing is keyed on order and type.
- The per-segment before-and-after is still the substance of the change, so it
  has to be rendered somewhere. It belongs in the folder banner, next to the
  buttons that act on it, rather than only in the detail payload.
- Deduplicating on order version means an airline retry after a timeout no
  longer produces a duplicate queue item and a duplicate email to the sales
  point. It also means a genuine second change must carry a new order version to
  be seen — which is what the field is for, but it is a dependency on the
  airline incrementing it correctly.
