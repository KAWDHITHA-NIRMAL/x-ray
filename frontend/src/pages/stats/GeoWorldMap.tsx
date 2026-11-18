import { useCallback, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Marker,
  Sphere,
} from 'react-simple-maps';
import { ZoomableGroup } from 'react-simple-maps/zoom';
import type { ZoomPanCallbackProps } from 'react-simple-maps/zoom';
import type { GeoNode } from './types';
import CountryFlag from './CountryFlag';
import { SizeFormatter } from '@/utils';

// ISO 3166-1 numeric → alpha-2 lookup (world-atlas countries topology uses numeric IDs)
const NUM_TO_ALPHA2: Record<string, string> = {
  '144': 'LK',
  '702': 'SG',
  '458': 'MY',
  '360': 'ID',
  '276': 'DE',
  '840': 'US',
  '356': 'IN',
  '826': 'GB',
  '036': 'AU',
  '392': 'JP',
  '250': 'FR',
  '528': 'NL',
  '076': 'BR',
  '124': 'CA',
  '643': 'RU',
  '156': 'CN',
  '410': 'KR',
  '764': 'TH',
  '608': 'PH',
  '704': 'VN',
  '400': 'JO',
  '784': 'AE',
  '682': 'SA',
  '818': 'EG',
  '566': 'NG',
  '024': 'AO',
  '710': 'ZA',
  '170': 'CO',
  '032': 'AR',
  '484': 'MX',
  '752': 'SE',
  '578': 'NO',
  '246': 'FI',
  '208': 'DK',
  '040': 'AT',
  '756': 'CH',
  '724': 'ES',
  '380': 'IT',
  '616': 'PL',
  '498': 'MD',
  '804': 'UA',
  '792': 'TR',
  '364': 'IR',
  '586': 'PK',
  '050': 'BD',
};

const GEO_URL = '/world-110m.json';

function getCountryFill(
  alpha2: string | undefined,
  activeSet: Set<string>,
  selectedCountry: string | undefined,
  hoveredCountry: string | undefined,
): string {
  if (!alpha2) return 'var(--map-land-default)';
  if (alpha2 === selectedCountry) return 'rgba(56, 189, 248, 0.5)';
  if (alpha2 === hoveredCountry) return 'rgba(56, 189, 248, 0.22)';
  if (activeSet.has(alpha2)) {
    if (alpha2 === 'LK') return 'rgba(56, 189, 248, 0.38)';
    if (alpha2 === 'SG') return 'rgba(236, 72, 153, 0.42)';
    return 'rgba(52, 211, 153, 0.32)';
  }
  return 'var(--map-land-default)';
}

interface GeoWorldMapProps {
  nodes: GeoNode[];
  selectedCountry?: string;
  onSelectCountry?: (countryCode: string | undefined) => void;
  className?: string;
}

export default function GeoWorldMap({
  nodes,
  selectedCountry,
  onSelectCountry,
  className = '',
}: GeoWorldMapProps) {
  const [hoveredNode, setHoveredNode] = useState<GeoNode | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | undefined>(undefined);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([12, 8]);

  const activeSet = new Set(nodes.map((n) => n.code));

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.6, 10)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z / 1.6, 1)), []);
  const handleReset = useCallback(() => {
    setZoom(1);
    setCenter([12, 8]);
  }, []);

  const handleMoveEnd = useCallback((pos: ZoomPanCallbackProps) => {
    if (pos.zoom !== undefined) setZoom(pos.zoom);
    if (pos.coordinates) setCenter(pos.coordinates);
  }, []);

  return (
    <div className={`geo-world-map-container ${className}`}>
      {/* Legend + Zoom Controls */}
      <div className="map-legend-bar">
        <div className="legend-items">
          <span className="legend-chip">
            <span className="dot dot-cyan" /> Direct Inbound
          </span>
          <span className="legend-chip">
            <span className="dot dot-amber" /> Client Origin
          </span>
          <span className="legend-chip">
            <span className="dot dot-purple" /> Central Server (SG)
          </span>
        </div>

        <div className="map-controls-group">
          {selectedCountry && (
            <button
              type="button"
              className="map-filter-pill"
              onClick={() => onSelectCountry?.(undefined)}
            >
              {selectedCountry} ✕
            </button>
          )}
          <button type="button" className="map-zoom-btn" onClick={handleZoomIn} title="Zoom In">
            +
          </button>
          <button type="button" className="map-zoom-btn" onClick={handleZoomOut} title="Zoom Out">
            −
          </button>
          <button
            type="button"
            className="map-zoom-btn map-reset-btn"
            onClick={handleReset}
            title="Reset"
          >
            ⌂
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="map-rsm-viewport">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 175, center: [12, 5] }}
          width={800}
          height={420}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup
            zoom={zoom}
            center={center}
            minZoom={1}
            maxZoom={10}
            onMoveEnd={handleMoveEnd}
          >
            {/* Ocean backdrop */}
            <Sphere id="rsm-sphere-bg" stroke="transparent" fill="var(--map-ocean)" />

            {/* Grid lines every 20° */}
            <Graticule stroke="var(--map-graticule)" strokeWidth={0.4} step={[20, 20]} />

            {/* Country Geographies */}
            <Geographies geography={GEO_URL}>
              {({ geographies, borders }) => (
                <>
                  {geographies.map((geo) => {
                    const numId = String(geo.id);
                    const alpha2 = NUM_TO_ALPHA2[numId];
                    const isActive = alpha2 ? activeSet.has(alpha2) : false;
                    const fill = getCountryFill(alpha2, activeSet, selectedCountry, hoveredCountry);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="var(--map-border)"
                        strokeWidth={0.45}
                        style={{
                          outline: 'none',
                          cursor: isActive ? 'pointer' : 'default',
                          transition: 'fill 0.2s ease',
                        }}
                        onMouseEnter={() => {
                          if (alpha2) setHoveredCountry(alpha2);
                          if (isActive && alpha2) {
                            const node = nodes.find((n) => n.code === alpha2);
                            if (node) setHoveredNode(node);
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredCountry(undefined);
                          setHoveredNode(null);
                        }}
                        onClick={() => {
                          if (isActive && alpha2) {
                            onSelectCountry?.(selectedCountry === alpha2 ? undefined : alpha2);
                          }
                        }}
                      />
                    );
                  })}

                  {/* Single unified border path (avoids overlap artifacts) */}
                  <path
                    d={borders?.svgPath || ''}
                    fill="none"
                    stroke="var(--map-border)"
                    strokeWidth={0.4}
                  />
                </>
              )}
            </Geographies>

            {/* Pulsing Markers for active geo nodes */}
            {nodes.map((node) => {
              const isHub = node.role === 'hub' || node.code === 'SG';
              const isSelected = selectedCountry === node.code;
              const isHovered = hoveredNode?.code === node.code;
              const pinColor = isHub
                ? '#ec4899'
                : node.code === 'LK'
                  ? '#38bdf8'
                  : '#34d399';
              const baseR = isHub ? 7 : 5.5;
              const displayR = isSelected || isHovered ? baseR + 2.5 : baseR;

              return (
                <Marker
                  key={`marker-${node.code}`}
                  coordinates={[node.lng, node.lat]}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Animated pulse ring */}
                  <circle
                    r={baseR + 4}
                    fill="none"
                    stroke={pinColor}
                    strokeWidth={1.2}
                    opacity={0.7}
                    style={{ animation: 'rsmPulse 2.2s ease-out infinite' }}
                  />
                  {/* Second slower ring on hub */}
                  {isHub && (
                    <circle
                      r={baseR + 8}
                      fill="none"
                      stroke={pinColor}
                      strokeWidth={0.8}
                      opacity={0.4}
                      style={{ animation: 'rsmPulse 2.2s ease-out infinite 0.6s' }}
                    />
                  )}

                  {/* Filled core pin */}
                  <circle
                    r={displayR}
                    fill={pinColor}
                    stroke="#ffffff"
                    strokeWidth={isHub ? 2 : 1.5}
                    style={{
                      filter: `drop-shadow(0 0 ${isHub ? 8 : 5}px ${pinColor})`,
                      transition: 'r 0.15s ease',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCountry?.(selectedCountry === node.code ? undefined : node.code);
                    }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                  />

                  {/* City / country label */}
                  {(isHub || node.code === 'LK' || isSelected || isHovered) && (
                    <text
                      y={isHub ? -baseR - 8 : baseR + 11}
                      textAnchor="middle"
                      style={{
                        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                        fontSize: isHub ? '8px' : '7px',
                        fontWeight: 700,
                        fill: pinColor,
                        pointerEvents: 'none',
                        userSelect: 'none',
                        paintOrder: 'stroke',
                        stroke: 'rgba(0,0,0,0.85)',
                        strokeWidth: '3px',
                        strokeLinejoin: 'round',
                      }}
                    >
                      {node.code === 'LK'
                        ? 'Sri Lanka'
                        : node.code === 'SG'
                          ? 'SG Hub'
                          : node.city}
                    </text>
                  )}
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {/* Hover Tooltip Card (bottom-right corner, non-blocking) */}
        {hoveredNode && (
          <div className="map-floating-card">
            <div className="card-header">
              <CountryFlag
                countryCode={hoveredNode.code}
                countryName={hoveredNode.country}
                size={18}
              />
              <div className="card-title">
                <strong>{hoveredNode.country}</strong>
                <span>{hoveredNode.city}</span>
              </div>
              <span className={`card-badge ${hoveredNode.status}`}>
                {hoveredNode.status.toUpperCase()}
              </span>
            </div>
            <div className="card-body">
              <div className="card-metric">
                <span className="label">Sessions</span>
                <span className="val">
                  {hoveredNode.sessions} · {hoveredNode.clients} clients
                </span>
              </div>
              <div className="card-metric">
                <span className="label">Bandwidth</span>
                <span className="val">{SizeFormatter.sizeFormat(hoveredNode.trafficBytes)}</span>
              </div>
              <div className="card-metric">
                <span className="label">Latency</span>
                <span className="val highlight">{hoveredNode.avgLatencyMs} ms</span>
              </div>
              <div className="card-metric">
                <span className="label">ISP</span>
                <span className="val isp-name">{hoveredNode.isp}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
