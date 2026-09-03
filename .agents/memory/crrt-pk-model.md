---
name: CRRT PK model assumptions
description: Clinical-modeling constraints chosen for the browser-only CRRT concentration dashboard.
---

The model keeps the requested inputs explicit: endogenous clearance is entered directly, while Sc/Sa use the unbound-fraction approximation. Because the brief does not include blood flow or replacement-fluid rates, CVVH pre-filter dilution uses a visible 0.75 factor rather than pretending to calculate a precise hemodilution ratio.

**Why:** Inferring renal clearance from demographics or inventing missing flow inputs would make the model look precise while changing the requested clinical assumptions.

**How to apply:** If richer bedside inputs are added later, replace the fixed pre-filter factor with the appropriate Qb and Qpre relationship and surface the change in the assumptions panel.