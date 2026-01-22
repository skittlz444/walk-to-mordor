---
description: Generate watercolour-style images for goals in the Walk to Mordor application. Use when asked to create or update an image for a specific goal.
---

# Goal Image Generation

> **IMPORTANT**: This is a reference file. The full skill instructions are located at:
> 
> `.github/skills/goal-image-generation/SKILL.md`
> 
> Please read and follow the instructions in that file to complete this workflow.

## Quick Start

1. **Read the full skill file**: `.github/skills/goal-image-generation/SKILL.md`
2. **Reference the style guide**: `.github/skills/goal-image-generation/resources/style-reference.md`
3. **Follow the 7-step process** documented in the skill file

## Summary

This skill generates watercolour-style images for Walk to Mordor goals:

- **Step 1**: Identify the target goal
- **Step 2**: Identify anchoring milestones
- **Step 3**: Research LOTR context (sub-agent)
- **Step 4**: Build image prompt (sub-agent)
- **Step 5**: Validate prompt (sub-agent)
- **Step 6**: Generate high-res and thumbnail images
- **Step 7**: Update database with new image_id

## Image Specifications

| Type | Dimensions | Quality | Max Size | Format |
|------|------------|---------|----------|--------|
| High-res | 2560×2560px | 90 | <25MB | WebP |
| Thumbnail | max 400px | 60 | <20KB | WebP |

## Reference Images for Style

- `public/img/highres/2.jpg`
- `public/img/highres/21.jpg`
- `public/img/highres/28.jpg`
- `public/img/highres/30.jpg`
- `public/img/highres/56.jpg`
