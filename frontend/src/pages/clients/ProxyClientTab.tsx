import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  CompassOutlined,
  FilterOutlined,
  GlobalOutlined,
  MobileOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import CountryFlag from '@/pages/stats/CountryFlag';
import { useProxyCountriesQuery } from '@/api/queries/useProxies';
import {
  DOMAIN_PRESETS,
  APP_PACKAGE_PRESETS,
  BLOCK_PRESETS,
} from '@/pages/inbounds/form/AccessTab';

const POPULAR_COUNTRIES = ['United States', 'Germany', 'Singapore', 'Japan', 'United Kingdom'];
const ASIA_HUBS = ['Singapore', 'Japan', 'India', 'Malaysia', 'Indonesia'];
const EU_HUBS = ['Germany', 'United Kingdom', 'France', 'Netherlands'];

export default function ProxyClientTab() {
  const { control, watch, setValue } = useFormContext();
  const proxyEnabled = watch('proxyEnabled');
  const proxyMode = watch('proxyMode') || 'country';
  const proxyCountries = watch('proxyCountries') || [];
  const proxyAccessMode = watch('proxyAccessMode') || 'off';
  const proxyAllowedDomains = watch('proxyAllowedDomains') || [];
  const proxyAllowedPackages = watch('proxyAllowedPackages') || [];
  const proxyBlockedDomains = watch('proxyBlockedDomains') || [];

  const { data: countries = [], isLoading } = useProxyCountriesQuery();

  const countryOptions = useMemo(() => {
    return countries.map((c) => ({
      value: c.country,
      label: (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <CountryFlag countryCode={c.countryCode} countryName={c.country} size={16} />
          <span>{c.country}</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>
            ({c.proxyCount} {c.proxyCount === 1 ? 'server' : 'servers'})
          </span>
          {c.avgLatency != null && (
            <Tag color={c.avgLatency < 100 ? 'green' : 'orange'} style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
              {c.avgLatency}ms
            </Tag>
          )}
        </div>
      ),
      country: c.country,
      code: c.countryCode,
      group: c.group,
      servers: c.proxyCount,
    }));
  }, [countries]);

  const selectedCount = proxyCountries.length;
  const availableSelectedServers = useMemo(() => {
    if (!proxyCountries || proxyCountries.length === 0) return 0;
    return countries
      .filter((c) => proxyCountries.includes(c.country))
      .reduce((sum, c) => sum + c.proxyCount, 0);
  }, [countries, proxyCountries]);

  const handleSelectPreset = (names: string[]) => {
    const matched = countries
      .filter((c) => names.some((n) => n.toLowerCase() === c.country.toLowerCase()))
      .map((c) => c.country);
    setValue('proxyCountries', matched, { shouldDirty: true });
  };

  const handleSelectAll = () => {
    setValue('proxyCountries', countries.map((c) => c.country), { shouldDirty: true });
  };

  const handleClear = () => {
    setValue('proxyCountries', [], { shouldDirty: true });
  };

  return (
    <div className="proxy-client-tab-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Enable Toggle Card */}
      <Card
        size="small"
        style={{
          borderRadius: 8,
          borderColor: proxyEnabled ? 'var(--ant-color-primary, #1677ff)' : undefined,
          background: proxyEnabled
            ? 'var(--panel-item-active-bg, rgba(22, 119, 255, 0.05))'
            : 'var(--panel-card-bg, rgba(255, 255, 255, 0.02))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CompassOutlined style={{ fontSize: 18, color: proxyEnabled ? 'var(--ant-color-primary, #1677ff)' : undefined }} />
              <Typography.Text strong style={{ fontSize: 15 }}>
                Route Traffic via Upstream Proxies (Urban VPN Network)
              </Typography.Text>
            </div>
            <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13 }}>
              When enabled, this client's outbound traffic automatically routes through external country proxy tunnels with auto-failover.
            </Typography.Paragraph>
          </div>
          <Controller
            control={control}
            name="proxyEnabled"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onChange={field.onChange}
                checkedChildren="ON"
                unCheckedChildren="OFF"
              />
            )}
          />
        </div>
      </Card>

      {!proxyEnabled ? (
        <Card size="small" style={{ borderRadius: 8, textAlign: 'center', padding: '16px 0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Typography.Text strong>Direct Inbound Routing Active</Typography.Text>
                <div style={{ color: 'var(--text-secondary, #8c8c8c)', fontSize: 12, marginTop: 4 }}>
                  Client connects directly through your server's public IP without upstream country proxying.
                </div>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          {/* Mode Selection */}
          <Form.Item label="Routing Strategy" style={{ marginBottom: 12 }}>
            <Controller
              control={control}
              name="proxyMode"
              render={({ field }) => (
                <Radio.Group
                  value={field.value || 'country'}
                  onChange={field.onChange}
                  optionType="button"
                  buttonStyle="solid"
                  style={{ width: '100%', display: 'flex' }}
                >
                  <Radio.Button value="country" style={{ flex: 1, textAlign: 'center' }}>
                    <GlobalOutlined style={{ marginRight: 6 }} />
                    Selected Countries
                  </Radio.Button>
                  <Radio.Button value="fastest" style={{ flex: 1, textAlign: 'center' }}>
                    <ThunderboltOutlined style={{ marginRight: 6 }} />
                    Auto Fastest Latency
                  </Radio.Button>
                  <Radio.Button value="pool" style={{ flex: 1, textAlign: 'center' }}>
                    <SyncOutlined style={{ marginRight: 6 }} />
                    All Countries Pool
                  </Radio.Button>
                </Radio.Group>
              )}
            />
          </Form.Item>

          {/* Country Selection for 'country' mode */}
          {proxyMode === 'country' && (
            <Card
              size="small"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Target Countries</span>
                  <Space size="small">
                    <Button size="small" onClick={() => handleSelectPreset(POPULAR_COUNTRIES)}>
                      Popular (US, DE, SG, JP, GB)
                    </Button>
                    <Button size="small" onClick={() => handleSelectPreset(ASIA_HUBS)}>
                      Asia Hubs
                    </Button>
                    <Button size="small" onClick={() => handleSelectPreset(EU_HUBS)}>
                      EU Hubs
                    </Button>
                    <Button size="small" onClick={handleSelectAll}>
                      Select All ({countries.length})
                    </Button>
                    {selectedCount > 0 && (
                      <Button size="small" danger onClick={handleClear}>
                        Clear
                      </Button>
                    )}
                  </Space>
                </div>
              }
              style={{ borderRadius: 8 }}
            >
              <Form.Item
                style={{ marginBottom: 12 }}
                extra="Select 1 or more countries. Connections will distribute or failover across available servers in the selected countries."
              >
                <Controller
                  control={control}
                  name="proxyCountries"
                  render={({ field }) => (
                    <Select
                      mode="multiple"
                      allowClear
                      loading={isLoading}
                      placeholder="Search and select one or more countries..."
                      style={{ width: '100%' }}
                      value={field.value || []}
                      onChange={field.onChange}
                      options={countryOptions}
                      filterOption={(input, option) => {
                        const str = `${option?.country || ''} ${option?.code || ''} ${option?.group || ''}`.toLowerCase();
                        return str.includes(input.toLowerCase());
                      }}
                      maxTagCount="responsive"
                    />
                  )}
                />
              </Form.Item>

              {/* Selected summary */}
              {selectedCount > 0 ? (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--panel-item-active-bg, rgba(22, 119, 255, 0.04))',
                    border: '1px solid var(--border-color, rgba(125, 125, 125, 0.15))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Space size="middle" wrap>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      Selected Pool:
                    </Typography.Text>
                    <Tag color="blue" style={{ margin: 0 }}>
                      {selectedCount} {selectedCount === 1 ? 'Country' : 'Countries'}
                    </Tag>
                    <Tag color="cyan" style={{ margin: 0 }}>
                      {availableSelectedServers} Total Servers
                    </Tag>
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Round-robin failover active
                  </Typography.Text>
                </div>
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="No countries selected. Please pick at least one country or switch mode to 'All Countries Pool'."
                  style={{ fontSize: 12 }}
                />
              )}
            </Card>
          )}

          {proxyMode === 'fastest' && (
            <Alert
              type="info"
              showIcon
              icon={<ThunderboltOutlined />}
              message="Dynamic Lowest Latency Routing"
              description="The system continuously pings active proxies via low-overhead TCP probes. The proxy with the lowest response latency will be automatically assigned for this client."
              style={{ borderRadius: 8 }}
            />
          )}

          {proxyMode === 'pool' && (
            <Alert
              type="info"
              showIcon
              icon={<GlobalOutlined />}
              message="Full Global Pool Load Balancing"
              description={`Traffic rotates across all ${countries.length} countries (269+ servers) with automatic health checking and failover.`}
              style={{ borderRadius: 8 }}
            />
          )}

          {/* Access & App / Domain Limiting Card */}
          <Card
            size="small"
            style={{
              borderRadius: 8,
              border: '1px solid var(--border-color, rgba(125, 125, 125, 0.15))',
              background: 'var(--panel-card-bg, rgba(255, 255, 255, 0.02))',
            }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <Space size={8}>
                  <FilterOutlined style={{ color: 'var(--ant-color-primary, #1677ff)' }} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Proxy Access & App / Domain Limiting</span>
                </Space>
                <Tag
                  style={{
                    margin: 0,
                    fontWeight: 600,
                    fontSize: 11,
                    background: proxyAccessMode === 'allow' ? 'rgba(16, 185, 129, 0.14)' : proxyAccessMode === 'block' ? 'rgba(239, 68, 68, 0.14)' : 'rgba(125, 125, 125, 0.1)',
                    border: proxyAccessMode === 'allow' ? '1px solid rgba(16, 185, 129, 0.35)' : proxyAccessMode === 'block' ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(125, 125, 125, 0.2)',
                    color: proxyAccessMode === 'allow' ? '#10b981' : proxyAccessMode === 'block' ? '#ef4444' : 'var(--text-secondary, #8c8c8c)',
                  }}
                >
                  {proxyAccessMode === 'allow' ? 'Allowlist Mode' : proxyAccessMode === 'block' ? 'Blocklist Mode' : 'All Traffic (Global)'}
                </Tag>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  Define how proxy routing behaves for this client: route all traffic globally, or limit proxying to specific apps & websites while remaining traffic uses normal direct internet data.
                </Typography.Text>

                <Controller
                  control={control}
                  name="proxyAccessMode"
                  render={({ field }) => (
                    <Radio.Group
                      value={field.value || 'off'}
                      onChange={(e) => field.onChange(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Radio value="off">
                          <div>
                            <span style={{ fontWeight: 600 }}>All Traffic (Global Proxy)</span>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                              All client internet connections route through the selected country proxy pool.
                            </div>
                          </div>
                        </Radio>
                        <Radio value="allow">
                          <div>
                            <span style={{ fontWeight: 600, color: '#10b981' }}>Allowlist Mode (Selective Proxy)</span>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                              Proxy is used ONLY for selected websites & mobile apps. All other internet traffic uses normal direct data without consuming proxy quota.
                            </div>
                          </div>
                        </Radio>
                        <Radio value="block">
                          <div>
                            <span style={{ fontWeight: 600, color: '#ef4444' }}>Blocklist Mode (Bypass Proxy)</span>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                              Selected websites & apps bypass the proxy directly or get blocked. All other traffic routes through the proxy.
                            </div>
                          </div>
                        </Radio>
                      </Space>
                    </Radio.Group>
                  )}
                />
              </div>

              {proxyAccessMode === 'allow' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, borderRadius: 8, background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.18)' }}>
                  <div>
                    <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      Quick Web & App Presets (Click to add):
                    </Typography.Text>
                    <Space size={6} wrap>
                      {DOMAIN_PRESETS.map((p) => (
                        <Button
                          key={p.name}
                          size="small"
                          onClick={() => {
                            const current = proxyAllowedDomains || [];
                            const next = Array.from(new Set([...current, ...p.domains]));
                            setValue('proxyAllowedDomains', next, { shouldDirty: true });
                          }}
                        >
                          + {p.name}
                        </Button>
                      ))}
                    </Space>
                  </div>

                  <div>
                    <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      Mobile App Package Presets (Android / iOS):
                    </Typography.Text>
                    <Space size={6} wrap>
                      {APP_PACKAGE_PRESETS.map((p) => (
                        <Button
                          key={p.name}
                          size="small"
                          onClick={() => {
                            const current = proxyAllowedPackages || [];
                            const next = Array.from(new Set([...current, ...p.packages]));
                            setValue('proxyAllowedPackages', next, { shouldDirty: true });
                          }}
                        >
                          <MobileOutlined /> {p.name}
                        </Button>
                      ))}
                    </Space>
                  </div>

                  <Form.Item
                    label={<span style={{ fontSize: 12, fontWeight: 600 }}>Allowed Domains (Proxy Route Only)</span>}
                    extra="Enter domain names (e.g. *.zoom.us, teams.microsoft.com, whatsapp.net). Press Enter to add."
                    style={{ marginBottom: 8 }}
                  >
                    <Controller
                      control={control}
                      name="proxyAllowedDomains"
                      render={({ field }) => (
                        <Select
                          mode="tags"
                          placeholder="Add domain names (e.g. *.zoom.us, tiktok.com)..."
                          value={field.value || []}
                          onChange={field.onChange}
                          style={{ width: '100%' }}
                          tokenSeparators={[',', ' ', '\n']}
                        />
                      )}
                    />
                  </Form.Item>

                  <Form.Item
                    label={<span style={{ fontSize: 12, fontWeight: 600 }}>Allowed Mobile App Packages (Android / iOS)</span>}
                    extra="Android package names or iOS bundle identifiers (e.g. us.zoom.videomeetings, com.whatsapp)."
                    style={{ marginBottom: 0 }}
                  >
                    <Controller
                      control={control}
                      name="proxyAllowedPackages"
                      render={({ field }) => (
                        <Select
                          mode="tags"
                          placeholder="Add package names (e.g. us.zoom.videomeetings)..."
                          value={field.value || []}
                          onChange={field.onChange}
                          style={{ width: '100%' }}
                          tokenSeparators={[',', ' ', '\n']}
                        />
                      )}
                    />
                  </Form.Item>
                </div>
              )}

              {proxyAccessMode === 'block' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.18)' }}>
                  <div>
                    <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      Block / Bypass Presets:
                    </Typography.Text>
                    <Space size={6} wrap>
                      {BLOCK_PRESETS.map((p) => (
                        <Button
                          key={p.name}
                          size="small"
                          danger
                          onClick={() => {
                            const current = proxyBlockedDomains || [];
                            const next = Array.from(new Set([...current, ...p.domains]));
                            setValue('proxyBlockedDomains', next, { shouldDirty: true });
                          }}
                        >
                          + {p.name}
                        </Button>
                      ))}
                    </Space>
                  </div>

                  <Form.Item
                    label={<span style={{ fontSize: 12, fontWeight: 600 }}>Blocked / Direct Bypass Domains</span>}
                    extra="Enter domain names to block or bypass from proxying. Press Enter to add."
                    style={{ marginBottom: 8 }}
                  >
                    <Controller
                      control={control}
                      name="proxyBlockedDomains"
                      render={({ field }) => (
                        <Select
                          mode="tags"
                          placeholder="Add domain names to block/bypass..."
                          value={field.value || []}
                          onChange={field.onChange}
                          style={{ width: '100%' }}
                          tokenSeparators={[',', ' ', '\n']}
                        />
                      )}
                    />
                  </Form.Item>

                  <Form.Item
                    label={<span style={{ fontSize: 12, fontWeight: 600 }}>Blocked App Package Names</span>}
                    extra="Mobile application package identifiers that should not be forwarded through proxy."
                    style={{ marginBottom: 0 }}
                  >
                    <Controller
                      control={control}
                      name="proxyBlockedPackages"
                      render={({ field }) => (
                        <Select
                          mode="tags"
                          placeholder="Add package names to block/bypass..."
                          value={field.value || []}
                          onChange={field.onChange}
                          style={{ width: '100%' }}
                          tokenSeparators={[',', ' ', '\n']}
                        />
                      )}
                    />
                  </Form.Item>
                </div>
              )}
            </div>
          </Card>

          {/* Token Keep-Alive & 20-Minute Refresh Status Notice */}
          <Card
            size="small"
            style={{
              borderRadius: 8,
              background: 'var(--panel-card-bg, rgba(255, 255, 255, 0.02))',
              border: '1px solid var(--border-color, rgba(125, 125, 125, 0.15))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <SafetyCertificateOutlined style={{ fontSize: 20, color: '#10b981', marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography.Text strong style={{ fontSize: 13 }}>
                    Session Persistence & 20-Minute Auto-Refresh
                  </Typography.Text>
                  <Badge status="processing" text={<span style={{ fontSize: 12, color: '#10b981' }}>Active Daemon</span>} />
                </div>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 8px' }}>
                  Urban VPN upstream proxy tokens expire after 30 minutes if idle. The background daemon automatically refreshes access credentials every 20 minutes to guarantee non-stop connectivity for this client.
                </Typography.Paragraph>

                <Row gutter={8}>
                  <Col span={8}>
                    <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(125,125,125,0.06)', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>Idle Expiry</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>30 Minutes</div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(125,125,125,0.06)', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>Auto Refresh</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ant-color-primary, #1677ff)' }}>Every 20 Min</div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(125,125,125,0.06)', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)' }}>Connected State</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#10b981' }}>Permanent</div>
                    </div>
                  </Col>
                </Row>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
