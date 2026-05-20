import { NextResponse } from 'next/server';

export function GET(): Response {
  return NextResponse.json(
    {
      error: 'not_implemented',
      detail: 'Tickets endpoint is reserved for a future spec; not part of v0.',
    },
    { status: 501 },
  );
}
