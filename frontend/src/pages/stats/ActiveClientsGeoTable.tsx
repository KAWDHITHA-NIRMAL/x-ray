import { useMemo, useState } from 'react';
import { Button, Input, Select, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileTextOutlined,
  SearchOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import type { ClientConnection } from './types';
import CountryFlag from './CountryFlag';
import { SizeFormatter } from '@/utils';

interface ActiveClientsGeoTableProps {
  connections: ClientConnection[];
  selectedCountry?: string;
  onSelectCountry?: (countryCode: string | undefined) => void;
  onViewClient?: (connection: ClientConnection) => void;
  className?: string;
}

export default function ActiveClientsGeoTable({
  connections,
  selectedCountry,
  onSelectCountry,
  onViewClient,
  className = '',
}: ActiveClientsGeoTableProps) {
  const [searchText, setSearchText] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');

  // Filter connections by search, protocol, and country
  const filteredConnections = useMemo(() => {
    return connections.filter((c) => {
      if (selectedCountry && c.countryCode !== selectedCountry) return false;
      if (protocolFilter !== 'ALL' && c.protocol.toUpperCase() !== protocolFilter) return false;

      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        const matchEmail = c.clientEmail.toLowerCase().includes(query);
        const matchCountry = c.country.toLowerCase().includes(query);
        const matchCity = c.city.toLowerCase().includes(query);
        const matchIp = c.clientIp.includes(query);
        const matchIsp = c.isp.toLowerCase().includes(query);
        const matchInbound = c.inboundTag.toLowerCase().includes(query);
        if (!matchEmail && !matchCountry && !matchCity && !matchIp && !matchIsp && !matchInbound) {
          return false;
        }
      }

      return true;
    });
  }, [connections, selectedCountry, protocolFilter, searchText]);

  // Unique country list for quick pills
  const countryList = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>();
    connections.forEach((c) => {
      const existing = map.get(c.countryCode);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(c.countryCode, { code: c.countryCode, name: c.country, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [connections]);

  const columns: ColumnsType<ClientConnection> = [
    {
      title: 'Country Location',
      key: 'country',
      width: 180,
      render: (_, record) => (
        <div
          className="cell-country-loc"
          onClick={() =>
            onSelectCountry?.(selectedCountry === record.countryCode ? undefined : record.countryCode)
          }
          style={{ cursor: 'pointer' }}
          title={`Filter by ${record.country}`}
        >
          <CountryFlag
            countryCode={record.countryCode}
            countryName={record.country}
            size={22}
          />
          <div className="loc-text">
            <span className="loc-name">{record.country}</span>
            <span className="loc-city">{record.city}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Client / Inbound',
      key: 'client',
      width: 240,
      render: (_, record) => (
        <div className="cell-client-info">
          <div className="client-email" title={record.clientEmail}>
            <strong>{record.clientEmail}</strong>
          </div>
          <div className="client-sub-meta">
            <span className="client-ip">{record.clientIp}</span>
            <span className="client-sep">·</span>
            <span className="client-isp" title={record.isp}>{record.isp}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Protocol',
      key: 'protocol',
      width: 120,
      render: (_, record) => (
        <div className="cell-protocol">
          <Tag color="cyan">{record.protocol}</Tag>
          <span className="port-tag">:{record.port}</span>
        </div>
      ),
    },
    {
      title: 'Storage / Traffic',
      key: 'storage',
      width: 140,
      render: (_, record) => (
        <div className="cell-traffic">
          <span className="traffic-total">{SizeFormatter.sizeFormat(record.totalBytes)}</span>
          <span className="traffic-split">
            ↑{SizeFormatter.sizeFormat(record.upBytes)} ↓{SizeFormatter.sizeFormat(record.downBytes)}
          </span>
        </div>
      ),
    },
    {
      title: 'Server Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        let pillClass = 'status-pill-active';
        let label = 'ACTIVE';

        if (record.status === 'IDLE') {
          pillClass = 'status-pill-trouble';
          label = 'TROUBLE';
        } else if (record.status === 'DOWN') {
          pillClass = 'status-pill-down';
          label = 'DOWN';
        }

        return <span className={`status-pill ${pillClass}`}>{label}</span>;
      },
    },
    {
      title: 'Page Load / Ping',
      key: 'latency',
      width: 110,
      render: (_, record) => {
        const ping = record.latencyMs;
        const color = ping < 50 ? '#10b981' : ping < 150 ? '#f59e0b' : '#ef4444';
        return (
          <span className="cell-latency" style={{ color }}>
            {ping} ms
          </span>
        );
      },
    },
    {
      title: 'Signal',
      key: 'signal',
      width: 80,
      render: (_, record) => {
        const bars = record.signalBars;
        const color = bars >= 4 ? '#10b981' : bars >= 3 ? '#3b82f6' : '#f59e0b';
        return (
          <Tooltip title={`Signal Strength: ${bars}/4`}>
            <span className="cell-signal" style={{ color }}>
              <WifiOutlined />
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Report / Details',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Button
          size="small"
          type="text"
          className="btn-client-report"
          icon={<FileTextOutlined />}
          onClick={() => onViewClient?.(record)}
        >
          client_view
        </Button>
      ),
    },
  ];

  return (
    <div className={`active-clients-table-card ${className}`}>
      {/* Top Controls */}
      <div className="table-header-bar">
        <div className="table-title-area">
          <h3 className="table-title">Active Server & Client Locations</h3>
          <span className="table-badge-pill">{filteredConnections.length} Active Records</span>
        </div>

        <div className="table-filter-bar">
          <Input
            placeholder="Search client, IP, ISP..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="filter-search-input"
            allowClear
          />

          <Select
            value={protocolFilter}
            onChange={setProtocolFilter}
            className="filter-protocol-select"
            options={[
              { label: 'All Protocols', value: 'ALL' },
              { label: 'VLESS', value: 'VLESS' },
              { label: 'VMess', value: 'VMESS' },
              { label: 'Trojan', value: 'TROJAN' },
              { label: 'Shadowsocks', value: 'SHADOWSOCKS' },
            ]}
          />
        </div>
      </div>

      {/* Country Pills Filter Row */}
      <div className="country-pills-row">
        <button
          type="button"
          className={`country-pill ${!selectedCountry ? 'active' : ''}`}
          onClick={() => onSelectCountry?.(undefined)}
        >
          All Countries ({connections.length})
        </button>
        {countryList.map((c) => (
          <button
            key={c.code}
            type="button"
            className={`country-pill ${selectedCountry === c.code ? 'active' : ''}`}
            onClick={() => onSelectCountry?.(selectedCountry === c.code ? undefined : c.code)}
          >
            <CountryFlag countryCode={c.code} countryName={c.name} size={16} />
            <span>{c.name}</span>
            <span className="pill-count">{c.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrap">
        <Table
          columns={columns}
          dataSource={filteredConnections}
          rowKey="id"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          size="middle"
          scroll={{ x: 900 }}
        />
      </div>
    </div>
  );
}
