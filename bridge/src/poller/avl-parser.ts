import { XMLParser } from 'fast-xml-parser';
import * as iconv from 'iconv-lite';
import type { AvlMarker } from '../matcher/types';

export class AvlParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AvlParseError';
  }
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  // Treat <marker/> as always-array even when there's one.
  isArray: (tagName) => tagName === 'marker',
});

interface RawMarker {
  id?: string;
  lin?: string;
  dir?: string;
  lat?: string;
  lon?: string;
  time?: string;
  speed?: string;
  head?: string;
  srv?: string;
}

interface RawDocument {
  markers?: { marker?: RawMarker[] };
}

function requireField(v: unknown, name: string): string {
  if (v === undefined || v === null || v === '') {
    throw new AvlParseError(`marker missing required attribute: ${name}`);
  }
  return String(v);
}

function parseMarker(raw: RawMarker): AvlMarker {
  const lin = requireField(raw.lin, 'lin');
  const dirStr = requireField(raw.dir, 'dir');
  const dir = Number.parseInt(dirStr, 10);
  if (dir !== 0 && dir !== 1) {
    throw new AvlParseError(`marker.dir must be 0 or 1, got: ${dirStr}`);
  }
  const lat = Number.parseFloat(requireField(raw.lat, 'lat'));
  const lon = Number.parseFloat(requireField(raw.lon, 'lon'));
  const timeStr = requireField(raw.time, 'time');
  // AVL format: "YYYY-MM-DD HH:MM:SS" in America/Montevideo local time.
  // We interpret as Montevideo local; convert to a UTC Date.
  const time = parseMontevideoTimestamp(timeStr);
  const speed = Number.parseFloat(requireField(raw.speed, 'speed'));
  const head = Number.parseFloat(requireField(raw.head, 'head'));
  const id = requireField(raw.id, 'id');
  return {
    id,
    lin,
    dir: dir as 0 | 1,
    lat,
    lon,
    time,
    speed,
    head,
    srv: raw.srv && raw.srv !== '' ? raw.srv : undefined,
  };
}

function parseMontevideoTimestamp(raw: string): Date {
  // "YYYY-MM-DD HH:MM:SS" local Montevideo (UY is UTC-3 year-round, no DST
  // since 2015).
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) {
    throw new AvlParseError(`unparseable marker.time: ${raw}`);
  }
  const [, y, mo, d, h, mi, s] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`);
}

export function parseAvlXml(buf: Buffer): AvlMarker[] {
  let text: string;
  try {
    text = iconv.decode(buf, 'iso-8859-1');
  } catch (err) {
    throw new AvlParseError('failed to decode upstream bytes as ISO-8859-1', { cause: err });
  }
  let parsed: RawDocument;
  try {
    parsed = xmlParser.parse(text) as RawDocument;
  } catch (err) {
    throw new AvlParseError('failed to parse XML', { cause: err });
  }
  if (!parsed.markers) {
    throw new AvlParseError('XML root element is not <markers>');
  }
  const rawMarkers = parsed.markers.marker ?? [];
  return rawMarkers.map(parseMarker);
}
