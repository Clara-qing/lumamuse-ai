# Assumption Ledger — MirrorMate demo
<!-- ASK mode: never -->

| ID | Under-determined by the request | Chosen | Class | Source |
|---|---|---|---|---|
| A-001 | What arbitrary reference-image understanding means for the demo | Extract a local color palette and require the user to confirm one of two validated teaching templates | semantic | default |
| A-002 | Whether live camera is mandatory | Offer camera mode with a deterministic demo-face fallback | interface | default |
| A-003 | What counts as automatic error detection | Demo detects user-declared practice difficulty and produces a bounded recovery instruction; it does not claim production vision scoring | semantic | default |
| A-004 | Supported makeup areas | Daily de-puff eye makeup is the complete path; natural contour is a shorter second template | interface | default |
| A-005 | Data persistence | Reference image and camera stream remain in browser memory and are cleared when the session resets | semantic | default |
| A-006 | Language and audience | Chinese mobile-first interface for competition judges and novice makeup users | interface | default |

## Notes

- **A-001** — Reliable reconstruction of application order from one finished-look image is not defensible in this timeframe. Template confirmation keeps the experience honest and reversible.
- **A-003** — A labelled prototype feedback path is more credible than presenting simulated classification as a trained result.

