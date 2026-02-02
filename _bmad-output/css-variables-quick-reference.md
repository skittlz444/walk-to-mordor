# Quick Reference: CSS Theme Variables

## Most Commonly Used Variables

### Primary Colors
```css
--bg-primary: #000000              /* Main background */
--bg-secondary: #1a1a1a            /* Secondary background */
--text-primary: #ffffff            /* Primary text */
--text-secondary: #ccc             /* Secondary text */
--text-gold: #FFD700               /* Gold accent (titles) */
```

### Accent & Interactive
```css
--accent-dark-blue: #0f3460        /* Primary buttons */
--accent-teal: #16c79a             /* Hover states */
--accent-blue: #007bff             /* Links, focus */
--spring-meadow: #00FF7F           /* Celebration/success */
```

### Status & Feedback
```css
--status-success: #28a745          /* Success messages */
--status-error: #dc3545            /* Error messages */
--status-warning: #ff6b6b          /* Warning messages */
```

### Common Effects
```css
--hover-overlay: rgba(255, 255, 255, 0.1)    /* White hover */
--shadow-std: rgba(0, 0, 0, 0.3)             /* Standard shadow */
--gold-glow-light: rgba(255, 215, 0, 0.3)    /* Gold glow */
--blue-focus-ring: rgba(0, 123, 255, 0.25)   /* Focus ring */
```

## Usage Pattern

```css
/* ✅ CORRECT - Use variables */
.button {
  background: var(--accent-dark-blue);
  color: var(--text-primary);
}

.button:hover {
  background: var(--accent-teal);
  box-shadow: 0 4px 12px var(--shadow-std);
}

/* ❌ INCORRECT - Don't hardcode colors */
.button {
  background: #0f3460;
  color: #fff;
}
```

## Full Reference

See [docs/css-theming.md](../docs/css-theming.md) for complete documentation of all 69 variables.

---

**Quick Stats:**
- Total Variables: 69
- Colors Replaced: 68+
- Files Updated: 6
- Zero Visual Changes: ✓

**Last Updated:** 2025 (CSS Color Cleanup Mission)
