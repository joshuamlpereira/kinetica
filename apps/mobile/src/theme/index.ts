import { color, font, motion, space } from './tokens';

export const theme = { color, space, font, motion } as const;

export type Theme = typeof theme;
