import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Empty, Form, Input, Modal, Radio, Select, Space, Spin, Switch, Tabs, message } from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
  SafetyOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { ClipboardManager, HttpUtil, IntlUtil, RandomUtil } from '@/utils';
import type { AllSetting } from '@/models/setting';
import { SettingListItem } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import CountryFlag from '@/pages/stats/CountryFlag';
import { catTabLabel } from './catTabLabel';
import TwoFactorModal from './TwoFactorModal';
import './SecurityTab.css';

interface ApiMsg<T = unknown> {
  success?: boolean;
  msg?: string;
  obj?: T;
}

interface ApiTokenRow {
  id: number;
  name: string;
  enabled: boolean;
  createdAt: number;
  scope: 'admin' | 'monitor' | 'node-sync';
  expiresAt: number;
}

interface SecurityTabProps {
  allSetting: AllSetting;
  updateSetting: (patch: Partial<AllSetting>) => void;
  saveSetting: (payload: (Partial<AllSetting> & Record<string, unknown>) | AllSetting) => Promise<unknown>;
}

const UNIX_MILLISECONDS_THRESHOLD = 100_000_000_000;

function apiTokenCreatedAtMilliseconds(createdAt: number): number {
  return createdAt < UNIX_MILLISECONDS_THRESHOLD ? createdAt * 1000 : createdAt;
}

type TfaType = 'set' | 'confirm';

interface TfaState {
  open: boolean;
  title: string;
  description: string;
  token: string;
  type: TfaType;
  onConfirm: (success: boolean, code?: string) => void;
}

const TFA_INITIAL: TfaState = {
  open: false,
  title: '',
  description: '',
  token: '',
  type: 'set',
  onConfirm: () => {},
};

export const WORLD_COUNTRIES = [
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SG', name: 'Singapore' },
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'NP', name: 'Nepal' },
  { code: 'MV', name: 'Maldives' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'OM', name: 'Oman' },
  { code: 'TR', name: 'Turkey' },
  { code: 'RU', name: 'Russia' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'PL', name: 'Poland' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NO', name: 'Norway' },
  { code: 'FI', name: 'Finland' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NZ', name: 'New Zealand' },
];

export default function SecurityTab({ allSetting, updateSetting, saveSetting }: SecurityTabProps) {
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();

  const [tfa, setTfa] = useState<TfaState>(TFA_INITIAL);
  const [user, setUser] = useState({
    oldUsername: '',
    oldPassword: '',
    newUsername: '',
    newPassword: '',
  });
  const [updating, setUpdating] = useState(false);

  const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([]);
  const [apiTokensLoading, setApiTokensLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<{ name: string; token: string } | null>(null);
  const [savingGeoShield, setSavingGeoShield] = useState(false);

  const selectedCountries = useMemo(() => {
    const raw = allSetting.geoShieldCountries;
    if (Array.isArray(raw)) {
      return (raw as string[]).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
      return raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    }
    return ['LK'];
  }, [allSetting.geoShieldCountries]);

  const openTfa = useCallback((opts: Omit<TfaState, 'open'>) => {
    setTfa({ ...opts, open: true });
  }, []);

  const onTfaConfirm = useCallback(
    (success: boolean, code?: string) => {
      tfa.onConfirm(success, code);
    },
    [tfa],
  );

  function updateUserField<K extends keyof typeof user>(key: K, value: string) {
    setUser((prev) => ({ ...prev, [key]: value }));
  }

  const sendUpdateUser = useCallback(
    async (twoFactorCode = '') => {
      setUpdating(true);
      try {
        const msg = (await HttpUtil.post('/panel/api/setting/updateUser', {
          ...user,
          twoFactorCode,
        })) as ApiMsg;
        if (msg?.success) {
          await HttpUtil.post('/logout');
          const basePath = window.XRAY_BASE_PATH || '/';
          window.location.replace(basePath);
        }
      } finally {
        setUpdating(false);
      }
    },
    [user],
  );

  function onUpdateUserClick() {
    if (allSetting.twoFactorEnable) {
      openTfa({
        title: t('pages.settings.security.twoFactorModalChangeCredentialsTitle'),
        description: t('pages.settings.security.twoFactorModalChangeCredentialsStep'),
        token: '',
        type: 'confirm',
        onConfirm: (ok: boolean, code?: string) => {
          if (ok) sendUpdateUser(code || '');
        },
      });
    } else {
      sendUpdateUser();
    }
  }

  const fetchApiTokens = useCallback(async () => {
    try {
      const msg = (await HttpUtil.get('/panel/api/setting/apiTokens')) as ApiMsg<ApiTokenRow[]>;
      if (msg?.success) setApiTokens(Array.isArray(msg.obj) ? msg.obj : []);
    } finally {
      setApiTokensLoading(false);
    }
  }, []);

  const loadApiTokens = useCallback(async () => {
    setApiTokensLoading(true);
    await fetchApiTokens();
  }, [fetchApiTokens]);

  useEffect(() => {
    void fetchApiTokens();
  }, [fetchApiTokens]);

  async function copyToken(token: string) {
    if (!token) return;
    const ok = await ClipboardManager.copyText(token);
    if (ok) messageApi.success(t('copySuccess'));
    else messageApi.error(t('copyFail') ?? 'Copy failed');
  }

  function openCreateModal() {
    setCreateName('');
    setCreateOpen(true);
  }

  async function confirmCreateToken() {
    const name = createName.trim();
    if (!name) {
      messageApi.error(t('pages.settings.security.apiTokenNameRequired') || 'Name is required');
      return;
    }
    setCreating(true);
    try {
      const msg = (await HttpUtil.post('/panel/api/setting/apiTokens/create', { name })) as ApiMsg<{
        token?: string;
      }>;
      if (msg?.success) {
        setCreateOpen(false);
        await loadApiTokens();
        if (msg.obj?.token) {
          setCreatedToken({ name, token: msg.obj.token });
        }
      }
    } finally {
      setCreating(false);
    }
  }

  function confirmDeleteToken(row: ApiTokenRow) {
    modal.confirm({
      title: `${t('delete')} "${row.name}"?`,
      content:
        t('pages.settings.security.apiTokenDeleteWarning') ||
        'Any caller using this token will stop authenticating immediately.',
      okText: t('delete'),
      cancelText: t('cancel'),
      okType: 'danger',
      onOk: async () => {
        const msg = (await HttpUtil.post(`/panel/api/setting/apiTokens/delete/${row.id}`, {
          expectedScope: row.scope,
        })) as ApiMsg;
        if (msg?.success) await loadApiTokens();
      },
    });
  }

  async function toggleTokenEnabled(row: ApiTokenRow) {
    const target = !row.enabled;
    const msg = (await HttpUtil.post(`/panel/api/setting/apiTokens/setEnabled/${row.id}`, {
      enabled: target,
      expectedScope: row.scope,
    })) as ApiMsg;
    if (msg?.success) {
      setApiTokens((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: target } : r)));
    }
  }

  function formatTokenDate(ts: number): string {
    if (!ts) return '';
    return IntlUtil.formatDate(apiTokenCreatedAtMilliseconds(ts));
  }

  function toggleTwoFactor() {
    if (!allSetting.twoFactorEnable) {
      const newToken = RandomUtil.randomBase32String();
      openTfa({
        title: t('pages.settings.security.twoFactorModalSetTitle'),
        description: '',
        token: newToken,
        type: 'set',
        onConfirm: (ok: boolean) => {
          if (ok) {
            messageApi.success(t('pages.settings.security.twoFactorModalSetSuccess'));
            updateSetting({ twoFactorToken: newToken, twoFactorEnable: true });
          } else {
            updateSetting({ twoFactorEnable: false });
          }
        },
      });
    } else {
      openTfa({
        title: t('pages.settings.security.twoFactorModalDeleteTitle'),
        description: t('pages.settings.security.twoFactorModalRemoveStep'),
        token: '',
        type: 'confirm',
        onConfirm: async (ok: boolean, code?: string) => {
          if (!ok) return;
          const next = {
            ...allSetting,
            twoFactorEnable: false,
            twoFactorToken: '',
            twoFactorCode: code || '',
          };
          const msg = (await saveSetting(next)) as ApiMsg;
          if (msg?.success) {
            messageApi.success(t('pages.settings.security.twoFactorModalDeleteSuccess'));
            updateSetting({ twoFactorEnable: false, twoFactorToken: '', hasTwoFactorToken: false });
          }
        },
      });
    }
  }

  return (
    <>
      {messageContextHolder}
      {modalContextHolder}
      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: '1',
            label: catTabLabel(<UserOutlined />, t('pages.settings.security.admin'), isMobile),
            children: (
              <>
                <SettingListItem paddings="small" title={t('pages.settings.oldUsername')}>
                  <Input
                    value={user.oldUsername}
                    autoComplete="username"
                    onChange={(e) => updateUserField('oldUsername', e.target.value)}
                  />
                </SettingListItem>
                <SettingListItem paddings="small" title={t('pages.settings.currentPassword')}>
                  <Input.Password
                    value={user.oldPassword}
                    autoComplete="current-password"
                    onChange={(e) => updateUserField('oldPassword', e.target.value)}
                  />
                </SettingListItem>
                <SettingListItem paddings="small" title={t('pages.settings.newUsername')}>
                  <Input
                    value={user.newUsername}
                    onChange={(e) => updateUserField('newUsername', e.target.value)}
                  />
                </SettingListItem>
                <SettingListItem paddings="small" title={t('pages.settings.newPassword')}>
                  <Input.Password
                    value={user.newPassword}
                    autoComplete="new-password"
                    onChange={(e) => updateUserField('newPassword', e.target.value)}
                  />
                </SettingListItem>
                <div className="security-actions">
                  <Space style={{ padding: '0 20px' }}>
                    <Button type="primary" loading={updating} onClick={onUpdateUserClick}>
                      {t('confirm')}
                    </Button>
                  </Space>
                </div>
              </>
            ),
          },
          {
            key: '2',
            label: catTabLabel(
              <SafetyOutlined />,
              t('pages.settings.security.twoFactor'),
              isMobile,
            ),
            children: (
              <SettingListItem
                paddings="small"
                title={t('pages.settings.security.twoFactorEnable')}
                description={t('pages.settings.security.twoFactorEnableDesc')}
              >
                <Switch checked={allSetting.twoFactorEnable} onClick={toggleTwoFactor} />
              </SettingListItem>
            ),
          },
          {
            key: '3',
            label: catTabLabel(<ApiOutlined />, t('pages.nodes.apiToken'), isMobile),
            children: (
              <div className="api-token-section">
                <div className="api-token-header">
                  <p className="api-token-hint">{t('pages.nodes.apiTokenHint')}</p>
                  <Button type="primary" size="small" onClick={openCreateModal}>
                    + {t('pages.settings.security.apiTokenNew') || 'New token'}
                  </Button>
                </div>
                <Spin spinning={apiTokensLoading}>
                  {!apiTokens.length && !apiTokensLoading && (
                    <Empty
                      description={t('pages.settings.security.apiTokenEmpty') || 'No tokens yet'}
                    />
                  )}
                  {apiTokens.map((row) => (
                    <div key={row.id} className={`api-token-row${row.enabled ? '' : ' disabled'}`}>
                      <div className="api-token-row-head">
                        <div className="api-token-name-wrap">
                          <span className="api-token-name">{row.name}</span>
                          <span className="api-token-created">
                            {formatTokenDate(row.createdAt)}
                          </span>
                        </div>
                        <div className="api-token-actions">
                          <Switch
                            size="small"
                            checked={row.enabled}
                            onChange={() => toggleTokenEnabled(row)}
                          />
                          <Button
                            size="small"
                            danger
                            type="text"
                            onClick={() => confirmDeleteToken(row)}
                          >
                            {t('delete')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </Spin>
              </div>
            ),
          },
          {
            key: '4',
            label: catTabLabel(
              <GlobalOutlined />,
              'Country Shield (Geo-Fence)',
              isMobile,
            ),
            children: (
              <>
                <SettingListItem
                  paddings="small"
                  title="Enable Country Shield (Geo-Fencing)"
                  description="Block inbound connections originating from foreign countries. Prevent unauthorized users, bots, and scanners outside your permitted regions from connecting to V2Ray or the VPS."
                >
                  <Switch
                    checked={allSetting.geoShieldEnable}
                    onChange={(checked) => updateSetting({ geoShieldEnable: checked })}
                  />
                </SettingListItem>

                {allSetting.geoShieldEnable && (
                  <>
                    <SettingListItem
                      paddings="small"
                      title="Geo-Shield Mode"
                      description="Choose whether to allow ONLY the selected countries (dropping all others), or block specific countries."
                    >
                      <Radio.Group
                        value={allSetting.geoShieldMode || 'allow'}
                        onChange={(e) => updateSetting({ geoShieldMode: e.target.value })}
                      >
                        <Space direction="vertical">
                          <Radio value="allow">
                            <div>
                              <span style={{ fontWeight: 600, color: '#10b981' }}>
                                Allowlist Mode (Allow ONLY Selected Countries - Block All Other Foreign Countries)
                              </span>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                                Strict geo-fence: Only clients with IP addresses from the chosen countries can connect. All other foreign traffic is dropped.
                              </div>
                            </div>
                          </Radio>
                          <Radio value="block">
                            <div>
                              <span style={{ fontWeight: 600, color: '#ef4444' }}>
                                Blocklist Mode (Block Selected Countries - Allow All Others)
                              </span>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)' }}>
                                Traffic originating from the selected countries is blackholed. All other countries are allowed.
                              </div>
                            </div>
                          </Radio>
                        </Space>
                      </Radio.Group>
                    </SettingListItem>

                    <SettingListItem
                      paddings="small"
                      title={allSetting.geoShieldMode === 'block' ? 'Blocked Countries' : 'Allowed Countries'}
                      description="Search and pick countries by name or ISO country code. Quick presets available below."
                    >
                      <div style={{ width: '100%', maxWidth: 540 }}>
                        <Select
                          mode="multiple"
                          showSearch
                          placeholder="Search countries (e.g. Sri Lanka, Singapore, United States)..."
                          value={selectedCountries}
                          onChange={(vals) => updateSetting({ geoShieldCountries: vals.join(',') })}
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

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary, #8c8c8c)', alignSelf: 'center' }}>
                            Quick Presets:
                          </span>
                          <Button
                            size="small"
                            onClick={() => updateSetting({ geoShieldMode: 'allow', geoShieldCountries: 'LK' })}
                          >
                            <CountryFlag countryCode="LK" size={14} /> Sri Lanka Only (LK)
                          </Button>
                          <Button
                            size="small"
                            onClick={() => updateSetting({ geoShieldMode: 'allow', geoShieldCountries: 'SG' })}
                          >
                            <CountryFlag countryCode="SG" size={14} /> Singapore Only (SG)
                          </Button>
                          <Button
                            size="small"
                            onClick={() => updateSetting({ geoShieldMode: 'allow', geoShieldCountries: 'US' })}
                          >
                            <CountryFlag countryCode="US" size={14} /> United States (US)
                          </Button>
                          <Button
                            size="small"
                            onClick={() => updateSetting({ geoShieldMode: 'allow', geoShieldCountries: 'LK,IN,BD,PK,MV,NP' })}
                          >
                            South Asia (LK, IN, BD, PK...)
                          </Button>
                          <Button
                            size="small"
                            onClick={() => updateSetting({ geoShieldMode: 'allow', geoShieldCountries: 'SG,MY,ID,TH,VN,PH' })}
                          >
                            Southeast Asia (SG, MY, ID...)
                          </Button>
                          <Button
                            size="small"
                            danger
                            onClick={() => updateSetting({ geoShieldCountries: '' })}
                          >
                            Clear
                          </Button>
                        </div>

                        {allSetting.geoShieldMode === 'allow' ? (
                          <Alert
                            type="success"
                            showIcon
                            icon={<CheckCircleOutlined style={{ color: '#10b981' }} />}
                            message={`Allowlist Protected: Only connections from [${selectedCountries.join(', ') || 'None'}] are permitted.`}
                            description="All incoming connections and V2Ray tunnels from other foreign countries will be immediately blackholed and dropped."
                          />
                        ) : (
                          <Alert
                            type="warning"
                            showIcon
                            icon={<StopOutlined />}
                            message={`Blocklist Active: Connections from [${selectedCountries.join(', ') || 'None'}] are blocked.`}
                            description="Users connecting from these listed countries will not be able to connect or authenticate."
                          />
                        )}
                      </div>
                    </SettingListItem>

                    <SettingListItem
                      paddings="small"
                      title="Protection Target Scope"
                      description="Choose whether the Geo-Shield restriction protects V2Ray inbounds, Panel web interface, or both."
                    >
                      <Select
                        value={allSetting.geoShieldTarget || 'both'}
                        onChange={(val) => updateSetting({ geoShieldTarget: val })}
                        style={{ width: 260 }}
                        options={[
                          { label: 'Both V2Ray & Web Panel (Recommended)', value: 'both' },
                          { label: 'V2Ray Inbounds Only', value: 'v2ray' },
                          { label: 'Web Panel Only', value: 'panel' },
                        ]}
                      />
                    </SettingListItem>

                    <SettingListItem
                      paddings="small"
                      title="Allow Local / Private Network (LAN)"
                      description="Always allow loopback (127.0.0.1) and private subnets (192.168.0.0/16, 10.0.0.0/8) to guarantee you can always manage your server."
                    >
                      <Switch
                        checked={allSetting.geoShieldAllowPrivate ?? true}
                        onChange={(checked) => updateSetting({ geoShieldAllowPrivate: checked })}
                      />
                    </SettingListItem>
                  </>
                )}

                <div className="security-actions" style={{ padding: '16px 20px 0' }}>
                  <Button
                    type="primary"
                    loading={savingGeoShield}
                    onClick={async () => {
                      setSavingGeoShield(true);
                      try {
                        const msg = (await saveSetting({ ...allSetting })) as ApiMsg;
                        if (msg?.success) {
                          messageApi.success('Country Shield settings saved and applied successfully!');
                        }
                      } finally {
                        setSavingGeoShield(false);
                      }
                    }}
                  >
                    Save Country Shield
                  </Button>
                </div>
              </>
            ),
          },
        ]}
      />

      <Modal
        open={createOpen}
        title={t('pages.settings.security.apiTokenNew') || 'New API token'}
        confirmLoading={creating}
        okText={t('confirm')}
        cancelText={t('cancel')}
        onOk={confirmCreateToken}
        onCancel={() => setCreateOpen(false)}
      >
        <Form layout="vertical">
          <Form.Item label={t('pages.settings.security.apiTokenName') || 'Name'} required>
            <Input
              value={createName}
              maxLength={64}
              placeholder={
                t('pages.settings.security.apiTokenNamePlaceholder') || 'e.g. central-panel-a'
              }
              onChange={(e) => setCreateName(e.target.value)}
              onPressEnter={confirmCreateToken}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!createdToken}
        title={t('pages.settings.security.apiTokenCreatedTitle') || 'Token created'}
        okText={t('done')}
        onOk={() => setCreatedToken(null)}
        onCancel={() => setCreatedToken(null)}
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <p className="api-token-created-notice">
          {t('pages.settings.security.apiTokenCreatedNotice') ||
            'Copy this token now. For security it is not stored in readable form and will not be shown again.'}
        </p>
        <div className="api-token-value-wrap">
          <code className="api-token-value">{createdToken?.token}</code>
          <Button
            size="small"
            type="primary"
            onClick={() => createdToken && copyToken(createdToken.token)}
          >
            {t('copy')}
          </Button>
        </div>
      </Modal>

      <TwoFactorModal
        open={tfa.open}
        title={tfa.title}
        description={tfa.description}
        token={tfa.token}
        type={tfa.type}
        onConfirm={onTfaConfirm}
        onOpenChange={(open) => setTfa((prev) => ({ ...prev, open }))}
      />
    </>
  );
}
