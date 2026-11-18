import type { GeoStatsKPIs } from './types';
import { SizeFormatter } from '@/utils';
import CountryFlag from './CountryFlag';

interface StatisticOverviewCardsProps {
  kpis: GeoStatsKPIs;
  className?: string;
}

// Generate smooth SVG sparkline path
function getMiniSparkPath(data: number[], width: number, height: number): string {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points: [number, number][] = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return [x, y];
  });

  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
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

export default function StatisticOverviewCards({
  kpis,
  className = '',
}: StatisticOverviewCardsProps) {
  const { totalTrafficBytes, activeSessions, connectedClients, topCountry, deltas, sparklines } =
    kpis;

  const sparkW = 85;
  const sparkH = 34;

  const items = [
    {
      key: 'traffic',
      title: 'Memory / Traffic',
      value: SizeFormatter.sizeFormat(totalTrafficBytes),
      delta: deltas.traffic,
      isPositive: deltas.traffic.startsWith('+'),
      sparkColor: '#10b981',
      sparkData: sparklines.traffic,
      sublabel: 'Total ingress & egress',
    },
    {
      key: 'sessions',
      title: 'Active Sessions',
      value: activeSessions.toString(),
      delta: deltas.sessions,
      isPositive: deltas.sessions.startsWith('+'),
      sparkColor: '#06b6d4',
      sparkData: sparklines.sessions,
      sublabel: 'Live client tunnels',
    },
    {
      key: 'clients',
      title: 'Connected Clients',
      value: connectedClients.toString(),
      delta: deltas.clients,
      isPositive: deltas.clients.startsWith('+'),
      sparkColor: '#3b82f6',
      sparkData: sparklines.clients,
      sublabel: 'Unique client IDs',
    },
    {
      key: 'topCountry',
      title: `Top Origin (${topCountry.code})`,
      value: `${topCountry.percent}%`,
      delta: deltas.topCountry,
      isPositive: !deltas.topCountry.startsWith('-'),
      sparkColor: '#f59e0b',
      sparkData: sparklines.topCountry,
      sublabel: `${topCountry.name} · ${topCountry.count} sessions`,
      flagCode: topCountry.code,
    },
  ];

  return (
    <div className={`stats-overview-box ${className}`}>
      {/* Top Header */}
      <div className="overview-header-row">
        <h3 className="overview-heading">Statistic Overview</h3>
        <span className="overview-pill-badge">24 Active Sessions</span>
      </div>

      {/* 2x2 Grid Tiles */}
      <div className="overview-tiles-grid">
        {items.map((item) => {
          const path = getMiniSparkPath(item.sparkData, sparkW, sparkH);
          return (
            <div key={item.key} className="ov-metric-card">
              <div className="card-val-row">
                <div className="val-col">
                  <div className="metric-num">
                    {item.value}
                    {item.flagCode && (
                      <CountryFlag
                        countryCode={item.flagCode}
                        size={16}
                        className="inline-top-flag"
                      />
                    )}
                  </div>
                  <div className="metric-title">{item.title}</div>
                </div>

                {/* Mini Sparkline Chart */}
                <div className="metric-spark-col">
                  <svg
                    viewBox={`0 0 ${sparkW} ${sparkH}`}
                    width={sparkW}
                    height={sparkH}
                    className="metric-sparkline"
                  >
                    <path
                      d={path}
                      fill="none"
                      stroke={item.sparkColor}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Delta & Sublabel */}
              <div className="card-delta-row">
                <span className={`delta-tag ${item.isPositive ? 'positive' : 'negative'}`}>
                  {item.isPositive ? '▲' : '▼'} {item.delta.replace(/[+-]/, '')}
                </span>
                <span className="sublabel-text">{item.sublabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
