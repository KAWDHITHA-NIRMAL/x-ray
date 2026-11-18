import { useCallback } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Button,
  Divider,
  Input,
  Radio,
  Select,
  Space,
  Switch,
  Tag,
} from 'antd';
import {
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  StopOutlined,
  GlobalOutlined,
  MobileOutlined,
  PlusOutlined,
  ClearOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { WORLD_COUNTRIES } from '@/pages/settings/SecurityTab';
import CountryFlag from '@/pages/stats/CountryFlag';
import './AccessTab.css';

export const DOMAIN_PRESETS = [
  {
    name: 'kawditha.lk (Selective)',
    domains: ['kawditha.lk', '*.kawditha.lk', 'vpn.kawditha.dev'],
  },
  {
    name: 'Zoom & Teams',
    domains: ['*.zoom.us', 'zoom.us', 'teams.microsoft.com', 'aka.ms', 'meet.google.com', 'webex.com'],
  },
  {
    name: 'YouTube',
    domains: ['*.youtube.com', 'youtube.com', '*.googlevideo.com', 'ytimg.com', 'youtu.be'],
  },
  {
    name: 'TikTok',
    domains: ['*.tiktok.com', 'tiktok.com', '*.byteoversea.com', '*.ibytedtos.com'],
  },
  {
    name: 'WhatsApp',
    domains: ['*.whatsapp.net', 'whatsapp.com', '*.whatsapp.com', 'web.whatsapp.com'],
  },
  {
    name: 'Telegram',
    domains: ['*.telegram.org', 'telegram.org', 't.me', '*.t.me', 'telesco.pe'],
  },
  {
    name: 'Netflix',
    domains: ['*.netflix.com', 'netflix.com', '*.nflxvideo.net', '*.nflximg.net'],
  },
  {
    name: 'Social All',
    domains: [
      '*.whatsapp.net',
      'whatsapp.com',
      '*.telegram.org',
      't.me',
      '*.facebook.com',
      '*.fbcdn.net',
      '*.instagram.com',
      '*.cdninstagram.com',
    ],
  },
];

export const APP_PACKAGE_PRESETS = [
  {
    name: 'Zoom Meetings',
    packages: ['us.zoom.videomeetings'],
  },
  {
    name: 'YouTube App',
    packages: ['com.google.android.youtube', 'com.google.ios.youtube'],
  },
  {
    name: 'TikTok App',
    packages: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'],
  },
  {
    name: 'WhatsApp',
    packages: ['com.whatsapp', 'net.whatsapp.WhatsApp'],
  },
  {
    name: 'Telegram',
    packages: ['org.telegram.messenger', 'ph.telegra.Telegraph'],
  },
  {
    name: 'MS Teams',
    packages: ['com.microsoft.teams'],
  },
  {
    name: 'Netflix App',
    packages: ['com.netflix.mediaclient'],
  },
];

export const BLOCK_PRESETS = [
  {
    name: 'BitTorrent / P2P',
    domains: ['torrent', 'bittorrent', 'tracker', 'announce', 'utorrent', 'transmissionbt.com'],
  },
  {
    name: 'Ads & Trackers',
    domains: ['geosite:category-ads-all', 'doubleclick.net', 'adservice.google.com'],
  },
  {
    name: 'Adult / NSFW',
    domains: ['geosite:category-porn'],
  },
  {
    name: 'Cryptominers',
    domains: ['geosite:cryptominers', 'coin-hive.com'],
  },
];

function stringListToText(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return list.join('\n');
}

function textToStringList(text: string): string[] {
  return text
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter((item, index, self) => item.length > 0 && self.indexOf(item) === index);
}

export default function AccessTab() {
  const { control, setValue } = useFormContext();

  const mode = useWatch({ control, name: 'access.mode' }) || 'off';
  const allowedDomains = (useWatch({ control, name: 'access.allowedDomains' }) as string[]) || [];
  const allowedPackages = (useWatch({ control, name: 'access.allowedPackages' }) as string[]) || [];
  const unmatchedAction = useWatch({ control, name: 'access.unmatchedAction' }) || 'direct';
  const outboundTag = (useWatch({ control, name: 'access.outboundTag' }) as string) || '';
  const blockEnabled = useWatch({ control, name: 'access.blockEnabled' }) ?? false;
  const blockedDomains = (useWatch({ control, name: 'access.blockedDomains' }) as string[]) || [];
  const blockedPackages = (useWatch({ control, name: 'access.blockedPackages' }) as string[]) || [];

  const countryRestriction = (useWatch({ control, name: 'access.countryRestriction' }) as string) || '';
  const countryRestrictionMode = (useWatch({ control, name: 'access.countryRestrictionMode' }) as string) || 'allow';
  const countryRestrictionEnabled = useWatch({ control, name: 'access.countryRestrictionEnabled' }) ?? false;

  const handleModeChange = useCallback(
    (newMode: 'off' | 'allow' | 'block') => {
      setValue('access.mode', newMode);
      setValue('access.enabled', newMode !== 'off');
      if (newMode === 'block') {
        setValue('access.blockEnabled', true);
      }
    },
    [setValue],
  );

  const handleAppendDomains = useCallback(
    (newDomains: string[]) => {
      const merged = Array.from(new Set([...allowedDomains, ...newDomains]));
      setValue('access.allowedDomains', merged);
    },
    [allowedDomains, setValue],
  );

  const handleAppendPackages = useCallback(
    (newPkgs: string[]) => {
      const merged = Array.from(new Set([...allowedPackages, ...newPkgs]));
      setValue('access.allowedPackages', merged);
    },
    [allowedPackages, setValue],
  );

  const handleAppendBlockedDomains = useCallback(
    (newDomains: string[]) => {
      const merged = Array.from(new Set([...blockedDomains, ...newDomains]));
      setValue('access.blockedDomains', merged);
    },
    [blockedDomains, setValue],
  );

  return (
    <div className="access-tab-container">
      {/* Top Banner Alert */}
      <div className="access-banner-card">
        <div className="access-banner-header">
          <div className="access-banner-icon">
            <SafetyCertificateOutlined />
          </div>
          <div className="access-banner-text">
            <h4>Traffic & Access Control (Routing Policy)</h4>
            <p>
              Limit this V2Ray config to specific websites or mobile apps. When enabled, clients will only
              consume package data for listed services, while other traffic bypasses directly using regular internet.
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="access-mode-selector-row">
          <span className="access-mode-label">Access Mode:</span>
          <Radio.Group
            value={mode}
            buttonStyle="solid"
            onChange={(e) => handleModeChange(e.target.value)}
          >
            <Radio.Button value="off">
              <Space orientation="horizontal" size={4}>
                <ThunderboltOutlined />
                Standard (Full Tunnel)
              </Space>
            </Radio.Button>
            <Radio.Button value="allow">
              <Space orientation="horizontal" size={4}>
                <CheckCircleOutlined />
                Allow Only (Whitelist)
              </Space>
            </Radio.Button>
            <Radio.Button value="block">
              <Space orientation="horizontal" size={4}>
                <StopOutlined />
                Block Mode (Blacklist)
              </Space>
            </Radio.Button>
          </Radio.Group>
        </div>

        {mode === 'off' && (
          <div className="access-hint-box info">
            <InfoCircleOutlined />
            <span>
              All client traffic routes through this inbound without restriction. Select <strong>Allow Only</strong> to isolate specific ISP packages (e.g. Zoom, YouTube, TikTok).
            </span>
          </div>
        )}

        {mode === 'allow' && (
          <div className="access-hint-box success">
            <CheckCircleOutlined />
            <span>
              <strong>Allow Only Mode Active:</strong> Only listed websites & mobile apps will tunnel through this V2Ray config. Unmatched traffic will bypass direct (normal data).
            </span>
          </div>
        )}

        {mode === 'block' && (
          <div className="access-hint-box warning">
            <StopOutlined />
            <span>
              <strong>Block Mode Active:</strong> All traffic routes through this config EXCEPT the specified blocked websites & apps below.
            </span>
          </div>
        )}
      </div>

      {/* ALLOWED DESTINATIONS (Shown when mode is 'allow') */}
      {mode === 'allow' && (
        <div className="access-section-card allowed-section">
          <div className="section-title-row">
            <div className="section-title">
              <GlobalOutlined style={{ color: '#10b981' }} />
              <span>Allowed Websites & Domains (Whitelist)</span>
              <Tag color="green">{allowedDomains.length} domains</Tag>
            </div>
            {allowedDomains.length > 0 && (
              <Button
                size="small"
                icon={<ClearOutlined />}
                onClick={() => setValue('access.allowedDomains', [])}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="quick-presets-strip">
            <span className="strip-label">Quick Domain Presets:</span>
            <div className="presets-chips">
              {DOMAIN_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="preset-chip"
                  onClick={() => handleAppendDomains(p.domains)}
                >
                  <PlusOutlined style={{ fontSize: 9 }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <Input.TextArea
            rows={4}
            placeholder="Enter or paste domains (one per line or separated by comma)&#10;e.g.&#10;*.zoom.us&#10;zoom.us&#10;teams.microsoft.com"
            value={stringListToText(allowedDomains)}
            onChange={(e) => setValue('access.allowedDomains', textToStringList(e.target.value))}
            className="access-textarea"
          />
          <div className="field-helper-text">
            Supports exact domains (<code>zoom.us</code>), wildcards (<code>*.zoom.us</code>), or subdomains. Bulk paste supported.
          </div>

          <Divider style={{ margin: '14px 0 12px 0' }} />

          {/* Android & Apple iOS App Package Names */}
          <div className="section-title-row">
            <div className="section-title">
              <MobileOutlined style={{ color: '#38bdf8' }} />
              <span>Target Mobile Apps (Android Package Names & iOS Bundle IDs)</span>
              <Tag color="blue">{allowedPackages.length} apps</Tag>
            </div>
            {allowedPackages.length > 0 && (
              <Button
                size="small"
                icon={<ClearOutlined />}
                onClick={() => setValue('access.allowedPackages', [])}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="quick-presets-strip">
            <span className="strip-label">Quick App Presets:</span>
            <div className="presets-chips">
              {APP_PACKAGE_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="preset-chip app"
                  onClick={() => handleAppendPackages(p.packages)}
                >
                  <PlusOutlined style={{ fontSize: 9 }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <Input.TextArea
            rows={3}
            placeholder="Enter app IDs (one per line)&#10;e.g.&#10;us.zoom.videomeetings&#10;com.google.android.youtube&#10;com.zhiliaoapp.musically"
            value={stringListToText(allowedPackages)}
            onChange={(e) => setValue('access.allowedPackages', textToStringList(e.target.value))}
            className="access-textarea"
          />
          <div className="field-helper-text">
            When specified, Android clients (v2rayNG / sing-box) and iOS clients will route only traffic originating from these apps.
          </div>

          <Divider style={{ margin: '14px 0 12px 0' }} />

          {/* Upstream Proxy Target for Allowed Domains */}
          <div className="outbound-target-row" style={{ marginBottom: 14 }}>
            <div style={{ marginBottom: 6 }}>
              <span className="unmatched-title">Outbound Proxy Target (Optional):</span>
              <span className="unmatched-desc" style={{ display: 'block', fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                Target outbound tag for allowed websites (e.g. <code>urban-outbound-lk</code> for Sri Lanka proxy). Leave blank for direct Freedom.
              </span>
            </div>
            <Input
              placeholder="e.g. urban-outbound-lk"
              value={outboundTag}
              onChange={(e) => setValue('access.outboundTag', e.target.value.trim())}
              style={{ width: '100%', maxWidth: 360 }}
              addonBefore="Target Outbound"
            />
          </div>

          {/* Unmatched Traffic Routing */}
          <div className="unmatched-row">
            <div className="unmatched-info">
              <span className="unmatched-title">Unmatched Traffic Action:</span>
              <span className="unmatched-desc">
                What to do with traffic for websites or apps not in the allow list above
              </span>
            </div>
            <Radio.Group
              value={unmatchedAction}
              onChange={(e) => setValue('access.unmatchedAction', e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="direct">
                <Space orientation="horizontal" size={4}>
                  <ArrowRightOutlined />
                  Direct Bypass (Normal Data)
                </Space>
              </Radio.Button>
              <Radio.Button value="block">
                <Space orientation="horizontal" size={4}>
                  <StopOutlined />
                  Block / Reject
                </Space>
              </Radio.Button>
            </Radio.Group>
          </div>
        </div>
      )}

      {/* BLOCKED DESTINATIONS (Blacklist / Restrictions Section) */}
      <div className={`access-section-card blocked-section ${blockEnabled || mode === 'block' ? 'active' : ''}`}>
        <div className="section-title-row">
          <div className="section-title">
            <StopOutlined style={{ color: '#ef4444' }} />
            <span>Blocked Destinations & Security Filter (Blacklist)</span>
            {blockEnabled && <Tag color="error">{blockedDomains.length} blocked</Tag>}
          </div>
          {mode !== 'block' && (
            <Space>
              <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                Enable Blacklist Filter:
              </span>
              <Switch
                checked={blockEnabled}
                onChange={(checked) => setValue('access.blockEnabled', checked)}
              />
            </Space>
          )}
        </div>

        {(blockEnabled || mode === 'block') && (
          <>
            <p className="blocked-desc-text">
              Traffic matching any of the websites, domains, or protocols listed here will be blocked or dropped. All other websites will remain fully accessible.
            </p>

            <div className="quick-presets-strip">
              <span className="strip-label">Quick Block Presets:</span>
              <div className="presets-chips">
                {BLOCK_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="preset-chip danger"
                    onClick={() => handleAppendBlockedDomains(p.domains)}
                  >
                    <PlusOutlined style={{ fontSize: 9 }} />
                    {p.name}
                  </button>
                ))}
                {blockedDomains.length > 0 && (
                  <button
                    type="button"
                    className="preset-chip clear"
                    onClick={() => setValue('access.blockedDomains', [])}
                  >
                    <ClearOutlined style={{ fontSize: 9 }} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <Input.TextArea
              rows={3}
              placeholder="Enter domains, keywords, or geosite categories to block&#10;e.g.&#10;torrent&#10;bittorrent&#10;geosite:category-ads-all"
              value={stringListToText(blockedDomains)}
              onChange={(e) => setValue('access.blockedDomains', textToStringList(e.target.value))}
              className="access-textarea"
            />
            <div className="field-helper-text">
              Clients connected to this inbound will be strictly blocked from reaching these destinations.
            </div>

            <Divider style={{ margin: '14px 0 12px 0' }} />

            <div className="section-title-row">
              <div className="section-title">
                <FilterOutlined style={{ color: '#f59e0b' }} />
                <span>Blocked App Packages</span>
                <Tag color="orange">{blockedPackages.length} apps</Tag>
              </div>
            </div>
            <Input.TextArea
              rows={2}
              placeholder="Enter app package names that should be blocked from using this VPN (e.g. banking apps, torrent clients)"
              value={stringListToText(blockedPackages)}
              onChange={(e) => setValue('access.blockedPackages', textToStringList(e.target.value))}
              className="access-textarea"
            />
          </>
        )}
      </div>

      {/* CLIENT COUNTRY RESTRICTION (GEO-FENCE) */}
      <div className={`access-section-card country-shield-section ${countryRestrictionEnabled ? 'active' : ''}`} style={{ marginTop: 14 }}>
        <div className="section-title-row">
          <div className="section-title">
            <GlobalOutlined style={{ color: '#38bdf8' }} />
            <span>Client Country Geo-Fence (Inbound IP Restriction)</span>
            {countryRestrictionEnabled && (
              <Tag color={countryRestrictionMode === 'allow' ? 'green' : 'error'}>
                {countryRestrictionMode === 'allow' ? 'Allowlist Active' : 'Blocklist Active'}
              </Tag>
            )}
          </div>
          <Space>
            <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
              Enable Geo-Fence:
            </span>
            <Switch
              checked={countryRestrictionEnabled}
              onChange={(checked) => {
                setValue('access.countryRestrictionEnabled', checked);
                if (checked && !countryRestriction) {
                  setValue('access.countryRestriction', 'LK');
                  setValue('access.countryRestrictionMode', 'allow');
                }
              }}
            />
          </Space>
        </div>

        {countryRestrictionEnabled && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="blocked-desc-text" style={{ margin: 0 }}>
              Control which countries clients are allowed to connect from. When set to Allowlist, clients connecting from foreign countries will have their connections immediately dropped.
            </p>

            <Radio.Group
              value={countryRestrictionMode}
              onChange={(e) => setValue('access.countryRestrictionMode', e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="allow">
                <Space size={4}>
                  <CheckCircleOutlined />
                  Allowlist (Only Selected Countries)
                </Space>
              </Radio.Button>
              <Radio.Button value="block">
                <Space size={4}>
                  <StopOutlined />
                  Blocklist (Block Selected Countries)
                </Space>
              </Radio.Button>
            </Radio.Group>

            <div style={{ width: '100%', maxWidth: 540 }}>
              <Select
                mode="multiple"
                showSearch
                placeholder="Search and select countries (e.g. Sri Lanka, Singapore)..."
                value={
                  Array.isArray(countryRestriction)
                    ? (countryRestriction as string[]).map(s => String(s).trim().toUpperCase()).filter(Boolean)
                    : typeof countryRestriction === 'string' && countryRestriction.trim() !== ''
                    ? countryRestriction.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                    : []
                }
                onChange={(vals) => setValue('access.countryRestriction', Array.isArray(vals) ? vals.join(',') : '')}
                style={{ width: '100%', marginBottom: 8 }}
                filterOption={(input, option) => {
                  const val = String(option?.value || '').toLowerCase();
                  const title = String(option?.title || '').toLowerCase();
                  const query = input.toLowerCase();
                  return val.includes(query) || title.includes(query);
                }}
              >
                {WORLD_COUNTRIES.map((c) => (
                  <Select.Option key={c.code} value={c.code} title={`${c.name} (${c.code})`}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <CountryFlag countryCode={c.code} countryName={c.name} size={15} />
                      <span>{c.name}</span>
                      <span style={{ color: 'var(--text-secondary, #8c8c8c)', fontSize: 11 }}>({c.code})</span>
                    </div>
                  </Select.Option>
                ))}
              </Select>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)', alignSelf: 'center' }}>
                  Quick Presets:
                </span>
                <Button
                  size="small"
                  onClick={() => {
                    setValue('access.countryRestrictionMode', 'allow');
                    setValue('access.countryRestriction', 'LK');
                  }}
                >
                  <CountryFlag countryCode="LK" size={14} /> Sri Lanka Only (LK)
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setValue('access.countryRestrictionMode', 'allow');
                    setValue('access.countryRestriction', 'SG');
                  }}
                >
                  <CountryFlag countryCode="SG" size={14} /> Singapore Only (SG)
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setValue('access.countryRestrictionMode', 'allow');
                    setValue('access.countryRestriction', 'US');
                  }}
                >
                  <CountryFlag countryCode="US" size={14} /> United States (US)
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => setValue('access.countryRestriction', '')}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
