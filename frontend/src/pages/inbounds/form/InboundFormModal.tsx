import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { QuestionCircleOutlined, DownOutlined, ImportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  Alert,
  Button,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Tabs,
  Tooltip,
  message,
} from 'antd';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';

import { HttpUtil, NumberFormatter, RandomUtil, SizeFormatter, Wireguard } from '@/utils';
import type { RealityScanResult } from '@/generated/types';
import { rawInboundToFormValues, formValuesToWirePayload } from '@/lib/xray/inbound-form-adapter';
import { createDefaultInboundSettings } from '@/lib/xray/inbound-defaults';
import { generateAwgObfuscation } from '@/lib/xray/amneziawg-obfuscation';
import { composeInboundTag, isAutoInboundTag, type InboundTagInput } from '@/lib/xray/inbound-tag';
import {
  canEnableReality,
  canEnableSniffing,
  canEnableStream,
  canEnableTls,
  isSS2022,
} from '@/lib/xray/protocol-capabilities';
import {
  InboundDbFieldsSchema,
  InboundFormBaseSchema,
  InboundFormSchema,
  type InboundFormValues,
} from '@/schemas/forms/inbound-form';
import { FormField, rhfZodValidate } from '@/components/form/rhf';
import { Protocols, TRAFFIC_RESETS } from '@/schemas/primitives';
import { SockoptStreamSettingsSchema } from '@/schemas/protocols/stream/sockopt';
import { HysteriaStreamSettingsSchema } from '@/schemas/protocols/stream/hysteria';
import { createHysteriaTlsSettingsWithDefaultCert } from '@/lib/xray/inbound-tls-defaults';
import { NODE_ELIGIBLE_PROTOCOLS } from '@/lib/xray/node-protocols';
import { VLESS_AUTH_LABEL_KEYS, vlessEncryptionAuthKind } from '@/lib/xray/vless-encryption';
import { SniffingSchema } from '@/schemas/primitives/sniffing';
import { TcpStreamSettingsSchema } from '@/schemas/protocols/stream/tcp';
import { KcpStreamSettingsSchema } from '@/schemas/protocols/stream/kcp';
import { WsStreamSettingsSchema } from '@/schemas/protocols/stream/ws';
import { GrpcStreamSettingsSchema } from '@/schemas/protocols/stream/grpc';
import { HttpUpgradeStreamSettingsSchema } from '@/schemas/protocols/stream/httpupgrade';
import { XHttpStreamSettingsSchema } from '@/schemas/protocols/stream/xhttp';
import { DateTimePicker } from '@/components/form';
import { FinalMaskField } from '@/lib/xray/forms/fields';
import { getStoredPackages, type ISPPackage } from '@/lib/isp/isp-packages';
import { parseProxyConfigLink, stripEmojis } from '@/lib/isp/config-parser';
import { getIspLogo, getServiceIcon } from '@/lib/isp/isp-data';
import './InboundFormModal.css';

import { AdvancedAllEditor, AdvancedSliceEditor } from './advanced-editors';
import { formatInboundIssue, formatInboundValidation } from './formatValidationError';
import {
  AmneziawgFields,
  HttpFields,
  HysteriaFields,
  MixedFields,
  MtprotoFields,
  ShadowsocksFields,
  TuicFields,
  TunFields,
  TunnelFields,
  VlessFields,
  WireguardFields,
} from './protocols';
import {
  GrpcForm,
  HttpUpgradeForm,
  KcpForm,
  RawForm,
  SockoptForm,
  WsForm,
  XhttpForm,
} from './transport';
import { RealityForm, TlsForm } from './security';
import { useSecurityActions } from './useSecurityActions';
import { useInboundFallbacks } from './useInboundFallbacks';
import FallbacksCard from './FallbacksCard';
import SniffingTab from './SniffingTab';
import AccessTab from './AccessTab';

import type { DBInbound } from '@/models/dbinbound';
import type { NodeRecord } from '@/api/queries/useNodesQuery';

/* Render a field label with a hover tooltip icon instead of an `extra` help line below. */
const labelWithHint = (label: string, hint: string) => (
  <span>
    {label}
    <Tooltip title={hint}>
      <QuestionCircleOutlined style={{ marginInlineStart: 4, color: 'rgba(128,128,128,0.65)' }} />
    </Tooltip>
  </span>
);

const PROTOCOL_OPTIONS = Object.values(Protocols).map((p) => ({ value: p, label: p }));
const SHARE_ADDR_STRATEGIES = ['node', 'listen', 'custom'] as const;
const SHARE_ADDR_HOSTNAME_RE =
  /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/;

function isValidShareAddrInput(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return true;
  if (v.includes('://') || v.startsWith('//') || /[/?#@]/.test(v)) return false;
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) return false;
    try {
      new URL(`http://${v}`);
      return true;
    } catch {
      return false;
    }
  }
  if (v.includes(':')) {
    try {
      new URL(`http://[${v}]`);
      return true;
    } catch {
      return false;
    }
  }
  return SHARE_ADDR_HOSTNAME_RE.test(v);
}

interface RhfValidationIssue {
  path: PropertyKey[];
  message: string;
}

function firstRhfValidationIssue(
  value: unknown,
  path: PropertyKey[] = [],
): RhfValidationIssue | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  // `type` is what marks a react-hook-form leaf FieldError; anything else is a group.
  if ('type' in record) {
    return { path, message: typeof record.message === 'string' ? record.message : '' };
  }
  for (const key of Object.keys(record)) {
    const issue = firstRhfValidationIssue(record[key], [...path, key]);
    if (issue) return issue;
  }
  return null;
}

function tabForValidationPath(path: PropertyKey[]): string {
  if (path[0] === 'settings') return 'protocol';
  if (path[0] === 'sniffing') return 'sniffing';
  if (path[0] === 'access') return 'access';
  if (path[0] === 'streamSettings') {
    if (path[1] === 'security' || path[1] === 'realitySettings' || path[1] === 'tlsSettings')
      return 'security';
    return 'stream';
  }
  return 'basic';
}

interface InboundFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  mode: 'add' | 'edit';
  dbInbound: DBInbound | null;
  dbInbounds: DBInbound[];
  availableNodes?: NodeRecord[];
  availableNodesFetched?: boolean;
  initialPackage?: ISPPackage | null;
}

function buildAddModeValues(): InboundFormValues {
  const settings = createDefaultInboundSettings('vless') ?? undefined;
  return rawInboundToFormValues({
    protocol: 'vless',
    settings,
    streamSettings: {
      network: 'tcp',
      security: 'none',
      tcpSettings: TcpStreamSettingsSchema.parse({ header: { type: 'none' } }),
    },
    sniffing: SniffingSchema.parse({}),
    port: RandomUtil.randomInteger(10000, 60000),
    listen: '',
    tag: '',
    enable: true,
    trafficReset: 'never',
  });
}

/*
 * Switching `network` swaps which per-network key (tcpSettings, wsSettings,
 * grpcSettings, ...) appears on the wire. Seed each network's blob with its
 * Zod schema defaults so every field inside the network sub-form has a
 * defined starting value (KCP needs MTU=1350 etc., XHTTP needs the ""
 * sentinels so the "Default" option shows instead of blank).
 */
function newStreamSlice(n: string): Record<string, unknown> {
  switch (n) {
    case 'tcp':
      return TcpStreamSettingsSchema.parse({ header: { type: 'none' } });
    case 'kcp':
      return KcpStreamSettingsSchema.parse({});
    case 'ws':
      return WsStreamSettingsSchema.parse({});
    case 'grpc':
      return GrpcStreamSettingsSchema.parse({});
    case 'httpupgrade':
      return HttpUpgradeStreamSettingsSchema.parse({});
    case 'xhttp':
      return XHttpStreamSettingsSchema.parse({});
    default:
      return {};
  }
}

export default function InboundFormModal({
  open,
  onClose,
  onSaved,
  mode,
  dbInbound,
  dbInbounds,
  availableNodes,
  availableNodesFetched = true,
  initialPackage,
}: InboundFormModalProps) {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const methods = useForm<InboundFormValues>({ defaultValues: buildAddModeValues() });
  const setV = methods.setValue as unknown as (name: string, value: unknown) => void;
  const getV = methods.getValues as unknown as (name?: string) => unknown;
  const control = methods.control;
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<RealityScanResult | null>(null);
  const [activeTab, setActiveTab] = useState('basic');

  const [packagesList, setPackagesList] = useState<ISPPackage[]>([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');

  useEffect(() => {
    if (open) {
      setPackagesList(getStoredPackages());
    }
  }, [open]);

  const applyPackageToForm = useCallback(
    (pkg: ISPPackage) => {
      setV('protocol', pkg.protocol);
      setV('port', pkg.port);

      if (pkg.name) {
        setV('remark', pkg.name);
        setV('tag', pkg.name);
        lastWrittenTagRef.current = pkg.name;
        autoTagRef.current = false;
      }

      // Ensure protocol settings are properly initialized
      const curSettings = getV('settings') as Record<string, unknown> | undefined;
      if (!curSettings || !Array.isArray(curSettings.clients) || curSettings.clients.length === 0) {
        const def = createDefaultInboundSettings(pkg.protocol || 'vless');
        if (def) setV('settings', def);
      }

      setV('streamSettings.network', pkg.network);
      setV('streamSettings.security', pkg.security);

      if (pkg.network === 'ws') {
        setV('streamSettings.wsSettings', {
          ...WsStreamSettingsSchema.parse({}),
          path: pkg.path || '/',
          host: pkg.host || '',
          headers: pkg.host ? { Host: pkg.host } : {},
        });
      } else if (pkg.network === 'tcp') {
        setV('streamSettings.tcpSettings', {
          header: {
            type: pkg.headerType || 'none',
          },
        });
      } else if (pkg.network === 'xhttp') {
        setV('streamSettings.xhttpSettings', {
          ...XHttpStreamSettingsSchema.parse({}),
          path: pkg.path || '/',
          host: pkg.host || '',
          mode: 'auto',
          extra: {
            mode: 'auto',
            xPaddingBytes: '100-1000',
          },
        });
      } else if (pkg.network === 'grpc') {
        setV('streamSettings.grpcSettings', {
          ...GrpcStreamSettingsSchema.parse({}),
          serviceName: pkg.path || '',
          multiMode: false,
        });
      } else if (pkg.network === 'httpupgrade') {
        setV('streamSettings.httpupgradeSettings', {
          ...HttpUpgradeStreamSettingsSchema.parse({}),
          path: pkg.path || '/',
          host: pkg.host || '',
          headers: pkg.host ? { Host: pkg.host } : {},
        });
      }

      if (pkg.security === 'tls') {
        const existingTls = (getV('streamSettings.tlsSettings') as Record<string, unknown>) || {};
        const existingCerts = Array.isArray(existingTls.certificates) ? existingTls.certificates : [];
        const hasValidCert = existingCerts.some(
          (c: any) =>
            c.usage !== 'verify' &&
            ((c.certificateFile && c.certificateFile.trim() !== '') ||
              (Array.isArray(c.certificate) && c.certificate.some((line: string) => line.trim() !== ''))),
        );

        const certificates = hasValidCert
          ? existingCerts
          : [
            {
              useFile: true,
              certificateFile: '/root/cert.crt',
              keyFile: '/root/private.key',
              certificate: [],
              key: [],
              ocspStapling: 0,
              oneTimeLoading: false,
              usage: 'encipherment',
              buildChain: false,
            },
          ];

        const streamSettings = (getV('streamSettings') as Record<string, unknown>) || {};
        delete (streamSettings as any).realitySettings;

        setV('streamSettings.tlsSettings', {
          ...existingTls,
          serverName: pkg.sni || '',
          certificates,
          minVersion: '1.2',
          maxVersion: '1.3',
          settings: {
            fingerprint: pkg.fp || 'chrome',
            alpn: Array.isArray(pkg.alpn)
              ? pkg.alpn
              : typeof pkg.alpn === 'string'
                ? (pkg.alpn as string).split(',').map((s: string) => s.trim())
                : undefined,
          },
        });
      } else if (pkg.security === 'reality') {
        const existingReality =
          (getV('streamSettings.realitySettings') as Record<string, unknown>) || {};
        const shortIds =
          Array.isArray(existingReality.shortIds) && existingReality.shortIds.length > 0
            ? existingReality.shortIds
            : [RandomUtil.randomShortIds().split(',')[0] || '0123456789abcdef'];

        const privateKey = (existingReality.privateKey as string) || 'uK...samplePrivateKey...';
        const publicKey =
          ((existingReality.settings as any)?.publicKey as string) || 'uK...samplePublicKey...';
        const spiderX =
          ((existingReality.settings as any)?.spiderX as string) || `/${RandomUtil.randomSeq(15)}`;

        const streamSettings = (getV('streamSettings') as Record<string, unknown>) || {};
        delete (streamSettings as any).tlsSettings;

        setV('streamSettings.realitySettings', {
          ...existingReality,
          serverNames: pkg.sni ? [pkg.sni] : [],
          target: pkg.sni ? (pkg.sni.includes(':') ? pkg.sni : `${pkg.sni}:443`) : 'yahoo.com:443',
          shortIds,
          privateKey,
          settings: {
            ...((existingReality.settings as Record<string, unknown>) || {}),
            publicKey,
            spiderX,
            fingerprint: pkg.fp || 'chrome',
            serverName: pkg.sni || '',
            mldsa65Verify: '',
          },
        });
      } else {
        const streamSettings = (getV('streamSettings') as Record<string, unknown>) || {};
        delete (streamSettings as any).tlsSettings;
        delete (streamSettings as any).realitySettings;
      }

      // Ensure sniffing is enabled so Xray core can sniff TLS/HTTP host domains for routing
      setV('sniffing.enabled', true);
      setV('sniffing.destOverride', ['http', 'tls', 'quic']);

      // Automatically configure Access tab rules to isolate traffic for this ISP package
      const pkgNameLower = (pkg.name || '').toLowerCase();
      const pkgCat = (pkg.category || '').toLowerCase();
      if (pkgCat === 'zoom' || pkgNameLower.includes('zoom')) {
        setV('access.mode', 'allow');
        setV('access.enabled', true);
        setV('access.allowedDomains', ['*.zoom.us', 'zoom.us', 'teams.microsoft.com', 'aka.ms', 'webex.com']);
        setV('access.allowedPackages', ['us.zoom.videomeetings', 'com.microsoft.teams']);
        setV('access.unmatchedAction', 'block');
      } else if (pkgCat === 'youtube' || pkgNameLower.includes('youtube')) {
        setV('access.mode', 'allow');
        setV('access.enabled', true);
        setV('access.allowedDomains', ['*.youtube.com', 'youtube.com', '*.googlevideo.com', 'ytimg.com', 'youtu.be']);
        setV('access.allowedPackages', ['com.google.android.youtube', 'com.google.ios.youtube']);
        setV('access.unmatchedAction', 'block');
      } else if (pkgCat === 'tiktok' || pkgNameLower.includes('tiktok')) {
        setV('access.mode', 'allow');
        setV('access.enabled', true);
        setV('access.allowedDomains', ['*.tiktok.com', 'tiktok.com', '*.byteoversea.com', '*.ibytedtos.com']);
        setV('access.allowedPackages', ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill']);
        setV('access.unmatchedAction', 'block');
      } else if (pkgCat === 'netflix' || pkgNameLower.includes('netflix')) {
        setV('access.mode', 'allow');
        setV('access.enabled', true);
        setV('access.allowedDomains', ['*.netflix.com', 'netflix.com', '*.nflxvideo.net', '*.nflximg.net']);
        setV('access.allowedPackages', ['com.netflix.mediaclient']);
        setV('access.unmatchedAction', 'block');
      } else if (
        pkgCat === 'social' ||
        pkgNameLower.includes('social') ||
        pkgNameLower.includes('whatsapp') ||
        pkgNameLower.includes('telegram')
      ) {
        setV('access.mode', 'allow');
        setV('access.enabled', true);
        setV('access.allowedDomains', ['*.whatsapp.net', 'whatsapp.com', '*.whatsapp.com', '*.telegram.org', 't.me', '*.t.me']);
        setV('access.allowedPackages', ['com.whatsapp', 'net.whatsapp.WhatsApp', 'org.telegram.messenger']);
        setV('access.unmatchedAction', 'block');
      }

      messageApi.success(`Applied ISP Package: ${pkg.name}`);
    },
    [setV, getV, messageApi],
  );

  const handleApplyFromLink = useCallback(() => {
    if (!linkInputValue.trim()) {
      messageApi.error('Please enter a proxy configuration link');
      return;
    }
    const parsed = parseProxyConfigLink(linkInputValue.trim());
    if (!parsed) {
      messageApi.error('Invalid configuration link. Supported: vless://, vmess://, trojan://');
      return;
    }

    const currentPkgs = getStoredPackages();
    const matched = currentPkgs.find(
      (p) =>
        (parsed.sni && p.sni.toLowerCase() === parsed.sni.toLowerCase()) ||
        (parsed.port && p.port === parsed.port && parsed.network === p.network),
    );

    setV('protocol', parsed.protocol || 'vless');
    setV('port', parsed.port || 443);

    const cleanRemark = parsed.remark
      ? stripEmojis(parsed.remark).trim()
      : matched?.name || `${(parsed.protocol || 'vless').toUpperCase()} ${parsed.network.toUpperCase()} ${parsed.port || 443}`;

    setV('remark', cleanRemark);
    setV('tag', cleanRemark);
    lastWrittenTagRef.current = cleanRemark;
    autoTagRef.current = false;

    // Ensure protocol settings are properly initialized
    const curSettings = getV('settings') as Record<string, unknown> | undefined;
    if (!curSettings || !Array.isArray(curSettings.clients) || curSettings.clients.length === 0) {
      const def = createDefaultInboundSettings(parsed.protocol || 'vless');
      if (def) setV('settings', def);
    }

    setV('streamSettings.network', parsed.network || 'ws');
    setV('streamSettings.security', parsed.security || 'tls');

    if (parsed.network === 'ws') {
      setV('streamSettings.wsSettings', {
        ...WsStreamSettingsSchema.parse({}),
        path: parsed.path || '/',
        host: parsed.host || '',
        headers: parsed.host ? { Host: parsed.host } : {},
      });
    } else if (parsed.network === 'tcp') {
      setV('streamSettings.tcpSettings', {
        header: {
          type: parsed.headerType || 'none',
        },
      });
    } else if (parsed.network === 'xhttp') {
      setV('streamSettings.xhttpSettings', {
        ...XHttpStreamSettingsSchema.parse({}),
        path: parsed.path || '/',
        host: parsed.host || '',
        mode: 'auto',
        extra: {
          mode: 'auto',
          xPaddingBytes: '100-1000',
        },
      });
    } else if (parsed.network === 'grpc') {
      setV('streamSettings.grpcSettings', {
        ...GrpcStreamSettingsSchema.parse({}),
        serviceName: parsed.path || '',
        multiMode: false,
      });
    } else if (parsed.network === 'httpupgrade') {
      setV('streamSettings.httpupgradeSettings', {
        ...HttpUpgradeStreamSettingsSchema.parse({}),
        path: parsed.path || '/',
        host: parsed.host || '',
        headers: parsed.host ? { Host: parsed.host } : {},
      });
    }

    if (parsed.security === 'tls') {
      const existingTls = (getV('streamSettings.tlsSettings') as Record<string, unknown>) || {};
      const existingCerts = Array.isArray(existingTls.certificates) ? existingTls.certificates : [];
      const hasValidCert = existingCerts.some(
        (c: any) =>
          c.usage !== 'verify' &&
          ((c.certificateFile && c.certificateFile.trim() !== '') ||
            (Array.isArray(c.certificate) && c.certificate.some((line: string) => line.trim() !== ''))),
      );

      const certificates = hasValidCert
        ? existingCerts
        : [
          {
            useFile: true,
            certificateFile: '/root/cert.crt',
            keyFile: '/root/private.key',
            certificate: [],
            key: [],
            ocspStapling: 0,
            oneTimeLoading: false,
            usage: 'encipherment',
            buildChain: false,
          },
        ];

      const streamSettings = (getV('streamSettings') as Record<string, unknown>) || {};
      delete (streamSettings as any).realitySettings;

      setV('streamSettings.tlsSettings', {
        ...existingTls,
        serverName: parsed.sni || '',
        certificates,
        minVersion: '1.2',
        maxVersion: '1.3',
        settings: {
          fingerprint: parsed.fp || 'chrome',
          alpn: Array.isArray(parsed.alpn)
            ? parsed.alpn
            : typeof parsed.alpn === 'string'
              ? (parsed.alpn as string).split(',').map((s: string) => s.trim())
              : undefined,
        },
      });
    } else if (parsed.security === 'reality') {
      const existingReality =
        (getV('streamSettings.realitySettings') as Record<string, unknown>) || {};
      const shortIds =
        Array.isArray(existingReality.shortIds) && existingReality.shortIds.length > 0
          ? existingReality.shortIds
          : [RandomUtil.randomShortIds().split(',')[0] || '0123456789abcdef'];

      const privateKey = (existingReality.privateKey as string) || 'uK...samplePrivateKey...';
      const publicKey =
        ((existingReality.settings as any)?.publicKey as string) || 'uK...samplePublicKey...';
      const spiderX =
        ((existingReality.settings as any)?.spiderX as string) || `/${RandomUtil.randomSeq(15)}`;

      const streamSettings = (getV('streamSettings') as Record<string, unknown>) || {};
      delete (streamSettings as any).tlsSettings;

      setV('streamSettings.realitySettings', {
        ...existingReality,
        serverNames: parsed.sni ? [parsed.sni] : [],
        target: parsed.sni ? (parsed.sni.includes(':') ? parsed.sni : `${parsed.sni}:443`) : 'yahoo.com:443',
        shortIds,
        privateKey,
        settings: {
          ...((existingReality.settings as Record<string, unknown>) || {}),
          publicKey,
          spiderX,
          fingerprint: parsed.fp || 'chrome',
          serverName: parsed.sni || '',
          mldsa65Verify: '',
        },
      });
    } else {
      const streamSettings = (getV('streamSettings') as Record<string, unknown>) || {};
      delete (streamSettings as any).tlsSettings;
      delete (streamSettings as any).realitySettings;
    }

    setLinkModalOpen(false);
    setLinkInputValue('');
    if (matched) {
      messageApi.success(`Matched ISP Package: ${matched.name} (${matched.isp})`);
    } else {
      messageApi.success('Successfully imported connection parameters from link');
    }
  }, [linkInputValue, messageApi, setV, getV]);

  const ispGroups = useMemo(() => {
    const groups: Record<string, ISPPackage[]> = {};
    for (const p of packagesList) {
      if (!groups[p.isp]) groups[p.isp] = [];
      groups[p.isp].push(p);
    }
    return groups;
  }, [packagesList]);

  const ISP_NAMES: Record<string, string> = {
    dialog: 'Dialog',
    slt: 'SLT Fiber',
    'slt-mobitel': 'SLT-Mobitel',
    mobitel: 'Mobitel',
    airtel: 'Airtel',
    hutch: 'Hutch',
    all: 'Universal / All Networks',
  };

  const ispMenuItems = useMemo(() => {
    const orderedIsps = ['dialog', 'slt', 'slt-mobitel', 'airtel', 'hutch', 'all'];
    const allIsps = Array.from(new Set([...orderedIsps, ...Object.keys(ispGroups)]));

    return allIsps
      .filter((isp) => (ispGroups[isp] || []).length > 0)
      .map((isp) => {
        const pkgs = ispGroups[isp] || [];
        const logoSrc = getIspLogo(isp);
        const displayName = ISP_NAMES[isp] || (isp.charAt(0).toUpperCase() + isp.slice(1));

        return {
          key: `group-${isp}`,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt={displayName}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    objectFit: 'contain',
                    background: 'rgba(255, 255, 255, 0.06)',
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ fontWeight: 600, fontSize: 13 }}>{displayName}</span>
            </div>
          ),
          children: pkgs.map((pkg) => {
            const serviceIcon = getServiceIcon(pkg.category) || getServiceIcon(pkg.name);
            return {
              key: pkg.id,
              label: (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minWidth: 290,
                    gap: 12,
                    padding: '2px 0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {serviceIcon && (
                      <img
                        src={serviceIcon}
                        alt={pkg.category}
                        style={{ width: 17, height: 17, objectFit: 'contain', flexShrink: 0 }}
                      />
                    )}
                    <span style={{ fontWeight: 500 }}>{pkg.name}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--ant-color-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Port {pkg.port} | {pkg.network.toUpperCase()} | {pkg.security.toUpperCase()}
                  </span>
                </div>
              ),
              onClick: () => applyPackageToForm(pkg),
            };
          }),
        };
      });
  }, [ispGroups, applyPackageToForm]);

  const port443Packages = useMemo(
    () => packagesList.filter((p) => p.port === 443),
    [packagesList],
  );

  const port443MenuItems = useMemo(() => {
    return port443Packages.map((pkg) => {
      const ispLogo = getIspLogo(pkg.isp);
      const serviceIcon = getServiceIcon(pkg.category) || getServiceIcon(pkg.name);
      const ispName = ISP_NAMES[pkg.isp] || (pkg.isp.charAt(0).toUpperCase() + pkg.isp.slice(1));
      return {
        key: `p443-${pkg.id}`,
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minWidth: 290,
              gap: 12,
              padding: '2px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {ispLogo && (
                <img
                  src={ispLogo}
                  alt={ispName}
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: 3,
                    objectFit: 'contain',
                    flexShrink: 0,
                  }}
                />
              )}
              {serviceIcon && (
                <img
                  src={serviceIcon}
                  alt={pkg.category}
                  style={{ width: 17, height: 17, objectFit: 'contain', flexShrink: 0 }}
                />
              )}
              <span style={{ fontWeight: 500 }}>
                {ispName}: {pkg.name}
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--ant-color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              SNI: {pkg.sni || 'None'}
            </span>
          </div>
        ),
        onClick: () => applyPackageToForm(pkg),
      };
    });
  }, [port443Packages, applyPackageToForm]);
  const {
    fallbacks,
    fallbackChildOptions,
    loadFallbacks,
    saveFallbacks,
    addFallback,
    updateFallback,
    removeFallback,
    moveFallback,
    addAllFallbacks,
  } = useInboundFallbacks(dbInbound, dbInbounds);

  const selectableNodes = (availableNodes || []).filter((n) => n.enable);
  const protocol = (useWatch({ control, name: 'protocol' }) ?? '') as string;
  const isNodeEligible = !!NODE_ELIGIBLE_PROTOCOLS[protocol];
  /*
   * The `node` share-address strategy only means something when the inbound can
   * actually live on a node — otherwise the node address it would resolve to is
   * always empty. Offer it only then; `listen`/`custom` work for local inbounds.
   */
  const nodeShareOptionAvailable = selectableNodes.length > 0 && isNodeEligible;
  const vlessEncryption = useWatch({ control, name: 'settings.encryption' }) ?? '';
  const ssMethod = useWatch({ control, name: 'settings.method' });
  const isSSWith2022 = isSS2022({
    protocol,
    settings: typeof ssMethod === 'string' ? { method: ssMethod } : {},
  });
  const mixedUdpOn = (useWatch({ control, name: 'settings.udp' }) ?? false) as boolean;
  const network = (useWatch({ control, name: 'streamSettings.network' }) ?? '') as string;
  const security = (useWatch({ control, name: 'streamSettings.security' }) ?? 'none') as string;
  const streamEnabled = canEnableStream({ protocol });
  const sniffingSupported = canEnableSniffing({ protocol });
  /*
   * Wireguard (always a UDP listener) and Tunnel (dokodemo-door) expose no
   * user-selectable transport — their stream tab is just sockopt, which is all
   * Tunnel's TProxy/redirect mode needs (sockopt.tproxy). Hysteria carries its
   * own dedicated transport form. For all of these the RAW/mKCP/WS/... network
   * picker and the per-network sub-forms are hidden.
   */
  const hasSelectableTransport =
    protocol !== Protocols.HYSTERIA &&
    protocol !== Protocols.WIREGUARD &&
    protocol !== Protocols.TUNNEL &&
    protocol !== Protocols.TUIC;

  const wPort = useWatch({ control, name: 'port' });
  const wListen = (useWatch({ control, name: 'listen' }) ?? '') as string;
  const isUdsListen = wListen.startsWith('/') || wListen.startsWith('@');
  const wNodeId = useWatch({ control, name: 'nodeId' }) ?? null;
  const shareAddrStrategy = useWatch({ control, name: 'shareAddrStrategy' }) ?? 'node';
  const wTag = (useWatch({ control, name: 'tag' }) ?? '') as string;
  const wSsNetwork = useWatch({ control, name: 'settings.network' });
  const wTunnelNetwork = useWatch({ control, name: 'settings.allowedNetwork' });
  const wTotal = (useWatch({ control, name: 'total' }) as number | undefined) ?? 0;
  const wExpiry = (useWatch({ control, name: 'expiryTime' }) as number | undefined) ?? 0;
  const trafficReset = useWatch({ control, name: 'trafficReset' }) ?? 'never';
  const autoTagRef = useRef(true);
  const lastWrittenTagRef = useRef('');
  const currentTagInput = (): InboundTagInput => ({
    port: typeof wPort === 'number' ? wPort : 0,
    nodeId: typeof wNodeId === 'number' ? wNodeId : null,
    protocol,
    streamSettings: { network },
    settings: { network: wSsNetwork, allowedNetwork: wTunnelNetwork, udp: mixedUdpOn },
  });
  const isFallbackHost =
    (protocol === Protocols.VLESS || protocol === Protocols.TROJAN) &&
    network === 'tcp' &&
    (security === 'tls' || security === 'reality');

  const {
    genRealityKeypair,
    clearRealityKeypair,
    genMldsa65,
    clearMldsa65,
    scanRealityTarget,
    scanRealityCandidates,
    applyRealityScanResult,
    randomizeShortIds,
    randomizeSpiderX,
    getNewEchCert,
    clearEchCert,
    pinFromCert,
    pinFromRemote,
    setCertFromPanel,
    clearCertFiles,
    onSecurityChange,
  } = useSecurityActions({
    methods,
    setSaving,
    messageApi,
    modal,
    nodeId: typeof wNodeId === 'number' ? wNodeId : null,
    setScanResult,
    setScanning,
  });

  const toggleSockopt = (on: boolean) => {
    if (on) {
      setV('streamSettings.sockopt', SockoptStreamSettingsSchema.parse({}));
    } else {
      setV('streamSettings.sockopt', undefined);
    }
  };
  const wgSecretKey = useWatch({ control, name: 'settings.secretKey' });
  const wgPubKey =
    typeof wgSecretKey === 'string' && wgSecretKey.length > 0
      ? Wireguard.generateKeypair(wgSecretKey).publicKey
      : '';

  const regenInboundWg = () => {
    const kp = Wireguard.generateKeypair();
    setV('settings.secretKey', kp.privateKey);
  };

  // AmneziaWG uses the same Curve25519 keys as WireGuard, just nested under
  // settings.server instead of flat on settings — see amneziawg.ts. Unlike
  // WireGuard's Xray-native inbound (which re-derives its public key at
  // runtime and never stores one), AmneziaWG's server.publicKey is a real,
  // persisted field the Go backend reads directly, so it must be kept in
  // sync even when the user free-types a new private key instead of using
  // the regenerate button.
  const awgPrivateKey = useWatch({ control, name: 'settings.server.privateKey' });
  const awgPubKey =
    typeof awgPrivateKey === 'string' && awgPrivateKey.length > 0
      ? Wireguard.generateKeypair(awgPrivateKey).publicKey
      : '';

  useEffect(() => {
    if (protocol === Protocols.AMNEZIAWG) {
      setV('settings.server.publicKey', awgPubKey);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [awgPubKey, protocol]);

  const regenInboundAwg = () => {
    const kp = Wireguard.generateKeypair();
    setV('settings.server.privateKey', kp.privateKey);
    setV('settings.server.publicKey', kp.publicKey);
  };

  // Randomizes the AmneziaWG 3.1 obfuscation set client-side; the shared
  // generator mirrors the Go backend's amneziawg.GenerateObfuscation31.
  const regenInboundAwgObfuscation = () => {
    const obf = generateAwgObfuscation();
    for (const [field, value] of Object.entries(obf)) {
      setV(`settings.server.${field}`, value);
    }
  };

  const matchesVlessAuth = (
    block: { id?: string; label?: string } | undefined | null,
    authId: string,
  ) => {
    if (block?.id === authId) return true;
    const label = (block?.label || '').toLowerCase().replace(/[-_\s]/g, '');
    if (authId === 'mlkem768')
      return label.includes('mlkem768') && !label.includes('xorpub') && !label.includes('random');
    if (authId === 'x25519')
      return label.includes('x25519') && !label.includes('xorpub') && !label.includes('random');
    if (authId === 'mlkem768_xorpub') return label.includes('mlkem768') && label.includes('xorpub');
    if (authId === 'mlkem768_random') return label.includes('mlkem768') && label.includes('random');
    if (authId === 'x25519_xorpub') return label.includes('x25519') && label.includes('xorpub');
    if (authId === 'x25519_random') return label.includes('x25519') && label.includes('random');
    return false;
  };

  const getNewVlessEnc = async (authId: string) => {
    if (!authId) return;
    setSaving(true);
    try {
      const msg = await HttpUtil.get('/panel/api/server/getNewVlessEnc');
      if (!msg?.success) return;
      const obj = msg.obj as {
        auths?: { decryption: string; encryption: string; label?: string; id?: string }[];
      };
      const block = (obj.auths || []).find((a) => matchesVlessAuth(a, authId));
      if (!block) return;
      setV('settings.decryption', block.decryption);
      setV('settings.encryption', block.encryption);
    } finally {
      setSaving(false);
    }
  };

  const clearVlessEnc = () => {
    setV('settings.decryption', 'none');
    setV('settings.encryption', 'none');
  };

  const vlessAuthKind = vlessEncryptionAuthKind(
    typeof vlessEncryption === 'string' ? vlessEncryption : '',
  );
  const selectedVlessAuth = (() => {
    const enc = typeof vlessEncryption === 'string' ? vlessEncryption : '';
    if (!enc || enc === 'none') return 'None';
    if (!vlessAuthKind) return t('pages.inbounds.vlessAuthCustom');
    return t(VLESS_AUTH_LABEL_KEYS[vlessAuthKind]);
  })();

  useEffect(() => {
    if (!open) return;
    const initial =
      mode === 'edit' && dbInbound ? rawInboundToFormValues(dbInbound) : buildAddModeValues();
    methods.reset(initial);
    setScanResult(null);
    setActiveTab('basic');
    const initialTag = (initial.tag ?? '') as string;
    autoTagRef.current = isAutoInboundTag(initialTag, {
      port: initial.port ?? 0,
      nodeId: initial.nodeId ?? null,
      protocol: initial.protocol,
      streamSettings: (initial.streamSettings ?? {}) as Record<string, unknown>,
      settings: (initial.settings ?? {}) as Record<string, unknown>,
    });
    lastWrittenTagRef.current = initialTag;
    if (
      mode === 'edit' &&
      dbInbound &&
      (dbInbound.protocol === Protocols.VLESS || dbInbound.protocol === Protocols.TROJAN)
    ) {
      loadFallbacks(dbInbound.id);
    } else {
      loadFallbacks(null);
    }

    if (mode === 'add' && initialPackage) {
      setTimeout(() => {
        applyPackageToForm(initialPackage);
      }, 0);
    }

    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open, mode, dbInbound, methods, initialPackage, applyPackageToForm]);

  useEffect(() => {
    if (!open) return;
    if (wTag === lastWrittenTagRef.current) return;
    autoTagRef.current = isAutoInboundTag(wTag, currentTagInput());
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open, wTag]);

  useEffect(() => {
    if (!open || !autoTagRef.current) return;
    const next = composeInboundTag(currentTagInput());
    if (next !== ((getV('tag') as string | undefined) ?? '')) {
      lastWrittenTagRef.current = next;
      setV('tag', next);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open, wPort, wNodeId, protocol, network, mixedUdpOn, wSsNetwork, wTunnelNetwork]);

  /*
   * Keep the strategy value inside the visible option set: when `node` isn't
   * offered (no node, or a protocol that can't deploy to one) fall back to
   * `listen`, which yields the same link for a local inbound. Mirrors how the
   * protocol reset drops a nodeId that no longer applies.
   * Only downgrade once the inputs this decision depends on are settled, so a
   * persisted `node` strategy is never clobbered by transient mount state (#5375).
   */
  useEffect(() => {
    if (!open) return;
    if (!protocol) return;
    const current = getV('shareAddrStrategy') as InboundFormValues['shareAddrStrategy'] | undefined;
    if (protocol === Protocols.MTPROTO) {
      if (current !== 'listen') setV('shareAddrStrategy', 'listen');
      if (getV('shareAddr')) setV('shareAddr', '');
      return;
    }
    if (!availableNodesFetched) return;
    if (!nodeShareOptionAvailable && (current ?? 'node') === 'node') {
      setV('shareAddrStrategy', 'listen');
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open, availableNodesFetched, protocol, nodeShareOptionAvailable, shareAddrStrategy]);

  /*
   * Protocol picker reset cascades through the form — clearing the settings DU
   * branch and dropping a nodeId that no longer applies. Only a real user
   * change (type === 'change') triggers it; programmatic setValue (advanced
   * JSON edits, open reset) must not, matching the legacy onValuesChange.
   */
  useEffect(() => {
    if (mode === 'edit') return;
    /* eslint-disable-next-line react-hooks/incompatible-library */
    const sub = methods.watch((_value, { name, type }) => {
      if (name !== 'protocol' || type !== 'change') return;
      const next = getV('protocol') as string;
      const settings = createDefaultInboundSettings(next) ?? undefined;
      setV('settings', settings);
      if (!NODE_ELIGIBLE_PROTOCOLS[next]) {
        setV('nodeId', null);
      }
      if (next !== Protocols.VLESS) {
        setV('disableFlow', false);
      }
      if (next === Protocols.HYSTERIA) {
        setV('streamSettings', {
          network: 'hysteria',
          security: 'tls',
          hysteriaSettings: HysteriaStreamSettingsSchema.parse({}),
          tlsSettings: createHysteriaTlsSettingsWithDefaultCert(),
          finalmask: {
            tcp: [],
            udp: [
              {
                type: 'salamander',
                settings: { password: RandomUtil.randomLowerAndNum(16) },
              },
            ],
          },
        });
      } else if (next === Protocols.WIREGUARD || next === Protocols.TUNNEL) {
        setV('streamSettings', { security: 'none' });
      } else {
        const current = getV('streamSettings') as { network?: string } | undefined;
        if (current?.network === 'hysteria' || !current?.network) {
          setV('streamSettings', { network: 'tcp', security: 'none', tcpSettings: {} });
        }
      }
    });
    return () => sub.unsubscribe();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [mode, methods]);

  const saveValues = async () => {
    /*
     * getValues() returns the entire form store, including settings.clients and
     * settings.fallbacks which have no bound field (clients are managed via the
     * standalone Client modal, not this inbound modal). With shouldUnregister
     * false those pass-through sub-trees survive from the reset object, so the
     * update wire payload never silently drops every client on save.
     */
    const values = methods.getValues() as InboundFormValues;
    if (values.streamSettings) {
      if (values.streamSettings.security === 'none') {
        delete (values.streamSettings as any).tlsSettings;
        delete (values.streamSettings as any).realitySettings;
      } else if (values.streamSettings.security === 'tls') {
        delete (values.streamSettings as any).realitySettings;
      } else if (values.streamSettings.security === 'reality') {
        delete (values.streamSettings as any).tlsSettings;
      }
    }
    const parsed = InboundFormSchema.safeParse(values);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      setActiveTab(tabForValidationPath(issues[0].path));
      messageApi.error(formatInboundValidation(issues, values, t));
      console.error(
        '[InboundFormModal] schema validation failed:',
        issues.map((issue) => formatInboundIssue(issue, values, t)),
      );
      return;
    }
    setSaving(true);
    try {
      const payload = formValuesToWirePayload(parsed.data);
      const url =
        mode === 'edit' && dbInbound
          ? `/panel/api/inbounds/update/${dbInbound.id}`
          : '/panel/api/inbounds/add';
      const msg = await HttpUtil.post(url, payload);
      if (msg?.success) {
        if (isFallbackHost) {
          const obj = msg.obj as { id?: number; Id?: number } | null;
          const masterId = mode === 'edit' ? dbInbound!.id : (obj?.id ?? obj?.Id ?? 0);
          if (masterId) await saveFallbacks(masterId);
        }
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  /*
   * Field errors render inline, but every tab is force-rendered, so an error on
   * a hidden tab looks like a dead Save button — jump to it and say what broke.
   */
  const submit = methods.handleSubmit(saveValues, (errors) => {
    const issue = firstRhfValidationIssue(errors);
    if (!issue) return;
    setActiveTab(tabForValidationPath(issue.path));
    messageApi.error(formatInboundIssue(issue, methods.getValues(), t));
  });

  const title =
    mode === 'edit' ? t('pages.inbounds.modifyInbound') : t('pages.inbounds.addInbound');

  const okText = mode === 'edit' ? t('pages.clients.submitEdit') : t('create');

  const basicTab = (
    <>
      <FormField name="enable" label={t('enable')} valueProp="checked">
        <Switch />
      </FormField>

      <FormField name="remark" label={t('pages.inbounds.remark')}>
        <Input />
      </FormField>

      {selectableNodes.length > 0 && isNodeEligible && (
        <FormField name="nodeId" label={t('pages.inbounds.deployTo')}>
          <Select
            showSearch
            disabled={mode === 'edit'}
            placeholder={t('pages.inbounds.localPanel')}
            allowClear
            options={selectableNodes.map((n) => ({
              value: n.id,
              // Same rule as the clone target picker: only online is
              // deployable (`unknown` = no heartbeat yet).
              label: `${n.name}${n.status === 'online' ? '' : ` (${n.status || 'offline'})`}`,
              disabled: n.status !== 'online',
            }))}
          />
        </FormField>
      )}

      <FormField name="protocol" label={t('pages.inbounds.protocol')}>
        <Select id="protocol" disabled={mode === 'edit'} options={PROTOCOL_OPTIONS} />
      </FormField>

      <FormField
        name="listen"
        label={labelWithHint(t('pages.inbounds.address'), t('pages.inbounds.form.listenHelp'))}
      >
        <Input placeholder={t('pages.inbounds.monitorDesc')} />
      </FormField>

      {protocol !== Protocols.MTPROTO && (
        <>
          <FormField
            name="shareAddrStrategy"
            label={labelWithHint(
              t('pages.inbounds.form.shareAddrStrategy'),
              t('pages.inbounds.form.shareAddrStrategyHelp'),
            )}
          >
            <Select
              options={SHARE_ADDR_STRATEGIES.filter(
                (strategy) => strategy !== 'node' || nodeShareOptionAvailable,
              ).map((strategy) => ({
                value: strategy,
                label: t(`pages.inbounds.form.shareAddrStrategyOptions.${strategy}`),
              }))}
            />
          </FormField>

          {shareAddrStrategy === 'custom' && (
            <FormField
              name="shareAddr"
              label={labelWithHint(
                t('pages.inbounds.form.shareAddr'),
                t('pages.inbounds.form.shareAddrHelp'),
              )}
              rules={{
                validate: (value) =>
                  isValidShareAddrInput(String(value ?? '')) ||
                  t('pages.inbounds.form.shareAddrHelp'),
              }}
            >
              <Input placeholder="edge.example.com" />
            </FormField>
          )}
        </>
      )}

      <FormField
        name="subSortIndex"
        label={labelWithHint(
          t('pages.inbounds.form.subSortIndex'),
          t('pages.inbounds.form.subSortIndexHelp'),
        )}
      >
        <InputNumber />
      </FormField>

      {protocol === Protocols.VLESS && (
        <FormField
          name="disableFlow"
          valueProp="checked"
          label={labelWithHint(
            t('pages.inbounds.form.disableFlow'),
            t('pages.inbounds.form.disableFlowHelp'),
          )}
        >
          <Switch />
        </FormField>
      )}

      <FormField
        name="port"
        label={t('pages.inbounds.port')}
        rules={{ validate: rhfZodValidate(InboundFormBaseSchema.shape.port) }}
      >
        <InputNumber min={isUdsListen ? 0 : 1} max={65535} />
      </FormField>

      <Form.Item
        label={
          <Tooltip title={t('pages.inbounds.meansNoLimit')}>
            {t('pages.inbounds.totalFlow')}
          </Tooltip>
        }
      >
        <InputNumber
          value={wTotal ? Math.round((wTotal / SizeFormatter.ONE_GB) * 100) / 100 : 0}
          min={0}
          step={1}
          onChange={(v) => {
            const bytes = NumberFormatter.toFixed((Number(v) || 0) * SizeFormatter.ONE_GB, 0);
            setV('total', bytes);
          }}
        />
      </Form.Item>

      <FormField name="trafficReset" label={t('pages.inbounds.periodicTrafficResetTitle')}>
        <Select
          options={TRAFFIC_RESETS.map((r) => ({
            value: r,
            label: t(`pages.inbounds.periodicTrafficReset.${r}`),
          }))}
        />
      </FormField>

      {trafficReset === 'monthly' && (
        <FormField
          name="trafficResetDay"
          label={t('pages.inbounds.periodicTrafficResetDay')}
          rules={{ validate: rhfZodValidate(InboundDbFieldsSchema.shape.trafficResetDay) }}
        >
          <InputNumber min={1} max={31} />
        </FormField>
      )}

      <Form.Item
        label={
          <Tooltip title={t('pages.inbounds.leaveBlankToNeverExpire')}>
            {t('pages.inbounds.expireDate')}
          </Tooltip>
        }
      >
        <DateTimePicker
          value={wExpiry > 0 ? dayjs(wExpiry) : null}
          onChange={(d) => setV('expiryTime', d ? d.valueOf() : 0)}
        />
      </Form.Item>
    </>
  );

  const fallbacksCard = (
    <FallbacksCard
      fallbacks={fallbacks}
      fallbackChildOptions={fallbackChildOptions}
      addFallback={addFallback}
      updateFallback={updateFallback}
      removeFallback={removeFallback}
      moveFallback={moveFallback}
      addAllFallbacks={addAllFallbacks}
    />
  );

  const protocolTab = (
    <>
      {protocol === Protocols.WIREGUARD && (
        <WireguardFields wgPubKey={wgPubKey} regenInboundWg={regenInboundWg} />
      )}

      {protocol === Protocols.AMNEZIAWG && (
        <AmneziawgFields
          awgPubKey={awgPubKey}
          regenInboundAwg={regenInboundAwg}
          regenInboundAwgObfuscation={regenInboundAwgObfuscation}
        />
      )}

      {protocol === Protocols.TUIC && <TuicFields />}

      {protocol === Protocols.TUN && <TunFields />}

      {protocol === Protocols.TUNNEL && <TunnelFields />}

      {protocol === Protocols.HTTP && <HttpFields />}
      {protocol === Protocols.MIXED && <MixedFields mixedUdpOn={mixedUdpOn} />}

      {protocol === Protocols.MTPROTO && <MtprotoFields />}

      {protocol === Protocols.SHADOWSOCKS && <ShadowsocksFields isSSWith2022={isSSWith2022} />}

      {protocol === Protocols.VLESS && (
        <VlessFields
          saving={saving}
          selectedVlessAuth={selectedVlessAuth}
          vlessAuthKind={vlessAuthKind}
          network={network}
          security={security}
          getNewVlessEnc={getNewVlessEnc}
          clearVlessEnc={clearVlessEnc}
        />
      )}

      {isFallbackHost && fallbacksCard}
      {(protocol === Protocols.VLESS || protocol === Protocols.TROJAN) &&
        network === 'tcp' &&
        !isFallbackHost && (
          <Alert
            className="mt-12"
            type="info"
            showIcon
            title={t('pages.inbounds.fallbacks.needsTls')}
          />
        )}
    </>
  );

  /*
   * Switching `network` swaps which per-network key appears on the wire. Clear
   * the old network's blob and seed the new one with schema defaults, plus the
   * FinalMask mkcp-legacy UDP mask when moving to mKCP (removed otherwise).
   */
  const onNetworkChange = (next: string) => {
    const ALL = [
      'tcpSettings',
      'kcpSettings',
      'wsSettings',
      'grpcSettings',
      'httpupgradeSettings',
      'xhttpSettings',
    ];
    const current = (getV('streamSettings') as Record<string, unknown>) ?? {};
    const cleaned: Record<string, unknown> = { ...current, network: next };
    for (const k of ALL) {
      if (k !== `${next}Settings`) delete cleaned[k];
    }
    cleaned[`${next}Settings`] = newStreamSlice(next);
    if (next === 'kcp') {
      const fm = (cleaned.finalmask as Record<string, unknown> | undefined) ?? {};
      const udp = Array.isArray(fm.udp) ? (fm.udp as unknown[]) : [];
      const hasMkcp = udp.some((m) => {
        const entry = m as { type?: string };
        return entry?.type === 'mkcp-legacy';
      });
      if (!hasMkcp) {
        cleaned.finalmask = {
          ...fm,
          udp: [...udp, { type: 'mkcp-legacy', settings: { header: '', value: '' } }],
        };
      }
    } else {
      const fm = cleaned.finalmask as Record<string, unknown> | undefined;
      if (fm && Array.isArray(fm.udp)) {
        const udp = (fm.udp as unknown[]).filter(
          (m) => (m as { type?: string })?.type !== 'mkcp-legacy',
        );
        cleaned.finalmask = { ...fm, udp };
      }
    }
    setV('streamSettings', cleaned);
  };

  const streamTab = (
    <>
      {hasSelectableTransport && (
        <Form.Item label={t('transmission')}>
          <Select
            style={{ width: '75%' }}
            value={network}
            onChange={onNetworkChange}
            options={[
              { value: 'tcp', label: 'RAW' },
              { value: 'kcp', label: 'mKCP' },
              { value: 'ws', label: 'WebSocket' },
              { value: 'grpc', label: 'gRPC' },
              { value: 'httpupgrade', label: 'HTTPUpgrade' },
              { value: 'xhttp', label: 'XHTTP' },
            ]}
          />
        </Form.Item>
      )}

      {/* Inbound Hysteria stream sub-form. The transport for hysteria
          isn't user-selectable (always 'hysteria'), so the network
          dropdown is hidden above. */}
      {protocol === Protocols.HYSTERIA && <HysteriaFields />}

      {hasSelectableTransport && (
        <>
          {network === 'tcp' && <RawForm />}

          {network === 'ws' && <WsForm />}

          {network === 'grpc' && <GrpcForm />}

          {network === 'xhttp' && <XhttpForm />}

          {network === 'httpupgrade' && <HttpUpgradeForm />}

          {network === 'kcp' && <KcpForm />}
        </>
      )}

      {/* The legacy externalProxy section is replaced by the Hosts page; the
          field is still parsed/rendered for backward compatibility but is no
          longer editable here. */}

      <SockoptForm toggleSockopt={toggleSockopt} network={network} />

      {/* Transport masks don't apply to tunnel (a transparent forwarder), so
          its stream tab is just sockopt + TProxy. */}
      {protocol !== Protocols.TUNNEL && (
        <Controller
          control={control}
          name="streamSettings.finalmask"
          render={({ field }) => (
            <FinalMaskField
              key={`${protocol}:${network}`}
              value={field.value}
              onChange={field.onChange}
              network={network}
              protocol={protocol}
            />
          )}
        />
      )}
    </>
  );

  const tlsOk = canEnableTls({ protocol, streamSettings: { network, security } });
  const realityOk = canEnableReality({ protocol, streamSettings: { network, security } });
  const tlsOnly = protocol === Protocols.HYSTERIA;

  const securityTab = (
    <>
      <Form.Item label={t('pages.inbounds.securityTab')}>
        <Radio.Group
          value={security}
          buttonStyle="solid"
          disabled={!tlsOk}
          onChange={(e) => onSecurityChange(e.target.value)}
        >
          {!tlsOnly && <Radio.Button value="none">{t('none')}</Radio.Button>}
          <Radio.Button value="tls">TLS</Radio.Button>
          {realityOk && <Radio.Button value="reality">Reality</Radio.Button>}
        </Radio.Group>
      </Form.Item>

      {security === 'tls' && (
        <TlsForm
          saving={saving}
          setCertFromPanel={setCertFromPanel}
          clearCertFiles={clearCertFiles}
          pinFromCert={pinFromCert}
          pinFromRemote={pinFromRemote}
          getNewEchCert={getNewEchCert}
          clearEchCert={clearEchCert}
        />
      )}

      {security === 'reality' && (
        <RealityForm
          saving={saving}
          scanning={scanning}
          scanResult={scanResult}
          scanRealityTarget={scanRealityTarget}
          scanRealityCandidates={scanRealityCandidates}
          applyRealityScanResult={applyRealityScanResult}
          randomizeShortIds={randomizeShortIds}
          randomizeSpiderX={randomizeSpiderX}
          genRealityKeypair={genRealityKeypair}
          clearRealityKeypair={clearRealityKeypair}
          genMldsa65={genMldsa65}
          clearMldsa65={clearMldsa65}
        />
      )}
    </>
  );

  const advancedTab = (
    <div className="advanced-shell">
      <div className="advanced-panel">
        <div className="advanced-panel__header">
          <div>
            <div className="advanced-panel__title">{t('pages.inbounds.advanced.title')}</div>
            <div className="advanced-panel__subtitle">{t('pages.inbounds.advanced.subtitle')}</div>
          </div>
        </div>
        <Tabs
          className="advanced-inner-tabs"
          items={[
            {
              key: 'all',
              label: t('pages.inbounds.advanced.all'),
              children: (
                <>
                  <div className="advanced-editor-meta">{t('pages.inbounds.advanced.allHelp')}</div>
                  <AdvancedAllEditor
                    streamEnabled={streamEnabled}
                    sniffingEnabled={sniffingSupported}
                  />
                </>
              ),
            },
            {
              key: 'settings',
              label: t('pages.inbounds.advanced.settings'),
              children: (
                <>
                  <div className="advanced-editor-meta">
                    {t('pages.inbounds.advanced.settingsHelp')}{' '}
                    <code>{'{ settings: { ... } }'}</code>.
                  </div>
                  <AdvancedSliceEditor
                    path="settings"
                    wrapKey="settings"
                    minHeight="320px"
                    maxHeight="540px"
                  />
                </>
              ),
            },
            ...(streamEnabled
              ? [
                {
                  key: 'stream',
                  label: t('pages.inbounds.advanced.stream'),
                  children: (
                    <>
                      <div className="advanced-editor-meta">
                        {t('pages.inbounds.advanced.streamHelp')}{' '}
                        <code>{'{ streamSettings: { ... } }'}</code>.
                      </div>
                      <AdvancedSliceEditor
                        path="streamSettings"
                        wrapKey="streamSettings"
                        minHeight="320px"
                        maxHeight="540px"
                      />
                    </>
                  ),
                },
              ]
              : []),
            ...(sniffingSupported
              ? [
                {
                  key: 'sniffing',
                  label: t('pages.inbounds.advanced.sniffing'),
                  children: (
                    <>
                      <div className="advanced-editor-meta">
                        {t('pages.inbounds.advanced.sniffingHelp')}{' '}
                        <code>{'{ sniffing: { ... } }'}</code>.
                      </div>
                      <AdvancedSliceEditor
                        path="sniffing"
                        wrapKey="sniffing"
                        minHeight="240px"
                        maxHeight="420px"
                      />
                    </>
                  ),
                },
              ]
              : []),
          ]}
        />
      </div>
    </div>
  );

  const sniffingTab = <SniffingTab />;
  const accessTab = <AccessTab />;

  return (
    <>
      {messageContextHolder}
      {modalContextHolder}
      <Modal
        open={open}
        title={title}
        okText={okText}
        cancelText={t('close')}
        confirmLoading={saving}
        mask={{ closable: false }}
        width={780}
        onOk={submit}
        onCancel={onClose}
        destroyOnHidden
      >
        <FormProvider {...methods}>
          <Form
            colon={false}
            labelCol={{ sm: { span: 8 } }}
            wrapperCol={{ sm: { span: 14 } }}
            labelWrap
          >
            {mode === 'add' && (
              <div className="inbound-preset-toolbar">
                <div className="inbound-preset-row">
                  <span className="preset-label">ISP Quick Presets:</span>
                  <Dropdown menu={{ items: ispMenuItems }} trigger={['click']}>
                    <Button size="small">
                      <Space>
                        Select ISP Package
                        <DownOutlined style={{ fontSize: 10 }} />
                      </Space>
                    </Button>
                  </Dropdown>
                  <Dropdown menu={{ items: port443MenuItems }} trigger={['click']}>
                    <Button size="small" type="dashed">
                      <Space>
                        Port 443 Packages ({port443Packages.length})
                        <DownOutlined style={{ fontSize: 10 }} />
                      </Space>
                    </Button>
                  </Dropdown>
                  <Button
                    size="small"
                    icon={<ImportOutlined />}
                    onClick={() => setLinkModalOpen(true)}
                  >
                    Match from Config Link
                  </Button>
                </div>
              </div>
            )}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'basic',
                  label: t('pages.xray.basicTemplate'),
                  children: basicTab,
                  forceRender: true,
                },
                ...((
                  [
                    Protocols.VLESS,
                    Protocols.SHADOWSOCKS,
                    Protocols.HTTP,
                    Protocols.MIXED,
                    Protocols.TUNNEL,
                    Protocols.TUN,
                    Protocols.WIREGUARD,
                    Protocols.MTPROTO,
                    Protocols.AMNEZIAWG,
                    Protocols.TUIC,
                  ] as string[]
                ).includes(protocol) || isFallbackHost
                  ? [
                    {
                      key: 'protocol',
                      label: t('pages.inbounds.protocol'),
                      children: protocolTab,
                      forceRender: true,
                    },
                  ]
                  : []),
                ...(streamEnabled
                  ? [
                    {
                      key: 'stream',
                      label: t('pages.inbounds.streamTab'),
                      children: streamTab,
                      forceRender: true,
                    },
                    ...(protocol !== Protocols.WIREGUARD && protocol !== Protocols.TUNNEL
                      ? [
                        {
                          key: 'security',
                          label: t('pages.inbounds.securityTab'),
                          children: securityTab,
                          forceRender: true,
                        },
                      ]
                      : []),
                  ]
                  : []),
                ...(sniffingSupported
                  ? [
                    {
                      key: 'sniffing',
                      label: t('pages.inbounds.sniffingTab'),
                      children: sniffingTab,
                      forceRender: true,
                    },
                  ]
                  : []),
                {
                  key: 'access',
                  label: 'Access',
                  children: accessTab,
                  forceRender: true,
                },
                {
                  key: 'advanced',
                  label: t('pages.xray.advancedTemplate'),
                  children: advancedTab,
                  forceRender: true,
                },
              ]}
            />
          </Form>
        </FormProvider>
      </Modal>

      <Modal
        open={linkModalOpen}
        title="Match from External Config Link"
        okText="Match & Apply"
        cancelText={t('close')}
        onCancel={() => {
          setLinkModalOpen(false);
          setLinkInputValue('');
        }}
        onOk={handleApplyFromLink}
        destroyOnHidden
      >
        <p style={{ color: 'var(--ant-color-text-secondary)', marginBottom: 12 }}>
          Paste any vless://, vmess://, or trojan:// configuration link from another panel or client. The parameters (protocol, port, SNI, transport, path, host) will be extracted and applied to this inbound.
        </p>
        <Input.TextArea
          rows={5}
          placeholder="vless://...@example.com:443?type=ws&security=tls&sni=zoom.us&path=%2Fgigaray..."
          value={linkInputValue}
          onChange={(e) => setLinkInputValue(e.target.value)}
        />
      </Modal>
    </>
  );
}
