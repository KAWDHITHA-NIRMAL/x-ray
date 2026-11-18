import { useMemo, useState } from 'react';
import type { ServerRequestsData } from './types';

interface ServerRequestChartProps {
  data: ServerRequestsData;
  className?: string;
}

// Generate smooth cubic bezier spline SVG path
function getSplinePath(points: [number, number][]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  let d = `M ${points[0][0]} ${points[0][1]}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;

    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }

  return d;
}

export default function ServerRequestChart({ data, className = '' }: ServerRequestChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(3); // Default to middle like reference image

  const { timestamps, series } = data;
  const numPoints = timestamps.length;

  const width = 600;
  const height = 260;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 30;
  const padBottom = 40;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxY = 125;
  const gridLevels = [0, 25, 50, 75, 100, 125];

  // Map data to SVG coordinates
  const seriesPaths = useMemo(() => {
    return series.map((s) => {
      const points: [number, number][] = s.data.map((val, idx) => {
        const x = padLeft + (idx / Math.max(1, numPoints - 1)) * plotW;
        const y = padTop + plotH - (val / maxY) * plotH;
        return [x, y];
      });

      const linePath = getSplinePath(points);

      // Area path closing at baseline
      const firstX = points[0]?.[0] || padLeft;
      const lastX = points[points.length - 1]?.[0] || width - padRight;
      const baselineY = padTop + plotH;
      const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

      return {
        ...s,
        points,
        linePath,
        areaPath,
      };
    });
  }, [series, numPoints, plotW, plotH, padLeft, padRight, padTop, maxY]);

  const activeX =
    hoverIndex !== null ? padLeft + (hoverIndex / Math.max(1, numPoints - 1)) * plotW : null;

  return (
    <div className={`server-request-card ${className}`}>
      {/* Header & Legend */}
      <div className="card-top-bar">
        <div className="card-title-group">
          <h3 className="chart-heading">Server Request</h3>
          <span className="chart-sub">Real-time HTTP & Inbound connection flow</span>
        </div>
        <div className="chart-legend">
          {series.map((s, idx) => (
            <span key={s.name} className="legend-item">
              <span
                className="legend-swatch"
                style={{ backgroundColor: idx === 0 ? '#2563eb' : '#f59e0b' }}
              />
              <span className="legend-label">{s.name}</span>
            </span>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="server-chart-svg"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="blueGlowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
              <stop offset="85%" stopColor="#2563eb" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="amberGlowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="85%" stopColor="#f59e0b" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>

            <filter id="pointDrop" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Grid lines and Y axis labels */}
          <g className="chart-grid">
            {gridLevels.map((lvl) => {
              const y = padTop + plotH - (lvl / maxY) * plotH;
              return (
                <g key={`lvl-${lvl}`}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    strokeWidth="0.8"
                    opacity="0.18"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                    opacity="0.6"
                  >
                    {lvl}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Area Fills */}
          {seriesPaths.map((s, idx) => (
            <path
              key={`area-${s.name}`}
              d={s.areaPath}
              fill={idx === 0 ? 'url(#blueGlowGrad)' : 'url(#amberGlowGrad)'}
            />
          ))}

          {/* Spline Lines */}
          {seriesPaths.map((s, idx) => (
            <path
              key={`line-${s.name}`}
              d={s.linePath}
              fill="none"
              stroke={idx === 0 ? '#2563eb' : '#f59e0b'}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Vertical Hover Crosshair Bar */}
          {activeX !== null && (
            <line
              x1={activeX}
              y1={padTop}
              x2={activeX}
              y2={padTop + plotH}
              stroke="#60a5fa"
              strokeDasharray="3 3"
              strokeWidth="1.2"
              opacity="0.75"
            />
          )}

          {/* Data Points & Active Highlights */}
          {seriesPaths.map((s, sIdx) =>
            s.points.map(([px, py], pIdx) => {
              const isActive = hoverIndex === pIdx;
              if (!isActive) return null;

              return (
                <g key={`pt-${sIdx}-${pIdx}`}>
                  <circle
                    cx={px}
                    cy={py}
                    r="6.5"
                    fill={sIdx === 0 ? '#2563eb' : '#f59e0b'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter="url(#pointDrop)"
                  />
                </g>
              );
            })
          )}

          {/* Invisible interactive hover rects */}
          {timestamps.map((_, idx) => {
            const stepW = plotW / Math.max(1, numPoints - 1);
            const x = padLeft + idx * stepW - stepW / 2;
            return (
              <rect
                key={`hover-${idx}`}
                x={x}
                y={padTop}
                width={stepW}
                height={plotH}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoverIndex(idx)}
              />
            );
          })}

          {/* X Axis Timestamps */}
          <g className="chart-x-labels">
            {timestamps.map((t, idx) => {
              const x = padLeft + (idx / Math.max(1, numPoints - 1)) * plotW;
              const isCurrent = hoverIndex === idx;
              return (
                <text
                  key={`time-${t}`}
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill="currentColor"
                  fontWeight={isCurrent ? '600' : '400'}
                  opacity={isCurrent ? 1 : 0.65}
                >
                  {t}
                </text>
              );
            })}
          </g>
        </svg>

        {/* Floating Tooltip Card (Matching reference image) */}
        {hoverIndex !== null && series[0] && (
          <div
            className="chart-floating-tooltip"
            style={{
              left: `${((activeX || 0) / width) * 100}%`,
              top: `${((seriesPaths[0]?.points[hoverIndex]?.[1] || 100) / height) * 100 - 30}%`,
            }}
          >
            <div className="tooltip-request-count">{series[0].data[hoverIndex]} Requests</div>
            <div className="tooltip-subtext">From {series[0].name}</div>
            {series[1] && (
              <div className="tooltip-secondary">
                {series[1].data[hoverIndex]} req ({series[1].name})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
