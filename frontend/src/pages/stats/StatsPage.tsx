import { useCallback, useEffect, useState } from 'react';
import { Button, ConfigProvider, Layout, message } from 'antd';
import {
  SyncOutlined,
} from '@ant-design/icons';

import { useTheme } from '@/hooks/useTheme';
import AppSidebar from '@/layouts/AppSidebar';
import { HttpUtil } from '@/utils';
import type { ClientConnection, GeoStatsResponse } from './types';
import StatisticOverviewCards from './StatisticOverviewCards';
import GeoWorldMap from './GeoWorldMap';
import ServerRequestChart from './ServerRequestChart';
import ClientLoadChart from './ClientLoadChart';
import ActiveClientsGeoTable from './ActiveClientsGeoTable';
import ClientDetailModal from './ClientDetailModal';
import './StatsPage.css';

const DEFAULT_STATS_DATA: GeoStatsResponse = {
  kpis: {
    totalTrafficBytes: 133791825920,
    activeSessions: 70,
    connectedClients: 18,
    topCountry: { name: 'Sri Lanka', code: 'LK', percent: 64.2, count: 45 },
    avgLatencyMs: 28,
    deltas: {
      traffic: '+3.64%',
      sessions: '+5.20%',
      clients: '+0.24%',
      topCountry: '-1.48%',
    },
    sparklines: {
      traffic: [35, 42, 45, 60, 52, 70, 85, 92, 105, 124.6],
      sessions: [48, 52, 55, 58, 62, 60, 65, 68, 70],
      clients: [14, 15, 15, 16, 17, 17, 18, 18, 18],
      topCountry: [72, 70, 68, 66, 65, 64.2],
    },
  },
  serverRequests: {
    timestamps: ['13:20', '13:30', '13:40', '13:50', '14:00', '14:10', '14:20'],
    series: [
      {
        name: 'SG Node 1 (Inbound)',
        color: '#3b82f6',
        data: [12, 28, 22, 54, 48, 82, 95],
      },
      {
        name: 'Direct Inbounds',
        color: '#f59e0b',
        data: [8, 22, 16, 32, 68, 72, 92],
      },
    ],
  },
  clientLoadLatency: {
    timestamps: ['13:20', '13:30', '13:40', '13:50', '14:00', '14:10', '14:20'],
    bars: [
      { time: '13:20', latencyMs: 24, loadPercent: 42, split: [12, 12] },
      { time: '13:30', latencyMs: 20, loadPercent: 35, split: [10, 10] },
      { time: '13:40', latencyMs: 26, loadPercent: 55, split: [14, 12] },
      { time: '13:50', latencyMs: 28, loadPercent: 68, split: [18, 10] },
      { time: '14:00', latencyMs: 32, loadPercent: 74, split: [20, 12] },
      { time: '14:10', latencyMs: 30, loadPercent: 70, split: [18, 12] },
      { time: '14:20', latencyMs: 27, loadPercent: 65, split: [15, 12] },
    ],
  },
  geoNodes: [
    {
      country: 'Sri Lanka',
      code: 'LK',
      city: 'Colombo',
      lat: 7.8731,
      lng: 80.7718,
      clients: 12,
      sessions: 45,
      trafficBytes: 67108864000,
      upBytes: 15428900000,
      downBytes: 51679964000,
      avgLatencyMs: 24,
      isp: 'Dialog / SLT Mobitel',
      status: 'active',
      role: 'client',
    },
    {
      country: 'Singapore',
      code: 'SG',
      city: 'Singapore',
      lat: 1.3521,
      lng: 103.8198,
      clients: 3,
      sessions: 12,
      trafficBytes: 25769803776,
      upBytes: 6442450944,
      downBytes: 19327352832,
      avgLatencyMs: 8,
      isp: 'Singtel / DigitalOcean',
      status: 'active',
      role: 'hub',
    },
    {
      country: 'Malaysia',
      code: 'MY',
      city: 'Kuala Lumpur',
      lat: 4.2105,
      lng: 101.9758,
      clients: 2,
      sessions: 6,
      trafficBytes: 10307921510,
      upBytes: 2147483648,
      downBytes: 8160437862,
      avgLatencyMs: 34,
      isp: 'Telekom Malaysia',
      status: 'active',
      role: 'client',
    },
    {
      country: 'Indonesia',
      code: 'ID',
      city: 'Jakarta',
      lat: -0.7893,
      lng: 113.9213,
      clients: 2,
      sessions: 4,
      trafficBytes: 8589934592,
      upBytes: 1932735283,
      downBytes: 6657199309,
      avgLatencyMs: 42,
      isp: 'Telkomsel',
      status: 'active',
      role: 'client',
    },
    {
      country: 'Germany',
      code: 'DE',
      city: 'Frankfurt',
      lat: 51.1657,
      lng: 10.4515,
      clients: 1,
      sessions: 2,
      trafficBytes: 4669227008,
      upBytes: 966367641,
      downBytes: 3702859367,
      avgLatencyMs: 122,
      isp: 'Hetzner Online GmbH',
      status: 'idle',
      role: 'client',
    },
    {
      country: 'United States',
      code: 'US',
      city: 'Los Angeles',
      lat: 37.0902,
      lng: -95.7129,
      clients: 2,
      sessions: 5,
      trafficBytes: 7086696038,
      upBytes: 1503238553,
      downBytes: 5583457485,
      avgLatencyMs: 178,
      isp: 'Cloudflare WARP LAX',
      status: 'active',
      role: 'client',
    },
    {
      country: 'India',
      code: 'IN',
      city: 'Mumbai',
      lat: 20.5937,
      lng: 78.9629,
      clients: 1,
      sessions: 3,
      trafficBytes: 3972844748,
      upBytes: 858993459,
      downBytes: 3113851289,
      avgLatencyMs: 46,
      isp: 'Reliance Jio',
      status: 'active',
      role: 'client',
    },
  ],
  connections: [
    {
      id: 'conn-1',
      country: 'Sri Lanka',
      countryCode: 'LK',
      city: 'Colombo',
      clientEmail: 'kawditha@x-ray',
      clientIp: '112.134.140.22',
      isp: 'Dialog Axiata PLC',
      inboundTag: 'VLESS-Reality-Direct',
      protocol: 'VLESS',
      port: 443,
      upBytes: 15428900000,
      downBytes: 48320000000,
      totalBytes: 63748900000,
      status: 'ACTIVE',
      latencyMs: 24,
      signalBars: 4,
      lastSeen: Date.now() - 30000,
      connectedDuration: '14h 22m',
      clientConfig:
        'vless://a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d@194.163.150.22:443?security=reality&sni=sg.kawditha.dev&fp=chrome#LK-VIP-VLESS',
    },
    {
      id: 'conn-2',
      country: 'Sri Lanka',
      countryCode: 'LK',
      city: 'Kandy',
      clientEmail: 'nirmal_sl_mobile',
      clientIp: '175.157.88.9',
      isp: 'SLT Telecom Fibre',
      inboundTag: 'VMess-WS-CDN',
      protocol: 'VMess',
      port: 8080,
      upBytes: 3221225472,
      downBytes: 18253611008,
      totalBytes: 21474836480,
      status: 'ACTIVE',
      latencyMs: 28,
      signalBars: 4,
      lastSeen: Date.now() - 75000,
      connectedDuration: '8h 15m',
      clientConfig:
        'vmess://eyJhZGQiOiIxOTQuMTYzLjE1MC4yMiIsImFpZCI6IjAiLCJob3N0IjoiIiwiaWQiOiJiMmMzZDRlNS1mNmExLTRiNWMtOWQwZS0xZjJhM2I0YzVkNmUiLCJuZXQiOiJ3cyIsInBhdGgiOiIvdnciLCJwb3J0IjoiODA4MCIsInBzIjoiTEstU0xULU1PQklMRSIsInNjeSI6ImF1dG8iLCJzbmkiOiIiLCJ0bHMiOiIiLCJ0eXBlIjoibm9uZSIsInYiOiIyIn0=',
    },
    {
      id: 'conn-3',
      country: 'Singapore',
      countryCode: 'SG',
      city: 'Singapore',
      clientEmail: 'singapore_relay',
      clientIp: '128.199.204.15',
      isp: 'DigitalOcean Singapore',
      inboundTag: 'Trojan-gRPC',
      protocol: 'Trojan',
      port: 8443,
      upBytes: 6442450944,
      downBytes: 19327352832,
      totalBytes: 25769803776,
      status: 'ACTIVE',
      latencyMs: 8,
      signalBars: 4,
      lastSeen: Date.now() - 120000,
      connectedDuration: '2d 6h',
      clientConfig:
        'trojan://password123@194.163.150.22:8443?security=tls&type=grpc&serviceName=grpc-tr#SG-Relay',
    },
    {
      id: 'conn-4',
      country: 'Malaysia',
      countryCode: 'MY',
      city: 'Kuala Lumpur',
      clientEmail: 'kl_user_trojan',
      clientIp: '175.139.22.84',
      isp: 'Telekom Malaysia',
      inboundTag: 'Trojan-gRPC',
      protocol: 'Trojan',
      port: 8443,
      upBytes: 2147483648,
      downBytes: 8160437862,
      totalBytes: 10307921510,
      status: 'ACTIVE',
      latencyMs: 34,
      signalBars: 4,
      lastSeen: Date.now() - 180000,
      connectedDuration: '5h 40m',
      clientConfig: 'trojan://user456@194.163.150.22:8443?security=tls#MY-KL-Trojan',
    },
    {
      id: 'conn-5',
      country: 'Indonesia',
      countryCode: 'ID',
      city: 'Jakarta',
      clientEmail: 'jakarta_speed',
      clientIp: '36.88.102.45',
      isp: 'Telkom Indonesia',
      inboundTag: 'VLESS-Reality-Direct',
      protocol: 'VLESS',
      port: 443,
      upBytes: 1932735283,
      downBytes: 6657199309,
      totalBytes: 8589934592,
      status: 'ACTIVE',
      latencyMs: 42,
      signalBars: 3,
      lastSeen: Date.now() - 360000,
      connectedDuration: '3h 10m',
      clientConfig: 'vless://user_id_jkt@194.163.150.22:443?security=reality#ID-Jakarta',
    },
    {
      id: 'conn-6',
      country: 'Germany',
      countryCode: 'DE',
      city: 'Frankfurt',
      clientEmail: 'dev_frankfurt',
      clientIp: '159.69.80.12',
      isp: 'Hetzner Online GmbH',
      inboundTag: 'Shadowsocks-2022',
      protocol: 'Shadowsocks',
      port: 8388,
      upBytes: 966367641,
      downBytes: 3702859367,
      totalBytes: 4669227008,
      status: 'IDLE',
      latencyMs: 122,
      signalBars: 2,
      lastSeen: Date.now() - 2700000,
      connectedDuration: '1d 2h',
      clientConfig: 'ss://2022-blake3-aes-128-gcm:pass@194.163.150.22:8388#DE-Hetzner',
    },
    {
      id: 'conn-7',
      country: 'United States',
      countryCode: 'US',
      city: 'Los Angeles',
      clientEmail: 'alex_california',
      clientIp: '104.28.19.4',
      isp: 'Cloudflare WARP LAX',
      inboundTag: 'VLESS-Reality-Direct',
      protocol: 'VLESS',
      port: 443,
      upBytes: 1503238553,
      downBytes: 5583457485,
      totalBytes: 7086696038,
      status: 'ACTIVE',
      latencyMs: 178,
      signalBars: 2,
      lastSeen: Date.now() - 420000,
      connectedDuration: '11h 05m',
      clientConfig: 'vless://alex_us@194.163.150.22:443?security=reality#US-LA',
    },
    {
      id: 'conn-8',
      country: 'India',
      countryCode: 'IN',
      city: 'Mumbai',
      clientEmail: 'mumbai_stream',
      clientIp: '49.36.120.10',
      isp: 'Reliance Jio Infocomm',
      inboundTag: 'VMess-WS-CDN',
      protocol: 'VMess',
      port: 8080,
      upBytes: 858993459,
      downBytes: 3113851289,
      totalBytes: 3972844748,
      status: 'ACTIVE',
      latencyMs: 46,
      signalBars: 3,
      lastSeen: Date.now() - 540000,
      connectedDuration: '6h 50m',
      clientConfig: 'vmess://mumbai_stream@194.163.150.22:8080#IN-Mumbai',
    },
  ],
};

export default function StatsPage() {
  const { isDark, isUltra, antdThemeConfig } = useTheme();

  const [statsData, setStatsData] = useState<GeoStatsResponse>(DEFAULT_STATS_DATA);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>(undefined);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [selectedClientModal, setSelectedClientModal] = useState<ClientConnection | null>(null);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await HttpUtil.get<GeoStatsResponse>('/panel/api/server/geoStats');
      if (res && res.success && res.obj) {
        setStatsData(res.obj);
      }
    } catch {
      // Keep existing data gracefully
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(true);
    const timer = setInterval(() => {
      fetchStats(true);
    }, 6000);
    return () => clearInterval(timer);
  }, [fetchStats]);

  const pageClass = `stats-page ${isDark ? 'dark' : 'light'} ${isUltra ? 'ultra' : ''}`;

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className={pageClass}>
        <AppSidebar />

        <Layout className="content-shell">
          <Layout.Content className="content-area">
            <div className="stats-main-flow">
              {/* Top Action & Controls Bar */}
              <div className="stats-header-bar">
                <div className="header-title-block">
                  <div className="header-title-row">
                    <h1 className="stats-main-title">Stats Overview</h1>
                    <span className="live-status-pill">
                      <span className="pulse-dot" />
                      Live Stream
                    </span>
                  </div>
                  <p className="stats-subtitle">
                    Real-time client connections, geographic request origins & network telemetry
                  </p>
                </div>

                <div className="header-actions-row">
                  {/* Time Range Pills */}
                  <div className="time-range-pills">
                    {(['1h', '24h', '7d', '30d'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`range-pill ${timeRange === r ? 'active' : ''}`}
                        onClick={() => setTimeRange(r)}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Refresh Button */}
                  <Button
                    type="default"
                    icon={<SyncOutlined spin={loading} />}
                    onClick={() => {
                      fetchStats(false);
                      message.success('Stats refreshed!');
                    }}
                    className="btn-refresh"
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Top Row: Statistic Overview (Left) + Geo World Map (Right) */}
              <div className="stats-top-grid">
                <div className="grid-col-overview">
                  <StatisticOverviewCards kpis={statsData.kpis} />
                </div>
                <div className="grid-col-map">
                  <GeoWorldMap
                    nodes={statsData.geoNodes}
                    selectedCountry={selectedCountry}
                    onSelectCountry={setSelectedCountry}
                  />
                </div>
              </div>

              {/* Middle Row: Server Request Spline Chart (Left) + Client Load Bar Chart (Right) */}
              <div className="stats-charts-grid">
                <div className="grid-col-request-chart">
                  <ServerRequestChart data={statsData.serverRequests} />
                </div>
                <div className="grid-col-load-chart">
                  <ClientLoadChart data={statsData.clientLoadLatency} />
                </div>
              </div>

              {/* Bottom Row: Active Server & Client Locations Table */}
              <div className="stats-table-section">
                <ActiveClientsGeoTable
                  connections={statsData.connections}
                  selectedCountry={selectedCountry}
                  onSelectCountry={setSelectedCountry}
                  onViewClient={setSelectedClientModal}
                />
              </div>

              {/* Client Detail Modal */}
              <ClientDetailModal
                connection={selectedClientModal}
                open={Boolean(selectedClientModal)}
                onClose={() => setSelectedClientModal(null)}
              />
            </div>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
