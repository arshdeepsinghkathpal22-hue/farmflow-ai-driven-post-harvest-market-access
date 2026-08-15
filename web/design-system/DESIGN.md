---
name: FarmFlow
colors:
  surface: '#fdf9f0'
  surface-dim: '#dddad1'
  surface-bright: '#fdf9f0'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3ea'
  surface-container: '#f1eee5'
  surface-container-high: '#ece8df'
  surface-container-highest: '#e6e2d9'
  on-surface: '#1c1c17'
  on-surface-variant: '#3f4940'
  inverse-surface: '#31312b'
  inverse-on-surface: '#f4f0e8'
  outline: '#6f7a6f'
  outline-variant: '#becabd'
  surface-tint: '#016d38'
  primary: '#006030'
  on-primary: '#ffffff'
  primary-container: '#1b7a43'
  on-primary-container: '#abffbf'
  inverse-primary: '#80d998'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#004fab'
  on-tertiary: '#ffffff'
  tertiary-container: '#0566d9'
  on-tertiary-container: '#e6ecff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9bf6b2'
  primary-fixed-dim: '#80d998'
  on-primary-fixed: '#00210d'
  on-primary-fixed-variant: '#005228'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#fdf9f0'
  on-background: '#1c1c17'
  surface-variant: '#e6e2d9'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bilingual:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  touch-target-min: 48px
  base-unit: 8px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
  stack-sm: 12px
  stack-md: 24px
---

## Brand & Style
The design system is engineered for rural logistics and cold-chain management, specifically tailored for the Indian agricultural landscape. The brand personality is dependable, grounded, and accessible, prioritizing utility for users who may have varying levels of digital literacy. 

The aesthetic follows a **Modern-Tactile** approach-combining the clean efficiency of a SaaS platform with the physical approachability of soft, card-based UI. It avoids high-density information architecture in favor of generous whitespace and high-contrast elements that remain legible under direct sunlight. The emotional response should be one of "Prosperity and Reliability," positioning the technology as a sturdy tool for the farmer's livelihood.

## Colors
The palette is deeply rooted in the agricultural context while maintaining functional signaling.

- **Primary (Deep Green):** Represents growth and trust; used for primary actions and success states.
- **Background (Warm Cream):** Reduces screen glare and provides a less "clinical" feel than pure white, better suited for outdoor use.
- **Secondary (Amber/Orange):** Reserved strictly for critical financial information (prices, earnings) and alerts.
- **Tertiary (Cool Blue):** Used to signify cold-storage status, temperature controls, and technical metrics.
- **Neutrals:** Use Slate-based grays for text against the Cream background to maintain high legibility without the harshness of pure black.

## Typography
This design system utilizes **Inter** for its exceptional legibility and systematic support for Devanagari script via its variable axes and wide language coverage. 

**Bilingual Implementation:**
Every functional label must display English and Hindi simultaneously. The English text should be in `fontWeight: 600`, while the Hindi counterpart follows immediately or below in a slightly lighter weight to balance the visual "heaviness" of the script. 

**Scale:**
Body text starts at 16px to ensure accessibility. Headlines are kept compact to allow room for bilingual strings without excessive vertical scrolling.

## Layout & Spacing
The system uses a **Fluid Grid** model optimized for mobile-first consumption. 

- **Mobile (Default):** 4-column grid with 20px outside margins and 16px gutters.
- **Tablet/Desktop:** 12-column grid with a max-width of 1200px.
- **Rhythm:** An 8px base unit dictates all padding and margins. Vertical stacking of cards should use a 16px or 24px gap to maintain distinct visual separation for low-literacy clarity.
- **Touch Safety:** All interactive elements must maintain a minimum hit area of 48x48px, even if the visual asset is smaller.

## Elevation & Depth
Depth is signaled through **Tonal Layers** and **Ambient Shadows** rather than harsh borders.

- **Level 0 (Base):** Warm Cream (#FFFBF2).
- **Level 1 (Cards):** White (#FFFFFF) surfaces with a soft, diffused shadow (Y: 4, Blur: 12, Opacity: 0.05, Color: #1B7A43).
- **Level 2 (Floating/Active):** Slightly more pronounced shadow to indicate "pick-up" state or primary action buttons.

This approach creates a clear hierarchy: the "ground" is the warm earth/background, and "actionable tools" are clean white cards lifted slightly above it.

## Shapes
The design system employs a **Pill-shaped/High-radius** language. 

- **Standard Containers:** Use `rounded-2xl` (16px) for cards and input fields.
- **Primary Buttons/Chips:** Use `rounded-full` (999px) or `rounded-3xl` (24px) to maximize the "friendly" and "safe" perception of the UI.
- **Icon Enclosures:** Icons are often placed inside circular or highly rounded square containers to act as clear touch points.

## Components

### Buttons
- **Primary:** Deep Green background, White text. Large padding (16px vertical). 
- **Secondary:** Transparent background with a 2px Deep Green border.
- **Content:** All buttons must contain the Bilingual string (e.g., "Confirm / पुष्टि करें").

### Cards
- White background, `rounded-2xl`. 
- Cards should have a thick 4px left-border accent in Primary (Green) or Tertiary (Blue) to categorize the content type (e.g., Green for generic info, Blue for Cold Storage data).

### Input Fields
- Height of 56px to ensure large touch targets.
- Soft cream fill (#F7F2E9) when inactive, switching to a Green border on focus.
- Labels are always persistent; do not use floating placeholders that disappear.

### Icons
- **Style:** 2.5px stroke weight, rounded caps and corners. 
- **Scale:** Minimum 24x24px within a 48px touch target.
- **Context:** Use literal icons (a real thermometer for cold, a real rupee symbol for money) rather than abstract metaphors.

### Bilingual Labels
- Format: `[English] / [Hindi]`
- Use a forward slash as a separator. For complex layouts, stack vertically with English on top (14px) and Hindi below (14px).