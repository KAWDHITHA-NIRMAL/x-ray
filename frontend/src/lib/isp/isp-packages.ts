export type IspKey = 'dialog' | 'slt' | 'slt-mobitel' | 'mobitel' | 'airtel' | 'hutch' | 'all';
export type CategoryKey =
  | 'zoom'
  | 'youtube'
  | 'tiktok'
  | 'netflix'
  | 'social'
  | 'freedom'
  | 'custom';

export interface ISPPackage {
  id: string;
  name: string;
  isp: IspKey;
  ispName: string;
  category: CategoryKey;
  categoryName: string;
  protocol: 'vless' | 'vmess' | 'trojan';
  port: number;
  network: 'ws' | 'tcp' | 'xhttp' | 'grpc' | 'httpupgrade';
  security: 'tls' | 'reality' | 'none';
  sni: string;
  path?: string;
  host?: string;
  headerType?: string;
  frontAddress?: string;
  alpn?: string[];
  fp?: string;
  extra?: Record<string, unknown>;
  notes?: string;
  isDefault?: boolean;
  createdAt?: number;
}

export const DEFAULT_ISP_PACKAGES: ISPPackage[] = [
  // --- DIALOG ---
  {
    id: 'dialog-zoom-aka',
    name: 'Dialog Zoom (aka.ms Route)',
    isp: 'dialog',
    ispName: 'Dialog',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'aka.ms',
    path: '/codex',
    host: '',
    fp: 'chrome',
    notes: 'Dialog Zoom Package via aka.ms routing on standard TLS port 443',
    isDefault: true,
  },
  {
    id: 'dialog-zoom-std',
    name: 'Dialog Zoom (Standard)',
    isp: 'dialog',
    ispName: 'Dialog',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'zoom.us',
    path: '/codex',
    host: '',
    fp: 'chrome',
    notes: 'Direct Zoom TLS SNI on port 443',
    isDefault: true,
  },
  {
    id: 'dialog-zoom-teams',
    name: 'Dialog Zoom (Teams Route)',
    isp: 'dialog',
    ispName: 'Dialog',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'teams.microsoft.com',
    path: '/codex',
    host: '',
    fp: 'chrome',
    notes: 'Zoom traffic mapped over Teams SNI',
    isDefault: true,
  },
  {
    id: 'dialog-zoom-bypass',
    name: 'Dialog Zoom Mobile Bypass',
    isp: 'dialog',
    ispName: 'Dialog',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 2096,
    network: 'tcp',
    security: 'tls',
    sni: 'microsoft.com',
    headerType: 'none',
    fp: 'chrome',
    notes: 'Direct TCP TLS on port 2096 with microsoft.com SNI',
    isDefault: true,
  },
  {
    id: 'dialog-tiktok',
    name: 'Dialog TikTok',
    isp: 'dialog',
    ispName: 'Dialog',
    category: 'tiktok',
    categoryName: 'TikTok',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'tiktok.com',
    path: '/codex',
    fp: 'chrome',
    notes: 'Dialog TikTok official SNI package',
    isDefault: true,
  },
  {
    id: 'dialog-547-bypass-119',
    name: 'Dialog 547 / 797 WhatsApp Bypass',
    isp: 'dialog',
    ispName: 'Dialog',
    category: 'freedom',
    categoryName: 'Bypass / Freedom',
    protocol: 'vless',
    port: 119,
    network: 'tcp',
    security: 'tls',
    sni: 'whatsapp.net',
    headerType: 'none',
    fp: 'chrome',
    notes: 'Dialog 547/797 bypass routing through port 119 via whatsapp.net SNI',
    isDefault: true,
  },
  {
    id: 'dialog-547-bypass-high',
    name: 'Dialog 547 / 797 High-Port Bypass',
    isp: 'dialog',
    ispName: 'Dialog',
    category: 'freedom',
    categoryName: 'Bypass / Freedom',
    protocol: 'vless',
    port: 43808,
    network: 'tcp',
    security: 'tls',
    sni: 'whatsapp.net',
    headerType: 'none',
    fp: 'chrome',
    notes: 'High-port TCP TLS bypass for Dialog 547/797 plans',
    isDefault: true,
  },
  {
    id: 'dialog-speed-xhttp',
    name: 'Dialog 348 / 488 / 1188 Speed Bypass',
    isp: 'dialog',
    ispName: 'Dialog',
    category: 'freedom',
    categoryName: 'Bypass / Freedom',
    protocol: 'vless',
    port: 8080,
    network: 'xhttp',
    security: 'none',
    sni: '',
    path: '/codex',
    extra: { mode: 'auto', x_padding_bytes: '100-1000' },
    notes: 'XHTTP transport bypass on port 8080 with padding byte randomization',
    isDefault: true,
  },

  // --- SLT FIBER & BROADBAND ---
  {
    id: 'slt-fiber-zoom',
    name: 'SLT Fiber / ADSL Zoom',
    isp: 'slt',
    ispName: 'SLT Fiber',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'zoom.us',
    path: '/codex',
    fp: 'chrome',
    notes: 'SLT Fibre and ADSL high-speed Zoom tunnel on port 443',
    isDefault: true,
  },
  {
    id: 'slt-fiber-webex',
    name: 'SLT Fiber Zoom (Webex Route)',
    isp: 'slt',
    ispName: 'SLT Fiber',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'webex.com',
    path: '/codex',
    fp: 'chrome',
    notes: 'SLT Fiber Zoom routing via webex.com SNI',
    isDefault: true,
  },
  {
    id: 'slt-fiber-netflix',
    name: 'SLT Fiber Netflix',
    isp: 'slt',
    ispName: 'SLT Fiber',
    category: 'netflix',
    categoryName: 'Netflix',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'netflix.com',
    path: '/codex',
    fp: 'chrome',
    notes: 'SLT Fiber Netflix streaming plan on port 443',
    isDefault: true,
  },
  {
    id: 'slt-router-zoom-4g',
    name: 'SLT 4G Router Zoom',
    isp: 'slt',
    ispName: 'SLT Fiber / 4G',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 8443,
    network: 'ws',
    security: 'tls',
    sni: 'zoom.us',
    frontAddress: '141.193.213.20',
    path: '/codex',
    fp: 'chrome',
    notes: 'SLT 4G Wireless Router Zoom package on port 8443',
    isDefault: true,
  },

  // --- SLT-MOBITEL (MOBILE) ---
  {
    id: 'mobitel-zoom-iphunt',
    name: 'SLT-Mobitel Zoom (IP Hunt)',
    isp: 'slt-mobitel',
    ispName: 'SLT-Mobitel',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 8443,
    network: 'ws',
    security: 'tls',
    sni: 'zoom.us',
    frontAddress: '141.193.213.20',
    path: '/codex',
    fp: 'chrome',
    notes: 'Mobitel Zoom IP Hunt tunnel on port 8443',
    isDefault: true,
  },
  {
    id: 'mobitel-zoom-cf-rev',
    name: 'SLT-Mobitel Zoom (CF Reverse)',
    isp: 'slt-mobitel',
    ispName: 'SLT-Mobitel',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 8443,
    network: 'ws',
    security: 'tls',
    sni: 'news.zoom.us',
    path: '/codex',
    fp: 'chrome',
    notes: 'Mobitel Zoom Cloudflare reverse method via news.zoom.us SNI',
    isDefault: true,
  },
  {
    id: 'mobitel-all-zoom-443',
    name: 'SLT-Mobitel All Zoom (Port 443)',
    isp: 'slt-mobitel',
    ispName: 'SLT-Mobitel',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'zoom.us',
    path: '/codex',
    fp: 'chrome',
    notes: 'Mobitel Mobile SIM Zoom package via standard port 443 TLS',
    isDefault: true,
  },

  // --- AIRTEL ---
  {
    id: 'airtel-zoom-http',
    name: 'Airtel Zoom (Direct Port 80)',
    isp: 'airtel',
    ispName: 'Airtel',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 80,
    network: 'ws',
    security: 'none',
    sni: '',
    frontAddress: 'support.zoom.us',
    path: '/codex',
    notes: 'Airtel Zoom direct plaintext WS tunnel via support.zoom.us:80',
    isDefault: true,
  },
  {
    id: 'airtel-zoom-teams',
    name: 'Airtel Zoom (Teams Route)',
    isp: 'airtel',
    ispName: 'Airtel',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'teams.microsoft.com',
    path: '/codex',
    fp: 'chrome',
    notes: 'Airtel Zoom over Teams SNI',
    isDefault: true,
  },
  {
    id: 'airtel-youtube-std',
    name: 'Airtel YouTube (Standard)',
    isp: 'airtel',
    ispName: 'Airtel',
    category: 'youtube',
    categoryName: 'YouTube',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'youtube.com',
    path: '/codex',
    fp: 'chrome',
    notes: 'Airtel YouTube 443 WS TLS',
    isDefault: true,
  },
  {
    id: 'airtel-youtube-cf',
    name: 'Airtel YouTube (CF Reverse)',
    isp: 'airtel',
    ispName: 'Airtel',
    category: 'youtube',
    categoryName: 'YouTube',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'www.googleapics.eu.cc',
    path: '/codex',
    fp: 'chrome',
    notes: 'Airtel YouTube Cloudflare reverse proxy method',
    isDefault: true,
  },
  {
    id: 'airtel-freedom-148',
    name: 'Airtel Freedom (148 / 389 / 498)',
    isp: 'airtel',
    ispName: 'Airtel',
    category: 'freedom',
    categoryName: 'Bypass / Freedom',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'android.googleapics.cn',
    path: '/codex',
    fp: 'chrome',
    notes: 'Airtel 148 / 389 / 498 / Freedom data package SNI',
    isDefault: true,
  },
  {
    id: 'airtel-tiktok',
    name: 'Airtel TikTok',
    isp: 'airtel',
    ispName: 'Airtel',
    category: 'tiktok',
    categoryName: 'TikTok',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'tiktok.com',
    path: '/codex',
    fp: 'chrome',
    notes: 'Airtel TikTok streaming package',
    isDefault: true,
  },

  // --- HUTCH ---
  {
    id: 'hutch-zoom-partner',
    name: 'Hutch Zoom (Partner Route)',
    isp: 'hutch',
    ispName: 'Hutch',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'partner.zoom.us',
    path: '/codex',
    fp: 'chrome',
    notes: 'Hutch Zoom plan routed via partner.zoom.us',
    isDefault: true,
  },
  {
    id: 'hutch-zoom-direct',
    name: 'Hutch Zoom (Direct Route)',
    isp: 'hutch',
    ispName: 'Hutch',
    category: 'zoom',
    categoryName: 'Zoom / Video',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'support.zoom.us',
    path: '/codex',
    fp: 'chrome',
    notes: 'Hutch Zoom plan routed via support.zoom.us',
    isDefault: true,
  },
  {
    id: 'hutch-social-tme',
    name: 'Hutch Social (Telegram)',
    isp: 'hutch',
    ispName: 'Hutch',
    category: 'social',
    categoryName: 'Social Media',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 't.me',
    path: '/codex',
    fp: 'chrome',
    notes: 'Hutch Social Pack Telegram SNI',
    isDefault: true,
  },
  {
    id: 'hutch-social-org',
    name: 'Hutch Social (Telegram Org)',
    isp: 'hutch',
    ispName: 'Hutch',
    category: 'social',
    categoryName: 'Social Media',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'telegram.org',
    path: '/cs',
    fp: 'chrome',
    notes: 'Hutch Social Pack alternative telegram.org route',
    isDefault: true,
  },

  // --- ALL NETWORKS / UNIVERSAL ---
  {
    id: 'all-youtube-std',
    name: 'All Networks YouTube',
    isp: 'all',
    ispName: 'Universal / All Networks',
    category: 'youtube',
    categoryName: 'YouTube',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'www.youtube.com',
    path: '/codex',
    fp: 'chrome',
    notes: 'Universal YouTube SNI compatible across all Sri Lankan SIMs',
    isDefault: true,
  },
  {
    id: 'all-tiktok-std',
    name: 'All Networks TikTok',
    isp: 'all',
    ispName: 'Universal / All Networks',
    category: 'tiktok',
    categoryName: 'TikTok',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'www.tiktok.com',
    path: '/codex',
    fp: 'chrome',
    notes: 'Universal TikTok SNI for mobile plans',
    isDefault: true,
  },
  {
    id: 'all-social-whatsapp',
    name: 'All Networks WhatsApp',
    isp: 'all',
    ispName: 'Universal / All Networks',
    category: 'social',
    categoryName: 'Social Media',
    protocol: 'vless',
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: 'whatsapp.net',
    path: '/codex',
    fp: 'chrome',
    notes: 'All SIM Social WhatsApp package SNI on port 443',
    isDefault: true,
  },
];

const PACKAGES_STORAGE_KEY = 'xray-isp-packages-v1';

export function getStoredPackages(): ISPPackage[] {
  try {
    const raw = localStorage.getItem(PACKAGES_STORAGE_KEY);
    if (!raw) return DEFAULT_ISP_PACKAGES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_ISP_PACKAGES;
}

export function saveStoredPackages(pkgs: ISPPackage[]): void {
  try {
    localStorage.setItem(PACKAGES_STORAGE_KEY, JSON.stringify(pkgs));
  } catch {
    // ignore
  }
}

export function addCustomPackage(pkg: Omit<ISPPackage, 'id'>): ISPPackage {
  const current = getStoredPackages();
  const newPkg: ISPPackage = {
    ...pkg,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const updated = [newPkg, ...current];
  saveStoredPackages(updated);
  return newPkg;
}

export function updatePackage(pkg: ISPPackage): void {
  const current = getStoredPackages();
  const index = current.findIndex((p) => p.id === pkg.id);
  if (index >= 0) {
    current[index] = { ...pkg };
    saveStoredPackages([...current]);
  }
}

export function deletePackage(id: string): void {
  const current = getStoredPackages();
  const filtered = current.filter((p) => p.id !== id);
  saveStoredPackages(filtered);
}

export function resetPackagesToDefault(): ISPPackage[] {
  saveStoredPackages(DEFAULT_ISP_PACKAGES);
  return DEFAULT_ISP_PACKAGES;
}
