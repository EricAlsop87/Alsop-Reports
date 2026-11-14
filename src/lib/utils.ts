import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Checks whether an agent's office matches the selected office filter(s).
 * Treats "MC", "CM" (Claremont), and "MCM" interchangeably for the combined Montclair/Claremont hub.
 */
export function matchesOfficeFilter(agentOffice: string | null | undefined, selectedOffices: string[]): boolean {
  if (!selectedOffices || selectedOffices.length === 0) return true;
  if (!agentOffice) return false;

  const normAgent = agentOffice.trim().toUpperCase();
  return selectedOffices.some(sel => {
    const normSel = sel.trim().toUpperCase();
    if (normAgent === normSel) return true;

    // MCM encompasses both Montclair (MC) and Claremont (CM / CL) as one combined hub
    const isMcmFamily = (code: string) =>
      code === "MCM" || code === "MC" || code === "CM" || code === "CL" || code.includes("MONTCLAIR") || code.includes("CLAREMONT");

    if (isMcmFamily(normSel) && isMcmFamily(normAgent)) {
      return true;
    }
    return false;
  });
}

