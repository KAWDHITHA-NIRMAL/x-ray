import { useTranslation } from 'react-i18next';
import { Button, Tag, Tooltip } from 'antd';
import {
  ApiOutlined,
  ArrowUpOutlined,
  AreaChartOutlined,
  BarsOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  ControlOutlined,
  FileTextOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import { formatPanelVersion } from '@/lib/panel-version';
import type { Status } from '@/models/status';

interface OverviewActionBarProps {
  status: Status;
  isMobile: boolean;
  accessLogEnable: boolean;
  panelVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  onStopXray: () => void;
  onRestartXray: () => void;
  onOpenLogs: () => void;
  onOpenXrayLogs: () => void;
  onOpenAmneziaWGLogs: () => void;
  onOpenConfig: () => void;
  onOpenBackup: () => void;
  onOpenSystemHistory: () => void;
  onOpenXrayMetrics: () => void;
  onOpenPanelUpdate: () => void;
  onOpenVersionSwitch: () => void;
}

const XRAY_STATE_KEYS: Record<string, string> = {
  running: 'pages.index.xrayStatusRunning',
  stop: 'pages.index.xrayStatusStop',
  error: 'pages.index.xrayStatusError',
};

export default function OverviewActionBar({
  status,
  isMobile,
  accessLogEnable,
  panelVersion,
  latestVersion,
  updateAvailable,
  onStopXray,
  onRestartXray,
  onOpenLogs,
  onOpenXrayLogs,
  onOpenAmneziaWGLogs,
  onOpenConfig,
  onOpenBackup,
  onOpenSystemHistory,
  onOpenXrayMetrics,
  onOpenPanelUpdate,
  onOpenVersionSwitch,
}: OverviewActionBarProps) {
  const { t } = useTranslation();
  const stateLabel =
    status.xray.state === 'running'
      ? 'Online'
      : status.xray.state === 'stop'
        ? 'Offline'
        : t(XRAY_STATE_KEYS[status.xray.state] ?? 'pages.index.xrayStatusUnknown');
  const size = isMobile ? ('small' as const) : ('middle' as const);

  const statePill = (
    <span
      className="ov-state ov-state-interactive"
      data-state={status.xray.state}
      onClick={onOpenVersionSwitch}
      role="button"
      tabIndex={0}
      title={t('pages.index.xraySwitch') || 'Xray Core Versions & Geodata'}
    >
      <span className="ov-state-dot" style={{ color: status.xray.color }} />
      <span>{`Xray · ${stateLabel}`}</span>
    </span>
  );

  return (
    <div className="ov-bar">
      {status.xray.errorMsg ? (
        <Tooltip title={<span className="ov-error-detail">{status.xray.errorMsg}</span>}>
          {statePill}
        </Tooltip>
      ) : (
        statePill
      )}

      {status.xray.state === 'running' && status.xray.errorMsg ? (
        <Tooltip title={<span className="ov-error-detail">{status.xray.errorMsg}</span>}>
          <Tag color="error">{t('pages.index.xrayStatusError')}</Tag>
        </Tooltip>
      ) : null}

      {updateAvailable ? (
        <Tag
          className="ov-update-tag"
          color="warning"
          icon={<CloudDownloadOutlined />}
          onClick={onOpenPanelUpdate}
        >
          {`${t('update')} ${formatPanelVersion(latestVersion)}`}
        </Tag>
      ) : (
        <Tooltip title={t('pages.index.updatePanel') || 'Check for Panel Updates'}>
          <button type="button" className="ov-panel-version ov-mono" onClick={onOpenPanelUpdate}>
            <span className="ov-panel-pill">
              <CloudDownloadOutlined className="ov-panel-icon" />
              <span className="ov-panel-tag-text">{formatPanelVersion(panelVersion) || 'v1.0.0'}</span>
            </span>
          </button>
        </Tooltip>
      )}

      <div className="ov-bar-actions">
        {/* Service Controls: Restart & Stop */}
        <div className="ov-action-group ov-service-group">
          <Button
            type="primary"
            size={size}
            icon={<ReloadOutlined />}
            onClick={onRestartXray}
            className="ov-btn-restart"
          >
            {isMobile ? undefined : t('pages.index.restartXray')}
          </Button>
          <Button
            danger
            type="text"
            size={size}
            icon={<PoweroffOutlined />}
            onClick={onStopXray}
            className="ov-btn-stop"
          >
            {isMobile ? undefined : t('pages.index.stopXray')}
          </Button>
        </div>

        {/* System Tools: Logs, Config, Backup */}
        <div className="ov-action-group">
          <Tooltip title={t('pages.index.logs')} placement="bottom">
            <Button
              type="text"
              size={size}
              icon={<BarsOutlined />}
              aria-label={t('pages.index.logs')}
              onClick={onOpenLogs}
            />
          </Tooltip>
          {accessLogEnable && (
            <Tooltip title={t('pages.index.accessLogs')} placement="bottom">
              <Button
                type="text"
                size={size}
                icon={<FileTextOutlined />}
                aria-label={t('pages.index.accessLogs')}
                onClick={onOpenXrayLogs}
              />
            </Tooltip>
          )}
          {status.amneziawg.configured && (
            <Tooltip title={t('pages.index.amneziawgLogs')} placement="bottom">
              <Button
                type="text"
                size={size}
                icon={<ApiOutlined />}
                aria-label={t('pages.index.amneziawgLogs')}
                onClick={onOpenAmneziaWGLogs}
              />
            </Tooltip>
          )}
          <Tooltip title={t('pages.index.config')} placement="bottom">
            <Button
              type="text"
              size={size}
              icon={<ControlOutlined />}
              aria-label={t('pages.index.config')}
              onClick={onOpenConfig}
            />
          </Tooltip>
          <Tooltip title={t('pages.index.backupTitle')} placement="bottom">
            <Button
              type="text"
              size={size}
              icon={<CloudServerOutlined />}
              aria-label={t('pages.index.backupTitle')}
              onClick={onOpenBackup}
            />
          </Tooltip>
        </div>

        {/* Observability: History & Metrics */}
        <div className="ov-action-group">
          <Tooltip title={t('pages.index.systemHistoryTitle')} placement="bottom">
            <Button
              type="text"
              size={size}
              icon={<AreaChartOutlined />}
              aria-label={t('pages.index.systemHistoryTitle')}
              onClick={onOpenSystemHistory}
            />
          </Tooltip>
          <Tooltip title={t('pages.index.xrayMetricsTitle')} placement="bottom">
            <Button
              type="text"
              size={size}
              icon={<ArrowUpOutlined />}
              aria-label={t('pages.index.xrayMetricsTitle')}
              onClick={onOpenXrayMetrics}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
