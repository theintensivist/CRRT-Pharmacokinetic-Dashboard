---
name: CRRT PK model assumptions
description: Clinical-modeling constraints chosen for the browser-only CRRT concentration dashboard.
---

The model keeps the requested inputs explicit: endogenous clearance is entered directly, while Sc/Sa use the unbound-fraction approximation. Prescription flow is modality-specific, filter uptime scales prescribed to delivered effluent, and CVVH pre-filter dilution uses Qb / (Qb + Qpre).

**Why:** Inferring renal clearance from demographics or hiding modality-specific flow components would make the model look precise while obscuring which prescription terms drive modeled clearance.

**How to apply:** Keep blood flow, replacement fluid, dialysate, net ultrafiltration, and filter uptime visible whenever the prescription model is extended; surface any new membrane or downtime assumptions in the assumptions panel.