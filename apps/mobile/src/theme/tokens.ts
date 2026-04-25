export const color = {
  background: '#000000',
  text: '#EDEDED',
  textDim: '#7A7A7A',
  accent: '#7CFF6B',
  divider: '#1A1A1A',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
} as const;

export const font = {
  heading: 'SF Pro Text',
  mono: 'SF Mono',
} as const;

export const motion = {
  spring: { stiffness: 180, damping: 22 },
} as const;
