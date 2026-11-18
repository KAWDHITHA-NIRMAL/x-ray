import React from 'react';

export interface TechTextProps {
  text?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number;
  letterSpacing?: number;
  color?: string;
  accentColor?: string;
  align?: 'left' | 'center' | 'right';
  reach?: number;
  softness?: number;
  dashLength?: number;
  dashGap?: number;
  strokeWidth?: number;
  lineStyle?: 'dashed' | 'solid';
  reveal?: 'letter' | 'all' | 'none';
  specks?: number;
  selection?: boolean;
  labels?: boolean;
  draggable?: boolean;
  bounce?: number;
  sweep?: boolean;
  speed?: number;
  clickKick?: boolean;
  intro?: 'none' | 'fade' | 'pop';
  className?: string;
  style?: React.CSSProperties;
}

declare const TechText: React.FC<TechTextProps>;
export default TechText;
