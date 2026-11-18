export interface GeoStatsKPIs {
  totalTrafficBytes: number;
  activeSessions: number;
  connectedClients: number;
  topCountry: {
    name: string;
    code: string;
    percent: number;
    count: number;
  };
  avgLatencyMs: number;
  deltas: {
    traffic: string;
    sessions: string;
    clients: string;
    topCountry: string;
  };
  sparklines: {
    traffic: number[];
    sessions: number[];
    clients: number[];
    topCountry: number[];
  };
}

export interface ServerRequestSeries {
  name: string;
  color: string;
  data: number[];
}

export interface ServerRequestsData {
  timestamps: string[];
  series: ServerRequestSeries[];
}

export interface ClientLoadBar {
  time: string;
  latencyMs: number;
  loadPercent: number;
  split: [number, number];
}

export interface ClientLoadLatencyData {
  timestamps: string[];
  bars: ClientLoadBar[];
}

export interface GeoNode {
  country: string;
  code: string;
  city: string;
  lat: number;
  lng: number;
  clients: number;
  sessions: number;
  trafficBytes: number;
  upBytes: number;
  downBytes: number;
  avgLatencyMs: number;
  isp: string;
  status: 'active' | 'idle' | 'down';
  role: 'client' | 'hub';
}

export interface ClientConnection {
  id: string;
  country: string;
  countryCode: string;
  city: string;
  clientEmail: string;
  clientIp: string;
  isp: string;
  inboundTag: string;
  protocol: string;
  port: number;
  upBytes: number;
  downBytes: number;
  totalBytes: number;
  status: 'ACTIVE' | 'IDLE' | 'DOWN';
  latencyMs: number;
  signalBars: number;
  lastSeen: number;
  connectedDuration: string;
  clientConfig?: string;
}

export interface GeoStatsResponse {
  kpis: GeoStatsKPIs;
  serverRequests: ServerRequestsData;
  clientLoadLatency: ClientLoadLatencyData;
  geoNodes: GeoNode[];
  connections: ClientConnection[];
}
