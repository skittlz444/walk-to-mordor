# CSS Theming Guide

## Overview

The Walk to Mordor application uses CSS Custom Properties (CSS Variables) for consistent theming across all components. All colors are centralized in `/public/css/main.css` for easy theme customization.

## CSS Variables Location

All theme variables are defined in the `:root` selector in `/public/css/main.css`.

## Variable Categories

### Background Colors
```css
--bg-primary: #000000          /* Main dark background */
--bg-secondary: #1a1a1a        /* Secondary dark background */
--bg-dark-alt: #2a2a2a         /* Alternate dark background */
--bg-button-dark: #444         /* Dark button background */
--bg-modal-overlay: rgba(0, 0, 0, 0.5)   /* Modal overlay */
--bg-modal-dark: rgba(0, 0, 0, 0.95)     /* Modal dark background */
```

### Accent Colors
```css
--text-gold: #FFD700           /* Primary gold accent (titles) */
--accent-blue: #007bff         /* Primary blue accent */
--accent-blue-alt: #2563eb     /* Alternate blue accent */
--accent-blue-dark: #1e5aa8    /* Dark blue accent */
--accent-teal: #16c79a         /* Teal accent (hovers) */
--accent-dark-teal: #006048    /* Dark teal accent */
--accent-dark-blue: #0f3460    /* Dark blue (primary buttons) */
--spring-meadow: #00FF7F       /* Special celebration color */
```

### Text Colors
```css
--text-primary: #ffffff        /* Primary text (white) */
--text-secondary: #ccc         /* Secondary text (light gray) */
--text-muted: #999             /* Muted text */
--text-dim: #aaa               /* Dim text */
--text-black: #000             /* Black text */
--text-gray-dark: #333         /* Dark gray text */
--text-gray-medium: #666       /* Medium gray text */
```

### Light Theme Colors (Auth Page)
```css
--light-bg: #f5f5f5            /* Light background */
--light-bg-error: #fff5f5      /* Light error background */
--light-bg-success: #f0f9f0    /* Light success background */
--light-border: #ddd           /* Light border */
--light-border-hover: #777     /* Light border hover */
```

### Status Colors
```css
--status-success: #28a745      /* Success state */
--status-success-light: #51cf66 /* Light success state */
--status-error: #dc3545        /* Error state */
--status-error-hover: #c82333  /* Error hover state */
--status-warning: #ff6b6b      /* Warning state */
```

### UI Elements
```css
--border-gray: #333            /* Gray border */
--border-medium: #555          /* Medium border */
--border-light: #666           /* Light border */
--border-lighter: #ababab      /* Lighter border */
--shadow-dark: #222            /* Dark shadow */
```

### Secondary Colors
```css
--secondary-gray: #6c757d      /* Secondary gray */
--secondary-gray-hover: #545b62 /* Secondary gray hover */
--secondary-dark: #404040      /* Secondary dark */
```

### Overlay Effects
```css
--hover-overlay: rgba(255, 255, 255, 0.1)     /* White hover overlay */
--hover-overlay-light: rgba(255, 255, 255, 0.05) /* Light hover overlay */
--focus-ring-blue: rgba(15, 52, 96, 0.1)      /* Blue focus ring (auth) */
--blue-hover-overlay: rgba(15, 52, 96, 0.1)   /* Blue hover overlay */
--gold-glow-light: rgba(255, 215, 0, 0.3)     /* Light gold glow */
--gold-glow-medium: rgba(255, 215, 0, 0.5)    /* Medium gold glow */
--gold-glow-strong: rgba(255, 215, 0, 0.7)    /* Strong gold glow */
--gold-border-light: rgba(255, 215, 0, 0.6)   /* Light gold border */
--gold-border-strong: rgba(255, 215, 0, 0.8)  /* Strong gold border */
--blue-overlay: rgba(0, 120, 215, 0.25)       /* Blue overlay */
--blue-border: rgba(0, 123, 255, 0.3)         /* Blue border */
--blue-focus-ring: rgba(0, 123, 255, 0.25)    /* Blue focus ring */
--dark-overlay: rgba(60, 60, 60, 0.8)         /* Dark overlay */
--dark-bg: rgba(50, 50, 50, 0.95)            /* Dark background */
--darker-bg: rgba(45, 45, 45, 0.95)          /* Darker background */
--darkest-bg: rgba(55, 55, 55, 0.95)         /* Darkest background */
--shadow-std: rgba(0, 0, 0, 0.3)             /* Standard shadow */
--shadow-light: rgba(0, 0, 0, 0.1)           /* Light shadow */
--status-warning-bg: rgba(255, 107, 107, 0.1) /* Warning background */
--status-success-bg: rgba(81, 207, 102, 0.1)  /* Success background */
```

## Usage Examples

### Using Variables in CSS

```css
/* Instead of hardcoded colors */
.button {
  background: #0f3460;  /* ❌ Don't do this */
  color: #fff;
}

/* Use CSS variables */
.button {
  background: var(--accent-dark-blue);  /* ✅ Do this */
  color: var(--text-primary);
}
```

### Hover States

```css
.card:hover {
  background: var(--hover-overlay);
  border-color: var(--gold-border-light);
  box-shadow: 0 4px 12px var(--gold-glow-light);
}
```

### Status Indicators

```css
.error-message {
  color: var(--status-error);
  background: var(--status-warning-bg);
}

.success-message {
  color: var(--status-success);
  background: var(--status-success-bg);
}
```

## File Organization

### `/public/css/main.css`
- Contains all CSS variable definitions
- Imports domain-specific stylesheets
- Base application layout styles

### Domain-Specific Stylesheets
- `/public/css/calendar.css` - Calendar component styles
- `/public/css/progress.css` - Progress tracking and modal styles  
- `/public/css/goals.css` - Goals display and interaction styles
- `/public/css/profile.css` - Profile modal styles
- `/public/css/auth.css` - Authentication page styles (light theme)

## Customizing the Theme

To customize the application theme:

1. **Edit CSS variables** in `/public/css/main.css`
2. **Modify the `:root` selector** with your desired color values
3. **Rebuild the application** with `npm run build`
4. **Test thoroughly** to ensure contrast ratios meet accessibility standards

### Example: Creating a Light Theme

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #000000;
  --text-secondary: #666666;
  /* ... update other variables as needed */
}
```

## Best Practices

1. **Always use CSS variables** for colors - never hardcode hex/rgb values
2. **Maintain semantic naming** - use descriptive variable names
3. **Test accessibility** - ensure sufficient contrast ratios (WCAG AA minimum)
4. **Document changes** - update this guide when adding new variables
5. **Group related variables** - keep similar colors together
6. **Consider dark/light themes** - use appropriate contrast for both

## Browser Support

CSS Custom Properties are supported in all modern browsers:
- Chrome 49+
- Firefox 31+
- Safari 9.1+
- Edge 15+

## Migration Notes

As of the latest update, all hardcoded colors have been replaced with CSS variables. This change:
- ✅ Centralizes theme management
- ✅ Enables easy theme switching
- ✅ Improves maintainability
- ✅ Supports future dark/light mode toggle
- ✅ Ensures visual consistency across components

## Related Documentation

- [Frontend Guide](frontend-guide.md) - Overall frontend architecture
- [UI Overview](ui-overview.md) - Component structure and behavior
- [UX Design](ux-design.md) - Design principles and patterns
