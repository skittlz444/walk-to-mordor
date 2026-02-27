# Epic 3: Fellowship Features - Specification Evaluation

## Overview
This document provides an evaluation of the Epic 3 (Fellowship Features) specifications for the "Walk to Mordor" application. The evaluation checks for consistency and completeness, covers everything a feature set like this might need, suggests good additions, and identifies areas of over-complication that can be simplified for app stability and user experience.

## 1. Consistency and Completeness

Overall, the Epic 3 specification is incredibly detailed, highly consistent across stories, and very complete. The way `distance_at_join`, `last_viewed_distance`, `departed_at`, and `distance_kept` are designed to work together to support incremental/cumulative distance tracking without data duplication or breaking existing `progress` tables is excellent database design for a serverless edge environment.

*   **Consistency:** The schema design (Story 3.1) flows logically into the APIs (3.2-3.5) and then into the UI (3.6-3.8). The handling of "re-join" creating a *new* record rather than updating an old one is a crucial, smart decision that maintains historical audit trails perfectly.
*   **Completeness:** It hits every functional requirement (FR_PARTY_01 to FR_PARTY_12) defined in the PRD and epics list.

## 2. Potential Additions (What it might need)

While the feature set is robust, a few small additions could improve edge case handling:

1.  **Party Capacity Limits / Rate Limiting:** There is no mention of a maximum number of members per party or a maximum number of parties a user can join/create. While "no limit" is currently specified, allowing infinite members might cause performance issues on the `GET /api/party/:id/progress` calculation (summing distances for 1,000 members in a D1 database on an edge compute).
    *   *Recommendation:* Add a reasonable limit to `members_per_party` (e.g., 50 or 100) to keep the "Fellowship" theme intimate and prevent D1 query timeouts.
2.  **Invite Code Expiration/Rotation:** Story 3.5 allows the leader to regenerate the invite code, but there's no way to set an invite code to expire automatically (e.g., after 7 days) or restrict it to single-use.
    *   *Recommendation:* Consider if `invite_code` needs a `status` (active/revoked) or if manual regeneration by the leader is sufficient for this scope. Manual regeneration is likely fine for MVP, but worth noting.
3.  **Party Editing:** Story 3.5 allows editing `distance_mode` and `leave_distance_behavior`. Can a leader rename the party?
    *   *Recommendation:* Add `name` update capability to `PUT /api/party/:id/settings`.

## 3. Areas of Over-complication (Simplification Opportunities)

The spec is extremely thorough, but there are areas where the ambition might negatively impact the user experience or system stability, especially considering the "Gandalf Persona" (Zero maintenance operation).

### A. The "leave_distance_behavior" and "distance_kept" Logic
**The Complication:**
The system allows the leader to configure `leave_distance_behavior` ('keep' or 'remove'), which applies when users leave or are kicked. However:
1.  The leader can override this setting *during a kick* (`removeDistance` boolean).
2.  To calculate progress later, the system has to check the `distance_kept` boolean on the departed member's `party_members` record, calculate their distance between `joined_at` and `departed_at` (or all-time), and then sum it.
3.  Re-joins add *multiple* `party_members` records per user, meaning progress calculation has to sum across multiple historical records carefully avoiding double-counting (as explicitly noted in Story 3.4 ACs).

This creates an incredibly complex SQL query for `GET /api/party/:id/progress` that must run on every dashboard load. It has to join `parties`, `party_members`, and `progress`, group by user, handle `departed_at` date ranges, check `distance_kept`, and avoid double counting re-joins.

**The UX Impact:**
For users, explaining "If you leave, does your distance stay?" becomes confusing when leaders can arbitrarily change the default setting, or override it on a kick.

**Simplification Recommendation:**
1.  **Drop 'keep' behavior entirely (or make 'remove' the only option).** If you leave a Fellowship (or get kicked), you take your miles with you. This simplifies the UX ("You are currently contributing X km to this party. If you leave, the party loses X km") and drastically simplifies the DB query: you only ever sum distance for `status = 'active'` members.
2.  **Alternative:** When a user leaves/is kicked, instead of calculating their historical distance dynamically forever, fire a one-time trigger/worker task that calculates their total contribution *at that exact moment* and saves it to a `departed_member_distance` column on the `parties` table, then sets the member to 'left'. The progress query becomes: `SUM(active_members) + parties.departed_member_distance`. This removes all historical date-range querying from the hot path.

### B. "distance_mode" Changes Post-Creation
**The Complication:**
Story 3.5 allows leaders to change `distance_mode` ('incremental' vs 'cumulative') *after* creation.
*   **The UX Impact:** Imagine joining an 'incremental' party, walking 50km over a week to help the team. Then the leader flips it to 'cumulative'. Suddenly, the guy who ran a marathon last year but hasn't walked this week is the top contributor. It feels unfair and confusing.
*   **The Technical Impact:** It invalidates user expectations.

**Simplification Recommendation:**
Make `distance_mode` immutable after party creation. The party is either a "Start from Zero together" party or an "All-time stats" party. If a leader wants a different mode, they should create a new party.

### C. The Milestone Push Notifications (Story 3.9)
**The Complication:**
Story 3.9 requires server-side detection when a walk log pushes a party over a milestone, and then delivering an in-app toast/notification to all members on next load (and optionally email).
*   **The Technical Impact:** Walk logging (`POST /api/calendar-progress`) is the hottest path in the app (NFR_PERF_01 requires it to be fast). Adding complex cross-joining logic to check if *any* of the user's parties just crossed a milestone, then queueing notifications for all members of those parties, adds massive latency and complexity to the simple act of logging a walk.
*   **The UX Impact:** Story 3.6 already specifies a great UX where, upon switching to a party view, the `last_viewed_distance` logic triggers the standard milestone modal for that party. Having both a push notification *and* a view-switch modal is redundant.

**Simplification Recommendation:**
**Cut Story 3.9 entirely.** Lean completely on the `last_viewed_distance` modal logic from Story 3.6. When users check their party, if it leveled up while they were gone, they get the pop-up celebration. It's performant, reliable, and uses existing UI components without adding background job queues to the walking logging route.

### D. Re-joins creating multiple records
**The Complication:**
Story 3.3/3.4 mentions that re-joining a party creates a *new* `party_members` record to preserve the old record for contribution history.
*   If we implement the simplification for "A" (where leaving removes your distance entirely, or bakes it into a single snapshot column), we no longer need historical `party_member` records.
*   We can just update the `status` back to 'active' on the existing record and update `distance_at_join` to their current distance. This guarantees exactly one record per user per party, massively simplifying DB queries and UI rendering.

## Summary of Recommendations

1.  **Enforce a Party Member Limit:** ~50-100 to protect D1 query performance.
2.  **Simplify Leave Behavior:** Either force 'remove' on leave/kick, or snapshot the distance to a flat column on the `parties` table upon departure. Do not try to dynamically calculate departed member contributions on the fly using date ranges.
3.  **Lock Distance Mode:** Make `distance_mode` (`incremental` vs `cumulative`) immutable once the party is created.
4.  **Cut Proactive Notifications (Story 3.9):** Rely solely on the "catch-up" milestone modal shown when the user actively switches to the party view (Story 3.6).
5.  **Simplify Re-joins:** If leave behavior is simplified, re-joins can just update the existing `party_members` row rather than creating duplicates.
6.  **Add Rename Capability:** Allow leaders to rename the party in settings.
