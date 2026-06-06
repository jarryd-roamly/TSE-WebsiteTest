export type FxRates = {
  USD_ZAR:     number;
  EUR_ZAR:     number;
  GBP_ZAR:     number;
  USD_ZAR_mid: number;
  EUR_ZAR_mid: number;
  GBP_ZAR_mid: number;
  source:      string;
  fetched_at:  string;
};

export const FX_FALLBACK: FxRates = {
  USD_ZAR:     18.90,
  EUR_ZAR:     20.44,
  GBP_ZAR:     23.83,
  USD_ZAR_mid: 18.62,
  EUR_ZAR_mid: 20.14,
  GBP_ZAR_mid: 23.48,
  source:      'fallback',
  fetched_at:  new Date().toISOString(),
};

/**
 * Convert a foreign currency amount to ZAR.
 * mode='display' uses mid + spread (traveller-facing prices)
 * mode='margin'  uses mid only (internal margin calculations)
 */
export function toZar(
  amount:   number,
  currency: 'ZAR' | 'USD' | 'EUR' | 'GBP',
  rates:    FxRates,
  mode:     'display' | 'margin' = 'display'
): number {
  if (currency === 'ZAR') return amount;
  const key = mode === 'display'
    ? (`${currency}_ZAR` as keyof FxRates)
    : (`${currency}_ZAR_mid` as keyof FxRates);
  const rate = rates[key] as number ?? FX_FALLBACK[key] as number;
  return Math.round(amount * rate);
}

/**
 * Convert a per-person-per-night rate to per-unit-per-night.
 * Botswana and Kenya camps price PPPN. SA lodges price per unit.
 */
export function pppnToPerUnit(
  pppnRate:     number,
  pax:          number,
  maxOccupancy: number = 2
): number {
  return Math.round(pppnRate * Math.min(pax, maxOccupancy));
}

/**
 * Get the ZAR net rate for a supplier — handles currency and rate basis.
 * Always call this instead of reading net_rate_per_night directly.
 */
export function supplierNetRateZar(
  supplier: {
    net_rate_per_night: number;
    rate_currency?:     string;
    rate_basis?:        string;
  },
  pax:   number,
  rates: FxRates
): number {
  const currency = (supplier.rate_currency ?? 'ZAR') as 'ZAR' | 'USD' | 'EUR' | 'GBP';
  const zarRate  = toZar(supplier.net_rate_per_night, currency, rates, 'margin');
  if (supplier.rate_basis === 'per_person_per_night') return pppnToPerUnit(zarRate, pax);
  return zarRate;
}

/**
 * Get the ZAR display rate for a supplier — applies spread buffer.
 * Used for traveller-facing pricing.
 */
export function supplierDisplayRateZar(
  supplier: {
    display_rate_per_night: number;
    rate_currency?:         string;
    rate_basis?:            string;
  },
  pax:   number,
  rates: FxRates
): number {
  const currency = (supplier.rate_currency ?? 'ZAR') as 'ZAR' | 'USD' | 'EUR' | 'GBP';
  const zarRate  = toZar(supplier.display_rate_per_night, currency, rates, 'display');
  if (supplier.rate_basis === 'per_person_per_night') return pppnToPerUnit(zarRate, pax);
  return zarRate;
}

/**
 * Calculate gross margin for a stay in ZAR.
 * This is what the pricing engine ranks properties by.
 */
export function stayMarginZar(
  supplier: {
    net_rate_per_night:     number;
    display_rate_per_night: number;
    rate_currency?:         string;
    rate_basis?:            string;
  },
  nights: number,
  pax:    number,
  rates:  FxRates
): {
  marginPerNight: number;
  marginTotal:    number;
  marginPct:      number;
  netTotal:       number;
  displayTotal:   number;
} {
  const netPerNight     = supplierNetRateZar(supplier, pax, rates);
  const displayPerNight = supplierDisplayRateZar(supplier, pax, rates);
  const marginPerNight  = displayPerNight - netPerNight;
  const marginTotal     = marginPerNight * nights;
  const netTotal        = netPerNight * nights;
  const displayTotal    = displayPerNight * nights;
  const marginPct       = displayPerNight > 0
    ? Math.round((marginPerNight / displayPerNight) * 100 * 10) / 10
    : 0;

  return { marginPerNight, marginTotal, marginPct, netTotal, displayTotal };
}
