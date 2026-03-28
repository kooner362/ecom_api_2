import { prisma } from "@ecom/db";

const db = prisma as any;

export interface TaxAddressInput {
  country?: string;
  province?: string;
  postalCode?: string;
}

export interface ComputeTaxResult {
  taxCents: number;
  appliedRate?: {
    id: string;
    name: string;
    rateBps: number;
  };
}

function normalize(value?: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizePostalCode(value?: string | null): string {
  return normalize(value).replace(/\s+/g, "");
}

function matchRate(rate: any, address: TaxAddressInput): { matched: boolean; specificity: number } {
  const addressCountry = normalize(address.country);
  const addressProvince = normalize(address.province);
  const addressPostal = normalizePostalCode(address.postalCode);

  const rateCountry = normalize(rate.country);
  const rateProvince = normalize(rate.province);
  const ratePostalPrefix = normalizePostalCode(rate.postalPrefix);

  if (rateCountry && addressCountry !== rateCountry) {
    return { matched: false, specificity: 0 };
  }

  if (rateProvince && addressProvince !== rateProvince) {
    return { matched: false, specificity: 0 };
  }

  if (ratePostalPrefix && !addressPostal.startsWith(ratePostalPrefix)) {
    return { matched: false, specificity: 0 };
  }

  if (ratePostalPrefix) {
    return { matched: true, specificity: 3 };
  }

  if (rateProvince) {
    return { matched: true, specificity: 2 };
  }

  if (rateCountry) {
    return { matched: true, specificity: 1 };
  }

  return { matched: true, specificity: 0 };
}

export const taxService = {
  async computeTax(storeId: string, address: TaxAddressInput, taxableBaseCents: number): Promise<ComputeTaxResult> {
    const enabledRates = await db.taxRate.findMany({
      where: {
        storeId,
        enabled: true
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }]
    });

    let bestRate: any = null;
    let bestSpecificity = -1;

    for (const rate of enabledRates) {
      const { matched, specificity } = matchRate(rate, address);
      if (!matched) {
        continue;
      }

      if (!bestRate) {
        bestRate = rate;
        bestSpecificity = specificity;
        continue;
      }

      if (rate.priority > bestRate.priority) {
        bestRate = rate;
        bestSpecificity = specificity;
        continue;
      }

      if (rate.priority === bestRate.priority && specificity > bestSpecificity) {
        bestRate = rate;
        bestSpecificity = specificity;
      }
    }

    if (!bestRate) {
      return { taxCents: 0 };
    }

    const base = Math.max(0, taxableBaseCents);

    // Tax formula: tax applies to (subtotal - discount + shipping) passed as taxableBaseCents.
    const taxCents = Math.round((base * bestRate.rateBps) / 10000);

    return {
      taxCents,
      appliedRate: {
        id: bestRate.id,
        name: bestRate.name,
        rateBps: bestRate.rateBps
      }
    };
  }
};
