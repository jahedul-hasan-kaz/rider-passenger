# Passenger App Spec — 02 · Design system

[01 Overview & foundation](01-overview-foundation.md) · [02 Design system](02-design-system.md) · [03 Screens](03-screens.md) · [04 Integration](04-integration.md) · [05 Quality & delivery](05-quality-delivery.md)

---

## 5. Design system

Direction taken from the mockups: a deep-green header that curves into a pale surface, mint for the one primary accent, big rounded cards, heavy headline type, and generous touch targets.

### 5.1 Tokens (sampled from the mockups; finalise with design)

| Token | Light | Use |
|---|---|---|
| `brand.900` | `#0B3B2E` | Header, primary button on light surfaces, text on mint |
| `brand.800` | `#124D3C` | Cards on dark, selected card fill |
| `accent.400` | `#6EE7B7` | Primary button on dark, progress, selected ring, pickup dot |
| `surface.0` | `#FFFFFF` | Cards, inputs, sheets |
| `surface.50` | `#F1F7F4` | Screen background |
| `surface.100` | `#E3F1EA` | Info rows, chips, disabled fill |
| `text.primary` / `text.muted` | `#0E2A22` / `#5B6F68` | |
| `danger.500` | `#E5533D` | Destination marker, errors, SOS |
| `warning.500` | `#E0A100` | Surge, fare-changed notices |

- **Dark theme** from day one (follows the system, override in Settings); night riding is common and the map switches to a dark style with it.
- **Contrast:** all text ≥ 4.5:1; mint is never used for text on white.
- **Radius:** 12 (inputs, chips) · 20 (cards) · 28 (sheets, hero header). **Spacing:** 4-pt scale. **Touch targets:** ≥ 48 × 48 dp.
- **Elevation:** one soft shadow level for cards, one for sheets. No borders and shadows together.

### 5.2 Type

- Latin: **Inter** (700/800 headlines, 500/600 UI, 400 body). Bengali: **Hind Siliguri** (or Noto Sans Bengali), line-height +15% because of taller glyphs.
- Scale: Display 32 · Title 24 · Heading 18 · Body 16 · Caption 13. Respects system font scaling up to 130%; layouts must not clip at that size.
- Numbers (fares, ETA, OTP) use tabular figures. Fares are formatted `৳190`; Bengali locale may show Bengali digits (setting, default Latin digits for clarity with drivers).

### 5.3 Core components

Button (primary / secondary / ghost / danger, with loading and disabled states) · Field (label, helper, error) · OTP boxes · Phone field with fixed `+880` · Card · Selectable vehicle card · Chip · Segmented control · Stepper/progress bar · Bottom sheet (snap points, drag handle) · Info banner · Toast · Skeleton · Empty state · Map pin + pulse · Route line · Driver card · Fare breakdown list · Countdown ring · Offline bar · SOS button.

### 5.4 Motion & feedback

- 200–250 ms standard transitions, spring for sheets, shared-element feel between vehicle card → confirm sheet.
- Haptics: light on selection, medium on request sent, success on driver found, warning on cancellation, heavy on SOS.
- "Reduce motion" turns off the radar pulse, parallax and map camera sweeps.
- Skeletons, never spinners, for content; a spinner only inside a button that is working.

### 5.5 Accessibility

WCAG 2.2 AA: screen-reader labels and roles on every control, logical focus order, live-region announcements for trip status changes ("Your driver has arrived"), no information by colour alone (status has icon + text), dynamic type, RTL-safe layout primitives.

