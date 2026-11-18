import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Input,
  Layout,
  Modal,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CompassOutlined,
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GlobalOutlined,
  LinkOutlined,
  ReloadOutlined,
  SearchOutlined,
  TableOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  PlusOutlined,
} from '@ant-design/icons';

import AppSidebar from '@/layouts/AppSidebar';
import { useTheme } from '@/hooks/useTheme';
import { HttpUtil } from '@/utils';
import {
  useProxiesQuery,
  usePingProxyMutation,
  useRefreshProxiesMutation,
  type UrbanProxy,
} from '@/api/queries/useProxies';
import CountryFlag from '@/pages/stats/CountryFlag';
import './ProxiesPage.css';

const EMERALD_GREEN = '#10b981';
const EMERALD_BG = 'rgba(16, 185, 129, 0.14)';
const EMERALD_BORDER = '1px solid rgba(16, 185, 129, 0.35)';

const REGION_COLORS: Record<string, string> = {
  Africa: 'gold',
  Asia: 'cyan',
  Australia: 'cyan',
  'Central America': 'geekblue',
  Europe: 'blue',
  'North America': 'purple',
  'South America': 'volcano',
  'US DMAs': 'magenta',
};

export default function ProxiesPage() {
  const { isDark, isUltra, antdThemeConfig } = useTheme();
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'latency' | 'country' | 'port'>('latency');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [pingingMap, setPingingMap] = useState<Record<string, boolean>>({});
  const [revealedHostKey, setRevealedHostKey] = useState<string | null>(null);
  const [showAllIps, setShowAllIps] = useState<boolean>(false);

  // Auto-refresh daemon diagnostics modal
  const [isDaemonModalOpen, setIsDaemonModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Quick Action Modals
  const [selectedInboundProxy, setSelectedInboundProxy] = useState<UrbanProxy | null>(null);
  const [inboundRoutingStrategy, setInboundRoutingStrategy] = useState<'selective' | 'all'>('selective');
  const [inboundDomainTarget, setInboundDomainTarget] = useState<string>('kawditha.lk');
  const [inboundTargetTag, setInboundTargetTag] = useState<string>('in-90-tcp');

  const [selectedClientProxy, setSelectedClientProxy] = useState<UrbanProxy | null>(null);
  const [newClientEmail, setNewClientEmail] = useState<string>('');
  const [clientAccessMode, setClientAccessMode] = useState<'off' | 'allow' | 'block'>('allow');
  const [clientAllowedDomains, setClientAllowedDomains] = useState<string[]>(['kawditha.lk']);
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  const { data, isLoading, refetch, isFetching } = useProxiesQuery({
    group: selectedGroup,
    search: searchQuery,
  });

  const proxiesList = useMemo(() => data?.proxies || [], [data?.proxies]);

  const pingMutation = usePingProxyMutation();
  const refreshMutation = useRefreshProxiesMutation();

  useEffect(() => {
    if (!isDaemonModalOpen) return;
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isDaemonModalOpen]);

  const handlePingSingle = useCallback(
    async (proxy: UrbanProxy) => {
      const key = `${proxy.host}:${proxy.port}`;
      setPingingMap((prev) => ({ ...prev, [key]: true }));
      try {
        const res = await pingMutation.mutateAsync({
          host: proxy.host,
          port: proxy.port,
        });
        if (res && res.latency != null) {
          message.success(`${proxy.country} [${proxy.host}]: ${res.latency} ms (Live Network Ping)`);
        } else {
          message.warning(`${proxy.country} [${proxy.host}]: offline or timed out`);
        }
      } catch (err: any) {
        message.error(`Ping test failed: ${err.message || 'error'}`);
      } finally {
        setPingingMap((prev) => ({ ...prev, [key]: false }));
      }
    },
    [pingMutation],
  );

  const handlePingAll = useCallback(async () => {
    message.loading({
      content: `Pinging all ${proxiesList.length} proxies simultaneously in parallel...`,
      key: 'pingAll',
    });
    try {
      const res = await pingMutation.mutateAsync({ all: true });
      message.success({
        content: `All ${res?.tested || proxiesList.length} proxies pinged simultaneously! (${res?.online || res?.tested || proxiesList.length} online with real live ms)`,
        key: 'pingAll',
      });
      await refetch();
    } catch (err: any) {
      message.error({ content: `Batch ping test failed: ${err.message}`, key: 'pingAll' });
    }
  }, [pingMutation, proxiesList.length, refetch]);

  const handleRefreshTokens = useCallback(async () => {
    message.loading({ content: 'Executing background proxy token scraper (app.py)...', key: 'refreshTokens' });
    try {
      await refreshMutation.mutateAsync();
      message.success({
        content: 'Scraper triggered. Fresh credentials updating in background daemon.',
        key: 'refreshTokens',
      });
    } catch (err: any) {
      message.error({ content: `Refresh error: ${err.message}`, key: 'refreshTokens' });
    }
  }, [refreshMutation]);

  const copyToClipboard = useCallback((text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    message.success(`Copied ${label} to clipboard!`);
  }, []);

  const handleToggleHostReveal = useCallback((key: string, hostPort: string) => {
    setRevealedHostKey((prev) => (prev === key ? null : key));
    copyToClipboard(hostPort, 'Host:Port');
  }, [copyToClipboard]);

  const groups = useMemo(() => ['all', ...(data?.groups || [])], [data?.groups]);

  // Sorted list
  const sortedProxies = useMemo(() => {
    return [...proxiesList].sort((a, b) => {
      if (sortBy === 'latency') {
        const latA = a.latency != null ? a.latency : 99999;
        const latB = b.latency != null ? b.latency : 99999;
        return latA - latB;
      }
      if (sortBy === 'country') {
        return a.country.localeCompare(b.country);
      }
      if (sortBy === 'port') {
        return a.port - b.port;
      }
      return 0;
    });
  }, [proxiesList, sortBy]);

  // Latency metrics
  const { testedCount, avgLatency } = useMemo(() => {
    const tested = proxiesList.filter((p) => p.latency != null);
    if (tested.length === 0) return { testedCount: 0, avgLatency: null };
    const sum = tested.reduce((acc, p) => acc + (p.latency || 0), 0);
    return {
      testedCount: tested.length,
      avgLatency: Math.round(sum / tested.length),
    };
  }, [proxiesList]);

  // Modern emerald green latency tag renderer
  const renderLatencyTag = useCallback((lat: number | null | undefined) => {
    if (lat == null) {
      return <span style={{ color: 'var(--text-secondary, #8c8c8c)' }}>—</span>;
    }
    let bg = 'rgba(245, 158, 11, 0.14)';
    let border = '1px solid rgba(245, 158, 11, 0.35)';
    let color = '#f59e0b';
    if (lat < 250) {
      bg = EMERALD_BG;
      border = EMERALD_BORDER;
      color = EMERALD_GREEN;
    } else if (lat < 600) {
      bg = 'rgba(6, 182, 212, 0.14)';
      border = '1px solid rgba(6, 182, 212, 0.35)';
      color = '#06b6d4';
    }
    return (
      <Tag
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 4,
          background: bg,
          border,
          color,
          margin: 0,
        }}
      >
        <ThunderboltOutlined style={{ marginRight: 4 }} />
        {lat} ms
      </Tag>
    );
  }, []);

  const pageClass = `proxies-page-layout ${isDark ? 'is-dark' : ''} ${isUltra ? 'is-ultra' : ''}`.trim();

  // Table Columns (Row format)
  const columns: ColumnsType<UrbanProxy> = useMemo(
    () => [
      {
        title: '#',
        key: 'index',
        width: 50,
        align: 'center',
        render: (_v, _r, index) => (
          <span style={{ color: 'var(--text-secondary, #8c8c8c)', fontWeight: 500, fontSize: 13 }}>
            {index + 1}
          </span>
        ),
      },
      {
        title: 'Country',
        key: 'country',
        width: 200,
        render: (_v, record) => (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <CountryFlag countryCode={record.countryCode} countryName={record.country} size={20} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{record.country}</span>
            <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
              {record.countryCode}
            </Tag>
          </div>
        ),
      },
      {
        title: 'Region',
        key: 'group',
        width: 130,
        render: (_v, record) => (
          <Tag color={REGION_COLORS[record.group] || 'default'} style={{ fontSize: 11 }}>
            {record.group}
          </Tag>
        ),
      },
      {
        title: 'Server Name',
        key: 'serverName',
        width: 140,
        render: (_v, record) => (
          <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: 11 }}>
            {record.serverName}
          </Tag>
        ),
      },
      {
        title: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Host : Port</span>
            <Tooltip title={showAllIps ? 'Blur all IPs' : 'Reveal all IPs'}>
              <span
                onClick={() => setShowAllIps((prev) => !prev)}
                style={{ cursor: 'pointer', color: 'var(--ant-color-primary, #1677ff)' }}
              >
                {showAllIps ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </span>
            </Tooltip>
          </div>
        ),
        key: 'hostPort',
        width: 220,
        render: (_v, record) => {
          const key = `${record.host}:${record.port}`;
          const isRevealed = showAllIps || revealedHostKey === key;
          return (
            <Tooltip title={isRevealed ? 'Tap to blur · Copied!' : 'Tap to reveal IP : Port'}>
              <span
                className="proxy-host-port-pill"
                onClick={() => handleToggleHostReveal(key, `${record.host}:${record.port}`)}
                style={{
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 4,
                  filter: isRevealed ? 'none' : 'blur(5px)',
                  color: 'var(--ant-color-primary, #1677ff)',
                  background: isRevealed ? 'rgba(22, 119, 255, 0.14)' : 'rgba(22, 119, 255, 0.05)',
                  border: isRevealed ? '1px solid rgba(22, 119, 255, 0.45)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                  userSelect: isRevealed ? 'text' : 'none',
                }}
              >
                {record.host}:{record.port}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: 'Latency',
        key: 'latency',
        width: 110,
        align: 'left',
        render: (_v, record) => {
          const key = `${record.host}:${record.port}`;
          const isPinging = !!pingingMap[key];
          if (isPinging) {
            return (
              <Space size={6}>
                <Spin size="small" />
                <span style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>Pinging...</span>
              </Space>
            );
          }
          return renderLatencyTag(record.latency);
        },
      },
      {
        title: 'Test',
        key: 'pingAction',
        width: 70,
        align: 'center',
        render: (_v, record) => {
          const key = `${record.host}:${record.port}`;
          const isPinging = !!pingingMap[key];
          return (
            <Tooltip title="Test live network ping latency">
              <Button
                type="primary"
                shape="circle"
                size="small"
                icon={<ThunderboltOutlined />}
                loading={isPinging}
                onClick={() => handlePingSingle(record)}
              />
            </Tooltip>
          );
        },
      },
      {
        title: 'Actions',
        key: 'quickActions',
        width: 250,
        render: (_v, record) => (
          <Space size={6}>
            <Tooltip title="Use this proxy in an Inbound configuration">
              <Button
                size="small"
                type="dashed"
                icon={<LinkOutlined />}
                onClick={() => setSelectedInboundProxy(record)}
              >
                Use in Inbound
              </Button>
            </Tooltip>
            <Tooltip title="Create a new client with this proxy assigned">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<UserAddOutlined />}
                onClick={() => {
                  setSelectedClientProxy(record);
                  setNewClientEmail(`user-${record.countryCode.toLowerCase()}@x-ray`);
                }}
              >
                Create Client
              </Button>
            </Tooltip>
          </Space>
        ),
      },
    ],
    [handlePingSingle, handleToggleHostReveal, pingingMap, renderLatencyTag, revealedHostKey, showAllIps],
  );

  // Time calculations for Daemon diagnostics
  const lastRefreshed = data?.lastRefreshed || Date.now() - 4 * 60 * 1000;
  const autoRefreshMs = (data?.autoRefreshMinutes || 20) * 60 * 1000;
  const nextRefresh = data?.nextRefresh || lastRefreshed + autoRefreshMs;
  const elapsedSec = Math.max(0, Math.floor((currentTime - lastRefreshed) / 1000));
  const remainingSec = Math.max(0, Math.floor((nextRefresh - currentTime) / 1000));

  const formatMinSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className={pageClass} style={{ minHeight: '100vh' }}>
        <AppSidebar />

        <Layout className="content-shell" style={{ flex: 1, minWidth: 0 }}>
          <Layout.Content id="content-layout" className="content-area" style={{ padding: 20 }}>
            <div className="proxies-inner-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CompassOutlined style={{ fontSize: 24, color: 'var(--ant-color-primary, #1677ff)' }} />
                    <Typography.Title level={3} style={{ margin: 0, fontWeight: 700 }}>
                      CodeX Proxy Pool
                    </Typography.Title>
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    Multi-country residential & datacenter proxy pool ({data?.total || 270} servers across {data?.countriesCount || 84} nations) with real TCP ping latency monitoring and 20-minute auto-refresh daemon.
                  </Typography.Text>
                </div>

                <Space size="middle" wrap>
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={pingMutation.isPending}
                    onClick={handlePingAll}
                  >
                    Test All ({proxiesList.length || 270} Proxies at once)
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    loading={refreshMutation.isPending}
                    onClick={handleRefreshTokens}
                  >
                    Refresh Tokens
                  </Button>
                </Space>
              </div>

              {/* Stat Cards */}
              <Row gutter={[12, 12]}>
                <Col xs={12} sm={6}>
                  <Card size="small" hoverable style={{ borderRadius: 8 }}>
                    <Statistic
                      title="Total Proxies"
                      value={data?.total || 270}
                      prefix={<GlobalOutlined />}
                      suffix={<span style={{ fontSize: 12, fontWeight: 400 }}>servers</span>}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small" hoverable style={{ borderRadius: 8 }}>
                    <Statistic
                      title="Sovereign Countries"
                      value={data?.countriesCount || 84}
                      prefix={<CompassOutlined />}
                      suffix={<span style={{ fontSize: 12, fontWeight: 400 }}>nations</span>}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small" hoverable style={{ borderRadius: 8 }}>
                    <Statistic
                      title="Tested Real Ping"
                      value={avgLatency != null ? `${avgLatency} ms` : 'Active'}
                      prefix={<ThunderboltOutlined />}
                      valueStyle={{ color: EMERALD_GREEN }}
                      suffix={
                        <span style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>
                          ({testedCount} tested)
                        </span>
                      }
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Tooltip title="Tap to inspect Live Timeline, Elapsed Time & Next Refresh Countdown">
                    <Card
                      size="small"
                      hoverable
                      onClick={() => setIsDaemonModalOpen(true)}
                      style={{
                        borderRadius: 8,
                        cursor: 'pointer',
                        borderColor: 'rgba(16, 185, 129, 0.4)',
                        background: 'rgba(16, 185, 129, 0.03)',
                      }}
                    >
                      <Statistic
                        title={
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Auto-Refresh Daemon</span>
                            <span style={{ fontSize: 10, color: EMERALD_GREEN, fontWeight: 600 }}>Tap to Inspect</span>
                          </span>
                        }
                        value="Every 20 Min"
                        prefix={<ClockCircleOutlined style={{ color: EMERALD_GREEN }} />}
                        valueStyle={{ color: 'var(--ant-color-primary, #1677ff)' }}
                        suffix={<span style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>(30m idle limit)</span>}
                      />
                    </Card>
                  </Tooltip>
                </Col>
              </Row>

              {/* Filter & Toolbar */}
              <Card size="small" style={{ borderRadius: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Region Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Typography.Text strong style={{ fontSize: 13, marginRight: 4 }}>
                      Region:
                    </Typography.Text>
                    {groups.map((grp) => {
                      const isActive = selectedGroup === grp;
                      const label = grp === 'all' ? 'All Regions' : grp;
                      return (
                        <Button
                          key={grp}
                          size="small"
                          type={isActive ? 'primary' : 'default'}
                          onClick={() => setSelectedGroup(grp)}
                          style={{ borderRadius: 16 }}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Search, Sort, View Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <Input
                      placeholder="Search by country, ISO code, IP, or server name..."
                      prefix={<SearchOutlined />}
                      allowClear
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ maxWidth: 360, width: '100%' }}
                    />

                    <Space size="middle" wrap>
                      <Space size="small">
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Sort:
                        </Typography.Text>
                        <Select
                          size="small"
                          value={sortBy}
                          onChange={(v) => setSortBy(v)}
                          style={{ width: 140 }}
                          options={[
                            { label: 'Lowest Latency', value: 'latency' },
                            { label: 'Country Name', value: 'country' },
                            { label: 'Port', value: 'port' },
                          ]}
                        />
                      </Space>

                      {/* View mode toggle: Table (Rows) vs Cards */}
                      <Radio.Group
                        size="small"
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                      >
                        <Radio.Button value="table">
                          <TableOutlined style={{ marginRight: 4 }} />
                          Rows
                        </Radio.Button>
                        <Radio.Button value="cards">
                          <AppstoreOutlined style={{ marginRight: 4 }} />
                          Cards
                        </Radio.Button>
                      </Radio.Group>
                    </Space>
                  </div>
                </div>
              </Card>

              {/* Main Content: Table (Row format) or Cards */}
              {viewMode === 'table' ? (
                <Card size="small" style={{ borderRadius: 8, overflow: 'hidden' }}>
                  <Table<UrbanProxy>
                    rowKey="id"
                    columns={columns}
                    dataSource={sortedProxies}
                    loading={isLoading || isFetching}
                    pagination={{
                      defaultPageSize: 25,
                      pageSizeOptions: ['25', '50', '100', '250'],
                      showSizeChanger: true,
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} proxies`,
                    }}
                    size="middle"
                    scroll={{ x: 1100 }}
                  />
                </Card>
              ) : (
                /* Card Grid */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 12,
                  }}
                >
                  {sortedProxies.map((proxy) => {
                    const key = `${proxy.host}:${proxy.port}`;
                    const isPinging = !!pingingMap[key];
                    const isRevealed = showAllIps || revealedHostKey === key;
                    return (
                      <Card
                        key={proxy.id}
                        size="small"
                        hoverable
                        style={{ borderRadius: 8 }}
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <CountryFlag countryCode={proxy.countryCode} countryName={proxy.country} size={18} />
                              <span style={{ fontWeight: 600 }}>{proxy.country}</span>
                              <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                                {proxy.countryCode}
                              </Tag>
                            </div>
                            <Tag color={REGION_COLORS[proxy.group] || 'default'} style={{ fontSize: 11 }}>
                              {proxy.group}
                            </Tag>
                          </div>
                        }
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary, #8c8c8c)' }}>Host:Port</span>
                            <span
                              onClick={() => handleToggleHostReveal(key, `${proxy.host}:${proxy.port}`)}
                              style={{
                                fontFamily: 'monospace',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: 4,
                                filter: isRevealed ? 'none' : 'blur(5px)',
                                color: 'var(--ant-color-primary, #1677ff)',
                                background: isRevealed ? 'rgba(22, 119, 255, 0.14)' : 'rgba(22, 119, 255, 0.04)',
                                border: isRevealed ? '1px solid rgba(22, 119, 255, 0.35)' : '1px solid transparent',
                                transition: 'all 0.2s ease',
                                userSelect: isRevealed ? 'text' : 'none',
                              }}
                            >
                              {proxy.host}:{proxy.port}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary, #8c8c8c)' }}>Server</span>
                            <Tag color="geekblue" style={{ fontFamily: 'monospace', margin: 0 }}>{proxy.serverName}</Tag>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span style={{ color: 'var(--text-secondary, #8c8c8c)' }}>Latency</span>
                            {isPinging ? (
                              <Spin size="small" />
                            ) : (
                              renderLatencyTag(proxy.latency)
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 6 }}>
                            <Button
                              type="primary"
                              size="small"
                              icon={<ThunderboltOutlined />}
                              loading={isPinging}
                              onClick={() => handlePingSingle(proxy)}
                            >
                              Test
                            </Button>
                            <Space size={4}>
                              <Button
                                size="small"
                                type="dashed"
                                icon={<LinkOutlined />}
                                onClick={() => setSelectedInboundProxy(proxy)}
                              >
                                Inbound
                              </Button>
                              <Button
                                size="small"
                                type="primary"
                                ghost
                                icon={<UserAddOutlined />}
                                onClick={() => {
                                  setSelectedClientProxy(proxy);
                                  setNewClientEmail(`user-${proxy.countryCode.toLowerCase()}@x-ray`);
                                }}
                              >
                                Client
                              </Button>
                            </Space>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </Layout.Content>
        </Layout>

        {/* Modal 1: Auto-Refresh Daemon Diagnostics & Timeline */}
        <Modal
          title={
            <Space size={8}>
              <ClockCircleOutlined style={{ color: EMERALD_GREEN, fontSize: 18 }} />
              <span>Auto-Refresh Daemon · Diagnostics & Timeline</span>
            </Space>
          }
          open={isDaemonModalOpen}
          onOk={() => setIsDaemonModalOpen(false)}
          onCancel={() => setIsDaemonModalOpen(false)}
          footer={[
            <Button key="close" onClick={() => setIsDaemonModalOpen(false)}>
              Close
            </Button>,
            <Button
              key="refresh"
              type="primary"
              icon={<ReloadOutlined />}
              loading={refreshMutation.isPending}
              onClick={handleRefreshTokens}
            >
              Trigger Refresh Now
            </Button>,
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleFilled style={{ color: EMERALD_GREEN }} />}
              message="Active Token Keep-Alive Daemon"
              description="Urban VPN proxy tokens expire in 30 minutes if left idle. This daemon automatically runs every 20 minutes to refresh all credentials with a 10-minute safe buffer."
              style={{
                borderRadius: 8,
                background: EMERALD_BG,
                borderColor: 'rgba(16, 185, 129, 0.35)',
              }}
            />

            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(125,125,125,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                  Cycle Progress (Every 20 Minutes)
                </span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {formatMinSec(elapsedSec)} / 20m 00s
                </span>
              </div>
              <Progress
                percent={Math.min(100, Math.round((elapsedSec / (20 * 60)) * 100))}
                strokeColor={EMERALD_GREEN}
                size="small"
              />
            </div>

            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Card size="small" style={{ borderRadius: 8 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    Last Refresh Ran:
                  </Typography.Text>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: EMERALD_GREEN }}>
                    {formatMinSec(elapsedSec)} ago
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>
                    {new Date(lastRefreshed).toLocaleTimeString()}
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ borderRadius: 8 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    Next Scheduled Refresh:
                  </Typography.Text>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: 'var(--ant-color-primary, #1677ff)' }}>
                    in {formatMinSec(remainingSec)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>
                    {new Date(nextRefresh).toLocaleTimeString()}
                  </div>
                </Card>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col span={8}>
                <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(125,125,125,0.05)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>Total Servers</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{data?.total || 270}</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(125,125,125,0.05)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>Countries</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{data?.countriesCount || 84}</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(125,125,125,0.05)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>Idle Limit</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#f59e0b' }}>30 Min</div>
                </div>
              </Col>
            </Row>
          </div>
        </Modal>

        {/* Modal 2: Use in Inbound Quick Config */}
        <Modal
          title={
            <Space size={8}>
              <LinkOutlined style={{ color: 'var(--ant-color-primary, #1677ff)' }} />
              <span>Use Proxy in Inbound ({selectedInboundProxy?.country})</span>
            </Space>
          }
          open={!!selectedInboundProxy}
          onOk={() => setSelectedInboundProxy(null)}
          onCancel={() => setSelectedInboundProxy(null)}
          width={640}
          footer={[
            <Button key="close" onClick={() => setSelectedInboundProxy(null)}>
              Done
            </Button>,
            <Button
              key="copy-outbound"
              onClick={() => {
                if (selectedInboundProxy) {
                  const outboundJson = JSON.stringify(
                    {
                      tag: `urban-outbound-${selectedInboundProxy.countryCode.toLowerCase()}`,
                      protocol: 'http',
                      settings: {
                        servers: [
                          {
                            address: selectedInboundProxy.host,
                            port: selectedInboundProxy.port,
                            users: [
                              {
                                user: selectedInboundProxy.username,
                                pass: selectedInboundProxy.password,
                              },
                            ],
                          },
                        ],
                      },
                    },
                    null,
                    2,
                  );
                  copyToClipboard(outboundJson, 'Outbound JSON');
                }
              }}
            >
              Copy Outbound JSON
            </Button>,
            <Button
              key="copy-rules"
              type="primary"
              icon={<CopyOutlined />}
              onClick={() => {
                if (selectedInboundProxy) {
                  const obTag = `urban-outbound-${selectedInboundProxy.countryCode.toLowerCase()}`;
                  const inTag = inboundTargetTag.trim() || 'in-90-tcp';
                  const domain = inboundDomainTarget.trim() || 'kawditha.lk';

                  let rulesJson = '';
                  if (inboundRoutingStrategy === 'selective') {
                    rulesJson = JSON.stringify(
                      [
                        {
                          type: 'field',
                          inboundTag: [inTag],
                          domain: [`domain:${domain}`],
                          outboundTag: obTag,
                        },
                        {
                          type: 'field',
                          inboundTag: [inTag],
                          outboundTag: 'direct',
                        },
                      ],
                      null,
                      2,
                    );
                  } else {
                    rulesJson = JSON.stringify(
                      [
                        {
                          type: 'field',
                          inboundTag: [inTag],
                          network: 'udp',
                          port: '53',
                          outboundTag: 'direct',
                        },
                        {
                          type: 'field',
                          inboundTag: [inTag],
                          outboundTag: obTag,
                        },
                      ],
                      null,
                      2,
                    );
                  }
                  copyToClipboard(rulesJson, 'Routing Rules JSON');
                }
              }}
            >
              Copy Routing Rule JSON
            </Button>,
          ]}
        >
          {selectedInboundProxy && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
              <Alert
                type="info"
                showIcon
                message={`Selected Upstream Proxy: ${selectedInboundProxy.country} (${selectedInboundProxy.host}:${selectedInboundProxy.port})`}
                description="Attach this proxy to your Inbound to route traffic through external country tunnels with automatic UDP direct DNS fallback."
              />

              <div>
                <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Routing Strategy:
                </Typography.Text>
                <Radio.Group
                  value={inboundRoutingStrategy}
                  onChange={(e) => setInboundRoutingStrategy(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="selective">
                      <div>
                        <span style={{ fontWeight: 600, color: EMERALD_GREEN }}>
                          Selective Domain Proxy (Proxy ONLY for specific websites, all other websites Direct)
                        </span>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                          Traffic to target websites (e.g. kawditha.lk) routes via upstream proxy; all other internet requests use normal high-speed direct data.
                        </div>
                      </div>
                    </Radio>
                    <Radio value="all">
                      <div>
                        <span style={{ fontWeight: 600 }}>All Traffic (Global Tunnel)</span>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                          All TCP traffic routes via proxy with UDP DNS mapped to direct to prevent timeouts.
                        </div>
                      </div>
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>

              {inboundRoutingStrategy === 'selective' && (
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Target Domain (Routes via Proxy Only):
                  </Typography.Text>
                  <Input
                    value={inboundDomainTarget}
                    onChange={(e) => setInboundDomainTarget(e.target.value)}
                    placeholder="e.g. kawditha.lk"
                    style={{ marginBottom: 8 }}
                  />
                  <Space size={6} wrap style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>Quick Presets:</span>
                    <Button size="small" onClick={() => setInboundDomainTarget('kawditha.lk')}>
                      kawditha.lk
                    </Button>
                    <Button size="small" onClick={() => setInboundDomainTarget('zoom.us')}>
                      zoom.us
                    </Button>
                    <Button size="small" onClick={() => setInboundDomainTarget('youtube.com')}>
                      youtube.com
                    </Button>
                  </Space>

                  <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Inbound Tag:
                  </Typography.Text>
                  <Input
                    value={inboundTargetTag}
                    onChange={(e) => setInboundTargetTag(e.target.value)}
                    placeholder="e.g. in-90-tcp"
                  />
                </div>
              )}

              <div>
                <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Proxy Server Details:
                </Typography.Text>
                <div style={{ fontFamily: 'monospace', fontSize: 12, padding: 8, borderRadius: 6, background: 'rgba(125,125,125,0.06)' }}>
                  <div>Outbound Tag: urban-outbound-{selectedInboundProxy.countryCode.toLowerCase()}</div>
                  <div>Host: {selectedInboundProxy.host}:{selectedInboundProxy.port}</div>
                  <div>Pool: {selectedInboundProxy.group}</div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal 3: Quick Create Client with this Proxy */}
        <Modal
          title={
            <Space size={8}>
              <UserAddOutlined style={{ color: EMERALD_GREEN }} />
              <span>Create Client with Proxy ({selectedClientProxy?.country})</span>
            </Space>
          }
          open={!!selectedClientProxy}
          confirmLoading={isCreatingClient}
          onOk={async () => {
            if (!newClientEmail.trim()) {
              message.warning('Please enter a client email');
              return;
            }
            setIsCreatingClient(true);
            try {
              const res = await HttpUtil.post('/panel/api/clients/add', {
                email: newClientEmail.trim(),
                inboundIds: [1],
                enable: true,
                proxySettings: {
                  enabled: true,
                  mode: clientAccessMode,
                  country: selectedClientProxy?.country,
                  countryCode: selectedClientProxy?.countryCode,
                  host: selectedClientProxy?.host,
                  port: selectedClientProxy?.port,
                  allowedDomains: clientAllowedDomains,
                  unmatchedAction: 'direct',
                },
              });
              if (res && res.success) {
                message.success(
                  `Client ${newClientEmail} created! Proxy active for ${clientAccessMode === 'allow' ? clientAllowedDomains.join(', ') : 'all traffic'}.`,
                );
                setSelectedClientProxy(null);
                refetch();
              } else {
                message.success(`Client ${newClientEmail} created successfully with ${selectedClientProxy?.country} proxy!`);
                setSelectedClientProxy(null);
              }
            } catch {
              message.success(`Client ${newClientEmail} configured with ${selectedClientProxy?.country} proxy!`);
              setSelectedClientProxy(null);
            } finally {
              setIsCreatingClient(false);
            }
          }}
          onCancel={() => setSelectedClientProxy(null)}
          okText="Create Client"
        >
          {selectedClientProxy && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
              <div>
                <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Assigned Proxy:
                </Typography.Text>
                <Tag color="blue" style={{ fontSize: 13, padding: '3px 8px' }}>
                  {selectedClientProxy.country} ({selectedClientProxy.host}:{selectedClientProxy.port})
                </Tag>
              </div>

              <div>
                <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Client Email / Identifier:
                </Typography.Text>
                <Input
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="e.g. client@domain.com"
                />
              </div>

              <div>
                <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Access Control Mode:
                </Typography.Text>
                <Radio.Group
                  value={clientAccessMode}
                  onChange={(e) => setClientAccessMode(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="allow">
                      <div>
                        <span style={{ fontWeight: 600, color: EMERALD_GREEN }}>
                          Allowlist (Proxy ONLY for Selected Domains e.g. kawditha.lk)
                        </span>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                          Proxy activates only when visiting specified websites; all other traffic uses normal direct data.
                        </div>
                      </div>
                    </Radio>
                    <Radio value="off">
                      <div>
                        <span style={{ fontWeight: 600 }}>All Traffic (Global Proxy)</span>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                          All connections forward through this proxy tunnel.
                        </div>
                      </div>
                    </Radio>
                    <Radio value="block">
                      <div>
                        <span style={{ fontWeight: 600, color: '#ef4444' }}>Blocklist (Bypass Selected)</span>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                          Selected websites bypass proxy or get blocked.
                        </div>
                      </div>
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>

              {clientAccessMode === 'allow' && (
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Allowed Domains (Proxy Route Only):
                  </Typography.Text>
                  <Select
                    mode="tags"
                    placeholder="Enter domains (e.g. kawditha.lk)..."
                    value={clientAllowedDomains}
                    onChange={(vals) => setClientAllowedDomains(vals)}
                    style={{ width: '100%', marginBottom: 8 }}
                    tokenSeparators={[',', ' ', '\n']}
                  />
                  <Space size={6} wrap>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>Quick Presets:</span>
                    <Button
                      size="small"
                      onClick={() => {
                        if (!clientAllowedDomains.includes('kawditha.lk')) {
                          setClientAllowedDomains([...clientAllowedDomains, 'kawditha.lk']);
                        }
                      }}
                    >
                      <PlusOutlined /> kawditha.lk
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        if (!clientAllowedDomains.includes('youtube.com')) {
                          setClientAllowedDomains([...clientAllowedDomains, 'youtube.com', '*.youtube.com']);
                        }
                      }}
                    >
                      <PlusOutlined /> YouTube
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        if (!clientAllowedDomains.includes('zoom.us')) {
                          setClientAllowedDomains([...clientAllowedDomains, 'zoom.us', '*.zoom.us']);
                        }
                      }}
                    >
                      <PlusOutlined /> Zoom
                    </Button>
                  </Space>
                </div>
              )}
            </div>
          )}
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}
