---
name: Targeted Goal Description Update
description: Process for creating or updating a description for a specific goal in the Walk to Mordor application. Use when asked to update a specific goal's description.
---

# Targeted Goal Description Update Process

This workflow guides the process of updating a specific goal description in the Walk to Mordor application.

## Pre-requisites

- Access to the reference information document: `.agent/workflows/goal-description-reference.md`
- Access to `migrations/0003_init_goals.sql` for goal reference.

---

## Step 1: Identify the Target Goal

1. Determine which goal the user wants to update.
   - If the user provides a name or approximate location, search `migrations/0003_init_goals.sql` or `migrations/0019_update_goal_descriptions_09.sql` (or other description updates) to find the matching goal.
   - You need the **Distance** value to uniquely identify the goal.
2. Once identified, record:
   - Goal Distance (e.g., `135`)
   - Goal Title
   - The goal title/distance immediately BEFORE this one.
   - The goal title/distance immediately AFTER this one.

---

## Step 2: Identify Anchoring Milestones

1. Open the reference document (`.agent/workflows/goal-description-reference.md`).
2. Consult the **Book Milestones** section.
3. Identify:
   - The milestone that occurs DIRECTLY BEFORE the target goal.
   - The milestone that occurs DIRECTLY AFTER the target goal.

---

## Step 3: Create New Description (Sub-Agent)

> **IMPORTANT**: Use a sub-agent for this step to avoid context window bloat and to prevent the new description from being influenced by previous descriptions.
> **NOTE**: The sub-agent should be tasked with generating a description for **only ONE goal at a time**.
> **NOTE**: If asked to update multiple goals, use a SEPARATE sub-agent for EACH goal.

Provide the sub-agent with:
1. The **Target Goal's** distance and title.
2. The context goals (previous and next titles).
3. The anchoring milestones (before and after).
4. Reference to GOOD/BAD examples (from reference document).

**Sub-agent prompt template:**
```
Create a new goal description for the Walk to Mordor fitness app for a SINGLE goal.
> If you have been presented with more than one goal, exit early, returning an ERROR to the parent agent that you can only process one goal.

GOAL INFORMATION:
- Distance: [DISTANCE VALUE]
- Title: [GOAL TITLE]
- Previous goal: [PREVIOUS GOAL TITLE]
- Next goal: [NEXT GOAL TITLE]

BOOK CONTEXT:
- Previous milestone: [MILESTONE BEFORE]
- Next milestone: [MILESTONE AFTER]

GUIDELINES:
- Write 3-5 sentences that are specific to this exact location in the book
- Reference specific characters, events, or descriptions from this part of the narrative
- Avoid generic phrases like "a part of their journey" or "a testament to their resolve"
- Do NOT repeat structural patterns from other descriptions
- Focus on what makes THIS moment unique in the story
- **Use ONLY 3rd Person Limited perspective ("The hobbits", "Frodo", "Sam", "The company", "The Fellowship")**
- **Do NOT use 1st or 2nd person perspective ("I", "We", "You", "Your")**
- **Ensure the subject is established with a proper noun ("The hobbits", "The company", "Frodo") BEFORE using pronouns like "they" or "them". Do not start the description with "They" or "Them".**
- **Use British English spelling (e.g., 'travellers' instead of 'travelers', 'grey' instead of 'gray', 'colour' instead of 'color', 'honour' instead of 'honor').**

EXAMPLES:
[Include GOOD and BAD examples from reference document]

Return ONLY the new description text, nothing else.
```

---

## Step 4: Create Migration File

1. Create a new migration file in the `migrations/` folder.
   - Name format: `migrations/00XX_update_description_[short_goal_name].sql`
   - Use the next available migration number.
   - If a migration file for this specific request already exists (e.g. user is iterating), update it. Otherwise, create new.

2. **File Content:**
   ```sql
   -- Migration number: 00XX    [TIMESTAMP]
   
   -- Goal: [GOAL TITLE] (Distance: [DISTANCE value])
   UPDATE goals SET description = '[NEW DESCRIPTION]' WHERE distance = [DISTANCE] * 1.60934;
   ```

3. **If adding to an existing migration file:**
   - Do not change the Migration Number in an existing migration file, but update its timestamp

---

## Notes

- The sub-agent isolation is critical to prevent description patterns from becoming repetitive
- When in doubt about book accuracy, refer to the milestone bracketing to determine the narrative context
