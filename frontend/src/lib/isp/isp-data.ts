import ispLogosJson from '@/assets/media/isp_logos.json';
import socialIconsJson from '@/assets/media/social_media_icons.json';

export interface IspLogoItem {
  name: string;
  image: string;
}

export interface SocialIconItem {
  name: string;
  image: string;
}

export const SLT_FIBER_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 32"><rect width="36" height="32" rx="5" fill="%23ffffff"/><text x="3" y="14" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="%23004F9E" letter-spacing="-0.5">SLT</text><path d="M25 6 C28 6, 32 9, 33 13 C31 16, 27 17, 24 17" fill="none" stroke="%2300A3E0" stroke-width="2.5" stroke-linecap="round"/><circle cx="33" cy="13" r="2" fill="%2378BE20"/><rect x="3" y="17" width="30" height="11.5" rx="3" fill="%230072CE"/><text x="4.5" y="25.5" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="8.5" fill="%23ffffff" letter-spacing="0.8">FIBRE</text></svg>';

export const SLT_MOBITEL_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 32"><rect width="36" height="32" rx="5" fill="%23ffffff"/><path d="M4.5 8.5 L8 3.5 L10 4.5 L6.5 9.5 Z" fill="%2300A3E0"/><path d="M3.5 17 L7.5 10.5 L9.5 11.5 L5.5 18 Z" fill="%23004F9E"/><path d="M6.5 24 L10.5 14 L12.5 15 L8.5 25 Z" fill="%2378BE20"/><text x="12.5" y="14" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="11.5" fill="%23004F9E" letter-spacing="-0.5">SLT</text><text x="3.5" y="26.5" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="8.5" fill="%232E7D32" letter-spacing="-0.2">MOBITEL</text></svg>';

export const MOBITEL_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 32"><rect width="36" height="32" rx="4" fill="%23ffffff"/><rect x="3" y="4" width="30" height="24" rx="3" fill="%23004F9E"/><path d="M3 4 L33 4 L33 15 L3 15 Z" fill="%2378BE20"/><text x="6" y="23" font-family="system-ui, -apple-system, sans-serif" font-style="italic" font-weight="900" font-size="17" fill="%23ffffff">M</text><text x="17" y="21" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="7.5" fill="%23ffffff" letter-spacing="-0.2">obitel</text></svg>';

export const ISP_LOGOS: Record<string, string> = {
  slt: SLT_FIBER_SVG,
  'slt-mobitel': SLT_MOBITEL_SVG,
  mobitel: MOBITEL_SVG,
};

for (const item of (ispLogosJson as { items: IspLogoItem[] }).items || []) {
  const lower = item.name.toLowerCase();
  if (lower.includes('dialog')) {
    ISP_LOGOS.dialog = item.image;
  } else if (lower.includes('airtel')) {
    ISP_LOGOS.airtel = item.image;
  } else if (lower.includes('hutch')) {
    ISP_LOGOS.hutch = item.image;
  }
}

export const SERVICE_ICONS: Record<string, string> = {};
for (const item of (socialIconsJson as { items: SocialIconItem[] }).items || []) {
  const lower = item.name.toLowerCase();
  if (lower.includes('video call') || lower.includes('zoom')) {
    SERVICE_ICONS.zoom = item.image;
    SERVICE_ICONS['video-call'] = item.image;
  } else if (lower.includes('whatsapp')) {
    SERVICE_ICONS.whatsapp = item.image;
  } else if (lower.includes('youtube')) {
    SERVICE_ICONS.youtube = item.image;
  } else if (lower.includes('teams')) {
    SERVICE_ICONS.teams = item.image;
  } else if (lower.includes('facebook')) {
    SERVICE_ICONS.facebook = item.image;
  } else if (lower.includes('instagram')) {
    SERVICE_ICONS.instagram = item.image;
  } else if (lower.includes('twitter') || lower.includes('x')) {
    SERVICE_ICONS.twitter = item.image;
    SERVICE_ICONS.x = item.image;
  }
}

SERVICE_ICONS.tiktok =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2325F4EE"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>';
SERVICE_ICONS.netflix =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23E50914"><path d="M4 2v20l4-2V2H4zm8 0v20l4-2V2h-4zm-2 2.2L16 20h2L12 4.2h-2z"/></svg>';
SERVICE_ICONS.telegram =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%232AABEE"/><path fill="%23ffffff" d="M5.4 12l10.8-4.5c.5-.2 1 .1.8.7l-1.8 8.6c-.1.6-.5.7-1 .4l-2.8-2.1-1.3 1.3c-.2.2-.3.3-.6.3l.2-2.8 5.1-4.6c.2-.2 0-.3-.3-.1l-6.3 4-2.7-.9c-.6-.2-.6-.6.1-.9z"/></svg>';

ISP_LOGOS.all =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%231677ff"><circle cx="12" cy="12" r="10" stroke="%231677ff" stroke-width="2" fill="none"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="%231677ff" stroke-width="2" fill="none"/></svg>';

export function getIspLogo(isp: string): string | undefined {
  const key = isp.toLowerCase().trim();
  if (key.includes('dialog')) return ISP_LOGOS.dialog;
  if (key === 'slt' || key.includes('fiber') || key.includes('fibre')) return ISP_LOGOS.slt;
  if (key === 'mobitel') return ISP_LOGOS.mobitel || ISP_LOGOS['slt-mobitel'];
  if (key.includes('slt') || key.includes('mobitel')) return ISP_LOGOS['slt-mobitel'];
  if (key.includes('airtel')) return ISP_LOGOS.airtel;
  if (key.includes('hutch')) return ISP_LOGOS.hutch;
  if (key === 'all' || key.includes('universal')) return ISP_LOGOS.all;
  return undefined;
}

export function getServiceIcon(categoryOrName: string): string | undefined {
  const key = categoryOrName.toLowerCase().trim();
  if (key.includes('zoom') || key.includes('video') || key.includes('webex')) return SERVICE_ICONS.zoom;
  if (key.includes('whatsapp')) return SERVICE_ICONS.whatsapp;
  if (key.includes('youtube')) return SERVICE_ICONS.youtube;
  if (key.includes('teams')) return SERVICE_ICONS.teams;
  if (key.includes('facebook')) return SERVICE_ICONS.facebook;
  if (key.includes('instagram')) return SERVICE_ICONS.instagram;
  if (key.includes('twitter') || key === 'x') return SERVICE_ICONS.twitter;
  if (key.includes('tiktok')) return SERVICE_ICONS.tiktok;
  if (key.includes('netflix')) return SERVICE_ICONS.netflix;
  if (key.includes('telegram') || key.includes('t.me')) return SERVICE_ICONS.telegram;
  return undefined;
}

export interface DetectedBadge {
  ispKey?: 'dialog' | 'slt-mobitel' | 'slt' | 'mobitel' | 'airtel' | 'hutch' | 'all';
  ispName?: string;
  ispLogo?: string;
  serviceKey?: string;
  serviceName?: string;
  serviceIcon?: string;
}

export function detectIspAndService(text: string, sni?: string): DetectedBadge {
  const combined = `${text || ''} ${sni || ''}`.toLowerCase();
  const badge: DetectedBadge = {};

  // Detect ISP
  if (combined.includes('dialog') || combined.includes('aka.ms')) {
    badge.ispKey = 'dialog';
    badge.ispName = 'Dialog';
    badge.ispLogo = ISP_LOGOS.dialog;
  } else if (
    (combined.includes('slt') && combined.includes('mobitel')) ||
    combined.includes('slt-mobitel')
  ) {
    badge.ispKey = 'slt-mobitel';
    badge.ispName = 'SLT-Mobitel';
    badge.ispLogo = ISP_LOGOS['slt-mobitel'];
  } else if (
    combined.includes('slt') ||
    combined.includes('fibre') ||
    combined.includes('fiber') ||
    combined.includes('adsl')
  ) {
    badge.ispKey = 'slt';
    badge.ispName = 'SLT Fiber';
    badge.ispLogo = ISP_LOGOS.slt || ISP_LOGOS['slt-mobitel'];
  } else if (combined.includes('mobitel')) {
    badge.ispKey = 'mobitel';
    badge.ispName = 'Mobitel';
    badge.ispLogo = ISP_LOGOS.mobitel || ISP_LOGOS['slt-mobitel'];
  } else if (combined.includes('airtel') || combined.includes('googleapics')) {
    badge.ispKey = 'airtel';
    badge.ispName = 'Airtel';
    badge.ispLogo = ISP_LOGOS.airtel;
  } else if (combined.includes('hutch')) {
    badge.ispKey = 'hutch';
    badge.ispName = 'Hutch';
    badge.ispLogo = ISP_LOGOS.hutch;
  }

  // Detect Service
  if (combined.includes('zoom') || combined.includes('webex') || combined.includes('teams')) {
    badge.serviceKey = 'zoom';
    badge.serviceName = 'Zoom';
    badge.serviceIcon = combined.includes('teams') ? SERVICE_ICONS.teams : SERVICE_ICONS.zoom;
  } else if (combined.includes('youtube')) {
    badge.serviceKey = 'youtube';
    badge.serviceName = 'YouTube';
    badge.serviceIcon = SERVICE_ICONS.youtube;
  } else if (combined.includes('tiktok')) {
    badge.serviceKey = 'tiktok';
    badge.serviceName = 'TikTok';
    badge.serviceIcon = SERVICE_ICONS.tiktok;
  } else if (combined.includes('netflix')) {
    badge.serviceKey = 'netflix';
    badge.serviceName = 'Netflix';
    badge.serviceIcon = SERVICE_ICONS.netflix;
  } else if (combined.includes('whatsapp')) {
    badge.serviceKey = 'whatsapp';
    badge.serviceName = 'WhatsApp';
    badge.serviceIcon = SERVICE_ICONS.whatsapp;
  } else if (combined.includes('telegram') || combined.includes('t.me')) {
    badge.serviceKey = 'telegram';
    badge.serviceName = 'Telegram';
    badge.serviceIcon = SERVICE_ICONS.telegram;
  }

  return badge;
}
