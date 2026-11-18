import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  ConfigProvider,
  Layout,
  Button,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  InputNumber,
  Popconfirm,
  message,
  Space,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  ImportOutlined,
  ReloadOutlined,
  SearchOutlined,
  CopyOutlined,
  SendOutlined,
  EditOutlined,
  DeleteOutlined,
  GlobalOutlined,
} from '@ant-design/icons';

import AppSidebar from '@/layouts/AppSidebar';
import { useTheme } from '@/hooks/useTheme';
import {
  type ISPPackage,
  type IspKey,
  type CategoryKey,
  getStoredPackages,
  addCustomPackage,
  updatePackage,
  deletePackage,
  resetPackagesToDefault,
} from '@/lib/isp/isp-packages';
import { getIspLogo, getServiceIcon, ISP_LOGOS } from '@/lib/isp/isp-data';
import { parseProxyConfigLink } from '@/lib/isp/config-parser';
import './PackagesPage.css';

export default function PackagesPage() {
  const { isDark, isUltra, antdThemeConfig } = useTheme();
  const navigate = useNavigate();

  const [packages, setPackages] = useState<ISPPackage[]>(() => getStoredPackages());
  const [selectedIsp, setSelectedIsp] = useState<IspKey | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<ISPPackage | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const [form] = Form.useForm();

  const reloadPackages = useCallback(() => {
    setPackages(getStoredPackages());
  }, []);

  const handleReset = useCallback(() => {
    const def = resetPackagesToDefault();
    setPackages(def);
    message.success('Packages reset to system defaults');
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deletePackage(id);
      reloadPackages();
      message.success('Package deleted');
    },
    [reloadPackages],
  );

  const handleOpenAdd = () => {
    setEditingPkg(null);
    form.resetFields();
    form.setFieldsValue({
      isp: 'dialog',
      ispName: 'Dialog',
      category: 'zoom',
      categoryName: 'Zoom / Video',
      protocol: 'vless',
      port: 443,
      network: 'ws',
      security: 'tls',
      path: '/gigaray',
      fp: 'chrome',
    });
    setAddEditModalOpen(true);
  };

  const handleOpenEdit = (pkg: ISPPackage) => {
    setEditingPkg(pkg);
    form.setFieldsValue(pkg);
    setAddEditModalOpen(true);
  };

  const handleSavePackage = async () => {
    try {
      const values = await form.validateFields();
      const ispNameMap: Record<IspKey, string> = {
        dialog: 'Dialog',
        slt: 'SLT Fiber',
        'slt-mobitel': 'SLT-Mobitel',
        mobitel: 'Mobitel',
        airtel: 'Airtel',
        hutch: 'Hutch',
        all: 'Universal / All Networks',
      };
      const catNameMap: Record<CategoryKey, string> = {
        zoom: 'Zoom / Video',
        youtube: 'YouTube',
        tiktok: 'TikTok',
        netflix: 'Netflix',
        social: 'Social Media',
        freedom: 'Bypass / Freedom',
        custom: 'Custom SNI',
      };

      const payload = {
        ...values,
        ispName: ispNameMap[values.isp as IspKey] || values.isp,
        categoryName: catNameMap[values.category as CategoryKey] || values.category,
      };

      if (editingPkg) {
        updatePackage({ ...editingPkg, ...payload });
        message.success('Package updated successfully');
      } else {
        addCustomPackage(payload);
        message.success('Custom SNI package added successfully');
      }
      setAddEditModalOpen(false);
      reloadPackages();
    } catch {
      // validation error
    }
  };

  const handleImportLink = () => {
    const parsed = parseProxyConfigLink(importText);
    if (!parsed) {
      message.error('Invalid or unsupported proxy link format. Supports vless://, vmess://, trojan://');
      return;
    }

    // Guess ISP & category from SNI or remark
    let detectedIsp: IspKey = 'all';
    let detectedCat: CategoryKey = 'custom';
    const lowerRemark = parsed.remark.toLowerCase();
    const lowerSni = parsed.sni.toLowerCase();

    if (lowerRemark.includes('dialog') || lowerSni.includes('aka.ms')) {
      detectedIsp = 'dialog';
    } else if (
      (lowerRemark.includes('mobitel') && (lowerRemark.includes('slt') || lowerRemark.includes('telecom'))) ||
      lowerRemark.includes('slt-mobitel')
    ) {
      detectedIsp = 'slt-mobitel';
    } else if (
      lowerRemark.includes('fiber') ||
      lowerRemark.includes('fibre') ||
      lowerRemark.includes('slt') ||
      lowerRemark.includes('adsl')
    ) {
      detectedIsp = 'slt';
    } else if (lowerRemark.includes('mobitel')) {
      detectedIsp = 'slt-mobitel';
    } else if (lowerRemark.includes('airtel')) {
      detectedIsp = 'airtel';
    } else if (lowerRemark.includes('hutch')) {
      detectedIsp = 'hutch';
    }

    if (lowerSni.includes('zoom') || lowerSni.includes('teams') || lowerSni.includes('webex')) {
      detectedCat = 'zoom';
    } else if (lowerSni.includes('youtube')) {
      detectedCat = 'youtube';
    } else if (lowerSni.includes('tiktok')) {
      detectedCat = 'tiktok';
    } else if (lowerSni.includes('netflix')) {
      detectedCat = 'netflix';
    } else if (lowerSni.includes('whatsapp') || lowerSni.includes('telegram') || lowerSni.includes('t.me')) {
      detectedCat = 'social';
    }

    const ispNameMap: Record<IspKey, string> = {
      dialog: 'Dialog',
      slt: 'SLT Fiber',
      'slt-mobitel': 'SLT-Mobitel',
      mobitel: 'Mobitel',
      airtel: 'Airtel',
      hutch: 'Hutch',
      all: 'Universal / All Networks',
    };

    addCustomPackage({
      name: parsed.remark || `${ispNameMap[detectedIsp]} Custom SNI`,
      isp: detectedIsp,
      ispName: ispNameMap[detectedIsp],
      category: detectedCat,
      categoryName: detectedCat.toUpperCase(),
      protocol: parsed.protocol,
      port: parsed.port,
      network: parsed.network,
      security: parsed.security,
      sni: parsed.sni,
      path: parsed.path,
      host: parsed.host,
      headerType: parsed.headerType,
      alpn: parsed.alpn,
      fp: parsed.fp,
      extra: parsed.extra,
      notes: `Imported from config (${parsed.protocol.toUpperCase()} Port ${parsed.port})`,
    });

    setImportModalOpen(false);
    setImportText('');
    reloadPackages();
    message.success('Imported package saved successfully');
  };

  const handleCreateInboundFromPkg = (pkg: ISPPackage) => {
    // Navigate to inbounds page with preselected package param
    navigate(`/inbounds?applyPackage=${encodeURIComponent(pkg.id)}`);
  };

  const filteredPackages = useMemo(() => {
    return packages.filter((p) => {
      if (selectedIsp !== 'all') {
        if (selectedIsp === 'slt' && p.isp !== 'slt') return false;
        if (selectedIsp === 'slt-mobitel' && p.isp !== 'slt-mobitel' && p.isp !== 'mobitel') return false;
        if (selectedIsp !== 'slt' && selectedIsp !== 'slt-mobitel' && p.isp !== selectedIsp) return false;
      }
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSni = (p.sni || '').toLowerCase().includes(q);
        const matchNotes = (p.notes || '').toLowerCase().includes(q);
        const matchIsp = p.ispName.toLowerCase().includes(q);
        if (!matchName && !matchSni && !matchNotes && !matchIsp) return false;
      }
      return true;
    });
  }, [packages, selectedIsp, selectedCategory, searchQuery]);

  const pageClass = `packages-page${isDark ? ' is-dark' : ''}${isUltra ? ' is-ultra' : ''}`;

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className={pageClass}>
        <AppSidebar />

        <Layout className="content-shell">
          <Layout.Content className="content-area">
            {/* Header Bar */}
            <div className="packages-header-bar">
              <div className="packages-title-block">
                <h1>ISP & SNI Packages</h1>
                <p>
                  Pre-configured and custom Sri Lankan ISP SNI profiles, bypass rules & transport presets
                </p>
              </div>

              <div className="packages-actions-row">
                <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd}>
                  Add Custom SNI
                </Button>
                <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)}>
                  Import from Link
                </Button>
                <Popconfirm
                  title="Reset to Defaults?"
                  description="This will restore standard ISP package configurations."
                  onConfirm={handleReset}
                  okText="Reset"
                  cancelText="Cancel"
                >
                  <Button icon={<ReloadOutlined />}>Reset Defaults</Button>
                </Popconfirm>
              </div>
            </div>

            {/* Filters Card */}
            <div className="packages-filter-card">
              {/* Top row: ISP selector + Search + Port 443 toggle */}
              <div className="filter-row-top">
                <div className="isp-tabs">
                  {(
                    [
                      { key: 'all', label: 'All Networks' },
                      { key: 'dialog', label: 'Dialog', img: ISP_LOGOS.dialog },
                      { key: 'slt', label: 'SLT Fiber', img: ISP_LOGOS.slt || ISP_LOGOS['slt-mobitel'] },
                      { key: 'slt-mobitel', label: 'SLT-Mobitel', img: ISP_LOGOS['slt-mobitel'] },
                      { key: 'airtel', label: 'Airtel', img: ISP_LOGOS.airtel },
                      { key: 'hutch', label: 'Hutch', img: ISP_LOGOS.hutch },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`isp-tab-btn ${selectedIsp === tab.key ? 'active' : ''}`}
                      onClick={() => setSelectedIsp(tab.key)}
                    >
                      {'img' in tab && tab.img && <img src={tab.img} alt="" />}
                      {tab.label}
                    </button>
                  ))}
                </div>

                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Search package or SNI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  allowClear
                  style={{ width: 220 }}
                />
              </div>

              {/* Bottom row: Category Pills */}
              <div className="filter-row-sub">
                {(
                  [
                    { key: 'all', label: 'All Categories' },
                    { key: 'zoom', label: 'Zoom & Video' },
                    { key: 'youtube', label: 'YouTube' },
                    { key: 'tiktok', label: 'TikTok' },
                    { key: 'netflix', label: 'Netflix' },
                    { key: 'social', label: 'Social & Messaging' },
                    { key: 'freedom', label: 'Bypass / Freedom' },
                    { key: 'custom', label: 'Custom' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`category-pill ${selectedCategory === cat.key ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.key)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Packages Grid */}
            <div className="packages-grid">
              {filteredPackages.map((pkg) => {
                const ispLogo = getIspLogo(pkg.isp);
                const serviceIcon = getServiceIcon(pkg.category);
                const isPort443 = pkg.port === 443;

                return (
                  <div key={pkg.id} className="package-card">
                    <div>
                      {/* Top Row: Logos & Badges */}
                      <div className="package-card-header">
                        <div className="pkg-icon-group">
                          <div className="pkg-isp-logo">
                            {ispLogo ? (
                              <img src={ispLogo} alt={pkg.ispName} />
                            ) : (
                              <GlobalOutlined style={{ fontSize: 18, color: '#38bdf8' }} />
                            )}
                          </div>
                          {serviceIcon && (
                            <img src={serviceIcon} alt="" className="pkg-service-icon" />
                          )}
                        </div>

                        <div className="pkg-badges-row">
                          <span className={`pkg-pill-badge ${pkg.isp}`}>{pkg.ispName}</span>
                          <span className={`pkg-port-badge ${isPort443 ? 'port-443' : 'port-custom'}`}>
                            Port {pkg.port}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <div className="pkg-name-col" style={{ marginTop: 10 }}>
                        <div className="pkg-title" title={pkg.name}>
                          {pkg.name}
                        </div>
                      </div>

                      {/* Details Box */}
                      <div className="pkg-details-box" style={{ marginTop: 10 }}>
                        <div className="pkg-detail-line">
                          <span className="label">Protocol / Network</span>
                          <span className="val">
                            <Tag color="blue" style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}>
                              {pkg.protocol.toUpperCase()}
                            </Tag>
                            <Tag color="cyan" style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}>
                              {pkg.network.toUpperCase()}
                            </Tag>
                            <Tag
                              color={pkg.security === 'tls' ? 'green' : 'default'}
                              style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}
                            >
                              {pkg.security.toUpperCase()}
                            </Tag>
                          </span>
                        </div>

                        {pkg.sni && (
                          <div className="pkg-detail-line">
                            <span className="label">SNI Domain</span>
                            <span className="val">
                              <span className="pkg-sni-badge" title={pkg.sni}>
                                {pkg.sni}
                              </span>
                              <Tooltip title="Copy SNI">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => {
                                    navigator.clipboard.writeText(pkg.sni);
                                    message.success(`Copied: ${pkg.sni}`);
                                  }}
                                  style={{ padding: '0 4px', height: 20 }}
                                />
                              </Tooltip>
                            </span>
                          </div>
                        )}

                        {pkg.path && (
                          <div className="pkg-detail-line">
                            <span className="label">Path</span>
                            <span className="val" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                              {pkg.path}
                            </span>
                          </div>
                        )}

                        {pkg.frontAddress && (
                          <div className="pkg-detail-line">
                            <span className="label">Front Host / IP</span>
                            <span className="val" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                              {pkg.frontAddress}
                            </span>
                          </div>
                        )}

                        {pkg.notes && <div className="pkg-notes-text">{pkg.notes}</div>}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="package-card-footer">
                      <Button
                        type="primary"
                        size="small"
                        icon={<SendOutlined />}
                        onClick={() => handleCreateInboundFromPkg(pkg)}
                      >
                        Use in Inbound
                      </Button>

                      <Space size={4}>
                        <Tooltip title="Edit Package">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleOpenEdit(pkg)}
                          />
                        </Tooltip>

                        <Popconfirm
                          title="Delete Package"
                          description="Are you sure you want to delete this SNI package?"
                          onConfirm={() => handleDelete(pkg.id)}
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                          cancelText="Cancel"
                        >
                          <Tooltip title="Delete Package">
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add / Edit Package Modal */}
            <Modal
              title={editingPkg ? 'Edit SNI Package' : 'Add Custom SNI Package'}
              open={addEditModalOpen}
              onOk={handleSavePackage}
              onCancel={() => setAddEditModalOpen(false)}
              okText="Save Package"
              destroyOnClose
              width={540}
            >
              <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item
                  name="name"
                  label="Package Name"
                  rules={[{ required: true, message: 'Please enter a package name' }]}
                >
                  <Input placeholder="e.g. Dialog Zoom Office VIP" />
                </Form.Item>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Form.Item name="isp" label="ISP Provider" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: 'dialog', label: 'Dialog' },
                        { value: 'slt', label: 'SLT Fiber' },
                        { value: 'slt-mobitel', label: 'SLT-Mobitel' },
                        { value: 'airtel', label: 'Airtel' },
                        { value: 'hutch', label: 'Hutch' },
                        { value: 'all', label: 'Universal / All' },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item name="category" label="Category / App" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: 'zoom', label: 'Zoom & Video' },
                        { value: 'youtube', label: 'YouTube' },
                        { value: 'tiktok', label: 'TikTok' },
                        { value: 'netflix', label: 'Netflix' },
                        { value: 'social', label: 'Social & Messaging' },
                        { value: 'freedom', label: 'Bypass / Freedom' },
                        { value: 'custom', label: 'Custom' },
                      ]}
                    />
                  </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Form.Item name="protocol" label="Protocol" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: 'vless', label: 'VLESS' },
                        { value: 'vmess', label: 'VMess' },
                        { value: 'trojan', label: 'Trojan' },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item name="port" label="Port" rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} min={1} max={65535} />
                  </Form.Item>

                  <Form.Item name="network" label="Transport" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: 'ws', label: 'WebSocket (WS)' },
                        { value: 'tcp', label: 'RAW / TCP' },
                        { value: 'xhttp', label: 'XHTTP' },
                        { value: 'grpc', label: 'gRPC' },
                        { value: 'httpupgrade', label: 'HTTPUpgrade' },
                      ]}
                    />
                  </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Form.Item name="security" label="Security" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: 'tls', label: 'TLS' },
                        { value: 'reality', label: 'Reality' },
                        { value: 'none', label: 'None' },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item name="sni" label="SNI / ServerName">
                    <Input placeholder="e.g. aka.ms, zoom.us, youtube.com" />
                  </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Form.Item name="path" label="Path">
                    <Input placeholder="e.g. /gigaray or /" />
                  </Form.Item>

                  <Form.Item name="frontAddress" label="Front Address / IP Hunt">
                    <Input placeholder="e.g. 141.193.213.20 or support.zoom.us" />
                  </Form.Item>
                </div>

                <Form.Item name="notes" label="Notes / Description">
                  <Input.TextArea rows={2} placeholder="Optional notes about this ISP package rule" />
                </Form.Item>
              </Form>
            </Modal>

            {/* Import from Config Link Modal */}
            <Modal
              title="Import Package from Config Link"
              open={importModalOpen}
              onOk={handleImportLink}
              onCancel={() => {
                setImportModalOpen(false);
                setImportText('');
              }}
              okText="Parse & Save as Package"
              destroyOnClose
            >
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--pkg-sub)' }}>
                Paste any VLESS, VMess, or Trojan configuration link from another panel. The system will
                automatically extract the SNI, port, protocol, path, and security settings into a new
                package.
              </div>
              <Input.TextArea
                rows={4}
                placeholder="vless://uuid@host:443?type=ws&security=tls&sni=aka.ms&path=/cs#Dialog%20Zoom"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </Modal>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
