import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, deduping conflicting utilities.
 * Used by every shadcn/ui component.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
