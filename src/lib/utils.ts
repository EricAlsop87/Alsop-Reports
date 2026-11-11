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

    // MCM encompasses both Montclair (MC) and Claremont (CM / CL)
    const isMcmFamily = (code: string) =>
      code === "MCM" || code === "MC" || code === "CM" || code === "CL" || code.includes("MONTCLAIR") || code.includes("CLAREMONT");

    if (normSel === "MCM" && isMcmFamily(normAgent)) {
      return true;
    }
    if ((normSel === "MC" || normSel.includes("MONTCLAIR")) && (normAgent === "MC" || normAgent === "MCM" || normAgent.includes("MONTCLAIR"))) {
      return true;
    }
    if ((normSel === "CM" || normSel === "CL" || normSel.includes("CLAREMONT")) && (normAgent === "CM" || normAgent === "CL" || normAgent === "MCM" || normAgent.includes("CLAREMONT"))) {
      return true;
    }
    return false;
  });
}

