# Spec Delta

## REMOVED Requirements

### Requirement: Daily personal encounter rolls
**Reason**: Duplicated by the `personal-challenges` capability, which redefines the rules: active-challenge suppression, declined-offer suppression across page refreshes (daily roll status column), and global Nazgul eligibility are all specified there.
**Migration**: When this change is applied/archived, use the `Daily personal encounter rolls` requirement in `openspec/specs/personal-challenges/spec.md`.

### Requirement: Contextual personal encounter eligibility
**Reason**: The template rule system (storyline, route segment, cooldowns) is deferred to `personal-challenges-admin`; the rolled rules that remain live (global eligibility, minimum activity threshold, active-challenge suppression) are specified in the `personal-challenges` capability.
**Migration**: Use the `Personal encounter definitions and occurrences` and `Daily personal encounter rolls` requirements in `openspec/specs/personal-challenges/spec.md`.

### Requirement: Personal encounter choice
**Reason**: Replaced by the `personal-challenges` capability, which adds the coverage-window contract, accept-with-definition-ID rollover protection, and idempotent / single-use accept semantics the older requirement lacks.
**Migration**: Use the `Personal encounter choice` requirement in `openspec/specs/personal-challenges/spec.md`.

### Requirement: Personalized challenge targets
**Reason**: Replaced by the `personal-challenges` capability, which specifies the active-day average formula, stretch multiplier, min/max clamps, and roll-preview target persistence.
**Migration**: Use the `Personalized challenge targets` requirement in `openspec/specs/personal-challenges/spec.md`.

### Requirement: Progress accounting
**Reason**: Full of event-type-agnostic rules that are now split per feature: the `personal-challenges` capability defines ledger-backed, walk-date-window crediting for personal challenges (including coverage-window and grace-period rules and achievement immutability). Community campaign progress accounting will be re-specified by the pending `community-campaigns` change with its own crediting rules.
**Migration**: Use the `Progress accounting for personal challenges` requirement in `openspec/specs/personal-challenges/spec.md`; community crediting rules return via the pending `community-campaigns` change.

### Requirement: Personal challenge outcomes
**Reason**: Replaced by the `personal-challenges` capability, which adds the immediate completion rule (total ≥ target regardless of coverage-day fill), the 3-day grace logging window, daily-roll-settlement timing semantics, and acceptance-time completion.
**Migration**: Use the `Personal challenge outcomes` and `Scheduled settlement of personal challenges` requirements in `openspec/specs/personal-challenges/spec.md`.
