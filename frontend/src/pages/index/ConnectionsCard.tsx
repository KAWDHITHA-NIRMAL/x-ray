import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Tooltip, theme } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';

import { Sparkline } from '@/components/viz';
import type { Status } from '@/models/status';

interface ConnectionsCardProps {
  status: Status;
  tcp: number[];
  udp: number[];
  labels: string[];
  isMobile: boolean;
}

export default function ConnectionsCard({
  status,
  tcp,
  udp,
  labels,
  isMobile,
}: ConnectionsCardProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const accent = token.colorPrimary;
  const udpColor = token.colorTextTertiary;

  const total = Math.max(1, status.tcpCount + status.udpCount);
  const tcpPercent = Math.round((status.tcpCount / total) * 100);
  const udpPercent = 100 - tcpPercent;

  const referenceLines = useMemo(
    () => [
      { y: status.udpCount, color: udpColor, dash: '2 4' },
      { y: status.tcpCount, color: accent, dash: '2 4' },
    ],
    [status.tcpCount, status.udpCount, accent, udpColor],
  );

  return (
    <Card hoverable className="ov-connections-card" styles={{ body: { padding: 0 } }}>
      <div className="ov-wide-head ov-wide-head-stack">
        <div className="ov-conn-header-row">
          <div className="ov-kicker ov-kicker-icon">
            <ApartmentOutlined />
            <span>{t('pages.index.connectionCount') || 'Connection Stats'}</span>
          </div>
          <div className="ov-live-pulse-badge">
            <span className="ov-live-dot" />
            <span className="ov-live-text">LIVE</span>
          </div>
        </div>

        <div className="ov-conn-total">
          <span className="ov-tile-number">{status.tcpCount + status.udpCount}</span>
          <span className="ov-tile-unit">{t('pages.index.openSockets') || 'open sockets'}</span>
        </div>
      </div>

      <div className="ov-conn-bar-section">
        <Tooltip title={`TCP: ${status.tcpCount} (${tcpPercent}%) · UDP: ${status.udpCount} (${udpPercent}%)`}>
          <div className="ov-conn-bar-track">
            <div
              className="ov-conn-bar-tcp"
              style={{ width: `${tcpPercent}%`, backgroundColor: accent }}
            />
            <div
              className="ov-conn-bar-udp"
              style={{ width: `${udpPercent}%`, backgroundColor: udpColor }}
            />
          </div>
        </Tooltip>

        <div className="ov-conn-legend">
          <div className="ov-legend-chip ov-chip-tcp">
            <span className="ov-swatch" style={{ background: accent }} />
            <span className="ov-chip-label">TCP</span>
            <span className="ov-legend-num">{status.tcpCount.toLocaleString()}</span>
            <span className="ov-chip-percent">{tcpPercent}%</span>
          </div>
          <div className="ov-legend-chip ov-chip-udp">
            <span className="ov-swatch" style={{ background: udpColor }} />
            <span className="ov-chip-label">UDP</span>
            <span className="ov-legend-num">{status.udpCount.toLocaleString()}</span>
            <span className="ov-chip-percent">{udpPercent}%</span>
          </div>
        </div>
      </div>

      <div className="ov-wide-chart">
        <Sparkline
          data={tcp}
          data2={udp}
          labels={labels}
          height={isMobile ? 110 : 150}
          strokeWidth={1.5}
          fillOpacity={0.22}
          showTooltip
          showLegend={false}
          valueMax={null}
          stroke={accent}
          stroke2={udpColor}
          name1="TCP"
          name2="UDP"
          yFormatter={(v) => Math.round(v).toLocaleString()}
          referenceLines={referenceLines}
        />
      </div>
    </Card>
  );
}
