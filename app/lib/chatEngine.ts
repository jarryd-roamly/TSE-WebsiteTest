// ─── DETERMINISTIC CHAT ENGINE ───────────────────────────────────────────────
// Handles ~80% of itinerary chat requests without an AI call.
// Free, instant, zero API cost. Escalates to Haiku only when it can't handle it.
//
// HANDOVER: Add more intents here before reaching for AI.
// Each intent takes the message + current itinerary + hotels, returns a result or null.

import type { Itinerary, Hotel } from './types';

interface DetResult {
  itinerary: Itinerary;
  reply:     string;
}

// ── Intent patterns ───────────────────────────────────────────────────────────
const EXTEND        = /add\s+(\d+)\s*nights?|extend\s+(?:by\s+)?(\d+)|(\d+)\s+more\s+nights?/i;
const REDUCE        = /shorten\s+(?:by\s+)?(\d+)|remove\s+(\d+)\s*nights?|fewer\s+nights?|cut\s+(\d+)/i;
const CHEAPER       = /cheaper|lower.*price|less\s+expens|reduce\s+cost|more\s+affordabl|budget|save\s+money/i;
const LUXURY        = /more\s+luxur|upgrade|higher.*end|splurge|best\s+lodge|premium/i;
const FEWER_DEST    = /fewer\s+dest|simpler|one\s+(?:place|location|destination)|single\s+dest|less\s+moving/i;
const MORE_DEST     = /add\s+(?:a\s+)?(?:stop|destination|location)|more\s+places?|another\s+country/i;
const NIGHTS_SHIFT  = /(\d+)\s+nights?\s+(?:at|in)\s+(.+?)(?:\s+and|\s+less|\.|$)/i;

export function applyDeterministicChange(
  message: string,
  itinerary: Itinerary,
  hotels: Hotel[]
): DetResult | null {

  // ── Extend nights ─────────────────────────────────────────────────────────
  const extM = message.match(EXTEND);
  if (extM) {
    const add = parseInt(extM[1] ?? extM[2] ?? extM[3] ?? '2', 10);
    if (!isNaN(add) && add > 0 && add <= 7) {
      const last = itinerary.cities[itinerary.cities.length - 1];
      if (!last) return null;
      const perNight = last.hotelRate || Math.round(last.estimatedCost / last.nights);
      const addCost  = perNight * add;
      const updated: Itinerary = {
        ...itinerary,
        cities: itinerary.cities.map((c, i) =>
          i === itinerary.cities.length - 1
            ? { ...c, nights: c.nights + add, estimatedCost: c.estimatedCost + addCost }
            : c
        ),
        totalEstimate: itinerary.totalEstimate + addCost,
      };
      return { itinerary: updated, reply: `Extended your stay in ${last.city} by ${add} night${add > 1 ? 's' : ''}. New total: R${Math.round(updated.totalEstimate).toLocaleString()}.` };
    }
  }

  // ── Reduce nights ─────────────────────────────────────────────────────────
  const redM = message.match(REDUCE);
  if (redM) {
    const cut = parseInt(redM[1] ?? redM[2] ?? redM[3] ?? '2', 10);
    if (!isNaN(cut) && cut > 0) {
      const last = itinerary.cities[itinerary.cities.length - 1];
      if (!last || last.nights <= cut) return null;
      const perNight = last.hotelRate || Math.round(last.estimatedCost / last.nights);
      const saveCost = perNight * cut;
      const updated: Itinerary = {
        ...itinerary,
        cities: itinerary.cities.map((c, i) =>
          i === itinerary.cities.length - 1
            ? { ...c, nights: c.nights - cut, estimatedCost: c.estimatedCost - saveCost }
            : c
        ),
        totalEstimate: itinerary.totalEstimate - saveCost,
      };
      return { itinerary: updated, reply: `Reduced your stay in ${last.city} by ${cut} night${cut > 1 ? 's' : ''}. You save R${Math.round(saveCost).toLocaleString()}. New total: R${Math.round(updated.totalEstimate).toLocaleString()}.` };
    }
  }

  // ── Make cheaper — swap to lower-rate hotels ──────────────────────────────
  if (CHEAPER.test(message)) {
    const cheaperHotels = [...hotels].sort((a, b) => a.netRate - b.netRate);
    if (!cheaperHotels.length) return null;
    const currentMin = Math.min(...itinerary.cities.map(c => c.hotelRate || Infinity));
    const target = cheaperHotels.find(h => h.netRate < currentMin * 0.85);
    if (!target) return null;
    const saving = Math.round((currentMin - target.netRate) * itinerary.cities.reduce((s, c) => s + c.nights, 0));
    const updated: Itinerary = {
      ...itinerary,
      cities: itinerary.cities.map(c => ({ ...c, hotelRate: target.netRate, estimatedCost: Math.round(target.netRate * c.nights * 1.15) })),
      totalEstimate: itinerary.totalEstimate - saving,
      aiInsights: [...(itinerary.aiInsights ?? []), `Swapped to ${target.name} — saves R${saving.toLocaleString()} vs previous selection.`],
    };
    return { itinerary: updated, reply: `Swapped to ${target.name} — saves R${saving.toLocaleString()} without compromising on the wildlife experience.` };
  }

  // ── More luxury — swap to higher-rate hotels ──────────────────────────────
  if (LUXURY.test(message)) {
    const luxuryHotels = [...hotels].sort((a, b) => b.netRate - a.netRate);
    if (!luxuryHotels.length) return null;
    const currentMax = Math.max(...itinerary.cities.map(c => c.hotelRate || 0));
    const target = luxuryHotels.find(h => h.netRate > currentMax * 1.1);
    if (!target) return null;
    const uplift = Math.round((target.netRate - currentMax) * itinerary.cities.reduce((s, c) => s + c.nights, 0));
    const updated: Itinerary = {
      ...itinerary,
      cities: itinerary.cities.map(c => ({ ...c, hotelRate: target.netRate, estimatedCost: Math.round(target.netRate * c.nights * 1.15) })),
      totalEstimate: itinerary.totalEstimate + uplift,
      aiInsights: [`${target.name} is our highest-rated property in this region.`],
    };
    return { itinerary: updated, reply: `Upgraded to ${target.name} — our highest-rated property here. New total: R${Math.round(updated.totalEstimate).toLocaleString()}.` };
  }

  // ── Fewer destinations — collapse to single location ──────────────────────
  if (FEWER_DEST.test(message) && itinerary.cities.length > 1) {
    const primary = itinerary.cities[0];
    const totalNights = itinerary.cities.reduce((s, c) => s + c.nights, 0);
    const totalCost = Math.round(primary.hotelRate * totalNights * 1.15);
    const saving = itinerary.totalEstimate - totalCost;
    const updated: Itinerary = {
      ...itinerary,
      cities: [{ ...primary, nights: totalNights, estimatedCost: totalCost }],
      totalEstimate: totalCost,
      routing: `JNB → ${primary.city} (${totalNights}n) → JNB`,
      aiInsights: [`Simplified to one destination — saves transfer costs and packing days.`, saving > 0 ? `You save R${Math.round(saving).toLocaleString()} in transfer and positioning costs.` : ''].filter(Boolean),
    };
    return { itinerary: updated, reply: `Simplified to ${primary.city} only — ${totalNights} nights, one lodge, zero transfer days. Saves R${Math.round(Math.max(saving, 0)).toLocaleString()} in positioning costs.` };
  }

  // No deterministic match — escalate to AI
  return null;
}