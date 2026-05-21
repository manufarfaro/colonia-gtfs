'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { getLineColor } from '@/lib/colors/lines';
import { busMarkerIconUrl } from '@/lib/icons/marker-icons';

/**
 * Live vehicle marker. Renders as a `google.maps.Marker` with the
 * Lucide bus icon tinted to the line color. The marker is created ONCE
 * per (map, shortName) and its position/title/info-window content are
 * updated in place on every poll. Click opens an `InfoWindow` with the
 * vehicle's line, headsign, and last update timestamp. Runtime-only —
 * coverage excluded via vitest.config.
 */
/* v8 ignore start */
interface Props {
  shortName: string;
  label: string | null;
  headsign: string | null;
  lat: number;
  lng: number;
  bearing: number | null;
  timestamp: number | null;
}

function formatTimestamp(ts: number | null): string {
  if (ts === null) return '—';
  const date = new Date(ts * 1000);
  return new Intl.DateTimeFormat('es-UY', {
    timeZone: 'America/Montevideo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function buildInfoHtml(p: Props): string {
  const color = getLineColor(p.shortName);
  const lines = [
    `<div style="font-family:var(--font-body,sans-serif);font-size:13px;line-height:1.5;padding:2px 4px;">`,
    `  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">`,
    `    <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${color};"></span>`,
    `    <strong>Línea ${escapeHtml(p.shortName)}</strong>`,
    `  </div>`,
  ];
  if (p.headsign) {
    lines.push(
      `  <div style="color:#666;">→ ${escapeHtml(p.headsign)}</div>`,
    );
  }
  if (p.label) {
    lines.push(
      `  <div style="color:#999;font-size:11px;margin-top:4px;">${escapeHtml(p.label)}</div>`,
    );
  }
  lines.push(
    `  <div style="color:#999;font-size:11px;margin-top:4px;">Última posición · ${formatTimestamp(p.timestamp)}</div>`,
  );
  if (p.bearing !== null) {
    lines.push(
      `  <div style="color:#999;font-size:11px;">Rumbo · ${p.bearing}°</div>`,
    );
  }
  lines.push(`</div>`);
  return lines.join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function VehicleMarker(props: Props): React.ReactElement | null {
  const { shortName, label, lat, lng, bearing } = props;
  const map = useMap();
  const markerRef = useRef<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!map) return;
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: bearing !== null ? `${label ?? shortName} · ${bearing}°` : (label ?? shortName),
      icon: {
        url: busMarkerIconUrl(getLineColor(shortName)),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16),
      },
      zIndex: 10,
    });
    const infoWindow = new google.maps.InfoWindow({ disableAutoPan: false });
    const listener = marker.addListener('click', () => {
      infoWindow.setContent(buildInfoHtml(propsRef.current));
      infoWindow.open({ map, anchor: marker });
    });
    markerRef.current = marker;
    infoWindowRef.current = infoWindow;
    return () => {
      listener.remove();
      infoWindow.close();
      marker.setMap(null);
      markerRef.current = null;
      infoWindowRef.current = null;
    };
  }, [map, shortName]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.setPosition({ lat, lng });
    marker.setTitle(bearing !== null ? `${label ?? shortName} · ${bearing}°` : (label ?? shortName));
  }, [lat, lng, label, bearing, shortName]);

  return null;
}
/* v8 ignore stop */
