import { OdModeShell } from '@/components/od/OdModeShell';

/**
 * Server component for `/`. Reads the public Google Maps API key from
 * the env at request time and forwards it to the OD client shell. If
 * the key is missing the shell renders a static "API key missing"
 * banner instead of the map — chrome + endpoints stay functional.
 */
export default function HomePage(): React.ReactElement {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;
  return <OdModeShell apiKey={apiKey} />;
}
