import { Button, Modal, Tag, Tooltip, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import type { ClientConnection } from './types';
import CountryFlag from './CountryFlag';
import { ClipboardManager, SizeFormatter } from '@/utils';

interface ClientDetailModalProps {
  connection: ClientConnection | null;
  open: boolean;
  onClose: () => void;
}

export default function ClientDetailModal({
  connection,
  open,
  onClose,
}: ClientDetailModalProps) {
  if (!connection) return null;

  const copyConfig = async () => {
    if (connection.clientConfig) {
      await ClipboardManager.copyText(connection.clientConfig);
      message.success('Client config link copied to clipboard!');
    }
  };

  const copyIp = async () => {
    await ClipboardManager.copyText(connection.clientIp);
    message.success('Client IP copied!');
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CountryFlag
            countryCode={connection.countryCode}
            countryName={connection.country}
            size={24}
          />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{connection.clientEmail}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {connection.city}, {connection.country}
            </div>
          </div>
        </div>
      }
      width={560}
      destroyOnClose
    >
      <div className="client-detail-sheet">
        {/* Status & KPI Pills */}
        <div className="detail-status-grid">
          <div className="detail-status-tile">
            <span className="tile-label">Status</span>
            <Tag color={connection.status === 'ACTIVE' ? 'success' : 'warning'}>
              ● {connection.status}
            </Tag>
          </div>
          <div className="detail-status-tile">
            <span className="tile-label">Ping / Latency</span>
            <span className="tile-val highlight-green">{connection.latencyMs} ms</span>
          </div>
          <div className="detail-status-tile">
            <span className="tile-label">Protocol</span>
            <Tag color="blue">{connection.protocol} ({connection.port})</Tag>
          </div>
          <div className="detail-status-tile">
            <span className="tile-label">Connected</span>
            <span className="tile-val">{connection.connectedDuration}</span>
          </div>
        </div>

        {/* IP & ISP Info */}
        <div className="detail-section">
          <h4>Origin & Network Location</h4>
          <div className="detail-row">
            <span className="row-key">Client Public IP:</span>
            <span className="row-val">
              <code>{connection.clientIp}</code>
              <Tooltip title="Copy IP">
                <Button size="small" type="text" icon={<CopyOutlined />} onClick={copyIp} />
              </Tooltip>
            </span>
          </div>
          <div className="detail-row">
            <span className="row-key">Telecom / ISP:</span>
            <span className="row-val">{connection.isp}</span>
          </div>
          <div className="detail-row">
            <span className="row-key">Target Inbound:</span>
            <span className="row-val">
              <strong>{connection.inboundTag}</strong>
            </span>
          </div>
        </div>

        {/* Bandwidth Usage Breakdown */}
        <div className="detail-section">
          <h4>Bandwidth Usage</h4>
          <div className="detail-bandwidth-cards">
            <div className="bw-card">
              <span className="bw-type">Upload (↑)</span>
              <span className="bw-num">{SizeFormatter.sizeFormat(connection.upBytes)}</span>
            </div>
            <div className="bw-card">
              <span className="bw-type">Download (↓)</span>
              <span className="bw-num">{SizeFormatter.sizeFormat(connection.downBytes)}</span>
            </div>
            <div className="bw-card bw-total">
              <span className="bw-type">Total Volume</span>
              <span className="bw-num">{SizeFormatter.sizeFormat(connection.totalBytes)}</span>
            </div>
          </div>
        </div>

        {/* Config Link */}
        {connection.clientConfig && (
          <div className="detail-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>Connection URL</h4>
              <Button size="small" icon={<CopyOutlined />} onClick={copyConfig}>
                Copy Config
              </Button>
            </div>
            <div className="detail-config-box">
              <code>{connection.clientConfig}</code>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
