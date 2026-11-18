import { useTranslation } from 'react-i18next';
import { Card, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  DatabaseOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GlobalOutlined,
} from '@ant-design/icons';

import { SizeFormatter, TimeFormatter } from '@/utils';
import { activateOnKey } from '@/utils/a11y';
import type { Status } from '@/models/status';

interface SystemStripProps {
  status: Status;
  showIp: boolean;
  onToggleIp: () => void;
}

export default function SystemStrip({ status, showIp, onToggleIp }: SystemStripProps) {
  const { t } = useTranslation();

  const ipv4 = status.publicIP?.ipv4 && status.publicIP.ipv4 !== 0 ? String(status.publicIP.ipv4) : '-';
  const ipv6 = status.publicIP?.ipv6 && status.publicIP.ipv6 !== 0 ? String(status.publicIP.ipv6) : '';

  return (
    <Card hoverable styles={{ body: { padding: 0 } }}>
      <div className="ov-strip-grid">
        {/* Cell 1: Uptime */}
        <div className="ov-strip-cell">
          <div className="ov-kicker ov-kicker-icon">
            <ClockCircleOutlined />
            <span>{t('pages.index.uptime')}</span>
          </div>
          <div className="ov-strip-split">
            <div>
              <div className="ov-strip-sub">Xray</div>
              <div className="ov-strip-value">
                {TimeFormatter.formatSecond(status.appStats?.uptime || 0)}
              </div>
            </div>
            <span className="ov-strip-split-sep" />
            <div>
              <div className="ov-strip-sub">OS</div>
              <div className="ov-strip-value">{TimeFormatter.formatSecond(status.uptime)}</div>
            </div>
          </div>
        </div>

        {/* Cell 2: Panel Runtime */}
        <div className="ov-strip-cell">
          <div className="ov-kicker ov-kicker-icon">
            <DatabaseOutlined />
            <span>{t('pages.index.panel')}</span>
          </div>
          <div className="ov-strip-split">
            <div>
              <div className="ov-strip-sub">{t('pages.index.memory')}</div>
              <div className="ov-strip-value">
                {SizeFormatter.sizeFormat(status.appStats?.mem || 0)}
              </div>
            </div>
            <span className="ov-strip-split-sep" />
            <div>
              <div className="ov-strip-sub">{t('pages.index.threads')}</div>
              <div className="ov-strip-value">{status.appStats?.threads || 0}</div>
            </div>
          </div>
        </div>

        {/* Cell 3: IP Addresses */}
        <div className="ov-strip-cell">
          <div className="ov-kicker ov-kicker-icon">
            <GlobalOutlined />
            <span>{t('pages.index.ipAddresses')}</span>
            <Tooltip title={t('pages.index.toggleIpVisibility')}>
              {showIp ? (
                <EyeOutlined
                  className="ip-toggle-icon"
                  role="button"
                  tabIndex={0}
                  aria-label={t('pages.index.toggleIpVisibility')}
                  onClick={onToggleIp}
                  onKeyDown={activateOnKey(onToggleIp)}
                />
              ) : (
                <EyeInvisibleOutlined
                  className="ip-toggle-icon"
                  role="button"
                  tabIndex={0}
                  aria-label={t('pages.index.toggleIpVisibility')}
                  onClick={onToggleIp}
                  onKeyDown={activateOnKey(onToggleIp)}
                />
              )}
            </Tooltip>
          </div>
          <div className={`ov-ip${showIp ? '' : ' ip-hidden'}`}>
            <div className="ov-mono">{ipv4}</div>
            {ipv6 && <div className="ov-mono ov-ip-v6">{ipv6}</div>}
          </div>
        </div>
      </div>
    </Card>
  );
}
