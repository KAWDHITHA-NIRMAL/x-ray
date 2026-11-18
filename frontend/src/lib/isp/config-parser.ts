export interface ParsedProxyConfig {
  protocol: 'vless' | 'vmess' | 'trojan';
  uuidOrPassword?: string;
  address: string;
  port: number;
  network: 'ws' | 'tcp' | 'xhttp' | 'grpc' | 'httpupgrade';
  security: 'tls' | 'reality' | 'none';
  sni: string;
  path: string;
  host: string;
  headerType?: string;
  alpn?: string[];
  fp?: string;
  extra?: Record<string, unknown>;
  remark: string;
  rawUrl: string;
}

export function stripEmojis(text: string): string {
  if (!text) return '';
  return text
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{3297}\u{3299}\u{1F200}-\u{1F251}]/gu,
      '',
    )
    .trim();
}

export function parseProxyConfigLink(link: string): ParsedProxyConfig | null {
  const trimmed = link.trim();
  if (!trimmed) return null;

  try {
    let urlString = trimmed;
    // Decode if full URL was encoded
    if (!urlString.includes('://') && urlString.includes('%3A%2F%2F')) {
      urlString = decodeURIComponent(urlString);
    }

    const protoMatch = urlString.match(/^([a-z0-9_-]+):\/\//i);
    if (!protoMatch) return null;
    const protoLower = protoMatch[1].toLowerCase();

    if (protoLower === 'vless' || protoLower === 'trojan') {
      const parsedUrl = new URL(urlString);
      const uuidOrPassword = decodeURIComponent(parsedUrl.username || '');
      const address = parsedUrl.hostname || '';
      const port = Number(parsedUrl.port) || 443;
      const params = parsedUrl.searchParams;

      const networkRaw = (params.get('type') || params.get('network') || 'tcp').toLowerCase();
      const network = (
        ['ws', 'tcp', 'xhttp', 'grpc', 'httpupgrade'].includes(networkRaw) ? networkRaw : 'ws'
      ) as ParsedProxyConfig['network'];

      const securityRaw = (params.get('security') || 'none').toLowerCase();
      const security = (
        ['tls', 'reality', 'none'].includes(securityRaw) ? securityRaw : 'none'
      ) as ParsedProxyConfig['security'];

      const sni = params.get('sni') || '';
      const path = decodeURIComponent(params.get('path') || '/');
      const host = decodeURIComponent(params.get('host') || '');
      const headerType = params.get('headerType') || undefined;
      const alpnRaw = params.get('alpn');
      const alpn = alpnRaw ? alpnRaw.split(',') : undefined;
      const fp = params.get('fp') || 'chrome';

      let extra: Record<string, unknown> | undefined = undefined;
      const extraRaw = params.get('extra');
      if (extraRaw) {
        try {
          extra = JSON.parse(decodeURIComponent(extraRaw));
        } catch {
          // ignore
        }
      }
      if (!extra && (params.get('x_padding_bytes') || params.get('mode'))) {
        extra = {
          mode: params.get('mode') || 'auto',
          x_padding_bytes: params.get('x_padding_bytes') || '100-1000',
        };
      }

      const remark = stripEmojis(decodeURIComponent(parsedUrl.hash.replace(/^#/, '')));

      return {
        protocol: protoLower as 'vless' | 'trojan',
        uuidOrPassword,
        address,
        port,
        network,
        security,
        sni,
        path,
        host,
        headerType,
        alpn,
        fp,
        extra,
        remark,
        rawUrl: trimmed,
      };
    }

    if (protoLower === 'vmess') {
      const b64 = urlString.slice('vmess://'.length).trim();
      const decodedJson = atob(b64);
      const v = JSON.parse(decodedJson);

      const networkRaw = (v.net || 'tcp').toLowerCase();
      const network = (
        ['ws', 'tcp', 'xhttp', 'grpc', 'httpupgrade'].includes(networkRaw) ? networkRaw : 'ws'
      ) as ParsedProxyConfig['network'];

      const securityRaw = (v.tls === 'tls' ? 'tls' : 'none').toLowerCase();

      return {
        protocol: 'vmess',
        uuidOrPassword: v.id || '',
        address: v.add || '',
        port: Number(v.port) || 443,
        network,
        security: securityRaw as ParsedProxyConfig['security'],
        sni: v.sni || v.host || '',
        path: v.path || '/',
        host: v.host || '',
        headerType: v.type,
        alpn: v.alpn ? (Array.isArray(v.alpn) ? v.alpn : [v.alpn]) : undefined,
        fp: v.fp || 'chrome',
        remark: stripEmojis(v.ps || ''),
        rawUrl: trimmed,
      };
    }
  } catch {
    return null;
  }

  return null;
}
