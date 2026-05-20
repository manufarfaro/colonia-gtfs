// AVL marker shape — parser output. The matcher consumes this.
export interface AvlMarker {
  /** Operator-side vehicle identifier */
  id: string;
  /** Route short name (line number as string: '3', '4', '5', '8') */
  lin: string;
  /** Direction id (0 inbound, 1 outbound) */
  dir: 0 | 1;
  lat: number;
  lon: number;
  /** Timestamp of the AVL reading */
  time: Date;
  /** Speed in km/h (operator-supplied) */
  speed: number;
  /** Heading in degrees (0-359) */
  head: number;
  /** Optional operator-side service identifier — fast-path for matching (design D-05.1) */
  srv?: string;
}

export type MatchResult =
  | { kind: 'matched'; tripId: string; via: 'srv' | 'snap'; distanceMeters?: number }
  | {
      kind: 'unmatched';
      reason: 'no-active-service' | 'no-candidates' | 'beyond-threshold';
      bestDistanceMeters?: number;
    };
