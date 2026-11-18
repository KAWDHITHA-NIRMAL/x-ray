import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Modal, Switch, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  GithubOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import { HttpUtil, PromiseUtil } from '@/utils';
import { formatPanelVersion } from '@/lib/panel-version';
import type { PanelUpdateStatus } from '@/generated/types';
import './PanelUpdateModal.css';

type UpdateOutcome = 'success' | 'failed' | 'timeout';

export interface PanelUpdateInfo {
  channel?: string;
  currentVersion: string;
  latestVersion: string;
  currentCommit?: string;
  latestCommit?: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  releaseNotes?: string;
}

interface BusyEvent {
  busy: boolean;
  tip?: string;
}

interface PanelUpdateModalProps {
  open: boolean;
  info: PanelUpdateInfo;
  devChannelEnable?: boolean;
  onChannelChange?: (dev: boolean) => void | Promise<void>;
  onClose: () => void;
  onBusy: (e: BusyEvent) => void;
}

export default function PanelUpdateModal({
  open,
  info,
  devChannelEnable,
  onChannelChange,
  onClose,
  onBusy,
}: PanelUpdateModalProps) {
  const { t } = useTranslation();
  const [modal, contextHolder] = Modal.useModal();
  const [channelBusy, setChannelBusy] = useState(false);
  const [liveInfo, setLiveInfo] = useState<PanelUpdateInfo>(info);
  const [fetchingUpdate, setFetchingUpdate] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    setLiveInfo((prev) => ({
      ...prev,
      ...info,
      currentVersion: info.currentVersion || window.XRAY_CUR_VER || 'v1.0.0',
    }));
  }, [info]);

  const isDev = liveInfo.channel === 'dev' || !!devChannelEnable;

  async function fetchUpdateInfo() {
    setFetchingUpdate(true);
    try {
      const res = await HttpUtil.get<PanelUpdateInfo>('/panel/api/server/getPanelUpdateInfo');
      if (res?.success && res.obj) {
        const serverObj = res.obj;
        setLiveInfo((prev) => ({
          ...prev,
          ...serverObj,
          currentVersion: serverObj.currentVersion || window.XRAY_CUR_VER || 'v1.0.0',
        }));
      }

      // Check GitHub releases API for latest release info
      try {
        const ghRes = await fetch(
          'https://api.github.com/repos/KAWDHITHA-NIRMAL/x-ray/releases/latest',
          { headers: { Accept: 'application/vnd.github.v3+json' } },
        );
        if (ghRes.ok) {
          const rel = await ghRes.json();
          const ghTag = rel.tag_name || rel.name;
          if (ghTag) {
            setLiveInfo((prev) => {
              const cur = prev.currentVersion || window.XRAY_CUR_VER || 'v1.0.0';
              const cleanCur = cur.replace(/^v/, '');
              const cleanGh = ghTag.replace(/^v/, '');
              const isNewer = cleanGh !== cleanCur && cleanGh > cleanCur;
              return {
                ...prev,
                latestVersion: ghTag,
                updateAvailable: isNewer,
                releaseUrl: rel.html_url,
                releaseNotes: rel.name || rel.tag_name,
              };
            });
          }
        }
      } catch {
        /* GitHub offline or rate limited */
      }
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setFetchingUpdate(false);
    }
  }

  useEffect(() => {
    if (open) {
      fetchUpdateInfo();
    }
  }, [open]);

  async function pollUpdateStatus(expectedRunId: string): Promise<UpdateOutcome> {
    await PromiseUtil.sleep(5000);
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      try {
        const msg = await HttpUtil.get<PanelUpdateStatus>(
          '/panel/api/server/getUpdateStatus',
          undefined,
          { silent: true, timeout: 2000 },
        );
        const status = msg?.obj ?? undefined;
        if (status?.runId === expectedRunId) {
          if (status.state === 'success') return 'success';
          if (status.state === 'failed') return 'failed';
        }
      } catch {
        /* still restarting */
      }
      await PromiseUtil.sleep(2000);
    }
    return 'timeout';
  }

  async function handleChannel(checked: boolean) {
    if (!onChannelChange) return;
    setChannelBusy(true);
    try {
      await onChannelChange(checked);
      await fetchUpdateInfo();
    } finally {
      setChannelBusy(false);
    }
  }

  function updatePanel() {
    modal.confirm({
      title: t('pages.index.panelUpdateDialog'),
      content: t('pages.index.panelUpdateDialogDesc').replace(
        '#version#',
        liveInfo.latestVersion || '',
      ),
      okText: t('confirm'),
      cancelText: t('cancel'),
      onOk: async () => {
        const baseTip = t('pages.index.dontRefresh');
        const tip = liveInfo.latestVersion ? `${baseTip} (${liveInfo.latestVersion})` : baseTip;
        onClose();
        onBusy({ busy: true, tip });
        const result = await HttpUtil.post<{ runId: string }>('/panel/api/server/updatePanel');
        if (!result?.success) {
          onBusy({ busy: false });
          return;
        }
        const outcome = await pollUpdateStatus(result.obj?.runId ?? '');
        onBusy({ busy: false });
        if (outcome === 'success') {
          await PromiseUtil.sleep(800);
          window.location.reload();
          return;
        }
        modal[outcome === 'failed' ? 'error' : 'warning']({
          title: t(
            outcome === 'failed'
              ? 'pages.index.panelUpdateFailedTitle'
              : 'pages.index.panelUpdateUnknownTitle',
          ),
          content: t(
            outcome === 'failed'
              ? 'pages.index.panelUpdateFailedDesc'
              : 'pages.index.panelUpdateUnknownDesc',
          ),
          okText: t('refresh'),
          onOk: () => window.location.reload(),
        });
      },
    });
  }

  const curVer = formatPanelVersion(window.XRAY_CUR_VER || liveInfo.currentVersion) || 'v1.0.0';

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        title={
          <div className="update-modal-title">
            <span>{t('pages.index.updatePanel') || 'Panel Updates'}</span>
            {lastChecked && (
              <span className="update-checked-time">
                {t('lastChecked') || 'Checked'}: {lastChecked}
              </span>
            )}
          </div>
        }
        footer={null}
        onCancel={onClose}
        className="panel-update-dialog"
      >
        {liveInfo.updateAvailable && (
          <Alert
            type="warning"
            className="mb-12"
            title={t('pages.index.panelUpdateDesc')}
            showIcon
          />
        )}

        <div className="version-list">
          <div className="version-list-item">
            <span>{t('pages.index.devChannel')}</span>
            <Switch checked={!!devChannelEnable} loading={channelBusy} onChange={handleChannel} />
          </div>
        </div>

        {devChannelEnable && (
          <Alert
            type="info"
            className="mb-12"
            title={t('pages.index.devChannelWarning')}
            showIcon
          />
        )}

        <div className="version-list mt-12">
          <div className="version-list-item">
            <span>
              {isDev ? t('pages.index.currentCommit') : t('pages.index.currentPanelVersion')}
            </span>
            {isDev ? (
              <Tag color="green">{liveInfo.currentCommit || '0686940'}</Tag>
            ) : (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                {curVer}
              </Tag>
            )}
          </div>
          {liveInfo.updateAvailable ? (
            <div className="version-list-item">
              <span>
                {isDev ? t('pages.index.latestCommit') : t('pages.index.latestPanelVersion')}
              </span>
              <Tag color="purple">
                {(isDev ? liveInfo.latestCommit : liveInfo.latestVersion) || 'v1.0.0'}
              </Tag>
            </div>
          ) : (
            <div className="version-list-item">
              <span>{t('pages.index.panelUpToDate')}</span>
              <Tag color="green" icon={<CheckCircleOutlined />}>
                {curVer} {t('pages.index.panelUpToDate')}
              </Tag>
            </div>
          )}
        </div>

        {liveInfo.releaseUrl && (
          <div className="release-link-row mt-12">
            <a
              href={liveInfo.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="release-link-btn"
            >
              <GithubOutlined />
              <span>{t('viewReleaseNotes') || 'View GitHub Release Notes'}</span>
            </a>
          </div>
        )}

        <div className="actions-row mt-16">
          <Button
            icon={<ReloadOutlined spin={fetchingUpdate} />}
            loading={fetchingUpdate}
            onClick={fetchUpdateInfo}
          >
            {t('refresh') || 'Check for Updates'}
          </Button>

          <Button
            type="primary"
            disabled={!liveInfo.updateAvailable}
            onClick={updatePanel}
            icon={<CloudDownloadOutlined />}
          >
            {t('pages.index.updatePanel')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
