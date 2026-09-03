# CRRT Pharmacokinetic Dashboard

An interactive clinical reference surface for comparing modeled drug concentrations with and without continuous renal replacement therapy.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/crrt-pk-dashboard/src/App.tsx` — responsive dashboard UI and local interaction state
- `artifacts/crrt-pk-dashboard/src/utils/pkMath.ts` — auditable clearance and repeated-bolus concentration model
- `artifacts/crrt-pk-dashboard/src/index.css` — dashboard theme, dark clinical palette, and responsive layout

## Architecture decisions

- This first version is client-side only; calculations update immediately from local state and require no API or database.
- Endogenous clearance is entered directly in mL/min to avoid silently deriving a different renal-function estimate from demographics.
- Sc and Sa are approximated from the unbound fraction; CVVH pre-filter dilution uses an explicit 0.75 factor because blood flow and replacement-fluid rates are not part of the requested inputs.
- Repeated boluses are modeled with first-order elimination and plotted against an illustrative 8–16 mg/L target band.

## Product

The dashboard accepts drug, patient, and CRRT prescription inputs; supports CVVH/CVVHD and CVVH pre/post-filter toggles; and renders a 72-hour concentration comparison, clearance metrics, checkpoints, and assumptions/disclaimer details.

## User preferences

No additional preferences recorded.

## Gotchas

- The concentration model is for clinical reference and exploration only; it does not replace therapeutic drug monitoring, local protocols, or clinical judgment.
- The standalone Vite build needs `PORT` and `BASE_PATH`; the managed artifact workflow provides them automatically.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
