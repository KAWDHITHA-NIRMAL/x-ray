import { useState } from 'react';
import type { ClientLoadLatencyData } from './types';

interface ClientLoadChartProps {
  data: ClientLoadLatencyData;
  className?: string;
}

export default function ClientLoadChart({ data, className = '' }: ClientLoadChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(3); // 13:50 highlighted like reference image

  const { timestamps, bars } = data;
  const width = 450;
  const height = 260;
  const padLeft = 40;
  const padRight = 15;
  const padTop = 30;
  const padBottom = 40;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxLatency = 4.0; // In seconds / relative load scale
  const gridLevels = [0, 1.0, 2.0, 3.0, 4.0];

  const barWidth = 14;

  return (
    <div className={`client-load-card ${className}`}>
      {/* Header */}
      <div className="card-top-bar">
        <div className="card-title-group">
          <h3 className="chart-heading">Client side load & latency</h3>
          <span className="chart-sub">Per-session response time & handshake distribution</span>
        </div>
      </div>

      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="client-load-svg"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="barGradPrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>

            <linearGradient id="barGradLight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.7" />
            </linearGradient>

            <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>

          {/* Grid lines and Y axis scale */}
          <g className="chart-grid">
            {gridLevels.map((lvl) => {
              const y = padTop + plotH - (lvl / maxLatency) * plotH;
              return (
                <g key={`grid-lvl-${lvl}`}>
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
                    {lvl.toFixed(1)}s
                  </text>
                </g>
              );
            })}
          </g>

          {/* Bars */}
          <g className="chart-bars">
            {bars.map((b, idx) => {
              const xCenter = padLeft + (idx / Math.max(1, bars.length - 1)) * plotW;
              const x = xCenter - barWidth / 2;

              // Total height for 4.0s full bar background
              const bgY = padTop;
              const bgH = plotH;

              // Actual latency height (seconds converted: e.g. 24ms -> scaled for demo or load bar)
              // We'll scale latency / load to match the visual proportion in the reference image
              const latencySec = (b.latencyMs / 10).toFixed(1);
              const val = Math.min(Math.max((b.latencyMs / 10) * 0.9, 0.8), 3.8);
              const filledH = (val / maxLatency) * plotH;
              const filledY = padTop + plotH - filledH;

              const isHovered = hoverIndex === idx;

              return (
                <g
                  key={`bar-${b.time}`}
                  className={`bar-group ${isHovered ? 'bar-hovered' : ''}`}
                  onMouseEnter={() => setHoverIndex(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Subtle Background Ghost Bar */}
                  <rect
                    x={x}
                    y={bgY}
                    width={barWidth}
                    height={bgH}
                    rx={barWidth / 2}
                    fill="currentColor"
                    opacity="0.08"
                  />

                  {/* Filled Latency Bar (Segmented Look) */}
                  <rect
                    x={x}
                    y={filledY}
                    width={barWidth}
                    height={filledH}
                    rx={barWidth / 2}
                    fill={isHovered ? 'url(#barGradActive)' : 'url(#barGradPrimary)'}
                    className="bar-filled-seg"
                  />

                  {/* Highlight pill text over active / hovered bar (e.g. 2.8s) */}
                  {isHovered && (
                    <g transform={`translate(${xCenter}, ${filledY - 14})`}>
                      <rect
                        x="-20"
                        y="-14"
                        width="40"
                        height="18"
                        rx="4"
                        fill="#1e293b"
                        stroke="#38bdf8"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="-2"
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill="#38bdf8"
                      >
                        {latencySec}s
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* X Axis Timestamps */}
          <g className="chart-x-labels">
            {timestamps.map((t, idx) => {
              const xCenter = padLeft + (idx / Math.max(1, timestamps.length - 1)) * plotW;
              const isCurrent = hoverIndex === idx;
              return (
                <text
                  key={`time-lbl-${t}`}
                  x={xCenter}
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
      </div>
    </div>
  );
}
