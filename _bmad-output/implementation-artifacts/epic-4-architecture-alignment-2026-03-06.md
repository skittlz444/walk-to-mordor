# Epic 4 Architecture Alignment Analysis

Date: 2026-03-06  
Analyst: Architect Agent (Winston)  
Scope: Compare current codebase state to Epic 4 plan in `_bmad-output/planning-artifacts/epics.md`

## Executive Summary

Verdict: **Conditionally Ready**

Update (Decision Applied): Team has decided to continue with repository-backed static assets (`public/img` + `image_id`) and not adopt R2 for Epic 4.

Epic 4 is directionally correct, but it is not implementation-ready without updates. Key blockers are:

- Missing admin foundation (`is_admin`, admin routes, admin audit persistence).
- Story assumptions that mismatch live schema (`sort_order`, `image_url` vs current `distance`, `image_id`).
- File upload path blocked by global JSON write parsing (multipart upload would fail without routing/body parsing changes).
- Fellowship/map dependencies now increase blast radius of goal mutations.

## Per-Story Assessment

| Story | Current fit | Gaps found | Required updates | Risk |
|---|---|---|---|---|
| 4.1 Admin Authentication & Authorization | Partial | No `is_admin`; no admin guard; no audit storage | Add `users.is_admin` migration, admin auth helper, audit table/writes, test-token policy | High |
| 4.2 Admin Dashboard Shell | Partial | No `/admin` route or admin stats API; current auth behavior is mostly client redirect after SSR shell render | Add protected `/admin` route behavior + `/api/admin/dashboard` contract, keep route ordering discipline | Medium |
| 4.3 Goal Management List | Partial | AC assumes `sort_order`/`name`; runtime model is `title`, `distance`, `image_id` | Update ACs/query model to distance-first and current schema; define explicit admin endpoint behavior | High |
| 4.4 Goal Edit | Poor | AC assumes `sort_order` + `image_url`; endpoint absent | Redefine editable fields to current model; define cache invalidation/versioning | High |
| 4.5 Image Asset Workflow Integration | Partial | Current Epic 4 text expected direct upload; current system is optimized static assets with `image_id` references | Keep no-R2 strategy, add admin workflow for validating/assigning `image_id` slugs and documenting optimize-images pipeline | Medium |
| 4.6 Add Intermediary Goal | Partial | Still assumes `sort_order`; does not include map/fellowship consistency checks | Use distance-first insertion and add regression guards for map/party milestone behavior | Medium-High |

## Cross-Cutting Risks

1. Plan/schema drift between Epic 4 docs and production model.
2. No admin scaffolding exists yet in routing/auth pipeline.
3. Direct upload API assumptions are incompatible with current no-R2 strategy and should be replaced with asset-workflow integration.
4. Goal mutations now affect map waypoint generation and fellowship milestone progression.
5. 24h milestone cache can delay visibility of admin changes if invalidation is not handled.
6. API docs auth description is stale versus bearer-token implementation.

## Pre-Epic-4 Must-Do Checklist

1. Align Epic 4 contracts to current goals schema (`distance`, `image_id`) and remove `sort_order`/`image_url` assumptions.
2. Add admin baseline schema: `users.is_admin` plus admin audit table.
3. Define/enforce admin authorization at both route and API levels.
4. Add explicit `/admin` and `/api/admin/*` route map.
5. Lock image strategy: keep `image_id` as canonical repository-backed asset reference.
6. Replace direct upload assumptions with admin validation + assignment flow for existing asset pipeline.
7. Add cache invalidation/versioning after goal writes.
8. Update API docs to match bearer token reality and add admin contracts.
9. Add regression gate for Fellowship/Map behavior after admin goal changes.

## Recommended Sequence Update

Recommended order:

1. 4.1 Admin auth + audit persistence
2. 4.2 Admin shell + protected routes + dashboard contract
3. 4.3 Goal list (schema-aligned)
4. 4.4 Goal edit metadata (no upload yet)
5. 4.5 image asset workflow integration (`image_id` validation/assignment, docs and operator flow)
6. 4.6 Intermediary goal insertion with regression safeguards

Rationale: avoid implementing UI around non-existent fields, reduce risk while admin primitives are still missing, and preserve Fellowship stability.

## Evidence Citations

- Epic 4 assumptions: `_bmad-output/planning-artifacts/epics.md:965`, `_bmad-output/planning-artifacts/epics.md:1002`, `_bmad-output/planning-artifacts/epics.md:1019`, `_bmad-output/planning-artifacts/epics.md:1044`, `_bmad-output/planning-artifacts/epics.md:1048`, `_bmad-output/planning-artifacts/epics.md:1071`
- Routing/auth/body parsing: `src/index.ts:79`, `src/index.ts:98`, `src/index.ts:100`, `src/index.ts:115`, `src/index.ts:336`, `src/index.ts:392`, `src/auth-handlers.ts:328`, `src/auth-handlers.ts:344`
- Render/island patterns: `src/renderLayout.ts:24`, `src/renderLayout.ts:106`, `src/renderPartyListPage.ts:4`, `src/renderPartyDetailPage.ts:4`, `client/src/index.tsx:72`
- Data model reality: `docs/data-models.md:35`, `docs/data-models.md:42`, `src/goals-handlers.ts:12`, `client/src/types/goal.ts:6`, `migrations/0021_add_image_id_to_goals.sql:5`
- Fellowship/map coupling + cache: `src/party-handlers.ts:579`, `src/party-handlers.ts:599`, `client/src/data/waypoints.ts:34`, `client/src/utils/map-cache.ts:29`, `client/src/stores/mapStore.ts:301`
- Infra bindings: `wrangler.json:1`, `worker-configuration.d.ts:9`
- Prior retro constraints: `_bmad-output/implementation-artifacts/epic-3-retro-2026-03-06.md:155`, `_bmad-output/implementation-artifacts/epic-3-retro-2026-03-06.md:161`, `_bmad-output/implementation-artifacts/epic-3-retro-2026-03-06.md:172`
