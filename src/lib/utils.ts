import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips FiveM color codes from server names
 * Removes: ^0-^9, ^*, ~r~, ~b~, etc., and preserves content in brackets like [DK]
 */
export function stripColorCodes(str: string): string {
  if (!str) return '';
  return str
    .replace(/\^[0-9#\*]/g, '')   // Remove ^0-^9, ^#, ^*
    .replace(/\^(?=[A-Za-z])/g, '') // Remove stray ^ before letters (like ^Legacy -> Legacy)
    .replace(/~[a-zA-Z]~/g, '')   // Remove ~r~, ~b~, etc.
    .trim();
}
