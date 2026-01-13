---
description: Process for updating goal descriptions to be more accurate and less repetitive
---

# Goal Description Update Process

This workflow guides the process of updating goal descriptions in the Walk to Mordor application to make them:
- More accurate to the specific part of the book where each goal takes place
- Less repetitive, generic, and bland
- Properly anchored to known book milestones

## Pre-requisites

- Access to the reference information document: `.agent/workflows/goal-description-reference.md`
- Familiarity with the goal structure in `migrations/0003_init_goals.sql`

---

## Step 1: Identify the Next Goal to Update

1. Open the reference document (`.agent/workflows/goal-description-reference.md`)
2. Check the **Progress Tracking** section for the last goal that was updated
   - **Note:** Migration `0004` contains initial descriptions but should be considered a baseline/legacy state. If the reference document shows "Not started", begin from Goal 4 (Distance 15) as the first few goals in 0004 are often already high quality. Verify against "Good" examples if in doubt.
3. Open `migrations/0003_init_goals.sql` to find the NEXT goal after the last completed one
4. Record:
   - Goal distance (e.g., `135 * 1.60934`)  
   - Goal title (e.g., "Reach Bree and meet Strider")
   - The goal title BEFORE this one
   - The goal title AFTER this one

---

## Step 2: Identify Anchoring Milestones

1. Using the reference document's **Book Milestones** section, identify:
   - The milestone that occurs DIRECTLY BEFORE the target goal
   - The milestone that occurs DIRECTLY AFTER the target goal
2. These milestones help anchor the goal within the narrative and ensure the description is contextually accurate

---

## Step 3: Create New Description (Sub-Agent)

> **IMPORTANT**: Use a sub-agent for this step to avoid context window bloat and to prevent the new description from being influenced by previous descriptions.
> **NOTE**: The sub-agent should be tasked with generating a description for **only ONE goal at a time**.

Provide the sub-agent with:
1. The **SINGLE** goal's distance value and title
2. The anchoring milestones (before and after)
3. The titles of the goals immediately before and after
4. Example of a GOOD description (from reference document)
5. Example of a BAD description (from reference document)

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

## Step 4: Save the Description Update

1. Check the latest migration file for goal description updates:
   - Look for files matching pattern: `migrations/00XX_update_goal_descriptions_*.sql`
   - If no such file exists OR the latest one already has 20 goals, create a new one

2. **If creating a new migration file:**
   ```sql
   -- Migration number: 00XX    [TIMESTAMP]
   
   -- Batch X: Update goal descriptions for improved accuracy
   
   -- Goal: [GOAL TITLE] (Distance: [DISTANCE value])
   UPDATE goals SET description = '[NEW DESCRIPTION]' WHERE distance = [DISTANCE] * 1.60934;
   ```

3. **If adding to an existing migration file:**
   - Count the number of UPDATE statements in the file
   - If < 20, append the new UPDATE statement **preceded by a comment** with the goal title and distance
   - If >= 20, create a new migration file instead

---

## Step 5: Update Progress Tracking

1. Open `.agent/workflows/goal-description-reference.md`
2. Update the **Progress Tracking** section:
   - Change "Last goal updated" to the goal you just completed
   - Increment the "Goals completed" counter
   - Update the timestamp

---

## Repeat

Continue from Step 1 for the next goal until all goals have been updated.

---

## Notes

- Each migration file should contain exactly 20 goals (except possibly the last one)
- The sub-agent isolation is critical to prevent description patterns from becoming repetitive
- When in doubt about book accuracy, refer to the milestone bracketing to determine the narrative context
