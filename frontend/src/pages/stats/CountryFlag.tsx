import { useState } from 'react';
import { GlobalOutlined } from '@ant-design/icons';

interface CountryFlagProps {
  countryCode: string;
  countryName?: string;
  size?: number;
  className?: string;
}

export default function CountryFlag({
  countryCode,
  countryName = '',
  size = 22,
  className = '',
}: CountryFlagProps) {
  const [loadError, setLoadError] = useState(false);
  const code = (countryCode || 'UN').toUpperCase();
  const lowerCode = code.toLowerCase();

  const width = Math.round(size * 1.33);
  const height = size;

  if (loadError || !countryCode) {
    return (
      <span
        className={`country-flag-badge ${className}`}
        style={{
          fontSize: `${Math.max(10, Math.round(size * 0.55))}px`,
          fontWeight: 700,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: 4,
          background: 'rgba(125,125,125,0.18)',
          border: '1px solid rgba(125,125,125,0.3)',
          color: 'var(--text-secondary, #8c8c8c)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
        title={countryName || code}
      >
        {code === 'UN' ? <GlobalOutlined style={{ fontSize: `${size * 0.75}px` }} /> : code.slice(0, 2)}
      </span>
    );
  }

  return (
    <span
      className={`country-flag-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
      title={countryName || code}
    >
      <img
        src={`https://flagcdn.com/${lowerCode}.svg`}
        alt={countryName || code}
        width={width}
        height={height}
        loading="lazy"
        onError={() => setLoadError(true)}
        style={{
          display: 'block',
          width: `${width}px`,
          height: `${height}px`,
          objectFit: 'cover',
        }}
      />
    </span>
  );
}
