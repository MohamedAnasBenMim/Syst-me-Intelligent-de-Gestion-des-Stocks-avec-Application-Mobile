// SGS Mobile — Design Tokens
// Primary color matches the SGS web frontend: RGB(0, 70, 120)

export const COLORS = {
  primary:        '#004678',   // SGS brand blue (matches web frontend)
  primaryDark:    '#003560',
  primaryLight:   '#E6EFF7',
  secondary:      '#0077CC',
  accent:         '#00A8E8',
  background:     '#F0F4F8',
  card:           '#FFFFFF',
  textPrimary:    '#0D1B2A',
  textSecondary:  '#5A7184',
  textMuted:      '#A0B3C4',
  success:        '#00B894',
  successLight:   '#E6FAF6',
  warning:        '#F39C12',
  warningLight:   '#FEF5E7',
  danger:         '#E74C3C',
  dangerLight:    '#FDECEA',
  info:           '#2980B9',
  infoLight:      '#EBF5FB',
  border:         '#DDE6EF',
};

export const SHADOW = {
  sm: {
    shadowColor: '#004678',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#004678',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
};
