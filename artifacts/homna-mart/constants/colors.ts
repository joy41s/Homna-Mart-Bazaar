/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#17382A',
    tint: '#247A48',

    // Core surfaces
    background: '#F6F8F2',
    foreground: '#17382A',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#17382A',

    // Primary action color (buttons, links, active states)
    primary: '#247A48',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#EAF2E9',
    secondaryForeground: '#214B35',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EDF1E9',
    mutedForeground: '#718074',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#DFF0DF',
    accentForeground: '#1D6139',

    // Destructive actions (delete, error states)
    destructive: '#C43D3D',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#E4EAE0',
    input: '#DDE5D9',

    // Brand details and overlays
    white: '#FFFFFF',
    primaryDark: '#164A31',
    primarySoft: '#D5E8D7',
    primaryMuted: '#D1E3D5',
    gold: '#F0C766',
    whiteOverlay: 'rgba(255,255,255,0.82)',
    whiteOverlayStrong: 'rgba(255,255,255,0.92)',
    whiteBorder: 'rgba(255,255,255,0.19)',
    greenGlow: 'rgba(209,232,188,0.08)',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;
