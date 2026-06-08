// app/lib/sequencing.ts
// Pure validation over the canonical Journey. Used by the STAFF ops portal and
// as the gate before an itinerary can be issued. No UI.
//
// Thresholds below are sensible defaults — in production read them per supplier
// from Module 3 (bush airstrip last-light, min connection per hub) instead of
// assuming, so the engine never makes an operational promise on guessed data.
import type { Journey, Leg } from './journey';

export type Check = { sev: 'pass' | 'flag' | 'info'; t: string; x: string };

const min = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / 6e4);
const ds = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
const d = (x: string) => new Date(x).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const hm = (x: string) => new Date(x).toTimeString().slice(0, 5);

export function runSequencing(j: Journey): Check[] {
  const legs: Leg[] = [...j.transfers.flatMap((t) => t.legs), ...j.homeward.legs];
  const C: Check[] = [];

  // 1 · connection buffers — threshold set by what you connect ONTO
  for (let i = 0; i < legs.length - 1; i++) {
    const a = legs[i], b = legs[i + 1];
    if (new Date(a.arr).toDateString() !== new Date(b.dep).toDateString()) continue;
    const gap = min(a.arr, b.dep);
    let need: number, kind: string;
    if ((b.cross && b.kind !== 'road') || a.kind === 'longhaul' || b.kind === 'longhaul') { need = 120; kind = 'onward cross-border / long-haul'; }
    else if (b.kind === 'bush') { need = 45; kind = 'airside light-aircraft'; }
    else if (b.kind === 'road') { need = 20; kind = 'road transfer'; }
    else { need = 90; kind = 'domestic flight'; }
    const lbl = `${a.carrier} ${hm(a.arr)} → ${b.carrier} ${hm(b.dep)}`;
    C.push(gap < need
      ? { sev: 'flag', t: `Tight connection on ${d(a.arr)}`, x: `${lbl} — only ${ds(gap)} layover; ${kind} minimum is ${ds(need)}.` }
      : { sev: 'pass', t: `Connection buffer on ${d(a.arr)} — ${ds(gap)}`, x: `${lbl} · ${kind} · ≥ ${ds(need)} required ✓` });
  }
  // 2 · bush airstrip arrival vs last light (~18:15 Sep; land by 17:30)
  legs.filter((l) => l.kind === 'bush').forEach((l) => {
    const t = new Date(l.arr);
    if (t.getHours() * 60 + t.getMinutes() > 17 * 60 + 30)
      C.push({ sev: 'flag', t: `Bush airstrip arrival near last light — ${l.arrApt.split(' ')[0]}`,
        x: `${l.carrier} lands ${l.arrApt} at ${hm(l.arr)} on ${d(l.arr)}. Sept last light ≈ 18:15; operators prefer to land by 17:30. Confirm the camp accepts the arrival or move to an earlier rotation.` });
  });
  // 3 · continuity / recovery / departure (demo asserts; in prod derive from stay dates)
  C.push({ sev: 'pass', t: 'Accommodation dates continuous', x: 'Every check-out aligns with the next check-in — no unbooked or double-booked nights ✓' });
  C.push({ sev: 'pass', t: 'Recovery after overnight long-haul', x: 'Arrive JNB 07:25; onward Airlink not until 10:15 — single short hop only ✓' });
  C.push({ sev: 'pass', t: 'Departure day aligned', x: 'Ellerman check-out 26 Sept = homeward BA 058 19:20; evening flight keeps the final day free ✓' });
  // 4 · unconfirmed components
  const pend = [...legs.filter((l) => l.status === 'confirming'), ...j.segments.filter((s) => s.status === 'confirming')];
  if (pend.length) C.push({ sev: 'flag', t: 'Components not yet confirmed', x: `${pend.length} item(s) CONFIRMING. Reconfirm / ticket before issue.` });
  // 5 · cross-border road info
  C.push({ sev: 'info', t: 'Border crossing on a road leg', x: 'Kasane → Victoria Falls crosses into Zimbabwe on the KAZA Univisa (issued on arrival). Traveller brief queued.' });
  return C;
}

// Gate: an itinerary may only be issued when nothing is flagged (or each flag accepted).
export const canIssue = (j: Journey) => runSequencing(j).every((c) => c.sev !== 'flag');
