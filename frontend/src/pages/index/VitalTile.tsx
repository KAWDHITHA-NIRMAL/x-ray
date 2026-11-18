import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Card, theme } from 'antd';

import { Sparkline } from '@/components/viz';
import { mean, peak } from './useOverviewHistory';

interface VitalTileProps {
  icon: ReactNode;
  label: string;
  percent?: number;
  valueString?: string;
  unit?: string;
  statusColor: string;
  detail: ReactNode;
  subBadge?: ReactNode;
  footLeft: string;
  footRight: string;
  data: number[];
  isMobile: boolean;
  yFormatter?: (v: number) => string;
}

export default function VitalTile({
  icon,
  label,
  percent,
  valueString,
  unit = '%',
  statusColor,
  detail,
  subBadge,
  footLeft,
  footRight,
  data,
  isMobile,
  yFormatter,
}: VitalTileProps) {
  const { token } = theme.useToken();
  const meanColor = token.colorTextTertiary;

  const referenceLines = useMemo(
    () => (data.length > 1 ? [{ y: mean(data), dash: '3 4', color: meanColor }] : []),
    [data, meanColor],
  );

  const displayNum = percent !== undefined ? percent.toFixed(1) : (valueString || '0');

  return (
    <Card hoverable className="ov-tile" styles={{ body: { padding: 0 } }}>
      <div className="ov-tile-head">
        <div className="ov-tile-title">
          <span className="ov-tile-icon">{icon}</span>
          <span className="ov-kicker">{label}</span>
        </div>
        {subBadge && <div className="ov-tile-badge">{subBadge}</div>}
      </div>

      <div className="ov-tile-value">
        <span className="ov-tile-number">{displayNum}</span>
        <span className="ov-tile-unit">{unit}</span>
      </div>

      {percent !== undefined && (
        <div className="ov-tile-progress-track">
          <div
            className="ov-tile-progress-fill"
            style={{
              width: `${Math.min(100, Math.max(0, percent))}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>
      )}

      <div className="ov-tile-detail">{detail}</div>

      <div className="ov-tile-foot">
        <span className="ov-foot-chip">{footLeft}</span>
        <span className="ov-foot-chip">{footRight}</span>
      </div>

      <div className="ov-tile-chart">
        <Sparkline
          data={data}
          height={isMobile ? 48 : 58}
          strokeWidth={1.5}
          fillOpacity={0.25}
          showGrid={false}
          showMarker={false}
          valueMax={peak(data) > 0 ? null : (percent !== undefined ? 100 : null)}
          stroke={statusColor}
          referenceLines={referenceLines}
          yFormatter={yFormatter || ((v) => `${v.toFixed(0)}%`)}
          name1={label}
        />
      </div>
    </Card>
  );
}
