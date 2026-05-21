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
  isArray: (tagName) => tagName === 'marker',
});

/**
 * Operator's AVL response shape. Root is `<list>` with `<marker>` children;
 * each marker carries its fields as CHILD ELEMENTS (not attributes).
 *
 * Field reference (observed in production):
 *   lat / lon — coordinates
 *   id        — vehicle id (operator-side)
 *   rum       — heading degrees
 *   est       — state ("n" normal, etc.)
 *   bus       — bus number
 *   bmt       — license plate / bus identifier
 *   bac       — speed
 *   bas/bpp   — ancillary metadata (unused)
 *   fec       — date "DD/MM/YYYY"
 *   hor       — time "HH:MM:SS"
 *   lin       — route short name (3, 4, 5, 8)
 *   tra       — track / pattern (1, 2, 3, 4)
 *   sen       — direction
 *   lnm       — line / headsign description
 *   sal       — scheduled departure "HH:MM"
 *   srv       — operator's trip service id (matches our trips.txt
 *               `original_trip_id` column)
 *   ord       — sequence order
 *   p1c       — current stop code
 *   p1n       — current stop name
 *   ico       — icon code
 *
 * The bridge collapses `tra` to a GTFS `direction_id` (0 or 1): tra=1 → 0,
 * tra=2 → 1. Other tra values (3, 4) are dropped per the GTFS feed
 * generation policy that only keeps the two canonical directions.
 */
interface RawMarker {
  id?: string;
  lin?: string;
  tra?: string;
  lat?: string;
  lon?: string;
  fec?: string;
  hor?: string;
  bac?: string;
  rum?: string;
  srv?: string;
}

interface RawDocument {
  list?: { marker?: RawMarker[] };
}

function requireField(v: unknown, name: string): string {
  if (v === undefined || v === null || v === '') {
    throw new AvlParseError(`marker missing required field: ${name}`);
  }
  return String(v);
}

const TRA_TO_DIR: Record<string, 0 | 1> = { '1': 0, '2': 1 };

function parseMarker(raw: RawMarker): AvlMarker | null {
  const lin = requireField(raw.lin, 'lin');
  const traStr = requireField(raw.tra, 'tra');
  const dir = TRA_TO_DIR[traStr];
  if (dir === undefined) {
    // Skip non-canonical patterns (tra=3 / tra=4) — they correspond to
    // operator's rare alternates that the GTFS feed does not model.
    return null;
  }
  const lat = Number.parseFloat(requireField(raw.lat, 'lat'));
  const lon = Number.parseFloat(requireField(raw.lon, 'lon'));
  const fec = requireField(raw.fec, 'fec');
  const hor = requireField(raw.hor, 'hor');
  const time = parseMontevideoTimestamp(fec, hor);
  const speed = Number.parseFloat(raw.bac ?? '0');
  const head = Number.parseFloat(raw.rum ?? '0');
  const id = requireField(raw.id, 'id');
  return {
    id,
    lin,
    dir,
    lat,
    lon,
    time,
    speed: Number.isFinite(speed) ? speed : 0,
    head: Number.isFinite(head) ? head : 0,
    srv: raw.srv && raw.srv !== '' ? raw.srv : undefined,
  };
}

function parseMontevideoTimestamp(fec: string, hor: string): Date {
  // fec is "DD/MM/YYYY", hor is "HH:MM:SS" (or "HH:MM") — both in
  // America/Montevideo local time (UY is UTC-3 year-round, no DST).
  const fm = fec.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const hm = hor.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!fm || !hm) {
    throw new AvlParseError(`unparseable marker time: fec="${fec}" hor="${hor}"`);
  }
  const [, dd, mm, yyyy] = fm;
  const [, h, mi, s] = hm;
  return new Date(`${yyyy}-${mm}-${dd}T${h}:${mi}:${s ?? '00'}-03:00`);
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
  if (!parsed.list) {
    throw new AvlParseError('XML root element is not <list>');
  }
  const rawMarkers = parsed.list.marker ?? [];
  const out: AvlMarker[] = [];
  for (const raw of rawMarkers) {
    const m = parseMarker(raw);
    if (m !== null) out.push(m);
  }
  return out;
}
