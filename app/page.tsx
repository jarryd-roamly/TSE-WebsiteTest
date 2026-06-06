'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// THE TRAVEL CATALOGUE — page.tsx
// Safari Edition · v7.0
// CHANGES IN v7.0 (additive to v6.0):
//  [V7-1] International flight module wired in (Duffel) — FlightSelector component
//  [V7-2] Flight intent: include / own / flexible (replaces simple boolean)
//  [V7-3] Open-jaw routing support (system finds cheapest gateway combination)
//  [V7-4] Route reversal optimisation tip (uses real INTERNAL_LEGS transfer costs)
//  [V7-5] Corrected deposit handled at checkout: flights 100% + 30% package balance
//  [V7-6] YouTube reels from CMS rendered in property tiles — NO controls visible
//         Reads `reels` JSONB column: {source, video_id, start, end, speed, caption, status}
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, useMemo, useReducer } from 'react';
import { T, GLOBAL_CSS }                     from './lib/theme';
import { buildKBContext, runPlannerEngine,
         answerFactual, applyCreativeDiff,
         chatWithSpecialist }                from './lib/aiGateway';
import { preloadHotels, findAlternativeDate,
         addDays, todayPlusDays }            from './lib/availability';
import { resolveHotelUpgrades, makeFmt }     from './lib/pricing';
import { applyDeterministicChange }          from './lib/chatEngine';
import FlightSelector                        from '@/components/FlightSelector';
import { lastMileFor, lastMileZar, defaultCommercialTarget,
         priceTransfer, CARRIER_ADJUST,
         exitLastMileFor, originHubAirport }  from './lib/transfers';
import SafariCinematicResearch from '@/components/SafariCinematicResearch'
import LandingHero from '@/components/LandingHero';
import JourneyLoadingScreen from '@/components/JourneyLoadingScreen';
import RegionChapter, { PropertyMiniSite, InclusionPills } from '@/components/RegionChapter';
import type { SkeletonFinding as RegionSkeletonFinding } from '@/components/RegionChapter';
import JourneyConfirmation from '@/components/JourneyConfirmation';
import type { LastMile, AirportCode }        from './lib/transfers';
import type { Screen, Pillar, InputMode, Hotel, PropertyStay,
              InterTransferState, UpgradeState, Itinerary,
              ItineraryCity, Currency, KBEntry, ChatMessage,
              BookingIntent, BookingComponent,
              AvailResult, AltDate, EditionConfig }  from './lib/types';

const SAFARI_EDITION: EditionConfig = {
  id: 'safari', name: 'The Safari Edition',
  tagline: 'Sub-Saharan Africa · Curated',
  heroImage: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1400&q=80',
  primaryRegion: 'southern-africa', defaultCurrency: 'USD',
  margins: { flights: 1.08, hotels: 1.15, transfers: 1.20, activities: 1.18, intl: 1.08 },
  ai: { plannerModel: 'claude-sonnet-4-5', chatModel: 'claude-haiku-4-5-20251001', maxPlanTokens: 1200, maxChatTokens: 400, monthlyBudgetZAR: 5000 },
  payment: { gateways: ['payfast', 'stripe'], depositPercent: 30, balanceDaysBefore: 30 },
  support: { email: 'journeys@thesafariedition.com', whatsapp: '+27000000000' },
};

const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$',   rate: 18.62 },
  { code: 'ZAR', symbol: 'R ',  rate: 1     },
  { code: 'EUR', symbol: '€',   rate: 20.14 },
  { code: 'GBP', symbol: '£',   rate: 23.48 },
];

const OTHER_EDITIONS = [
  { id:'island',    name:'The Island Edition',    icon:'🏝', color:'#60a5fa', desc:'Maldives · Seychelles · Zanzibar' },
  { id:'adventure', name:'The Adventure Edition', icon:'🧗', color:'#4ade80', desc:'Nepal · Patagonia · Arctic' },
  { id:'japan',     name:'The Japan Edition',     icon:'⛩',  color:'#f87171', desc:'Tokyo · Kyoto · Hokkaido' },
  { id:'ski',       name:'The Ski Edition',       icon:'⛷',  color:'#a78bfa', desc:'Alps · Aspen · Hokkaido' },
];
const REGION_WHY: Record<string, string> = {
  'kruger-sabi-sand': 'The finest predator territory on Earth. Leopard, lion, wild dog.',
  'okavango-delta':   'No roads. No fences. A flooded wilderness unlike anywhere else.',
  'cape-town':        'Mountain, ocean, winelands. The perfect journey bookend.',
  'madikwe':          'Malaria-free Big Five. 90 minutes from Johannesburg.',
  'chobe-vic-falls':  'The smoke that thunders. One of the Seven Natural Wonders.',
  'masai-mara':       'The greatest wildlife spectacle on Earth.',
};
const REGION_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1400&q=85';
const REGIONS = [
  { id: 'kruger',     label: 'Kruger / Sabi Sand',  icon: '🐆', slug: 'kruger-sabi-sand' },
  { id: 'okavango',   label: 'Okavango Delta',       icon: '🛶', slug: 'okavango-delta'   },
  { id: 'cape-town',  label: 'Cape Town',            icon: '🏔', slug: 'cape-town'        },
  { id: 'madikwe',    label: 'Madikwe',              icon: '🦏', slug: 'madikwe'          },
  { id: 'chobe',      label: 'Chobe / Vic Falls',    icon: '🌊', slug: 'chobe-vic-falls'  },
  { id: 'inspire-me', label: 'Inspire Me',           icon: '✨', slug: null               },
];

const CITY_TO_SLUG: Record<string, string> = {
  'kruger':'kruger-sabi-sand','sabi sand':'kruger-sabi-sand','kruger / sabi sand':'kruger-sabi-sand',
  'sabi sands':'kruger-sabi-sand','okavango':'okavango-delta','okavango delta':'okavango-delta',
  'cape town':'cape-town','madikwe':'madikwe','chobe':'chobe-vic-falls','victoria falls':'chobe-vic-falls',
  'chobe / victoria falls':'chobe-vic-falls','vic falls':'chobe-vic-falls','victoria falls, zimbabwe':'chobe-vic-falls',
  'masai mara':'masai-mara','masai mara, kenya':'masai-mara','the masai mara':'masai-mara',
  'phinda':'phinda','mozambique':'mozambique','bazaruto':'mozambique','bwindi':'bwindi','kalahari':'kalahari',
};

const CITY_TYPE_ALWAYS = new Set(['cape-town','chobe-vic-falls']);
const CITY_TYPE_KB = new Set(['masai-mara','bwindi','mozambique']);
const CITY_TYPE_SLUGS = new Set([...CITY_TYPE_ALWAYS, ...CITY_TYPE_KB]);

type CityTransferOption = { id:string; icon:string; label:string; provider:string; duration:string; estimatedCostZAR:number; note:string; recommended:boolean; };
const CITY_TRANSFERS: Record<string, CityTransferOption[]> = {
  'cape-town': [
    { id:'private-car',  icon:'🚗', label:'Private transfer',    provider:'Private vehicle — door to door',    duration:'30–45 min', estimatedCostZAR:2800,  note:'Most popular. Driver meets you at arrivals with name board. Includes luggage handling.', recommended:true },
    { id:'helicopter',   icon:'🚁', label:'Helicopter transfer',  provider:'NAC Helicopters — aerial city tour', duration:'12 min',    estimatedCostZAR:18000, note:'The unforgettable arrival. 12 minutes airside to the hotel pad with full city panorama.', recommended:false },
    { id:'shuttle',      icon:'🚌', label:'Shared shuttle',       provider:'Backpacker Bus / Myciti',           duration:'45–75 min', estimatedCostZAR:850,   note:'Budget option. Shared with other passengers, scheduled times only.', recommended:false },
  ],
  'chobe-vic-falls': [
    { id:'private-car',  icon:'🚗', label:'Private transfer',    provider:'Private vehicle from VFA airport',  duration:'15–20 min', estimatedCostZAR:1800,  note:'Victoria Falls Airport is 20 minutes from town. Private vehicle recommended — minimal public options.', recommended:true },
    { id:'helicopter',   icon:'🚁', label:'Helicopter arrival',  provider:'Helicopter direct from airstrip',   duration:'8 min',     estimatedCostZAR:9500,  note:'Arrive in style — aerial views of the Falls on approach. Unforgettable first moment.', recommended:false },
  ],
  'masai-mara': [
    { id:'light-aircraft', icon:'✈', label:'Light aircraft charter', provider:'Safarilink / Air Kenya charter', duration:'45 min',    estimatedCostZAR:6800,  note:'Nairobi to Mara airstrip. Most camps have their own airstrip — vehicle transfer included.', recommended:true },
    { id:'road',           icon:'🚗', label:'Road transfer',          provider:'Private 4WD — scenic route',    duration:'5–6 hrs',   estimatedCostZAR:3200,  note:'Long but scenic. Passes through the Rift Valley. Early morning departure essential.', recommended:false },
  ],
};

const COUNTRY_REGION: Record<string, string> = {
  'South Africa':'southern-africa','Botswana':'southern-africa','Zimbabwe':'southern-africa',
  'Zambia':'southern-africa','Namibia':'southern-africa','Kenya':'east-africa',
  'Tanzania':'east-africa','Uganda':'east-africa','Rwanda':'east-africa',
  'Mozambique':'indian-ocean','Seychelles':'indian-ocean',
};

const REGION_LABEL: Record<string, string> = {
  'kruger-sabi-sand':'Kruger / Sabi Sand','okavango-delta':'Okavango Delta','cape-town':'Cape Town',
  'madikwe':'Madikwe','chobe-vic-falls':'Chobe / Victoria Falls','masai-mara':'Masai Mara',
  'phinda':'Phinda','mozambique':'Mozambique','bwindi':'Bwindi / Uganda',
};

const INTERNATIONAL_ORIGINS = [
  { code: 'LHR', label: 'London Heathrow',  flag: '🇬🇧' },
  { code: 'LGW', label: 'London Gatwick',   flag: '🇬🇧' },
  { code: 'MAN', label: 'Manchester',       flag: '🇬🇧' },
  { code: 'AMS', label: 'Amsterdam',        flag: '🇳🇱' },
  { code: 'FRA', label: 'Frankfurt',        flag: '🇩🇪' },
  { code: 'JFK', label: 'New York (JFK)',   flag: '🇺🇸' },
  { code: 'LAX', label: 'Los Angeles',      flag: '🇺🇸' },
  { code: 'DXB', label: 'Dubai',            flag: '🇦🇪' },
  { code: 'SYD', label: 'Sydney',           flag: '🇦🇺' },
];

const REGIONAL_ORIGINS = [
  { code: 'JNB', label: 'Johannesburg (O.R. Tambo)', flag: '🇿🇦' },
  { code: 'CPT', label: 'Cape Town',                 flag: '🇿🇦' },
  { code: 'DUR', label: 'Durban',                    flag: '🇿🇦' },
];

const RESEARCH_STEPS = [
  'Reviewing seasonal conditions and migration patterns...',
  'Checking lodge availability across the region...',
  'Finding the best charter connections...',
  'Comparing lodge rates and margin opportunities...',
  'Optimising your itinerary sequence...',
  'Putting your personalised journey together...',
];

type Activity = {
  id: string; region_slug: string; name: string; description?: string;
  netRate: number; currency: 'ZAR'|'USD'; duration?: string; category?: string;
  requires_transfer?: boolean; transfer_note?: string; image: string; images?: string[];
  funFact?: string;
};

// Activities are now loaded from Supabase at runtime (see useEffect in main component).
// This empty default is only a safety fallback if the fetch fails.
const ACTIVITIES_FALLBACK: Activity[] = [];

// Map a Supabase activities row -> Activity. Converts USD net rates to ZAR at the
// supplied fx rate (USD->ZAR). ZAR rows pass through unchanged.
function mapActivityRow(a: any, usdToZar: number): Activity {
  const imgs: string[] = (() => {
    try { return Array.isArray(a.image_urls) ? a.image_urls : (a.image_urls ? JSON.parse(a.image_urls) : []); }
    catch { return []; }
  })();
  const rawRate = Number(a.net_rate) || 0;
  const netZar = a.currency === 'USD' ? Math.round(rawRate * usdToZar) : rawRate;
  return {
    id: String(a.id), region_slug: a.region_slug, name: a.name, description: a.description || '',
    netRate: netZar, currency: a.currency || 'ZAR', duration: a.duration || '', category: a.category || '',
    requires_transfer: !!a.requires_transfer, transfer_note: a.transfer_note || '',
    image: imgs[0] || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80',
    images: imgs,
    funFact: a.description ? String(a.description).slice(0, 120) : '',
  };
}

const SPECIALISTS = [
  { name: 'Sarah Mitchell', role: 'Senior Safari Specialist', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80', tip: 'June–August is peak — book 6 months ahead for Sabi Sand.' },
  { name: 'James Okonkwo',  role: 'East Africa Specialist',   avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80', tip: 'The Migration crosses the Mara River July–October. Don\'t miss it.' },
  { name: 'Priya Naidoo',   role: 'Indian Ocean Specialist',  avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80', tip: 'Combine 4 nights bush with 4 nights beach — the perfect balance.' },
];

// [V6-6] Quick action chips for the Customise chat tab
const CHAT_QUICK_ACTIONS = [
  { id:'cheaper',  label:'Make it cheaper',      icon:'↓',  desc:'Swap to lower-rate properties in the same destinations' },
  { id:'luxury',   label:'Upgrade everything',   icon:'✦',  desc:'Move to premium tier across all destinations' },
  { id:'extend',   label:'Extend by 2 nights',   icon:'+2', desc:'Add 2 nights to your longest destination' },
  { id:'addcity',  label:'Add a city stop',       icon:'＋', desc:'Recommend a new destination that fits your route' },
  { id:'dates',    label:'Flexible on dates?',    icon:'◎',  desc:'Show savings if you shift ±7 days' },
  { id:'fewer',    label:'Fewer destinations',    icon:'–',  desc:'Simplify — remove the lowest-value stop' },
];
function getCuratedAssumptions(j: any) {
  const cities: any[] = j.cities || [];
  const themes: string[] = j.themes || [];
  const nights = j.nights || cities.reduce((s: number, c: any) => s + (c.nights || 0), 0);
  const pax = j.pax || 2;

  // Who it's priced for
  const isFamily    = themes.includes('family');
  const isHoneymoon = themes.includes('honeymoon') || themes.includes('romance') || themes.includes('anniversary');
  const paxLabel    = isFamily ? '2 adults + 2 children' : isHoneymoon ? 'per couple' : `${pax} adults`;

  // Region flags
  const slugs          = cities.map((c: any) => c.regionSlug || '');
  const hasCharter     = slugs.some(s => ['okavango-delta','masai-mara'].includes(s));
  const isMalariaFree  = slugs.length > 0 && slugs.every(s => ['madikwe','cape-town'].includes(s));
  const isMultiDest    = cities.length > 1;
  const hasVicFalls    = slugs.includes('chobe-vic-falls');
  const hasCT          = slugs.includes('cape-town');

  // Key inclusions
  const inclusions: string[] = [];
  if (isMultiDest && hasCharter) inclusions.push('All charter flights & bush transfers');
  else if (isMultiDest)           inclusions.push('All internal flights & transfers');
  else                            inclusions.push('All road & airstrip transfers');
  inclusions.push('Full board · All meals included');
  inclusions.push('All game drives & guided activities');
  if (isMalariaFree) inclusions.push('Malaria-free · No prophylactics');

  // Important notes
  const notes: string[] = [];
  if (hasCharter)  notes.push('20kg soft bag limit on light aircraft · No hard cases');
  if (hasVicFalls) notes.push('Visa on arrival for most nationalities');
  if (hasCT)       notes.push('Malaria-free Cape Town extension');

  return {
    paxLabel,
    nights,
    priceNote: `Based on ${paxLabel} · ${nights} nights`,
    inclusions,
    notes,
    alwaysExcluded: 'International flights',
  };
}
const CURATED_JOURNEYS = [
  { id:'sabi-classic',  name:'The Sabi Sand Classic',       tagline:"South Africa's finest leopard territory",  nights:5,  pax:2, image:'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80', badge:'Most popular', badgeColor:T.gold,    includes:['Return Federal Air charter','5n Singita Sabi Sand','All-inclusive','All game drives & walks'], priceFrom:142000, otaEquivalent:192000, themes:['safari','luxury'],   region:'southern-africa', nightsRange:'short'  },
  { id:'grand-circuit', name:'The Grand Safari Circuit',    tagline:'Two countries. Three ecosystems.',         nights:9,  pax:2, image:'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80', badge:'Signature',    badgeColor:'#a78bfa', includes:['All charter flights','3n Sabi Sand','3n Ngorongoro','3n Masai Mara','All-inclusive'], priceFrom:298000, otaEquivalent:412000, themes:['safari'],             region:'both',           nightsRange:'medium' },
  { id:'vic-falls',     name:'Kruger & Victoria Falls',     tagline:'Big Five then one of the Seven Wonders',   nights:7,  pax:2, image:'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', badge:'Classic combo',badgeColor:T.green,   includes:['Return flights','4n Royal Malewane','Charter to Vic Falls','3n Victoria Falls Hotel'], priceFrom:198000, otaEquivalent:272000, themes:['safari','adventure'],region:'southern-africa', nightsRange:'medium' },
  { id:'island-finish', name:'Safari & Indian Ocean',       tagline:'Bush then beach — the perfect combination',nights:8,  pax:2, image:'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&q=80', badge:'Our favourite',badgeColor:'#60a5fa', includes:['All flights','4n Phinda','4n Azura Bazaruto','All-inclusive','Speedboat'], priceFrom:224000, otaEquivalent:316000, themes:['beach','romance'],   region:'southern-africa', nightsRange:'medium' },
];

const DEFAULT_KB: KBEntry[] = [
  { id:'kb-region-kruger',    edition_id:'safari', type:'regional', inclusion_source:'KB', title:'Kruger / Sabi Sand', linkedTo:'Kruger / Sabi Sand', active:true, structuredFields:{ best_season:'May–September. Dry season. Short grass, animals at waterholes.', malaria:'Malaria area. Prophylactics recommended. Consult your GP 6 weeks before.', why_visit:'Highest leopard density in Africa. Private concessions mean no other vehicles at sightings.', best_sightings:'Leopard year-round. Lion June–August. Wild dog May–July.', ideal_nights:'4 nights minimum. 3 nights feels rushed.' }, specialistNotes:'Lead with Singita Boulders or Londolozi for UK/US first-timers. Our rates are 20–27% below Booking.com.' },
  { id:'kb-region-okavango',  edition_id:'safari', type:'regional', inclusion_source:'KB', title:'Okavango Delta',     linkedTo:'Okavango Delta',     active:true, structuredFields:{ best_season:'June–October. Flood peaks July–August.', malaria:'Malaria area. Prophylactics essential.', why_visit:'No roads. No fences. You arrive by light aircraft. Nothing else like it on Earth.', ideal_nights:'3 nights minimum. 4 optimal.', flights:'All transfers by light aircraft from Maun. 20kg soft bag STRICTLY enforced.' }, specialistNotes:'Mombo is the apex property. For honeymooners: Jao or Nxabega. For wild dog: DumaTau.' },
  { id:'kb-region-cape',      edition_id:'safari', type:'regional', inclusion_source:'KB', title:'Cape Town',          linkedTo:'Cape Town',          active:true, structuredFields:{ best_season:'November–April. Long warm days.', no_malaria:'Malaria-free. No prophylactics needed.', why_visit:'The perfect safari bookend. World-class food and wine within 45 minutes.' }, specialistNotes:'Ellerman House for seclusion and views. The Silo for design and city access.' },
  { id:'kb-prop-singita',     edition_id:'safari', type:'property', inclusion_source:'KB', title:'Singita Boulders Lodge', linkedTo:'Singita Boulders Lodge', active:true, structuredFields:{ why_here:'Six riverside suites built into the boulders above the Sand River.', best_room:'Request Suite 3 (Boulders Suite) — north-facing, directly above the river bend, private plunge pool.', best_sightings:'Leopard at the river most evenings. Lion crosses at dawn.', ideal_nights:'4 nights. 3 feels rushed.' }, specialistNotes:'Our rate is 27% below Booking.com. Ask for Marcus or Sipho as guide.' },
  { id:'kb-prop-mombo',       edition_id:'safari', type:'property', inclusion_source:'KB', title:'Wilderness Mombo Camp', linkedTo:'Wilderness Mombo Camp', active:true, structuredFields:{ why_here:"Chief's Island — the highest predator density in Botswana.", best_sightings:'Wild dog almost guaranteed June–September.', ideal_nights:'3–4 nights. Your best sighting is often the last morning.' }, specialistNotes:'Request Little Mombo (6 tents) for honeymooners — more intimate. Same guiding team.' },
  { id:'kb-transfer-madikwe', edition_id:'safari', type:'trade_tip', inclusion_source:'KB', title:'Madikwe Distances', linkedTo:'madikwe', active:true, structuredFields:{ routing:'Cape Town to Madikwe: fly CPT→JNB, then 3.5hr drive or 45min charter. NOT 4.5hrs direct.' }, specialistNotes:'Never quote Cape Town → Madikwe as 4.5hrs. Always route via JNB.' },
];

type InternalLeg = { fromLabel:string; toLabel:string; mode:'charter'|'scheduled'|'road'|'boat'; provider:string; duration:string; estimatedCostZAR:number; aiNote:string; bufferHours:number; };

// [Transfers v2] Fallback commercial-leg fares (per person, ZAR) used ONLY when
// Duffel returns no offer for a regional route. Shown as 'estimated' — never a hard fare.
// Keyed by target airport (the airport the last-mile starts from).
const COMMERCIAL_FALLBACK_ZAR: Record<string, number> = {
  SZK: 4200, MQP: 3800, HDS: 4000,   // CPT/JNB -> Kruger gateways
  MUB: 4500,                          // CPT/JNB -> Maun (Okavango)
  VFA: 4500, LVI: 4300, BBK: 4400,    // -> Victoria Falls / Livingstone / Kasane
  JNB: 2800,                          // CPT -> JNB trunk (for Madikwe/charter routing)
  CPT: 2800,
};

const INTERNAL_LEGS: Record<string, InternalLeg & { road_viable?: boolean }> = {
  'cape-town→kruger-sabi-sand': { fromLabel:'Cape Town', toLabel:'Sabi Sand', mode:'scheduled', provider:'Airlink CPT→JNB + Federal Air JNB→Skukuza', duration:'~2h 45m', estimatedCostZAR:12000, aiNote:'Morning departure from CPT recommended to catch the afternoon game drive.', bufferHours:3, road_viable:false },
  'kruger-sabi-sand→okavango-delta': { fromLabel:'Sabi Sand', toLabel:'Okavango Delta', mode:'scheduled', provider:'Federal Air SZK→JNB + Airlink/Fastjet JNB→Maun + Wilderness Air/MackAir to camp', duration:'~6h 30m door-to-door', estimatedCostZAR:22000, aiNote:'Exit Sabi Sand via Federal Air to O.R. Tambo. Connect JNB→MUB (Maun) via Airlink or Fastjet — allow 2hrs at O.R. Tambo. Then Wilderness Air or Mack Air charter to your camp. Full travel day. Depart post-morning drive (~10:00), arrive camp ~17:00.', bufferHours:6, road_viable:false },
  'okavango-delta→chobe-vic-falls': { fromLabel:'Okavango Delta', toLabel:'Chobe / Victoria Falls', mode:'charter', provider:'Air Botswana / Wilderness Air', duration:'~1h 30m', estimatedCostZAR:9500, aiNote:'Afternoon departure post-morning activity recommended.', bufferHours:1.5, road_viable:false },
  'kruger-sabi-sand→chobe-vic-falls': { fromLabel:'Sabi Sand', toLabel:'Victoria Falls', mode:'scheduled', provider:'Federal Air → Airlink via JNB → Victoria Falls', duration:'~4h 30m', estimatedCostZAR:14000, aiNote:'Exit via Skukuza or Hoedspruit, connect through O.R. Tambo (JNB), fly Fastjet or Airlink to Victoria Falls. Allow 4.5hrs door-to-door. Journey Specialist confirms best routing.', bufferHours:4.5, road_viable:false },
  'kruger-sabi-sand→cape-town': { fromLabel:'Sabi Sand', toLabel:'Cape Town', mode:'scheduled', provider:'Federal Air Skukuza→JNB + Airlink JNB→CPT', duration:'~3h', estimatedCostZAR:12000, aiNote:'Allow 2hr connection at O.R. Tambo.', bufferHours:2.5, road_viable:false },
  'cape-town→okavango-delta': { fromLabel:'Cape Town', toLabel:'Okavango Delta', mode:'scheduled', provider:'Airlink CPT→JNB + Mack Air JNB→Maun', duration:'~4h', estimatedCostZAR:16500, aiNote:'Connect through Johannesburg. Afternoon arrival in Maun.', bufferHours:3.5, road_viable:false },
  'cape-town→madikwe':        { fromLabel:'Cape Town', toLabel:'Madikwe',         mode:'scheduled', provider:'Airlink CPT→JNB + 3.5hr private drive or 45min charter', duration:'~4h total', estimatedCostZAR:11000, aiNote:'Fly CPT→JNB, then 3.5hr private drive north or 45min charter to Madikwe airstrip.', bufferHours:4, road_viable:false },
  'kruger-sabi-sand→madikwe': { fromLabel:'Sabi Sand', toLabel:'Madikwe',         mode:'scheduled', provider:'Federal Air + Airlink JNB connection', duration:'~3h', estimatedCostZAR:9500, aiNote:'Connect via O.R. Tambo. Allow 2hr connection.', bufferHours:3, road_viable:false },
  'madikwe→cape-town':        { fromLabel:'Madikwe', toLabel:'Cape Town',         mode:'scheduled', provider:'Road to JNB (3.5hr) + Airlink JNB→CPT', duration:'~4h total', estimatedCostZAR:11000, aiNote:'Early morning departure from Madikwe to catch morning flights from JNB.', bufferHours:4, road_viable:false },
  'cape-town→chobe-vic-falls': { fromLabel:'Cape Town', toLabel:'Victoria Falls', mode:'scheduled', provider:'Airlink CPT→JNB + Air Zimbabwe or Fastjet JNB→VFA', duration:'~3h 30m', estimatedCostZAR:13500, aiNote:'Morning departure from CPT. Connect at O.R. Tambo — allow 2hr. Afternoon arrival at VFA.', bufferHours:3.5, road_viable:false },
  'chobe-vic-falls→kruger-sabi-sand': { fromLabel:'Victoria Falls', toLabel:'Sabi Sand', mode:'charter', provider:'Charter VFA→Skukuza or scheduled VFA→JNB→Skukuza', duration:'~3h', estimatedCostZAR:15000, aiNote:'Specialist confirms best routing. VFA→JNB scheduled + Federal Air JNB→Skukuza most reliable.', bufferHours:3, road_viable:false },
       
};

function getInternalLeg(fromSlug: string, toSlug: string): InternalLeg | null {
  const fwd = `${fromSlug}→${toSlug}`;
  const rev = `${toSlug}→${fromSlug}`;
  if (INTERNAL_LEGS[fwd]) return INTERNAL_LEGS[fwd];
  if (INTERNAL_LEGS[rev]) { const r = INTERNAL_LEGS[rev]; return { ...r, fromLabel:r.toLabel, toLabel:r.fromLabel }; }
  return { fromLabel:fromSlug.replace(/-/g,' '), toLabel:toSlug.replace(/-/g,' '), mode:'charter', provider:'TBC — Journey Specialist confirms', duration:'TBC', estimatedCostZAR:10000, aiNote:'Your Journey Specialist will recommend the best routing.', bufferHours:2 };
}

async function track(event: string, editionId: string, properties: Record<string, any> = {}) {
  try { await fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ event, edition_id:editionId, properties, ts:Date.now() }) }); } catch { /* silent */ }
}

function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c==='x' ? r : (r&0x3|0x8)).toString(16); });
}

function filterWarnings(warnings: string[]): string[] {
  const skip = [/not a (traditional )?safari destination/i,/no big.?5/i,/must be changed/i,/redirect.*to sabi/i,/critical.*cape town/i];
  return (warnings ?? []).filter(w => w && !skip.some(re => re.test(w)));
}

type Slide = { type:'image'|'video'|'reel'|'youtube'; url:string; poster?:string; label?:string; roomType?:string; speed?:number; caption?:string; };

// Build a clean autoplay/looping YouTube embed — zero visible controls or branding.
function buildYouTubeEmbedUrl(reel: { video_id: string; start?: number; end?: number; speed?: number }): string {
  if (!reel?.video_id) return '';
  const start = Math.round(reel.start ?? 0);
  const end   = Math.round(reel.end ?? (start + 15));
  const params = new URLSearchParams({
    start: String(start), end: String(end), autoplay: '1', mute: '1', loop: '1',
    playlist: reel.video_id, controls: '0', rel: '0', modestbranding: '1',
    playsinline: '1', disablekb: '1', fs: '0', iv_load_policy: '3',
  });
  return `https://www.youtube.com/embed/${reel.video_id}?${params.toString()}`;
}

function buildSlides(hotel: Hotel): Slide[] {
  const slides: Slide[] = [];
  if (hotel.image) slides.push({ type:'image', url:hotel.image, label:'Hero' });

  // CMS YouTube reels — {source, video_id, start, end, speed, caption, status}
  const reels = (hotel as any)._reels as any[] | undefined;
  if (Array.isArray(reels)) {
    reels
      .filter(r => r?.video_id && (r.status === 'approved' || !r.status))
      .forEach(r => slides.push({
        type:'youtube',
        url: buildYouTubeEmbedUrl(r),
        poster: `https://img.youtube.com/vi/${r.video_id}/hqdefault.jpg`,
        label: r.type === 'room' ? 'Room tour' : 'Reel',
        roomType: r.room_type || undefined,
        speed: r.speed ?? 1,
        caption: r.caption || undefined,
      }));
  }

  // Legacy single reel URL — only if no CMS reels
  if ((!reels || reels.length === 0) && hotel.reelUrl) {
    slides.push({ type:'reel', url:hotel.reelUrl, poster:hotel.image, label:'Reel' });
  }

  const extras = (hotel as any)._images as Slide[] | undefined;
  if (extras) {
    extras.forEach(img => {
      if (!slides.find(s => s.url === img.url)) slides.push(img);
    });
  }
  const seen = new Set<string>();
  return slides.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true; });
}

function getSlideKB(hotel: Hotel, slide: Slide, kbEntries: KBEntry[]): string | null {
  // TRAVELLER-SAFE ONLY — never expose specialistNotes or specialist_recs
  const entries = kbEntries.filter((e:any) =>
    (e.active || e.status === 'active') &&
    !e.internal_only &&
    e.claim_type !== 'commercial'
  );
  // Try property-level traveller tip
  const propMatch = entries.find((e:any) =>
    (e.type==='property' || e.entry_type==='property') &&
    ((e.linkedTo ?? e.linked_name ?? '')).toLowerCase().includes(hotel.name.toLowerCase())
  );
  if (propMatch) {
    const tip = (propMatch.tips ?? [])[0] ?? (propMatch.highlights ?? [])[0];
    if (tip) return tip;
    // Fall back to safe structured fields only (why_here, best_sightings — not commercial/ops)
    const safe = ['why_here','best_sightings','ideal_nights'];
    const field = safe.map(k => propMatch.structuredFields?.[k]).find(v => typeof v === 'string' && v.length > 15);
    if (field) return String(field);
  }
  // Try region-level traveller fact
  if (slide.label === 'Hero' || !slide.roomType) {
    const regionMatch = entries.find((e:any) =>
      (e.type==='regional' || e.entry_type==='region') &&
      hotel.subRegion && ((e.linkedTo ?? e.region_slug ?? '')).toLowerCase().includes(hotel.subRegion.replace(/-/g,' '))
    );
    if (regionMatch) {
      const tip = (regionMatch.tips ?? [])[0] ?? (regionMatch.highlights ?? [])[0];
      if (tip) return tip;
      const safe = ['why_visit','best_season','best_sightings'];
      const field = safe.map(k => regionMatch.structuredFields?.[k]).find(v => typeof v === 'string' && v.length > 15);
      if (field) return String(field);
    }
  }
  return null;
}

function mapSupplierRow(s: any, roomTypes: any[] = []): Hotel {
  const netRate = Number(s.net_rate_per_night) || 25000;
  const displayRate = Number(s.display_rate_per_night) || Math.round(netRate * 1.15);
  let imageUrl = 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80';
  let extraSlides: Slide[] = [];
  try {
    if (typeof s.images === 'string' && s.images.startsWith('http')) { imageUrl = s.images; }
    else {
      const images: any[] = Array.isArray(s.images) ? s.images : (s.images ? JSON.parse(s.images) : []);
      const primary = images.find((img:any) => img.is_primary && img.status==='approved') ?? images.find((img:any) => img.status==='approved') ?? images[0];
      if (primary?.url) imageUrl = primary.url;
      extraSlides = images
        .filter((img:any) => img.status==='approved' && img.url && img.url !== imageUrl)
        .map((img:any) => ({ type:'image' as const, url:img.url, label:img.caption || img.room_type || undefined, roomType:img.room_type || undefined }));
    }
  } catch { /* keep fallback */ }
  if (imageUrl.includes('unsplash') && s.hero_image)    imageUrl = s.hero_image;
  if (imageUrl.includes('unsplash') && s.cover_image)   imageUrl = s.cover_image;
  const destination = REGION_LABEL[s.region_slug] ?? s.destination ?? s.region_slug ?? '';
  const hotel: any = {
    id:s.id, supplier_id:s.id, edition_id:s.edition_id||'safari', name:s.name,
    location:destination ? `${destination}, ${s.country}` : s.country??'',
    destination, subRegion:s.region_slug??'', region:COUNTRY_REGION[s.country]||'southern-africa',
    country:s.country||'', stars:5, trustScore:s.trust_score||85, contentScore:s.content_score||70,
    netRate, displayRate, otaRate:s.ota_rate_per_night ? Number(s.ota_rate_per_night) : null,
    marginScore:displayRate>0 ? Math.round((displayRate-netRate)/displayRate*100) : 20,
    image:imageUrl, reelUrl:s.reel_url??s.video_url??null,
    funFact:s.short_tagline??(s.description ? String(s.description).slice(0,120) : null),
    malariaFree:s.malaria_status==='malaria-free', tags:s.tags||[], rate_includes:s.rate_includes||[],
    reviewScore:s.review_score??null, reviewCount:s.review_count??null,
    socialLinks:s.social_media_links??null,
    _images:extraSlides,
    _reels:(() => { try { return Array.isArray(s.reels) ? s.reels : (s.reels ? JSON.parse(s.reels) : []); } catch { return []; } })(),
    upgrades:{
      rooms: roomTypes.length > 0
        ? roomTypes.map((rt: any, i: number) => ({
            label: rt.name,
            extra: (() => {
              const cat = (rt.category || '').toLowerCase();
              if (cat === 'standard') return 0;
              if (cat === 'family')   return 0;
              if (cat === 'premium')  return Math.round(displayRate * 0.20);
              if (cat === 'villa' || cat === 'exclusive-use') return Math.round(displayRate * 0.45);
              return 0;
            })(),
            tier:  i,
          }))
        : [{label:'Standard Suite',extra:0,tier:0},{label:'Premium Suite',extra:Math.round(netRate*0.4),tier:1}],
      basis:[{label:'All-inclusive',extra:0,tier:0}],
      flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:Math.round(netRate*0.08),tier:1}],
    },
  };
  return hotel;
}

function buildFallbackItinerary(nights: number, budget: number, mode: InputMode, selectedSlugs: string[]): Itinerary {
  const destMap: Record<string, {label:string;country:string;why:string;highlights:string[]}> = {
    'kruger-sabi-sand':{ label:'Kruger / Sabi Sand', country:'South Africa', why:'Highest leopard density in Africa. The benchmark safari experience.', highlights:['Leopard tracking at dawn','Night drive','Sundowner in the bush'] },
    'okavango-delta':  { label:'Okavango Delta',     country:'Botswana',     why:"No roads. No fences. The world's finest wilderness safari.", highlights:['Mokoro through papyrus','Walking safari','Helicopter over Delta'] },
    'cape-town':       { label:'Cape Town',          country:'South Africa', why:'World-class city, mountain, winelands — the perfect safari bookend.', highlights:['Table Mountain','Winelands','V&A Waterfront'] },
    'chobe-vic-falls': { label:'Chobe / Victoria Falls', country:'Zimbabwe', why:'One of the Seven Wonders of Nature.', highlights:['Victoria Falls','Chobe River cruise','Elephant herds'] },
    'masai-mara':      { label:'Masai Mara',         country:'Kenya',        why:'The greatest wildlife spectacle on Earth.', highlights:['Great Migration','Hot air balloon','Big cats'] },
    'madikwe':         { label:'Madikwe',            country:'South Africa', why:'Malaria-free Big Five. Excellent for families.', highlights:['Big Five game drives','Malaria-free','Excellent guiding'] },
    'bwindi':          { label:'Bwindi',             country:'Uganda',       why:'Half the world\'s mountain gorillas live here.', highlights:['Gorilla trekking','Forest walks','Community visit'] },
  };

  const validSlugs = selectedSlugs.filter(s => destMap[s]);

  // No recognisable region — default to Sabi + Okavango
  if (validSlugs.length === 0) {
    const n1 = Math.ceil(nights * 0.55); const n2 = nights - n1;
    return { title:`${nights}-Night Safari Journey`, summary:`A perfectly sequenced ${nights}-night journey across two of Africa's finest wilderness areas.`, routing:`JNB → Kruger / Sabi Sand (${n1}n) → Okavango (${n2}n) → JNB`, bestTiming:'June–September: dry season.', cities:[{ city:'Kruger / Sabi Sand', country:'South Africa', nights:n1, why:'First destination while fresh.', highlights:['Leopard tracking','Night drive','Sundowner'], estimatedCost:Math.round(budget*0.52), hotelRate:56000, flightCost:7600, transferCost:3800, activityCost:0, arrivalGap:'Land Skukuza 09:30, lodge 11:00', departureGap:'Final morning drive 05:30–09:30' },{ city:'Okavango Delta', country:'Botswana', nights:n2, why:'Contrast — water, mokoro, birds.', highlights:['Mokoro','Walking safari','Helicopter'], estimatedCost:Math.round(budget*0.42), hotelRate:62000, flightCost:9200, transferCost:2400, activityCost:0, arrivalGap:'Land 12:00, evening drive', departureGap:'Final mokoro 07:00–10:00' }], totalEstimate:Math.round(budget*0.94), aiInsights:['Our rates are 20–27% below booking direct'], warnings:[], inputMode:mode };
  }

  // Single destination
  if (validSlugs.length === 1) {
    const dest = destMap[validSlugs[0]];
    return { title:`${nights}-Night ${dest.label}`, summary:`A focused ${nights}-night journey in ${dest.label}.`, routing:`JNB → ${dest.label} (${nights}n) → JNB`, bestTiming:'June–September: dry season.', cities:[{ city:dest.label, country:dest.country, nights, why:dest.why, highlights:dest.highlights, estimatedCost:Math.round(budget*0.92), hotelRate:45000, flightCost:7600, transferCost:3800, activityCost:0, arrivalGap:'Arrive midday, first drive at 16:00', departureGap:'Final morning drive before departure' }], totalEstimate:Math.round(budget*0.92), aiInsights:['Our rates are 20–27% below booking direct'], warnings:[], inputMode:mode };
  }

  // 2+ destinations — distribute nights proportionally, minimum 2 per city
  const rawSplit = validSlugs.map((_, i) => {
    const share = i === 0 ? 0.45 : i === validSlugs.length - 1 ? 0.25 : 0.30 / Math.max(1, validSlugs.length - 2);
    return Math.max(2, Math.round(nights * share));
  });
  const splitTotal = rawSplit.reduce((a, b) => a + b, 0);
  rawSplit[0] += (nights - splitTotal); // fix rounding on first city

  const cities = validSlugs.map((slug, i) => {
    const dest = destMap[slug];
    return { city:dest.label, country:dest.country, nights:rawSplit[i], why:dest.why, highlights:dest.highlights, estimatedCost:Math.round(budget*(rawSplit[i]/nights)), hotelRate:48000, flightCost:8000, transferCost:3500, activityCost:0, arrivalGap:'Arrive midday, first activity at 16:00', departureGap:'Final morning activity before departure' };
  });

  const isGrand = validSlugs.length >= 3;
  const routeLabels = validSlugs.map(s => destMap[s].label);
  return {
    title: isGrand ? `${nights}-Night Grand Safari` : `${nights}-Night ${routeLabels[0]} & ${routeLabels[1]}`,
    summary: `A ${nights}-night journey across ${validSlugs.length} of Africa's finest wilderness areas.`,
    routing: `JNB → ${routeLabels.join(' → ')} → JNB`,
    bestTiming: 'June–September: dry season, short grass, animals at water.',
    cities,
    totalEstimate: Math.round(budget * 0.92),
    aiInsights: ['Our rates are 20–27% below booking direct'],
    warnings: [],
    inputMode: mode,
  };
}

type ValidationIssue = { severity:'hard'|'warning'; code:string; message:string; };

function validateItinerary(params: { cities:ItineraryCity[]; checkinDate:string; infants:number; hasOwnFlights?:boolean; arrivalFlightNo?:string; }): ValidationIssue[] {
  const { cities, checkinDate, infants } = params;
  const issues: ValidationIssue[] = [];
  if (params.hasOwnFlights && !params.arrivalFlightNo && cities.length > 0) {
    issues.push({ severity:'warning', code:'NO_ARRIVAL_DETAILS', message:'No arrival flight details provided. Your Journey Specialist will contact you to arrange your airport transfer and first-night timing.' });
  }
  if (!checkinDate) issues.push({ severity:'warning', code:'NO_DATES', message:'No specific dates selected. Pricing is indicative — your Journey Specialist will confirm availability once dates are set.' });
  cities.forEach(c => { if (c.nights===1) issues.push({ severity:'hard', code:'ONE_NIGHT_STAY', message:`${c.city}: 1-night stay is below minimum. Extend to at least 2 nights or remove this destination.` }); });
  if (infants>0) cities.forEach(c => {
    const slug = CITY_TO_SLUG[c.city?.toLowerCase().trim()??'']??'';
    if (['kruger-sabi-sand','okavango-delta','masai-mara','chobe-vic-falls'].includes(slug)) issues.push({ severity:'warning', code:'INFANT_AGE_RESTRICTION', message:`${c.city}: Some camps restrict under-5s on open game drives. We'll confirm lodge policies.` });
    if (['kruger-sabi-sand','okavango-delta','masai-mara','bwindi','chobe-vic-falls'].includes(slug)) issues.push({ severity:'warning', code:'INFANT_MALARIA', message:`${c.city}: Malaria zone. Consult your paediatrician before travel with infants.` });
  });
  const charterSlugs = ['kruger-sabi-sand','okavango-delta','masai-mara'];
  if (cities.some(c => charterSlugs.includes(CITY_TO_SLUG[c.city?.toLowerCase().trim()??'']??''))) issues.push({ severity:'warning', code:'CHARTER_BAGGAGE', message:'Light aircraft routes enforce a 20kg soft-bag limit. Hard-sided cases are not permitted.' });
  return issues;
}

function ValidationModal({ issues, onProceed, onBack }: { issues:ValidationIssue[]; onProceed:()=>void; onBack:()=>void; }) {
  const hard = issues.filter(i=>i.severity==='hard');
  const warn = issues.filter(i=>i.severity==='warning');
  return (
    <div className="overlay" onClick={e => { if (e.target===e.currentTarget) onBack(); }}>
      <div style={{ background:'#141414', border:`0.5px solid ${T.border}`, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:600, maxHeight:'88vh', overflowY:'auto', padding:'24px 20px 40px', animation:'slideUp 0.3s ease' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.text }}>Pre-flight check</div>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:T.textMid, width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        <div style={{ fontSize:13, color:T.textDim, marginBottom:20 }}>Logistics, connections and guest requirements</div>
        {hard.length>0 && (<div style={{ marginBottom:16 }}><div style={{ fontSize:10, fontWeight:700, color:'#f87171', letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:8 }}>⛔ Must resolve before proceeding</div>{hard.map((issue,i) => <div key={i} style={{ background:'rgba(248,113,113,0.07)', border:'0.5px solid rgba(248,113,113,0.22)', borderRadius:10, padding:'12px 14px', marginBottom:8, fontSize:13, color:'rgba(248,113,113,0.9)', lineHeight:1.6 }}>{issue.message}</div>)}</div>)}
        {warn.length>0 && (<div style={{ marginBottom:20 }}><div style={{ fontSize:10, fontWeight:700, color:T.amber, letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:8 }}>⚠ Noted — your specialist will handle</div>{warn.map((issue,i) => <div key={i} style={{ background:'rgba(251,191,36,0.06)', border:'0.5px solid rgba(251,191,36,0.2)', borderRadius:10, padding:'12px 14px', marginBottom:8, fontSize:13, color:T.amber, lineHeight:1.6 }}>{issue.message}</div>)}</div>)}
        {issues.length===0 && <div style={{ background:'rgba(74,222,128,0.07)', border:'0.5px solid rgba(74,222,128,0.22)', borderRadius:10, padding:'12px 14px', marginBottom:20, fontSize:13, color:T.green }}>✓ Everything checks out. Itinerary is logistically sound.</div>}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onBack} style={{ flex:1, padding:'13px 0', border:`0.5px solid ${T.border}`, borderRadius:10, background:'transparent', color:T.textMid, cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>← Review</button>
          {hard.length===0 ? <button onClick={onProceed} style={{ flex:2, padding:'13px 0', background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', borderRadius:10, color:'#0a0a0a', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700 }}>Proceed to Payment →</button> : <div style={{ flex:2, padding:'13px 0', background:'rgba(255,255,255,0.04)', border:`0.5px solid ${T.border}`, borderRadius:10, color:T.textDim, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>Resolve issues above first</div>}
        </div>
      </div>
    </div>
  );
}

function ImageMiniChat({ hotel, slide, edition, onEscalate, onClose }: { hotel:Hotel; slide:Slide; edition:EditionConfig; onEscalate:(context:string)=>void; onClose:()=>void; }) {
  const [msgs,    setMsgs]    = useState<{role:'user'|'ai';text:string}[]>([]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const limit = 3;
  const exhausted = msgs.filter(m=>m.role==='user').length >= limit;
  const context = `Property: ${hotel.name} (${hotel.destination}). Current image: ${slide.label || 'hero image'}${slide.roomType ? `, room type: ${slide.roomType}` : ''}.`;
  const send = async () => {
    if (!input.trim() || exhausted) return;
    const msg = input.trim(); setInput('');
    setMsgs(m => [...m, { role:'user', text:msg }]);
    setLoading(true);
    let replied = false;
    try {
      const res = await fetch('/api/ai-gateway', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:200, system:`You are a knowledgeable safari specialist. Answer questions about ${hotel.name} in ${hotel.destination} concisely (2-3 sentences). Be specific and helpful. Context: ${context}`, messages:[{ role:'user', content:msg }] }) });
      if (res.ok) { const d = await res.json(); const text = d.content?.[0]?.text; if (text) { setMsgs(m => [...m, { role:'ai', text }]); replied = true; } }
    } catch { /* fall through */ }
    if (!replied) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{ 'Content-Type':'application/json', 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' }, body:JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:200, system:`You are a knowledgeable safari specialist. Answer questions about ${hotel.name} in ${hotel.destination} concisely (2-3 sentences). Be specific and helpful. Context: ${context}`, messages:[{ role:'user', content:msg }] }) });
        if (res.ok) { const d = await res.json(); const text = d.content?.[0]?.text; if (text) { setMsgs(m => [...m, { role:'ai', text }]); replied = true; } }
      } catch { /* both failed */ }
    }
    if (!replied) setMsgs(m => [...m, { role:'ai', text:`${hotel.name} is in ${hotel.destination}. For detailed information, your Journey Specialist can help — tap the escalate button below.` }]);
    setLoading(false);
  };
  return (
    <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(10,10,10,0.97)', borderTop:`0.5px solid ${T.border}`, borderRadius:'0 0 14px 14px', padding:12, zIndex:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:11, color:T.gold, fontWeight:600 }}>? About this image</div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:T.textDim, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>×</button>
      </div>
      <div style={{ maxHeight:120, overflowY:'auto', marginBottom:8, display:'flex', flexDirection:'column', gap:6 }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'90%', padding:'7px 11px', borderRadius:10, background:m.role==='user'?'rgba(212,175,55,0.12)':'rgba(255,255,255,0.06)', border:`0.5px solid ${m.role==='user'?T.borderGold:T.border}`, fontSize:12, color:T.text, lineHeight:1.5 }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{ fontSize:12, color:T.textDim, padding:'4px 8px' }}>…</div>}
      </div>
      {exhausted ? (
        <button onClick={() => { onClose(); onEscalate(context); }} style={{ width:'100%', padding:'9px 0', background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, color:T.gold, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Talk to a Journey Specialist →</button>
      ) : (
        <div style={{ display:'flex', gap:6 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask about this image or room..." style={{ flex:1, background:'rgba(255,255,255,0.06)', border:`0.5px solid ${T.border}`, color:T.text, borderRadius:7, padding:'7px 10px', fontSize:12, outline:'none', fontFamily:'inherit' }} />
          <button onClick={send} style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', color:'#0a0a0a', borderRadius:7, padding:'7px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>→</button>
        </div>
      )}
      {!exhausted && <div style={{ fontSize:10, color:T.textDim, marginTop:4, textAlign:'center' as const }}>{limit - msgs.filter(m=>m.role==='user').length} question{limit - msgs.filter(m=>m.role==='user').length!==1?'s':''} remaining · then connect to specialist</div>}
    </div>
  );
}
function SectionLabel({ text, sub, noMargin }: { text:string; sub?:string; noMargin?:boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 20 }}>
      <div style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: 20,
        fontWeight: 300,
        color: 'rgba(245,240,232,0.85)',
        letterSpacing: '0.01em',
        lineHeight: 1.2,
      }}>{text}</div>
      {sub && (
        <div style={{
          fontSize: 12,
          color: 'rgba(245,240,232,0.35)',
          marginTop: 6,
          fontWeight: 200,
          letterSpacing: '0.03em',
        }}>{sub}</div>
      )}
    </div>
  );
}
function InputDivider() {
  return <div style={{ height: 44 }} />;
}
const M_HOTELS = 1.15;

// ═══════════════════════════════════════════════════════════════════════════════
// [V6-3] [V6-6] CUSTOMISE SHEET — tabs: Rooms + Chat with quick actions
// Activities REMOVED — they live in their own spool below the property carousel.
// Title changed from "Upgrade & Personalise" to "Customise".
// ═══════════════════════════════════════════════════════════════════════════════
function UpgradeSheet({ hotel, stayPrefs, kbEntries, fmt, onSelect, onClose }: { hotel:Hotel; stayPrefs:{rooms:number;basis:number;flexibility:number}; kbEntries:KBEntry[]; fmt:(n:number)=>string; onSelect:(key:string,opt:any)=>void; onClose:()=>void; }) {

  const [heroSlide, setHeroSlide] = useState(0);
  const [sheetTab,  setSheetTab]  = useState<'rooms'|'chat'>('rooms');
  const [chatMsgs,  setChatMsgs]  = useState<{role:'user'|'ai';text:string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendChat = async (msg: string) => {
    if (!msg.trim() || chatLoading) return;
    setChatMsgs(m => [...m, { role:'user', text:msg }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-haiku-4-5-20251001', max_tokens:300,
          system:`You are a luxury safari specialist. The traveller is customising their itinerary at ${hotel.name} in ${hotel.destination}. Respond concisely (2-3 sentences). For changes like "make it cheaper" or "extend" — describe what you would do and ask them to confirm before making changes. Be warm and specific.`,
          messages:[{ role:'user', content:msg }]
        })
      });
      const d = await res.json();
      const text = d.content?.[0]?.text ?? "Let me connect you with your Journey Specialist for this one.";
      setChatMsgs(m => [...m, { role:'ai', text }]);
    } catch {
      setChatMsgs(m => [...m, { role:'ai', text:"Your Journey Specialist can action this for you — tap escalate below." }]);
    }
    setChatLoading(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior:'smooth' }), 100);
  };

  const kbEntry = kbEntries.find((e:any) =>
    (e.status === 'active' || e.active === true) &&
    (e.entry_type === 'property' || e.type === 'property') &&
    e.claim_type !== 'commercial' &&
    !e.internal_only &&
    ((e.linked_name ?? e.linkedTo ?? '').toLowerCase().includes(hotel.name.toLowerCase()))
  );
  const kbHighlightsSheet: string[] = kbEntry?.highlights ?? [];
  const kbTipsSheet: string[]       = kbEntry?.tips ?? [];
  // Never expose specialist_recs or specialistNotes to traveller
  const kbSpecialistNote: string    = '';
  const allSlides = buildSlides(hotel);

  const [localPrefs, setLocalPrefs] = useState(stayPrefs);
  const handleSelect = (key: string, opt: any) => {
    setLocalPrefs(p => ({ ...p, [key]: opt.tier ?? 0 }));
    onSelect(key, opt);
  };

  const [roomSlides, setRoomSlides]   = useState<Record<number,number>>({});
  const [expandedRoom, setExpandedRoom] = useState<number | null>(null);

  const roomExtra  = hotel.upgrades?.rooms?.[localPrefs.rooms]?.extra ?? 0;
  const flexExtra  = hotel.upgrades?.flexibility?.[localPrefs.flexibility]?.extra ?? 0;
  const addedCost  = roomExtra + flexExtra;

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'#0f0f0f', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:680, height:'95vh', display:'flex', flexDirection:'column', animation:'slideUp 0.3s ease', overflow:'hidden' }}>

        {/* STICKY HEADER */}
        <div style={{ flexShrink:0, padding:'18px 20px 14px', borderBottom:`0.5px solid rgba(255,255,255,0.08)`, background:'#0f0f0f' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.12em', fontWeight:700, marginBottom:3 }}>✦ Customise</div>
              <div style={{ fontSize:18, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.2 }}>{hotel.name}</div>
              <div style={{ fontSize:12, color:T.textDim, marginTop:2 }}>{hotel.destination} · {hotel.country}</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:'none', color:T.textMid, width:34, height:34, borderRadius:'50%', cursor:'pointer', fontSize:17, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginLeft:12 }}>×</button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:10, flexWrap:'wrap' }}>
            <div style={{ fontSize:20, fontWeight:700, color:T.gold, fontFamily:"'Cormorant Garamond',serif" }}>
              {fmt(hotel.displayRate)}<span style={{ fontSize:11, color:T.textDim, fontWeight:400 }}>/night</span>
            </div>
            {addedCost > 0 && (<div style={{ fontSize:12, color:T.green }}>+ {fmt(addedCost)} in selected add-ons</div>)}
            {hotel.otaRate && (
              <div style={{ fontSize:11, color:T.textDim, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'2px 10px' }}>
               Save {fmt(Math.max(0, (hotel.otaRate||0) - hotel.displayRate))}/night vs direct
              </div>
            )}
          </div>

          {/* TAB SWITCHER */}
          <div style={{ display:'flex', gap:6, marginTop:14 }}>
            {(['rooms','chat'] as const).map(t => (
              <button key={t} onClick={() => setSheetTab(t)} style={{ flex:1, padding:'9px 0', borderRadius:9, border:`1.5px solid ${sheetTab===t ? T.gold : T.border}`, background:sheetTab===t ? T.goldDim : 'transparent', color:sheetTab===t ? T.gold : T.textMid, fontSize:12, fontWeight:sheetTab===t ? 700 : 400, cursor:'pointer', fontFamily:'inherit' }}>
                {t==='rooms' ? '🛏 Rooms & Upgrades' : '💬 Customise via chat'}
              </button>
            ))}
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 0 120px' }}>

          {/* CHAT TAB */}
          {sheetTab === 'chat' && (
            <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:12, color:T.textDim, lineHeight:1.6 }}>
                Tap a quick action below — or type anything to your Journey Specialist. All changes are confirmed with you before they happen.
              </div>
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:8 }}>
                {CHAT_QUICK_ACTIONS.map(a => (
                  <button key={a.id} onClick={() => sendChat(a.label)} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:20, border:`0.5px solid ${T.borderGold}`, background:T.goldDim, color:T.gold, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                    <span>{a.icon}</span>{a.label}
                  </button>
                ))}
              </div>
              {chatMsgs.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto' as const, padding:'4px 0' }}>
                  {chatMsgs.map((m, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
                      <div style={{ maxWidth:'84%', padding:'9px 13px', borderRadius:m.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px', background:m.role==='user'?T.goldDim:T.surface, border:`0.5px solid ${m.role==='user'?T.borderGold:T.border}`, fontSize:12, color:m.role==='user'?T.gold:T.text, lineHeight:1.55 }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display:'flex', justifyContent:'flex-start' }}>
                      <div style={{ padding:'9px 14px', borderRadius:'14px 14px 14px 4px', background:T.surface, border:`0.5px solid ${T.border}`, fontSize:12, color:T.textDim }}>Thinking…</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendChat(chatInput)} placeholder="Make it cheaper · Add a night · Swap Cape Town for Kruger…" style={{ flex:1, padding:'10px 14px', background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, color:T.text, fontSize:12, outline:'none', fontFamily:'inherit' }} />
                <button onClick={() => sendChat(chatInput)} disabled={!chatInput.trim() || chatLoading} style={{ width:40, height:40, borderRadius:10, background:chatInput.trim()?`linear-gradient(135deg,${T.gold},${T.goldLight})`:'rgba(255,255,255,0.06)', border:'none', color:chatInput.trim()?'#0a0a0a':T.textDim, cursor:chatInput.trim()?'pointer':'default', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', flexShrink:0 }}>→</button>
              </div>
            </div>
          )}

          {/* ROOMS TAB */}
          {sheetTab === 'rooms' && (
            <>
              {/* SECTION 1: HERO CAROUSEL */}
              {allSlides.length > 0 && (
                <div style={{ position:'relative', height:240, overflow:'hidden', background:'#111' }}>
                  {allSlides[heroSlide] && (
                    allSlides[heroSlide].type === 'youtube'
                      ? <iframe src={allSlides[heroSlide].url} title={hotel.name} style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none', pointerEvents:'none' }} allow="autoplay; encrypted-media" allowFullScreen={false} loading="lazy" />
                    : allSlides[heroSlide].type === 'reel' || allSlides[heroSlide].type === 'video'
                      ? <video src={allSlides[heroSlide].url} poster={allSlides[heroSlide].poster} autoPlay muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <img src={allSlides[heroSlide].url} alt={hotel.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  )}
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 60%)' }} />
                  {heroSlide > 0 && (
                    <button onClick={() => setHeroSlide(i => i-1)} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.55)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>‹</button>
                  )}
                  {heroSlide < allSlides.length - 1 && (
                    <button onClick={() => setHeroSlide(i => i+1)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.55)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>›</button>
                  )}
                  <div style={{ position:'absolute', bottom:10, left:0, right:0, display:'flex', justifyContent:'space-between', alignItems:'flex-end', padding:'0 14px' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', background:'rgba(0,0,0,0.4)', borderRadius:4, padding:'2px 7px' }}>{allSlides[heroSlide]?.label || ''}{allSlides[heroSlide]?.roomType ? ` · ${allSlides[heroSlide].roomType}` : ''}</div>
                    {allSlides.length > 1 && (
                      <div style={{ display:'flex', gap:3 }}>
                        {allSlides.map((_,i) => <div key={i} onClick={() => setHeroSlide(i)} style={{ width:i===heroSlide?14:4, height:4, borderRadius:2, background:i===heroSlide?T.gold:'rgba(255,255,255,0.35)', cursor:'pointer', transition:'all 0.2s' }} />)}
                      </div>
                    )}
                  </div>
                  {(() => { const note = allSlides[heroSlide] ? getSlideKB(hotel, allSlides[heroSlide], kbEntries) : null; return note ? (
                    <div title={note} style={{ position:'absolute', top:10, right:10, zIndex:8 }}>
                      <div style={{ width:26, height:26, background:'linear-gradient(135deg,#c8a020,#f0c840)', transform:'rotate(45deg)', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ transform:'rotate(-45deg)', fontSize:10, color:'#0a0a0a', fontWeight:900 }}>✦</span>
                      </div>
                    </div>
                  ) : null; })()}
                </div>
              )}

              <div style={{ padding:'20px 20px 0' }}>
                {hotel.funFact && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:14, color:T.textMid, lineHeight:1.75 }}>{hotel.funFact}</div>
                  </div>
                )}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'4px 12px', fontSize:12, color:T.green }}>★ {hotel.trustScore}/100 trust score</div>
                  {hotel.malariaFree && <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'4px 12px', fontSize:12, color:T.green }}>✓ Malaria-free</div>}
                  {(hotel as any).reviewScore && <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, borderRadius:20, padding:'4px 12px', fontSize:12, color:T.textMid }}>{(hotel as any).reviewScore}★ guest rating</div>}
                </div>

                {(kbHighlightsSheet.length > 0 || kbTipsSheet.length > 0 || kbSpecialistNote) && (
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:700, marginBottom:10 }}>✦ Specialist Notes</div>
                    {kbSpecialistNote && (
                      <div style={{ background:'rgba(212,175,55,0.07)', border:`0.5px solid ${T.borderGold}`, borderLeft:`2px solid ${T.gold}`, borderRadius:'0 12px 12px 0', padding:'12px 16px', marginBottom:12, fontSize:13, color:'rgba(240,237,230,0.85)', lineHeight:1.75, fontStyle:'italic' }}>{kbSpecialistNote}</div>
                    )}
                    {kbHighlightsSheet.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                        {kbHighlightsSheet.map((h:string,i:number) => (
                          <span key={i} style={{ fontSize:11, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:6, padding:'4px 10px' }}>{h}</span>
                        ))}
                      </div>
                    )}
                    {kbTipsSheet.map((tip:string,i:number) => (
                      <div key={i} style={{ fontSize:12, color:T.textMid, lineHeight:1.65, padding:'4px 0', borderBottom:i<kbTipsSheet.length-1?`0.5px solid ${T.border}`:'none' }}>
                        <span style={{ color:T.green, marginRight:6 }}>›</span>{tip}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginBottom:24 }}>
                  <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:600, marginBottom:12 }}>Room types & upgrades</div>
                  {(hotel.upgrades?.rooms ?? []).map((opt:any, roomIdx:number) => {
                    const sel = opt.tier === localPrefs.rooms;
                    const expanded = expandedRoom === roomIdx;
                    const roomSlideList = allSlides.filter(s => !s.roomType || s.roomType?.toLowerCase().includes(opt.label.toLowerCase()));
                    const rSlideIdx = roomSlides[roomIdx] ?? 0;
                    const rSlide = roomSlideList[rSlideIdx] ?? allSlides[0];
                    return (
                      <div key={opt.label} style={{ marginBottom:10, borderRadius:12, border:`1.5px solid ${sel?T.gold:T.border}`, background:sel?'rgba(212,175,55,0.04)':T.surface, overflow:'hidden', transition:'border-color 0.2s' }}>
                        <div style={{ position:'relative', height:160, overflow:'hidden', cursor:'pointer' }} onClick={() => { handleSelect('rooms', opt); }}>
                          {rSlide && (rSlide.type==='youtube'
                            ? <iframe src={rSlide.url} title={opt.label} style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none', pointerEvents:'none' }} allow="autoplay; encrypted-media" allowFullScreen={false} loading="lazy" />
                            : rSlide.type==='reel'||rSlide.type==='video'
                            ? <video src={rSlide.url} poster={rSlide.poster} autoPlay muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <img src={rSlide.url} alt={opt.label} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          )}
                          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 50%)' }} />
                          {roomSlideList.length > 1 && rSlideIdx > 0 && (
                            <button onClick={e => { e.stopPropagation(); setRoomSlides(prev => ({ ...prev, [roomIdx]: rSlideIdx-1 })); }} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:24, height:24, borderRadius:'50%', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>‹</button>
                          )}
                          {roomSlideList.length > 1 && rSlideIdx < roomSlideList.length-1 && (
                            <button onClick={e => { e.stopPropagation(); setRoomSlides(prev => ({ ...prev, [roomIdx]: rSlideIdx+1 })); }} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:24, height:24, borderRadius:'50%', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>›</button>
                          )}
                          <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                            <div>
                              <div style={{ fontSize:14, fontWeight:700, color:'#fff', fontFamily:"'Cormorant Garamond',serif" }}>{opt.label}</div>
                              {roomSlideList.length > 1 && (
                                <div style={{ display:'flex', gap:3, marginTop:4 }}>
                                  {roomSlideList.map((_,i) => <div key={i} style={{ width:i===rSlideIdx?12:4, height:4, borderRadius:2, background:i===rSlideIdx?T.gold:'rgba(255,255,255,0.35)', transition:'all 0.2s' }} />)}
                                </div>
                              )}
                            </div>
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                              {sel && <div style={{ fontSize:10, color:'#0a0a0a', background:T.gold, borderRadius:20, padding:'2px 8px', fontWeight:800 }}>✓ Selected</div>}
                              {!sel && <div style={{ fontSize:10, color:T.textDim, background:'rgba(255,255,255,0.06)', border:`0.5px solid ${T.border}`, borderRadius:20, padding:'2px 8px' }}>Select</div>}
                            </div>
                          </div>
                        </div>
                        <div style={{ padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <button onClick={() => setExpandedRoom(expanded ? null : roomIdx)} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12, color:T.textDim, display:'flex', alignItems:'center', gap:4 }}>
                            {expanded ? '▲ Hide details' : '▼ Room details'}
                          </button>
                          <button onClick={() => handleSelect('rooms', opt)} style={{ padding:'7px 16px', borderRadius:8, border:`1.5px solid ${sel?T.gold:T.border}`, background:sel?T.goldDim:'transparent', color:sel?T.gold:T.textMid, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:sel?700:400 }}>
                            {sel ? '✓ Selected' : 'Select this room'}
                          </button>
                        </div>
                        {expanded && (
                          <div style={{ padding:'0 14px 14px', borderTop:`0.5px solid ${T.border}` }}>
                            <div style={{ fontSize:12, color:T.textMid, lineHeight:1.65, paddingTop:10 }}>
                              {kbEntry?.structuredFields?.best_room && opt.tier === 1 ? String(kbEntry.structuredFields.best_room) : `${opt.label} — ${opt.extra === 0 ? 'included in your base rate' : `upgrade at ${fmt(opt.extra)}/night`}. All meals and game activities included.`}
                            </div>
                            {hotel.upgrades?.basis && (
                              <div style={{ marginTop:10, display:'flex', gap:6, flexWrap:'wrap' }}>
                                {hotel.upgrades.basis.map((b:any) => (
                                  <div key={b.label} style={{ fontSize:11, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:20, padding:'3px 10px' }}>✓ {b.label}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {hotel.upgrades?.flexibility && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600, marginBottom:8 }}>Cancellation</div>
                      <div style={{ display:'flex', gap:8 }}>
                        {hotel.upgrades.flexibility.map((opt:any) => {
                          const sel = opt.tier === localPrefs.flexibility;
                          return (
                            <button key={opt.label} onClick={() => handleSelect('flexibility', opt)} style={{ flex:1, padding:'9px 12px', borderRadius:9, border:`1.5px solid ${sel?T.gold:T.border}`, background:sel?T.goldDim:'transparent', color:sel?T.gold:T.textMid, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:sel?600:400, textAlign:'left' as const }}>
                              <div style={{ fontWeight:sel?700:400 }}>{opt.label}</div>
                              <div style={{ fontSize:10, marginTop:2, color:opt.extra===0?T.textDim:T.gold }}>{opt.extra===0?'No extra cost':`+${fmt(opt.extra)}/night`}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {(hotel as any).socialLinks && (
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:600, marginBottom:10 }}>Follow this property</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {Object.entries((hotel as any).socialLinks).map(([platform, url]:any) => url && (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer" style={{ padding:'7px 14px', background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, borderRadius:8, fontSize:12, color:T.textMid, textDecoration:'none', textTransform:'capitalize' as const }}>{platform}</a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* STICKY FOOTER */}
        <div style={{ flexShrink:0, padding:'14px 20px 24px', borderTop:`0.5px solid rgba(255,255,255,0.08)`, background:'#0f0f0f' }}>
          {addedCost > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:10 }}>
              <span style={{ color:T.textDim }}>Base rate + add-ons</span>
             <span style={{ color:T.gold, fontWeight:600 }}>{fmt(hotel.displayRate + addedCost)}/night equivalent</span>
            </div>
          )}
          <button onClick={onClose} className="btn-gold" style={{ width:'100%', padding:15, fontSize:15 }}>
            Confirm & return to itinerary →
          </button>
          <div style={{ textAlign:'center' as const, fontSize:11, color:T.textDim, marginTop:8 }}>Tap outside or press × to close without saving</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// [V6-3] ACTIVITY SPOOL — separate horizontal carousel below the property.
// Activities live here now, not inside the Customise sheet.
// Filtered by region. Tap to add/remove.
// ═══════════════════════════════════════════════════════════════════════════════
function ActivitySpool({ regionSlug, selectedIds, onToggle, fmt, activities }: {
  regionSlug:  string;
  selectedIds: string[];
  onToggle:    (id:string)=>void;
  fmt:         (n:number)=>string;
  activities:  Activity[];
}) {
  const regionActs = useMemo(() => activities.filter(a =>
    a.region_slug === regionSlug
  ), [regionSlug, activities]);

  const [idx, setIdx] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  const scrollTo = (i: number) => {
    const strip = stripRef.current; if (!strip) return;
    const cards = strip.querySelectorAll<HTMLElement>('[data-act-card]');
    cards[i]?.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
    setIdx(i);
  };

  if (!regionActs.length) return null;

  return (
    <div style={{ marginBottom:24 }}>
      {/* Section header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8, padding:'0 2px' }}>
        <div>
          <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:700 }}>✦ Experiences nearby</div>
          <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>Add to your package · all priced per person</div>
        </div>
        {selectedIds.length > 0 && <div style={{ fontSize:11, color:T.gold }}>{selectedIds.length} selected</div>}
      </div>

      <div style={{ position:'relative', margin:'0 -4px' }}>
        {idx > 0 && (
          <button onClick={() => scrollTo(idx - 1)} style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', zIndex:10, background:'rgba(10,10,10,0.92)', border:`1px solid ${T.borderGold}`, color:T.gold, width:32, height:52, borderRadius:'0 10px 10px 0', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'3px 0 12px rgba(0,0,0,0.5)' }}>‹</button>
        )}
        {idx < regionActs.length - 1 && (
          <button onClick={() => scrollTo(idx + 1)} style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', zIndex:10, background:'rgba(10,10,10,0.92)', border:`1px solid ${T.borderGold}`, color:T.gold, width:32, height:52, borderRadius:'10px 0 0 10px', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'-3px 0 12px rgba(0,0,0,0.5)' }}>›</button>
        )}

        <div ref={stripRef} style={{ display:'flex', gap:12, overflowX:'auto', scrollSnapType:'x mandatory' as any, WebkitOverflowScrolling:'touch' as any, scrollbarWidth:'none' as any, paddingLeft:20, paddingRight:20, paddingBottom:4 }}>
          {regionActs.map((act, i) => {
            const isSel = selectedIds.includes(String(act.id));
            const display = Math.round(act.netRate * 1.18);
            const saving = act.otaRate ? Math.round(act.otaRate - display) : 0;
            return (
              <div key={act.id} data-act-card={i} onClick={() => { onToggle(String(act.id)); setIdx(i); }} style={{ flexShrink:0, width:'min(70vw,240px)', scrollSnapAlign:'center', borderRadius:12, border:`1.5px solid ${isSel?T.gold:T.border}`, background:isSel?'rgba(212,175,55,0.06)':T.surface, cursor:'pointer', overflow:'hidden', transition:'border-color 0.2s' }}>
                <div style={{ position:'relative', height:130, overflow:'hidden' }}>
                  <img src={act.image} alt={act.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.68) 0%,transparent 50%)' }} />
                  {isSel && <div style={{ position:'absolute', top:8, right:8, width:20, height:20, borderRadius:'50%', background:T.gold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#0a0a0a', fontWeight:800 }}>✓</div>}
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'8px 10px' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#fff', lineHeight:1.2, fontFamily:"'Cormorant Garamond',serif" }}>{act.name}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:1 }}>{act.duration}</div>
                  </div>
                </div>
                <div style={{ padding:'10px 12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                    <div style={{ fontSize:11, color:T.textDim }}>★ {act.trustScore}/100</div>
                    <div style={{ textAlign:'right' as const }}>
                      <div style={{ fontSize:14, fontWeight:700, color:isSel?T.gold:T.text }}>{fmt(display)}<span style={{ fontSize:9, color:T.textDim, fontWeight:400 }}>/pp</span></div>

                    </div>
                  </div>
                  <div style={{ fontSize:10, color:T.textDim, lineHeight:1.4 }}>{act.funFact}</div>
                </div>
              </div>
            );
          })}
        </div>

        {regionActs.length > 1 && (
          <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:8 }}>
            {regionActs.map((_,i) => <div key={i} onClick={() => scrollTo(i)} style={{ width:i===idx?14:5, height:5, borderRadius:3, background:i===idx?T.gold:'rgba(255,255,255,0.2)', cursor:'pointer', transition:'all 0.2s' }} />)}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div style={{ marginTop:10, padding:'9px 14px', background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, display:'flex', justifyContent:'space-between', fontSize:12 }}>
          <span style={{ color:T.gold, fontWeight:600 }}>{selectedIds.length} experience{selectedIds.length===1?'':'s'} added</span>
          <span style={{ color:T.textMid }}>{fmt(regionActs.filter(a=>selectedIds.includes(String(a.id))).reduce((s,a)=>s+Math.round(a.netRate*1.18),0))}</span>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// [V6-4][V6-5] NESTED PROPERTY CAROUSEL
// CHANGES:
//  - Auto-select on swipe: centred property is always selected (V6-4)
//  - Single Customise button below each tile (V6-5) — Select button removed
//  - Sticky price updates automatically as user swipes
// ═══════════════════════════════════════════════════════════════════════════════
function NestedPropertyCarousel({
  destinationLabel, destinationSlug, cityNights, onNightsChange,
  hotels, selectedHotelId, onSelectHotel, stayPrefs, onUpgradeSelect,
  kbEntries, fmt, edition, onEscalateChat, onExploreLodge,
}: {
  destinationLabel:     string;
  destinationSlug:      string;
  cityNights:           number;
  onNightsChange:       (delta: number) => void;
  hotels:               Hotel[];
  selectedHotelId:      string | number;
  onSelectHotel:        (hotel: Hotel) => void;
  stayPrefs:            { rooms: number; basis: number; flexibility: number };
  onUpgradeSelect:      (key: string, opt: any) => void;
  kbEntries:            KBEntry[];
  fmt:                  (n: number) => string;
  edition:              EditionConfig;
  onEscalateChat:       (context: string) => void;
  onExploreLodge?:      (hotel: Hotel, supplierId?: string, includes?: string[]) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(() => {
    const idx = hotels.findIndex(h => String(h.id) === String(selectedHotelId));
    return idx >= 0 ? idx : 0;
  });

  const [slideIdxMap, setSlideIdxMap] = useState<Record<string, number>>({});
  const getSlideIdx = (hotelId: string | number) => slideIdxMap[String(hotelId)] ?? 0;
  const setSlideIdx = (hotelId: string | number, idx: number) =>
    setSlideIdxMap(prev => ({ ...prev, [String(hotelId)]: idx }));

  const [kbOpenId,      setKbOpenId]      = useState<string | null>(null);
  const [chatOpenId,    setChatOpenId]    = useState<string | null>(null);
  const [upgradeOpenId, setUpgradeOpenId] = useState<string | null>(null);

  const stripRef = useRef<HTMLDivElement>(null);

  // [V6-4] scrollToIdx now also auto-selects the centred hotel
  const scrollToIdx = useCallback((idx: number) => {
    const strip = stripRef.current; if (!strip) return;
    const cards = strip.querySelectorAll<HTMLElement>('[data-card]');
    const card = cards[idx];
    if (card) card.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
    setActiveIdx(idx);
    setKbOpenId(null); setChatOpenId(null);
    // AUTO-SELECT: the centred property is always the selected one
    if (hotels[idx]) onSelectHotel(hotels[idx]);
  }, [hotels, onSelectHotel]);

  // [V6-4] Touch swipe also triggers auto-select
  useEffect(() => {
    const strip = stripRef.current; if (!strip) return;
    const onScroll = () => {
      const cards = Array.from(strip.querySelectorAll<HTMLElement>('[data-card]'));
      const stripCenter = strip.scrollLeft + strip.clientWidth / 2;
      let closest = 0; let minDist = Infinity;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(stripCenter - cardCenter);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setActiveIdx(closest);
      // Auto-select on touch swipe
      if (hotels[closest]) onSelectHotel(hotels[closest]);
    };
    strip.addEventListener('scroll', onScroll, { passive: true });
    return () => strip.removeEventListener('scroll', onScroll);
  }, [hotels, onSelectHotel]);

  useEffect(() => {
    const idx = hotels.findIndex(h => String(h.id) === String(selectedHotelId));
    if (idx > 0) setTimeout(() => scrollToIdx(idx), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hotels.length) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:12, paddingLeft:2 }}>
        <div>
          <div style={{ fontSize:11, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>{destinationLabel}</div>
          <div style={{ fontSize:12, color:T.textDim, marginTop:1 }}>{hotels.length} propert{hotels.length===1?'y':'ies'} · swipe to browse — price updates as you go</div>
        </div>
        <div style={{ textAlign:'right' as const }}>
          <div style={{ fontSize:11, color:T.textDim }}>{hotels.length} option{hotels.length!==1?'s':''}</div>
        </div>
      </div>

      <div style={{ position:'relative' as const }}>
        {activeIdx > 0 && (
          <button onClick={() => scrollToIdx(activeIdx - 1)} aria-label="Previous property" style={{ position:'absolute', left:-18, top:'50%', transform:'translateY(-60%)', zIndex:20, background:T.gold, border:`1px solid ${T.gold}`, color:'#0a0a0a', width:36, height:56, borderRadius:'0 10px 10px 0', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'3px 0 16px rgba(0,0,0,0.55)', fontWeight:700 }}>◂</button>
        )}
        {activeIdx < hotels.length - 1 && (
          <button onClick={() => scrollToIdx(activeIdx + 1)} aria-label="Next property" style={{ position:'absolute', right:-18, top:'50%', transform:'translateY(-60%)', zIndex:20, background:T.gold, border:`1px solid ${T.gold}`, color:'#0a0a0a', width:36, height:56, borderRadius:'10px 0 0 10px', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'-3px 0 16px rgba(0,0,0,0.55)', fontWeight:700 }}>▸</button>
        )}

        <div ref={stripRef} style={{ display:'flex', gap:12, overflowX:'auto', scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch', scrollbarWidth:'none', msOverflowStyle:'none', paddingLeft:24, paddingRight:24, paddingBottom:4 } as React.CSSProperties}>
          <style>{`.carousel-strip::-webkit-scrollbar{display:none}`}</style>

          {hotels.map((hotel, propIdx) => {
            const isActive = propIdx === activeIdx;
            const slideIdx = getSlideIdx(hotel.id);
            const slides = buildSlides(hotel);
            const currentSlide = slides[slideIdx] ?? slides[0];
            const kbNote = currentSlide ? getSlideKB(hotel, currentSlide, kbEntries) : null;
            const kbOpen = kbOpenId === String(hotel.id);
            const chatOpen = chatOpenId === String(hotel.id);

            const { resolved: res } = resolveHotelUpgrades(hotel, isActive ? stayPrefs : { rooms:0,basis:0,flexibility:0 });
            const upExtra = Object.values(res).reduce((s: number, v: any) => s + (v?.extra ?? 0), 0);
            const tileTotal = Math.round((hotel.netRate * cityNights + upExtra) * M_HOTELS);
            const saving = hotel.otaRate ? Math.round(hotel.otaRate * cityNights - tileTotal) : 0;

            const touch = { x: null as number | null };
            const onTouchStart = (e: React.TouchEvent) => { touch.x = e.touches[0].clientX; };
            const onTouchEnd   = (e: React.TouchEvent) => {
              if (touch.x === null) return;
              const delta = e.changedTouches[0].clientX - touch.x;
              if (Math.abs(delta) > 36) {
                if (delta < 0 && slideIdx < slides.length - 1) setSlideIdx(hotel.id, slideIdx + 1);
                if (delta > 0 && slideIdx > 0)                 setSlideIdx(hotel.id, slideIdx - 1);
              }
              touch.x = null;
            };

            return (
              <div key={hotel.id} data-card={propIdx} style={{ flexShrink:0, width:'min(84vw, 500px)', scrollSnapAlign:'center', borderRadius:14, overflow:'hidden', border:`1.5px solid ${isActive ? T.gold : 'rgba(255,255,255,0.08)'}`, background:T.surface, transition:'border-color 0.25s, opacity 0.2s', opacity: isActive ? 1 : 0.72, position:'relative' as const }}>

                {/* [V6-4] Selected badge — auto-selected when centred */}
                {isActive && (
                  <div style={{ position:'absolute', top:10, left:10, zIndex:15, background:T.gold, color:'#0a0a0a', fontSize:9, fontWeight:800, padding:'3px 10px', borderRadius:20, letterSpacing:'0.08em', textTransform:'uppercase' as const }}>
                    ✓ Selected
                  </div>
                )}

                <div style={{ position:'relative' as const, height:240, overflow:'hidden', cursor:'ew-resize', userSelect:'none' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                  {currentSlide && (
                    currentSlide.type === 'youtube'
  ? <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
      <iframe
        src={currentSlide.url}
        title={hotel.name}
        style={{ position:'absolute', top:'-10%', left:'-10%', width:'120%', height:'120%', border:'none', pointerEvents:'none' }}
        allow="autoplay; encrypted-media"
        allowFullScreen={false}
        loading="lazy"
      />
      <div style={{ position:'absolute', inset:0, zIndex:2, background:'transparent' }} />
    </div>
                    : currentSlide.type === 'reel' || currentSlide.type === 'video'
                      ? <video src={currentSlide.url} poster={currentSlide.poster} autoPlay muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <img src={currentSlide.url} alt={hotel.name} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'opacity 0.18s' }} />
                  )}
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.78) 0%,transparent 50%)' }} />

                  {slideIdx > 0 && (
                    <button onClick={e => { e.stopPropagation(); setSlideIdx(hotel.id, slideIdx - 1); setKbOpenId(null); }} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'rgba(30,30,30,0.72)', border:'1px solid rgba(255,255,255,0.18)', color:'rgba(255,255,255,0.85)', width:28, height:28, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:8, backdropFilter:'blur(4px)' }} aria-label="Previous image">‹</button>
                  )}
                  {slideIdx < slides.length - 1 && (
                    <button onClick={e => { e.stopPropagation(); setSlideIdx(hotel.id, slideIdx + 1); setKbOpenId(null); }} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'rgba(30,30,30,0.72)', border:'1px solid rgba(255,255,255,0.18)', color:'rgba(255,255,255,0.85)', width:28, height:28, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:8, backdropFilter:'blur(4px)' }} aria-label="Next image">›</button>
                  )}

                  {slides.length > 1 && (
                    <div style={{ position:'absolute', bottom:50, left:0, right:0, display:'flex', justifyContent:'center', gap:4, pointerEvents:'none' }}>
                      {slides.map((_,i) => (<div key={i} style={{ width:i===slideIdx?16:5, height:5, borderRadius:3, background:i===slideIdx?T.gold:'rgba(255,255,255,0.35)', transition:'all 0.2s' }} />))}
                    </div>
                  )}

                  {(currentSlide?.type==='reel'||currentSlide?.type==='video'||currentSlide?.type==='youtube') && (
                    <div style={{ position:'absolute', bottom:52, left:10, fontSize:9, color:'rgba(255,255,255,0.6)', background:'rgba(0,0,0,0.45)', borderRadius:4, padding:'2px 6px' }}>▶ Reel</div>
                  )}
                  {currentSlide?.roomType && currentSlide.roomType !== 'general' && (
                    <div style={{ position:'absolute', bottom:52, left:10, fontSize:9, color:'rgba(255,255,255,0.65)', background:'rgba(0,0,0,0.5)', borderRadius:4, padding:'2px 7px' }}>{currentSlide.roomType}</div>
                  )}

                  {kbNote && (
                    <button onClick={e => { e.stopPropagation(); setKbOpenId(kbOpen ? null : String(hotel.id)); setChatOpenId(null); }} title="Specialist KB note for this image" style={{ position:'absolute', top:10, right:48, zIndex:9, background:'transparent', border:'none', cursor:'pointer', padding:2 }}>
                      <div style={{ width:28, height:28, background:'linear-gradient(135deg,#c8a020,#f0c840)', transform:'rotate(45deg)', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(0,0,0,0.5)' }}>
                        <span style={{ transform:'rotate(-45deg)', fontSize:11, color:'#0a0a0a', fontWeight:900, lineHeight:1 }}>✦</span>
                      </div>
                    </button>
                  )}

                  <button onClick={e => { e.stopPropagation(); setChatOpenId(chatOpen ? null : String(hotel.id)); setKbOpenId(null); }} title="Ask about this image" style={{ position:'absolute', top:10, right:10, zIndex:9, width:28, height:28, borderRadius:'50%', background:'rgba(96,165,250,0.22)', border:'1.5px solid rgba(96,165,250,0.6)', color:'#93c5fd', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>?</button>

                  <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 14px 12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                      <div>
                        <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'#fff', lineHeight:1.2 }}>{hotel.name}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{hotel.destination} · ★ {hotel.trustScore}/100</div>
                      </div>
                      <div style={{ textAlign:'right' as const }}>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', background:'rgba(0,0,0,0.35)', borderRadius:6, padding:'3px 8px' }}>{cityNights} nights</div>
                      </div>
                    </div>
                  </div>

                  {kbOpen && kbNote && (
                    <div style={{ position:'absolute', top:44, right:8, left:8, background:'rgba(8,8,8,0.97)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'12px 14px', zIndex:18, backdropFilter:'blur(16px)' }}>
                      <div style={{ fontSize:10, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:6 }}>✦ Specialist note</div>
                      <div style={{ fontSize:12, color:'rgba(240,237,230,0.8)', lineHeight:1.65 }}>{kbNote}</div>
                      <button onClick={() => setKbOpenId(null)} style={{ marginTop:8, fontSize:10, color:T.textDim, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Close ×</button>
                    </div>
                  )}

                  {chatOpen && currentSlide && (
                    <ImageMiniChat hotel={hotel} slide={currentSlide} edition={edition} onEscalate={ctx => { setChatOpenId(null); onEscalateChat(ctx); }} onClose={() => setChatOpenId(null)} />
                  )}
                </div>

                <div style={{ padding:'12px 14px 14px' }}>
                  {hotel.funFact && (<div className="fun-fact" style={{ marginBottom:8 }}>✦ {hotel.funFact}</div>)}
                  {/* Inclusions strip — pulled from rate_includes */}
                  {isActive && hotel.rate_includes?.length > 0 && (
                    <InclusionPills includes={hotel.rate_includes ?? []} malariaFree={hotel.malariaFree} compact />
                  )}


                  {/* [V6-5] SINGLE BUTTON — Customise. Select button removed (auto-selected on swipe). */}
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <button onClick={() => setUpgradeOpenId(String(hotel.id))} style={{ flex:1, padding:'12px 0', borderRadius:9, border:`1.5px solid ${T.borderGold}`, background:T.goldDim, color:T.gold, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700, letterSpacing:'0.03em' }}>
                      Customise ✦
                    </button>
                    {onExploreLodge && (
                      <button onClick={() => onExploreLodge(hotel, hotel.supplier_id ?? String(hotel.id), hotel.rate_includes ?? [])} style={{ padding:'12px 14px', borderRadius:9, border:`0.5px solid ${T.border}`, background:'rgba(255,255,255,0.04)', color:T.textMid, cursor:'pointer', fontFamily:'inherit', fontSize:12, letterSpacing:'0.02em', whiteSpace:'nowrap' as const }}>
                        Explore →
                      </button>
                    )}
                  </div>
                </div>

                {upgradeOpenId === String(hotel.id) && (
                  <UpgradeSheet
                    hotel={hotel}
                    stayPrefs={isActive ? stayPrefs : { rooms:0, basis:0, flexibility:0 }}
                    kbEntries={kbEntries}
                    fmt={fmt}
                    onSelect={(key, opt) => { onSelectHotel(hotel); onUpgradeSelect(key, opt); }}
                    onClose={() => setUpgradeOpenId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>

        <style>{`[data-strip] > div::-webkit-scrollbar { display:none }`}</style>
      </div>

      {hotels.length > 1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>
          {hotels.map((_,i) => (
            <div key={i} onClick={() => scrollToIdx(i)} style={{ width:i===activeIdx?20:7, height:7, borderRadius:4, background:i===activeIdx?T.gold:'rgba(255,255,255,0.2)', cursor:'pointer', transition:'all 0.2s' }} />
          ))}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, padding:'10px 14px', background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:10 }}>
        <div>
          <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600 }}>Nights in {destinationLabel}</div>
          <div style={{ fontSize:11, color:T.textDim, marginTop:1 }}>Adjusts lodge cost for this destination</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => onNightsChange(-1)} disabled={cityNights<=1} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:28, height:28, borderRadius:7, cursor:cityNights<=1?'not-allowed':'pointer', fontSize:16, fontFamily:'inherit', opacity:cityNights<=1?0.35:1 }}>−</button>
          <span style={{ fontSize:16, fontWeight:700, color:T.text, minWidth:30, textAlign:'center' as const }}>{cityNights}</span>
          <button onClick={() => onNightsChange(1)} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:28, height:28, borderRadius:7, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>+</button>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// DATE SELECTOR
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS_AHEAD = Array.from({ length: 18 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() + i + 1);
  return { value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleDateString('en-GB', { month:'long', year:'numeric' }) };
});

function DateSelector({ checkinDate, setCheckinDate, dateMode, setDateMode, flexMonth, setFlexMonth, windowStart, setWindowStart, windowEnd, setWindowEnd, nights }: {
  checkinDate:string; setCheckinDate:(v:string)=>void;
  dateMode:'specific'|'month'|'window'|'flexible'; setDateMode:(v:'specific'|'month'|'window'|'flexible')=>void;
  flexMonth:string; setFlexMonth:(v:string)=>void;
  windowStart:string; setWindowStart:(v:string)=>void;
  windowEnd:string; setWindowEnd:(v:string)=>void;
  nights:number;
}) {
  const isSet = !!(checkinDate || flexMonth || (windowStart && windowEnd) || dateMode==='flexible');
  const modeLabel: Record<string, string> = { specific:'Specific date', month:'Month', window:'Date window', flexible:"I'm flexible" };
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:600, color:T.text }}>Travel dates</div>
        <div style={{ fontSize:11, color:isSet?T.green:T.amber, fontWeight:600 }}>{isSet?'✓ Set':'Required before payment'}</div>
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {(['specific','month','window','flexible'] as const).map(mode => (
          <button key={mode} onClick={() => setDateMode(mode)} style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${dateMode===mode?T.gold:T.border}`, background:dateMode===mode?T.goldDim:'transparent', color:dateMode===mode?T.gold:T.textMid, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:dateMode===mode?600:400 }}>
            {modeLabel[mode]}
          </button>
        ))}
      </div>
      {dateMode==='specific' && (
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <input type="date" value={checkinDate} onChange={e=>setCheckinDate(e.target.value)} style={{ background:T.bg3, border:`1.5px solid ${checkinDate?T.borderGold:T.border}`, color:T.text, borderRadius:9, padding:'8px 12px', fontSize:13, outline:'none', fontFamily:'inherit', flexShrink:0 }} />
          {checkinDate && nights > 0 && (
            <div style={{ fontSize:11, color:T.textDim }}>Check-out: {new Date(new Date(checkinDate).getTime() + nights*86400000).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
          )}
        </div>
      )}
      {dateMode==='month' && (
        <select value={flexMonth} onChange={e=>setFlexMonth(e.target.value)} style={{ width:'100%', background:T.bg3, border:`1.5px solid ${flexMonth?T.borderGold:T.border}`, color:flexMonth?T.text:T.textDim, borderRadius:9, padding:'9px 12px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
          <option value="">Select a month…</option>
          {MONTHS_AHEAD.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      )}
      {dateMode==='window' && (
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <div><div style={{ fontSize:10, color:T.textDim, marginBottom:4, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Earliest</div><input type="date" value={windowStart} onChange={e=>setWindowStart(e.target.value)} style={{ background:T.bg3, border:`1.5px solid ${windowStart?T.borderGold:T.border}`, color:T.text, borderRadius:9, padding:'7px 11px', fontSize:12, outline:'none', fontFamily:'inherit' }} /></div>
          <div style={{ fontSize:14, color:T.textDim, paddingTop:18 }}>→</div>
          <div><div style={{ fontSize:10, color:T.textDim, marginBottom:4, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Latest</div><input type="date" value={windowEnd} min={windowStart} onChange={e=>setWindowEnd(e.target.value)} style={{ background:T.bg3, border:`1.5px solid ${windowEnd?T.borderGold:T.border}`, color:T.text, borderRadius:9, padding:'7px 11px', fontSize:12, outline:'none', fontFamily:'inherit' }} /></div>
          {windowStart && windowEnd && <div style={{ fontSize:11, color:T.green, paddingTop:18 }}>✓ Window set</div>}
        </div>
      )}
      {dateMode==='flexible' && (
        <div style={{ background:'rgba(212,175,55,0.06)', border:`0.5px solid ${T.borderGold}`, borderRadius:10, padding:'12px 14px' }}>
          <div style={{ fontSize:13, color:T.text, fontWeight:600, marginBottom:4 }}>We'll find the best available dates for you</div>
          <div style={{ fontSize:12, color:T.textDim, lineHeight:1.6 }}>Your Journey Specialist will check live availability across your preferred travel window and recommend the best-value dates — including any savings from shifting ±14 days.</div>
          <div style={{ marginTop:8, fontSize:11, color:T.gold }}>✦ Flexible dates often unlock 10–20% savings on lodge rates.</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFER CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────
type TransferOption = { id:string; mode:'road'|'commercial'|'charter'|'combo'|'boat'; icon:string; label:string; provider:string; duration:string; estimatedCostZAR:number; badges:Array<{text:string;color:string}>; aiNote:string; recommended:boolean; };

// [Transfers v2] Build options from the property-aware transfers module.
//   Each option = COMMERCIAL leg (Duffel fare if supplied, else estimated fallback)
//   + LAST-MILE (FedAir/MackAir/road/charter from transfers.ts), summed via priceTransfer.
// destLodge = the booked lodge at the DESTINATION city (resolves the airport).
// commercialFareZarByAirport = optional live Duffel fares keyed by target airport.
// pax = passenger count (per-person fares scale; charters are flat).
// [Transfers v3] THREE-PART CHAIN model:
//   EXIT (origin lodge -> origin hub)  +  COMMERCIAL (origin hub -> dest hub)  +  ARRIVAL (dest hub -> dest lodge)
// commercialFareZarByAirport / Meta are keyed by ROUTE "ORIGINHUB-DESTHUB" (e.g. "MUB-JNB").
function buildTransferOptions(
  fromSlug: string,
  toSlug: string,
  destLodge?: string,
  pax: number = 2,
  usdToZar: number = 18.62,
  commercialFareZarByRoute?: Record<string, number>,
  commercialMetaByRoute?: Record<string, any>,
  originLodge?: string,
): TransferOption[] {
  // Cape Town is the arrival city — its airport transfer is handled by CityTransferStrip, not here.
  if (toSlug === 'cape-town') return [];

  const arrivalLastMiles = lastMileFor(destLodge ?? '', toSlug);
  if (!arrivalLastMiles.length) {
    const leg = getInternalLeg(fromSlug, toSlug);
    if (!leg) return [];
    return [{ id:'recommended', mode:leg.mode==='charter'?'charter':leg.mode==='road'?'road':'commercial',
      icon: leg.mode==='charter'?'✈':leg.mode==='road'?'🚗':'🛫',
      label: leg.mode==='charter'?'Private Charter':leg.mode==='road'?'Road Transfer':'Commercial Flight',
      provider: leg.provider, duration: leg.duration, estimatedCostZAR: leg.estimatedCostZAR,
      badges:[{text:'✦ Recommended',color:T.gold}], aiNote: leg.aiNote, recommended:true }];
  }

  const iconFor = (m: string) => m==='charter'?'✈':m==='road'?'🚗':m==='mackair'||m==='wilderness'||m==='fedair'?'🛩':'🛫';
  const fmtT = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); } catch { return ''; } };
  const durStr = (min?: number) => min ? `${Math.floor(min/60)}h${min%60?` ${min%60}m`:''}` : null;

  // EXIT leg: origin lodge -> origin hub. Cape Town origin = none (fly direct from CPT).
  const exitOptions = exitLastMileFor(originLodge ?? '', fromSlug);
  const exitRec = exitOptions.find(l => l.recommended) ?? exitOptions[0] ?? null;
  const originHub = originHubAirport(originLodge ?? '', fromSlug);

  // One transfer OPTION per arrival last-mile (e.g. FedAir vs charter into Madikwe).
  return arrivalLastMiles.map((arr, i) => {
    const destHub = arr.fromAirport;                 // commercial flight LANDS here
    const routeKey = `${originHub}-${destHub}`;       // e.g. "MUB-JNB"

    // COMMERCIAL hub->hub fare (per person). Live Duffel by route, else fallback by dest hub.
    const liveFare = commercialFareZarByRoute?.[routeKey];
    const fallback = COMMERCIAL_FALLBACK_ZAR[destHub] ?? 4000;
    const needCommercial = originHub !== destHub;     // same hub => no commercial leg
    const commercialPerPax = needCommercial ? (liveFare ?? fallback) : 0;
    const isEstimate = needCommercial && liveFare == null;

    // EXIT leg cost (origin lodge -> origin hub), per the recommended exit option.
    const exitZar = exitRec ? lastMileZar(exitRec, usdToZar, pax) : 0;
    // ARRIVAL leg cost (dest hub -> dest lodge).
    const arrivalZar = lastMileZar(arr, usdToZar, pax);
    // COMMERCIAL cost in ZAR for all pax.
    const commercialZar = Math.round(commercialPerPax * pax);

    const totalZar = exitZar + commercialZar + arrivalZar;

    // Commercial flight descriptor from meta.
    const meta = commercialMetaByRoute?.[routeKey];
    const airline = meta?.carrier ? String(meta.carrier).replace(/ Airways$/,'') : null;
    const depT = fmtT(meta?.departing_at), arrT = fmtT(meta?.arriving_at);
    const stops = meta?.stops, durH = durStr(meta?.duration_min);
    const flightBits = [airline, (depT&&arrT)?`${depT}→${arrT}`:null,
      (typeof stops==='number')?(stops===0?'direct':`${stops} stop${stops>1?'s':''}`):null, durH].filter(Boolean);
    const commercialLine = needCommercial ? (flightBits.length ? flightBits.join(' · ') : `${originHub}→${destHub}`) : null;

    // Build the full chain descriptor: "MackAir lodge→MUB  ·  Airlink MUB→JNB  ·  FedAir JNB→Madikwe"
    const chainBits = [
      exitRec ? `${exitRec.label}` : null,
      commercialLine,
      arr.label,
    ].filter(Boolean);
    const chainLine = chainBits.join('  →  ');

    const badges: Array<{text:string;color:string}> = [];
    if (arr.recommended) badges.push({ text:'✦ Recommended', color:T.gold });
    if (arr.perCharter)  badges.push({ text:'Private charter', color:'#a78bfa' });
    if (isEstimate)      badges.push({ text:'Est. — confirmed by specialist', color:T.textDim });

    const totalMin = (exitRec?.durationMin ?? 0) + (meta?.duration_min ?? 0) + arr.durationMin;

    return {
      id: arr.recommended ? 'recommended' : `${arr.mode}-${i}`,
      mode: (arr.mode==='charter'?'charter':arr.mode==='road'?'road':'commercial') as TransferOption['mode'],
      icon: iconFor(arr.mode),
      label: arr.label,
      provider: chainLine,
      duration: totalMin ? `~${durStr(totalMin)} total door-to-door` : `${arr.durationMin} min final leg`,
      estimatedCostZAR: totalZar,
      badges,
      aiNote: `${commercialLine ? `Commercial leg: ${commercialLine}. ` : ''}${arr.note ?? ''}${isEstimate ? ' Commercial fare estimated until dates confirmed.' : ''}`.trim(),
      recommended: !!arr.recommended,
    };
  });
}


// ── AIRLINE METADATA for logo badges ─────────────────────────────────────────
const AIRLINE_META: Record<string,{name:string;code:string;color:string}> = {
  'FA':    {name:'Federal Air', code:'FA', color:'#1a3a6e'},
  'FedAir':{name:'Federal Air', code:'FA', color:'#1a3a6e'},
  '4Z':    {name:'Airlink',     code:'4Z', color:'#d4341a'},
  'Airlink':{name:'Airlink',   code:'4Z', color:'#d4341a'},
  'FA203': {name:'Federal Air', code:'FA', color:'#1a3a6e'},
  'TC':    {name:'Fastjet',     code:'TC', color:'#f97316'},
  'Fastjet':{name:'Fastjet',   code:'TC', color:'#f97316'},
  'WA':    {name:'Wilderness Air', code:'WA', color:'#2d6a4f'},
  'MA':    {name:'Mack Air',   code:'MA', color:'#5e3a1a'},
};

function AirlineBadge({ code, size=28 }: { code:string; size?:number }) {
  const meta = AIRLINE_META[code] ?? {name:code, code:code.slice(0,2).toUpperCase(), color:'#1a1a2e'};
  return (
    <div style={{
      width:size, height:size, borderRadius:6,
      background:meta.color,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size<30?9:10, fontWeight:700, color:'#fff', letterSpacing:'0.04em',
      flexShrink:0, border:'0.5px solid rgba(255,255,255,0.15)',
    }}>{meta.code}</div>
  );
}

// ── Build rich structured legs from a transfer option ───────────────────────
interface TransferLeg {
  type:    'road'|'airline'|'charter'|'lodge'|'info';
  badge:   string;   // airline code or emoji
  primary: string;   // e.g. "Federal Air  FA203"
  route?:  string;   // e.g. "JNB 13:00  →  SZK 14:30"
  detail?: string;   // e.g. "1h 30m · direct · Economy"
  note?:   string;   // e.g. "FedAir terminal, Atlas Rd · OR Tambo"
  noteColor?: string;
}

function buildTransferLegs(opt: any, meta?: any): TransferLeg[] {
  const legs: TransferLeg[] = [];
  const provider = opt.provider ?? '';
  const aiNote   = opt.aiNote ?? '';

  // ── Decode the three-part chain: EXIT → COMMERCIAL → ARRIVAL ─────────────
  const parts = provider.split(/\s{1,4}→\s{1,4}|\s*->\s*/);

  // Detect commercial meta (Duffel live data)
  const hasLive = meta && (meta.carrier || meta.departing_at);
  const carrier   = meta?.carrier  ?? '';
  const depTime   = meta?.departing_at  ? new Date(meta.departing_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
  const arrTime   = meta?.arriving_at   ? new Date(meta.arriving_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
  const stops     = typeof meta?.stops === 'number' ? (meta.stops===0?'direct':`${meta.stops} stop${meta.stops>1?'s':''}`) : '';
  const durMin    = meta?.duration_min;
  const durStr    = durMin ? `${Math.floor(durMin/60)}h${durMin%60?` ${durMin%60}m`:''}` : '';

  for (let i=0; i<parts.length; i++) {
    const p = parts[i].trim();
    if (!p) continue;

    const isFedAir     = /FedAir|Federal Air/i.test(p);
    const isAirlink    = /Airlink/i.test(p);
    const isFastjet    = /Fastjet/i.test(p);
    const isCharter    = /Mack Air|Wilderness Air|charter|wilderness/i.test(p);
    const isRoad       = /Road|private.?transfer|vehicle|drive/i.test(p);
    const isPrivate    = /Private transfer/i.test(p);

    if (isPrivate || (isRoad && !isFedAir)) {
      // Road/private transfer leg
      const route = p.match(/([A-Z]{3})\s*→\s*([A-Z]{3})/)?.[0] ?? '';
      legs.push({
        type:'road', badge:'🚗',
        primary: p.replace(/\s*[A-Z]{3}\s*→\s*[A-Z]{3}\s*/g,'').trim() || 'Private transfer',
        route: route || undefined,
        detail: opt.duration && i===0 ? opt.duration : undefined,
        note: 'Driver meets at arrivals · luggage assistance included',
        noteColor: T.green,
      });
    } else if (isFedAir) {
      // Federal Air scheduled leg — include specific schedule info
      const routeMatch = p.match(/([A-Z]{3})\s*→?\s*([A-Z]{3})/);
      const from = routeMatch?.[1] ?? 'JNB';
      const to   = routeMatch?.[2] ?? 'SZK';
      legs.push({
        type:'airline', badge:'FA',
        primary: 'Federal Air',
        route: `${from} → ${to}`,
        detail: '10:00 & 13:00 daily · 55–65 min · 20kg soft bag',
        note: 'FedAir terminal, Atlas Rd · OR Tambo domestic · arrives lodge airstrip',
        noteColor: T.blue,
      });
    } else if (isAirlink || isFastjet || (hasLive && i===1)) {
      // Commercial scheduled airline — use Duffel meta if available
      const airlineName = hasLive && carrier ? (AIRLINE_META[carrier]?.name ?? carrier) : (isAirlink?'Airlink':isFastjet?'Fastjet':'Scheduled airline');
      const airlineCode = hasLive && carrier ? carrier : (isAirlink?'4Z':isFastjet?'TC':'?');
      const routeMatch = p.match(/([A-Z]{3})\s*→?\s*([A-Z]{3})/);
      const from = routeMatch?.[1] ?? '';
      const to   = routeMatch?.[2] ?? '';
      legs.push({
        type:'airline', badge: airlineCode,
        primary: airlineName + (hasLive && meta.flight_no ? `  ${meta.flight_no}` : ''),
        route: hasLive && depTime && arrTime
          ? `${from||'?'} ${depTime}  →  ${to||'?'} ${arrTime}`
          : (from && to ? `${from} → ${to}` : p),
        detail: hasLive
          ? [stops, durStr].filter(Boolean).join(' · ') + ' · Economy'
          : (durStr ? `${durStr} · Economy` : undefined),
        note: hasLive ? undefined : 'Est. fare — confirmed by specialist',
        noteColor: T.textDim,
      });
    } else if (isCharter) {
      const routeMatch = p.match(/([A-Z]{3})\s*→?\s*([A-Z]{3})/);
      const from = routeMatch?.[1] ?? 'MUB';
      const to   = routeMatch?.[2] ?? '';
      const charterName = /Mack Air/i.test(p)?'Mack Air':/Wilderness Air/i.test(p)?'Wilderness Air':'Light aircraft';
      legs.push({
        type:'charter', badge: charterName==='Mack Air'?'MA':'WA',
        primary: charterName,
        route: from && to ? `${from} → ${to}` : undefined,
        detail: '20kg soft bag · no hard cases · private airstrip',
        note: 'Part of the experience — arrives at camp airstrip',
        noteColor: T.green,
      });
    } else if (/lodge|camp|collection|airstrip/i.test(p)) {
      legs.push({
        type:'lodge', badge:'🏠',
        primary: 'Lodge collection',
        detail: 'Camp vehicle meets on airstrip',
        note: 'Complimentary · 5–20 min to main lodge',
        noteColor: T.green,
      });
    } else {
      // Airport / waypoint — abbreviated
      const clean = p.replace(/\s*(CPT|JNB|SZK|MUB|VFA|HDS|MQP|BBK|LVI)\s*/g, m=>m.trim()+' ').trim();
      if (clean.length > 2) {
        legs.push({ type:'info', badge:'⊕', primary: clean });
      }
    }
  }

  // If nothing parsed → fallback single card
  if (!legs.length) {
    legs.push({
      type:'airline', badge:'✈',
      primary: opt.label || (parts[0]?.trim() ?? 'Transfer'),
      route: opt.provider,
      detail: opt.duration,
      note: opt.aiNote,
    });
  }

  // Baggage note for any charter leg
  const hasCharter = legs.some(l=>l.type==='charter');
  if (hasCharter) {
    legs.push({
      type:'info', badge:'⚑',
      primary: '20kg soft-bag limit',
      detail: 'No hard-sided cases — strictly enforced on all light aircraft',
      noteColor: T.amber,
    });
  }

  return legs;
}

// ── The JourneyCard component ────────────────────────────────────────────────
function TransferCarousel({
  fromSlug, toSlug, fromLabel, toLabel,
  fmt, kbEntries, selectedTransferId, onSelect,
  destLodge, pax, usdToZar, commercialFares, commercialMeta, originLodge
}: {
  fromSlug:string; toSlug:string; fromLabel:string; toLabel:string;
  fmt:(n:number)=>string; kbEntries:KBEntry[]; selectedTransferId:string|null;
  onSelect:(id:string)=>void; destLodge?:string; pax?:number; usdToZar?:number;
  commercialFares?:Record<string,number>; commercialMeta?:Record<string,any>; originLodge?:string;
}) {
  const options = useMemo(()=>buildTransferOptions(fromSlug,toSlug,destLodge,pax??2,usdToZar??18.62,commercialFares,commercialMeta,originLodge),[fromSlug,toSlug,destLodge,pax,usdToZar,commercialFares,commercialMeta,originLodge]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    const t = setTimeout(()=>{
      setReady(true);
      const rec = options.find(o=>o.recommended);
      if (rec && !selectedTransferId) onSelect(rec.id);
    }, 500);
    return ()=>clearTimeout(t);
  },[]);

  // Fallback when no options built — use INTERNAL_LEGS
  if (!options.length) {
    const leg = getInternalLeg(fromSlug, toSlug);
    if (!leg) return null;
    const fallbackLegs = buildTransferLegs(
      {label:leg.fromLabel+' → '+leg.toLabel, provider:leg.provider, aiNote:leg.aiNote, duration:leg.duration, badges:[], recommended:true},
      undefined
    );
    return (
      <div style={{ marginBottom:24 }}>
        <TransferHeader fromLabel={fromLabel} toLabel={toLabel}/>
        <JourneyCardBody legs={fallbackLegs} duration={leg.duration} aiNote={leg.aiNote}
          badges={[]} optionCount={1} activeIdx={0} onPrev={()=>{}} onNext={()=>{}}
          isSelected fmt={fmt} cost={leg.estimatedCostZAR} />
      </div>
    );
  }

  const cur = options[activeIdx] ?? options[0];
  // Get commercial meta for this option (keyed by route e.g. "CPT-JNB")
  const routeKey = Object.keys(commercialMeta??{}).find(k => cur.provider?.includes(k.split('-')[0]) && cur.provider?.includes(k.split('-')[1]));
  const liveMeta = routeKey ? (commercialMeta??{})[routeKey] : undefined;
  const legs = buildTransferLegs(cur, liveMeta);

  return (
    <div style={{ marginBottom:24 }}>
      <TransferHeader fromLabel={fromLabel} toLabel={toLabel}/>
      {!ready ? (
        <div style={{ background:'rgba(96,165,250,0.04)', border:'0.5px solid rgba(96,165,250,0.12)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <div className="spinner" style={{width:14,height:14,borderWidth:2}}/>
          <div style={{fontSize:12,color:'rgba(96,165,250,0.6)'}}>Checking transfer options…</div>
        </div>
      ) : (
        <JourneyCardBody
          legs={legs} duration={cur.duration} aiNote={cur.aiNote}
          badges={cur.badges} optionCount={options.length} activeIdx={activeIdx}
          onPrev={()=>setActiveIdx(i=>Math.max(0,i-1))}
          onNext={()=>setActiveIdx(i=>Math.min(options.length-1,i+1))}
          isSelected={selectedTransferId===cur.id || (!selectedTransferId && cur.recommended)}
          onSelect={()=>onSelect(cur.id)}
          fmt={fmt} cost={cur.estimatedCostZAR}
        />
      )}
    </div>
  );
}

// ── Shared header ─────────────────────────────────────────────────────────────
function TransferHeader({ fromLabel, toLabel }: { fromLabel:string; toLabel:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
      <div style={{ flex:1, height:'0.5px', background:'rgba(96,165,250,0.15)' }}/>
      <div style={{ fontSize:10, color:'rgba(96,165,250,0.7)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const }}>
        ✈ {fromLabel} → {toLabel}
      </div>
      <div style={{ flex:1, height:'0.5px', background:'rgba(96,165,250,0.15)' }}/>
    </div>
  );
}

// ── JourneyCard body ──────────────────────────────────────────────────────────
function JourneyCardBody({ legs, duration, aiNote, badges, optionCount, activeIdx, onPrev, onNext, isSelected, onSelect, fmt, cost }: {
  legs:TransferLeg[]; duration:string; aiNote:string;
  badges:Array<{text:string;color:string}>; optionCount:number; activeIdx:number;
  onPrev:()=>void; onNext:()=>void; isSelected:boolean; onSelect?:()=>void;
  fmt:(n:number)=>string; cost:number;
}) {
  const durDisplay = duration.replace(/~|total\s*door-to-door|door-to-door/gi,'').trim();
  const isRec = badges.some(b=>b.text.includes('Recommended'));

  return (
    <div style={{ background:'rgba(10,12,18,0.90)', border:`0.5px solid ${isSelected?'rgba(96,165,250,0.35)':'rgba(96,165,250,0.12)'}`, borderRadius:12, overflow:'hidden', transition:'border-color 0.2s' }}>
      {/* Card top bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 16px 9px', borderBottom:'0.5px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display:'flex', flexDirection:'column' as const }}>
          <span style={{ fontSize:13, fontWeight:600, color:T.text, fontFamily:"'Jost',sans-serif" }}>Getting there</span>
          <span style={{ fontSize:10, color:T.textDim }}>door to lodge</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* Duration */}
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.07)', borderRadius:20, padding:'4px 10px' }}>
            <span style={{ fontSize:9 }}>⏱</span>
            <span style={{ fontSize:11, fontWeight:600, color:T.text }}>{durDisplay}</span>
          </div>
          {/* Pagination */}
          {optionCount > 1 && (
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <button onClick={onPrev} disabled={activeIdx===0} style={{ background:'rgba(255,255,255,0.07)', border:'none', color:activeIdx===0?'rgba(255,255,255,0.2)':T.text, width:22, height:22, borderRadius:'50%', cursor:activeIdx===0?'default':'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>‹</button>
              <span style={{ fontSize:10, color:T.textDim, minWidth:28, textAlign:'center' as const }}>{activeIdx+1}/{optionCount}</span>
              <button onClick={onNext} disabled={activeIdx===optionCount-1} style={{ background:'rgba(255,255,255,0.07)', border:'none', color:activeIdx===optionCount-1?'rgba(255,255,255,0.2)':T.text, width:22, height:22, borderRadius:'50%', cursor:activeIdx===optionCount-1?'default':'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>›</button>
            </div>
          )}
        </div>
      </div>

      {/* Badges */}
      {(isRec || badges.length>0) && (
        <div style={{ display:'flex', gap:6, padding:'8px 16px 6px', flexWrap:'wrap' as const }}>
          {isRec && <span style={{ fontSize:9, fontWeight:700, color:T.green, background:'rgba(74,222,128,0.1)', border:'0.5px solid rgba(74,222,128,0.25)', borderRadius:20, padding:'2px 9px' }}>Recommended</span>}
          {badges.filter(b=>!b.text.includes('Recommended')).map((b,i)=>(
            <span key={i} style={{ fontSize:9, fontWeight:600, color:b.color, background:`${b.color}15`, border:`0.5px solid ${b.color}30`, borderRadius:20, padding:'2px 9px' }}>{b.text}</span>
          ))}
        </div>
      )}

      {/* Leg rows */}
      <div style={{ padding:'8px 16px 6px' }}>
        {legs.map((leg, i) => (
          <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom: i<legs.length-1 ? 10 : 6 }}>
            {/* Badge */}
            {leg.type === 'airline' || leg.type === 'charter'
              ? <AirlineBadge code={leg.badge} size={32}/>
              : leg.type === 'info'
              ? <div style={{ width:32, height:32, borderRadius:6, background:'rgba(251,191,36,0.08)', border:'0.5px solid rgba(251,191,36,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{leg.badge}</div>
              : <div style={{ width:32, height:32, borderRadius:6, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{leg.badge}</div>
            }
            <div style={{ flex:1, minWidth:0, paddingTop:2 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                <span style={{ fontSize:12, fontWeight:600, color:T.text, lineHeight:1.25 }}>{leg.primary}</span>
                {leg.route && <span style={{ fontSize:11, fontWeight:600, color:leg.type==='airline'?'rgba(96,165,250,0.9)':T.text, flexShrink:0, letterSpacing:'0.01em' }}>{leg.route}</span>}
              </div>
              {leg.detail && <div style={{ fontSize:10, color:T.textMid, marginTop:2, lineHeight:1.5 }}>{leg.detail}</div>}
              {leg.note && <div style={{ fontSize:10, color:leg.noteColor??T.textDim, marginTop:3, lineHeight:1.5 }}>{leg.note}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Cost + select row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px 12px', borderTop:'0.5px solid rgba(255,255,255,0.04)', marginTop:4 }}>
        <div style={{ fontSize:11, color:T.textDim }}>
          {cost > 0 ? `${fmt(cost)} est. · subject to confirmation` : 'Cost confirmed by specialist'}
        </div>
        {onSelect && optionCount > 1 && (
          <button onClick={onSelect} style={{ fontSize:11, fontWeight:600, color:isSelected?'rgba(96,165,250,0.9)':T.textMid, background:isSelected?'rgba(96,165,250,0.1)':'transparent', border:`0.5px solid ${isSelected?'rgba(96,165,250,0.3)':T.border}`, borderRadius:7, padding:'5px 12px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s' }}>
            {isSelected ? '✓ Selected' : 'Select this'}
          </button>
        )}
        {isSelected && optionCount===1 && (
          <span style={{ fontSize:10, color:'rgba(96,165,250,0.65)', fontWeight:600 }}>✓ Selected</span>
        )}
      </div>
    </div>
  );
}


function CityTransferStrip({ slug, destLabel, opts, selectedId, onSelect, fmt }: { slug:string; destLabel:string; opts:CityTransferOption[]; selectedId:string|undefined; onSelect:(id:string)=>void; fmt:(n:number)=>string; }) {
  const [idx, setIdx] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollTo = (i: number) => {
    const strip = stripRef.current; if (!strip) return;
    const cards = strip.querySelectorAll<HTMLElement>('[data-city-card]');
    cards[i]?.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
    setIdx(i);
  };
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'0 2px' }}>
        <div style={{ flex:1, height:1, background:'rgba(74,222,128,0.15)' }} />
        <div style={{ fontSize:11, color:T.green, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const }}>🚗 Airport transfer — {destLabel}</div>
        <div style={{ flex:1, height:1, background:'rgba(74,222,128,0.15)' }} />
      </div>
      <div style={{ position:'relative', margin:'0 -4px' }}>
        {idx > 0 && (<button onClick={() => scrollTo(idx-1)} style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', zIndex:10, background:'rgba(10,10,10,0.92)', border:'1px solid rgba(74,222,128,0.4)', color:T.green, width:30, height:50, borderRadius:'0 10px 10px 0', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'3px 0 12px rgba(0,0,0,0.5)' }}>‹</button>)}
        {idx < opts.length-1 && (<button onClick={() => scrollTo(idx+1)} style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', zIndex:10, background:'rgba(10,10,10,0.92)', border:'1px solid rgba(74,222,128,0.4)', color:T.green, width:30, height:50, borderRadius:'10px 0 0 10px', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'-3px 0 12px rgba(0,0,0,0.5)' }}>›</button>)}
        <div ref={stripRef} style={{ display:'flex', gap:10, overflowX:'auto', scrollSnapType:'x mandatory' as any, WebkitOverflowScrolling:'touch' as any, scrollbarWidth:'none' as any, paddingLeft:20, paddingRight:20, paddingBottom:2 }}>
          {opts.map((opt, i) => {
            const isSel = selectedId ? selectedId === opt.id : opt.recommended;
            return (
              <div key={opt.id} data-city-card={i} onClick={() => { onSelect(opt.id); scrollTo(i); }} style={{ flexShrink:0, width:'min(75vw,320px)', scrollSnapAlign:'center', borderRadius:12, border:`1.5px solid ${isSel?T.green:T.border}`, background:isSel?'rgba(74,222,128,0.07)':T.surface, cursor:'pointer', padding:'14px 16px', transition:'border-color 0.2s', opacity:i===idx?1:0.75 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:20 }}>{opt.icon}</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:isSel?T.green:T.text }}>{opt.label}</div>
                      <div style={{ fontSize:11, color:T.textDim, marginTop:1 }}>{opt.provider}</div>
                    </div>
                  </div>
                  {isSel && <div style={{ fontSize:10, color:T.green, background:'rgba(74,222,128,0.12)', border:'0.5px solid rgba(74,222,128,0.3)', borderRadius:20, padding:'2px 8px', fontWeight:700 }}>Selected</div>}
                </div>
                {opt.recommended && <div style={{ fontSize:10, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:20, padding:'2px 8px', fontWeight:700, display:'inline-block', marginBottom:8 }}>✦ Recommended</div>}
                <div style={{ marginBottom:6 }}>
                  <div style={{ fontSize:12, color:T.textMid }}>{opt.duration}</div>
                </div>
                <div style={{ fontSize:11, color:T.textDim, lineHeight:1.5, background:'rgba(74,222,128,0.04)', borderRadius:7, padding:'7px 10px' }}>{opt.note}</div>
              </div>
            );
          })}
        </div>
        {opts.length > 1 && (<div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:8 }}>{opts.map((_,i) => <div key={i} onClick={() => scrollTo(i)} style={{ width:i===idx?14:5, height:5, borderRadius:3, background:i===idx?T.green:'rgba(255,255,255,0.2)', cursor:'pointer', transition:'all 0.2s' }} />)}</div>)}
      </div>
    </div>
  );
}


function DepartureCard({ lastCity, lastSlug, includeIntlFlight, fmt, kbEntries, departureHubId, setDepartureHubId, showDepartureXfer, setShowDepartureXfer, flightSelected, departureGateway }: { lastCity:any; lastSlug:string; includeIntlFlight:boolean; fmt:(n:number)=>string; kbEntries:KBEntry[]; departureHubId:string; setDepartureHubId:(v:string)=>void; showDepartureXfer:boolean; setShowDepartureXfer:(v:boolean)=>void; flightSelected?:boolean; departureGateway?:string; }) {
  // Readable airport names for the known departure gateways.
  const GATEWAY_LABEL: Record<string,string> = {
    JNB:'O.R. Tambo International (JNB)', CPT:'Cape Town International (CPT)',
    VFA:'Victoria Falls (VFA)', LVI:'Livingstone (LVI)', MUB:'Maun (MUB)',
    HDS:'Hoedspruit (HDS)', MQP:'Kruger Mpumalanga (MQP)', SZK:'Skukuza (SZK)', BBK:'Kasane (BBK)',
  };
  // We "know" the departure point only once a flight is actually selected.
  const knownGateway = flightSelected && departureGateway ? (GATEWAY_LABEL[departureGateway] ?? departureGateway) : null;
  const hubs: {code:string; label:string; airport:string; note:string}[] = lastSlug === 'cape-town'
    ? [{ code:'CPT', label:'Cape Town', airport:'Cape Town International (CPT)', note:'Direct international departures to London, Amsterdam, Frankfurt, New York and more.' }]
    : lastSlug === 'chobe-vic-falls'
    ? [{ code:'VFA', label:'Victoria Falls', airport:'Victoria Falls Airport (VFA)', note:'Fastjet and Airlink to JNB daily. Short private transfer from your lodge to the airport.' },
       { code:'JNB', label:'Johannesburg (via VFA)', airport:'O.R. Tambo International (JNB)', note:'Fly VFA→JNB, then connect internationally. Allow 3hrs for connection at O.R. Tambo.' }]
    : lastSlug === 'masai-mara'
    ? [{ code:'NBO', label:'Nairobi', airport:'Jomo Kenyatta International (NBO)', note:'45-min charter from Mara airstrip. Book early for peak season connections.' },
       { code:'MBA', label:'Mombasa', airport:'Moi International (MBA)', note:'Alternative via scheduled carrier — useful if combining with coast.' }]
    : lastSlug === 'okavango-delta'
    ? [{ code:'JNB', label:'Johannesburg', airport:'O.R. Tambo International (JNB)', note:'Fly MackAir/Wilderness Air to Maun, then Airlink to JNB. Allow 4hrs total from camp.' },
       { code:'CPT', label:'Cape Town', airport:'Cape Town International (CPT)', note:'Maun to JNB then JNB to CPT. Good if ending your journey in Cape Town.' }]
    : [{ code:'JNB', label:'Johannesburg', airport:'O.R. Tambo International (JNB)', note:'Main hub for onward international connections. Allow 3hr connection from bush charters.' },
       { code:'CPT', label:'Cape Town', airport:'Cape Town International (CPT)', note:'Domestic connection from JNB. Good option for guests ending in Cape Town.' }];
  const selectedHub = hubs.find(h => h.code === departureHubId);
  return (
    <div style={{ marginBottom:24, background:'rgba(212,175,55,0.05)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'16px 18px' }}>
      <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:700, marginBottom:4 }}>✦ Departure from {lastCity.city}</div>
      <div style={{ fontSize:13, color:T.text, fontWeight:600, marginBottom:8 }}>
        {knownGateway ? 'Your departure is confirmed' : departureHubId ? 'Departure set — final transfer below' : 'Where are you flying home from?'}
      </div>
      <div style={{ fontSize:12, color:T.textDim, marginBottom:12, lineHeight:1.55 }}>
        {knownGateway
          ? `Flying from ${knownGateway}. We'll time your final lodge transfer to match.`
          : departureHubId
            ? `Flying from ${GATEWAY_LABEL[departureHubId] ?? departureHubId}. Final lodge transfer options are below.`
            : includeIntlFlight
              ? 'Return flight included — Journey Specialist will confirm your final transfer.'
              : "Select your departure airport — we'll arrange your final lodge-to-airport transfer."
        }
      </div>
      {!includeIntlFlight && (<>
        {/* Only show hub selector if not already set from inspire-input */}
        {!departureHubId && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:selectedHub ? 14 : 0 }}>
          {hubs.map(hub => {
            const isSel = departureHubId === hub.code;
            return (
              <button key={hub.code} onClick={() => { setDepartureHubId(hub.code); setShowDepartureXfer(true); }} style={{ width:'100%', padding:'11px 14px', background:isSel?T.goldDim:T.surface, border:`1.5px solid ${isSel?T.gold:T.border}`, borderRadius:10, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, transition:'border-color 0.2s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:isSel?700:400, color:isSel?T.gold:T.text }}>{hub.airport}</div>
                    <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>{hub.note}</div>
                  </div>
                  <div style={{ fontSize:11, color:isSel?T.gold:T.textDim, background:isSel?T.goldDim:'rgba(255,255,255,0.05)', border:`0.5px solid ${isSel?T.borderGold:T.border}`, borderRadius:20, padding:'3px 10px', fontWeight:isSel?700:400, flexShrink:0, marginLeft:12 }}>{isSel ? '✓ Selected' : 'Select'}</div>
                </div>
              </button>
            );
          })}
        </div>
        )}
        {(showDepartureXfer || !!departureHubId) && selectedHub && (() => {
          const deptOpts = CITY_TRANSFERS[lastSlug] ?? [
            { id:'private-car', icon:'🚗', label:'Private transfer', provider:'Private vehicle to airport', duration:'Varies by lodge location', estimatedCostZAR:2800, note:`Private vehicle from your final lodge to ${selectedHub.airport}. Driver tracks your checkout time.`, recommended:true },
            { id:'charter-transfer', icon:'✈', label:'Light aircraft charter', provider:'Charter to hub airport', duration:'30–60 min flight', estimatedCostZAR:8500, note:`Direct charter to ${selectedHub.airport}. Eliminates road transfer time — best for early departures.`, recommended:false },
          ];
          return (
            <div style={{ marginTop:4 }}>
              <div style={{ fontSize:11, color:T.gold, fontWeight:600, marginBottom:8 }}>Transfer options → {selectedHub.airport}</div>
              <div style={{ display:'flex', gap:10, overflowX:'auto', scrollSnapType:'x mandatory' as any, WebkitOverflowScrolling:'touch' as any, scrollbarWidth:'none' as any, paddingBottom:4 }}>
                {deptOpts.map(opt => {
                  const isSel = opt.recommended;
                  return (
                    <div key={opt.id} style={{ flexShrink:0, width:'min(78vw, 300px)', scrollSnapAlign:'center', borderRadius:11, border:`1.5px solid ${isSel?T.gold:T.border}`, background:isSel?T.goldDim:T.surface, padding:'12px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <span style={{ fontSize:18 }}>{opt.icon}</span>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:isSel?T.gold:T.text }}>{opt.label}</div>
                          <div style={{ fontSize:11, color:T.textDim }}>{opt.provider}</div>
                        </div>
                        {isSel && <div style={{ marginLeft:'auto', fontSize:9, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:20, padding:'2px 7px', fontWeight:800 }}>✦ Rec.</div>}
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <div style={{ fontSize:12, color:T.textMid }}>{opt.duration}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:isSel?T.gold:T.text }}>{fmt(opt.estimatedCostZAR)}<span style={{ fontSize:9, color:T.textDim, fontWeight:400 }}> est.</span></div>
                      </div>
                      <div style={{ fontSize:11, color:T.textDim, lineHeight:1.5 }}>{opt.note}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </>)}
      {includeIntlFlight && (<div style={{ fontSize:11, color:T.green }}>{knownGateway ? `✓ Return flight included from ${knownGateway} — final lodge-to-airport transfer arranged for you.` : '✓ Return flight included — your Journey Specialist handles all final transfers and airport timing.'}</div>)}
      <div style={{ marginTop:12, fontSize:11, color:T.textDim, borderTop:`0.5px solid ${T.border}`, paddingTop:10 }}>💬 Your Journey Specialist will confirm all final logistics before travel.</div>
    </div>
  );
}


function LoginGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const attempt = () => {
    if (code.trim().toLowerCase()==='safari2026') { localStorage.setItem('tse_access','safari2026'); onUnlock(); }
    else { setError(true); setShaking(true); setTimeout(()=>setShaking(false),500); }
  };
  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ marginBottom:32, textAlign:'center' as const }}>
        <div style={{ fontSize:28, color:'#d4af37', fontFamily:"'Cormorant Garamond',serif", fontWeight:700, marginBottom:8 }}>✦ The Safari Edition</div>
        <div style={{ fontSize:13, color:'rgba(245,240,232,0.4)', letterSpacing:'0.15em', textTransform:'uppercase' as const }}>Private Preview</div>
      </div>
      <div style={{ width:'100%', maxWidth:340, animation:shaking?'shake 0.4s ease':'none' }}>
        <input type="password" value={code} onChange={e=>{setCode(e.target.value);setError(false);}} onKeyDown={e=>e.key==='Enter'&&attempt()} placeholder="Enter access code" autoFocus style={{ width:'100%', padding:'14px 18px', background:'#1e1e1e', border:`1.5px solid ${error?'#f87171':'rgba(212,175,55,0.3)'}`, borderRadius:12, color:'#f5f0e8', fontSize:15, outline:'none', fontFamily:'inherit', textAlign:'center' as const, letterSpacing:'0.1em', marginBottom:12, boxSizing:'border-box' as const }} />
        {error && <div style={{ fontSize:12, color:'#f87171', textAlign:'center' as const, marginBottom:10 }}>Incorrect code — try again</div>}
        <button onClick={attempt} style={{ width:'100%', padding:14, background:'linear-gradient(135deg,#d4af37,#f0c040)', border:'none', borderRadius:12, color:'#0a0a0a', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Enter →</button>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  );
}


function Spinner() { return <div className="spinner" />; }
function StepDot({ active }: { active: boolean }) { return <div style={{ width:8, height:8, borderRadius:'50%', background:active?T.gold:'rgba(255,255,255,0.15)', transition:'all 0.3s' }} />; }

function Nav({ edition, setScreen, currency, setCurrency }: any) {
  return (
    <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(10,10,6,0.97)', backdropFilter:'blur(20px)', borderBottom:'0.5px solid rgba(212,175,55,0.1)', padding:'0 clamp(16px,4vw,40px)' }}>
      <div style={{ height:58, display:'flex', alignItems:'center', justifyContent:'space-between' }}>

        {/* HOME — branded wordmark, no dropdown */}
        <button
          onClick={() => setScreen('landing')}
          title="Return to home"
          style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10, padding:'4px 10px 4px 4px', borderRadius:8, transition:'opacity 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.72')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {/* Diamond gem */}
          <div style={{ position:'relative', width:24, height:24, flexShrink:0 }}>
            <div style={{ position:'absolute', inset:0, border:'1px solid rgba(212,175,55,0.65)', transform:'rotate(45deg)', borderRadius:2 }} />
            <div style={{ position:'absolute', inset:6, background:'rgba(212,175,55,0.8)', transform:'rotate(45deg)' }} />
          </div>
          <div>
            <span style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:15, color:'rgba(212,175,55,0.9)', letterSpacing:'0.08em', display:'block', lineHeight:1.1 }}>
              {edition?.name || 'The Safari Edition'}
            </span>
            <span style={{ fontWeight:200, fontSize:7, letterSpacing:'0.44em', textTransform:'uppercase' as const, color:'rgba(212,175,55,0.4)', display:'block', marginTop:1 }}>
              Sub-Saharan Africa · Handpicked
            </span>
          </div>
        </button>

        {/* CURRENCY SELECTOR */}
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <span style={{ fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase' as const, color:'rgba(245,240,232,0.28)', fontWeight:200 }}>
            Currency
          </span>
          <select
            value={currency.code}
            onChange={(e:any) => setCurrency(CURRENCIES.find((c:any) => c.code === e.target.value)!)}
            style={{ background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.1)', color:'rgba(245,240,232,0.7)', borderRadius:6, padding:'6px 10px', fontSize:11, outline:'none', fontFamily:'inherit', cursor:'pointer', letterSpacing:'0.1em', appearance:'none' as const }}
          >
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>

      </div>
    </nav>
  );
}
function ChatDrawer({ msgs, input, setInput, send, loading, endRef, onClose, edition }: any) {
  return (
    <div style={{ position:'fixed', bottom:0, right:16, width:340, height:460, background:'rgba(14,14,14,0.98)', border:`0.5px solid rgba(255,255,255,0.1)`, borderRadius:'16px 16px 0 0', backdropFilter:'blur(20px)', display:'flex', flexDirection:'column', zIndex:200, boxShadow:'0 -4px 40px rgba(0,0,0,0.6)' }}>
      <div style={{ padding:'14px 18px', borderBottom:`0.5px solid rgba(255,255,255,0.07)`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div><div style={{ fontSize:14, fontWeight:600, color:T.text }}>Journey Specialists</div><div style={{ fontSize:11, color:'rgba(212,175,55,0.75)', marginTop:1 }}>✦ {edition.name}</div></div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:'none', color:'rgba(255,255,255,0.5)', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>×</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
        {msgs.map((m:any,i:number) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'88%', padding:'9px 13px', borderRadius:m.role==='user'?'13px 13px 3px 13px':'13px 13px 13px 3px', background:m.role==='user'?'rgba(212,175,55,0.13)':'rgba(255,255,255,0.06)', border:`0.5px solid ${m.role==='user'?'rgba(212,175,55,0.28)':'rgba(255,255,255,0.07)'}`, fontSize:13, color:T.text, lineHeight:1.6 }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{ display:'flex', gap:4, padding:'8px 12px' }}>{[0,1,2].map(i=><div key={i} style={{ width:6, height:6, borderRadius:'50%', background:T.gold, animation:`pulse 1.2s ease ${i*0.2}s infinite` }} />)}</div>}
        <div ref={endRef} />
      </div>
      <div style={{ padding:'10px 14px', borderTop:`0.5px solid rgba(255,255,255,0.07)`, display:'flex', gap:8 }}>
        <input value={input} onChange={(e:any)=>setInput(e.target.value)} onKeyDown={(e:any)=>e.key==='Enter'&&send()} placeholder="Ask about lodges, timing, visas..." style={{ flex:1, background:'rgba(255,255,255,0.06)', border:`0.5px solid rgba(255,255,255,0.1)`, color:T.text, borderRadius:9, padding:'9px 13px', fontSize:13, outline:'none', fontFamily:'inherit' }} />
        <button onClick={send} style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', color:'#0a0a0a', borderRadius:9, padding:'9px 14px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>→</button>
      </div>
    </div>
  );
}


const HOTELS_FALLBACK: Hotel[] = [
  { id:1, edition_id:'safari', name:'Singita Boulders Lodge', location:'Kruger / Sabi Sand, South Africa', destination:'Kruger / Sabi Sand', subRegion:'kruger-sabi-sand', region:'southern-africa', country:'South Africa', stars:5, trustScore:99, contentScore:95, netRate:56000, otaRate:76000, marginScore:27, malariaFree:false, reelUrl:null, tags:[], image:'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80', funFact:'River-facing suites on the Sand River. Six guests per guide.', upgrades:{ rooms:[{label:'Luxury Suite',extra:0,tier:0},{label:'Private Villa',extra:89000,tier:1}], basis:[{label:'All-inclusive',extra:0,tier:0}], flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:4200,tier:1}] } },
  { id:2, edition_id:'safari', name:'Londolozi Tree Camp',    location:'Kruger / Sabi Sand, South Africa', destination:'Kruger / Sabi Sand', subRegion:'kruger-sabi-sand', region:'southern-africa', country:'South Africa', stars:5, trustScore:97, contentScore:90, netRate:48000, otaRate:67000, marginScore:28, malariaFree:false, reelUrl:null, tags:[], image:'https://images.unsplash.com/photo-1500491460312-c32fc2dbc751?w=800&q=80', funFact:'Treehouse suites above the Sand River.', upgrades:{ rooms:[{label:'Suite',extra:0,tier:0},{label:'Private Treehouse',extra:30000,tier:1}], basis:[{label:'All-inclusive',extra:0,tier:0}], flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:3800,tier:1}] } },
  { id:3, edition_id:'safari', name:'Wilderness Mombo Camp',  location:'Okavango Delta, Botswana',         destination:'Okavango Delta',    subRegion:'okavango-delta',  region:'southern-africa', country:'Botswana',      stars:5, trustScore:98, contentScore:92, netRate:62000, otaRate:88000, marginScore:30, malariaFree:false, reelUrl:null, tags:[], image:'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80', funFact:"Chief's Island — the highest predator density in the Delta.", upgrades:{ rooms:[{label:'Luxury Tent',extra:0,tier:0},{label:'Family Tent',extra:18000,tier:1}], basis:[{label:'All-inclusive',extra:0,tier:0}], flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:3200,tier:1}] } },
  { id:4, edition_id:'safari', name:'andBeyond Xaranna',      location:'Okavango Delta, Botswana',         destination:'Okavango Delta',    subRegion:'okavango-delta',  region:'southern-africa', country:'Botswana',      stars:5, trustScore:95, contentScore:88, netRate:52000, otaRate:74000, marginScore:29, malariaFree:false, reelUrl:null, tags:[], image:'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&q=80', funFact:'On a private island in the Delta.', upgrades:{ rooms:[{label:'Luxury Tent',extra:0,tier:0},{label:'Honeymoon Tent',extra:12000,tier:1}], basis:[{label:'All-inclusive',extra:0,tier:0}], flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:3000,tier:1}] } },
  { id:5, edition_id:'safari', name:'Matetsi Victoria Falls',  location:'Chobe / Victoria Falls, Zimbabwe', destination:'Chobe / Victoria Falls', subRegion:'chobe-vic-falls', region:'southern-africa', country:'Zimbabwe', stars:5, trustScore:96, contentScore:88, netRate:38000, otaRate:54000, marginScore:30, malariaFree:false, reelUrl:null, tags:[], image:'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', funFact:'Private 26km stretch of the Zambezi.', upgrades:{ rooms:[{label:'River Suite',extra:0,tier:0},{label:'Private Villa',extra:45000,tier:1}], basis:[{label:'All-inclusive',extra:0,tier:0}], flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:3200,tier:1}] } },
  { id:6, edition_id:'safari', name:'Ellerman House',         location:'Cape Town, South Africa',          destination:'Cape Town',         subRegion:'cape-town',      region:'southern-africa', country:'South Africa', stars:5, trustScore:94, contentScore:91, netRate:28000, otaRate:null,  marginScore:27, malariaFree:true,  reelUrl:null, tags:['malaria-free'], image:'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80', funFact:'Eleven suites overlooking the Atlantic.', upgrades:{ rooms:[{label:'Classic Suite',extra:0,tier:0},{label:'Villa Suite',extra:18000,tier:1}], basis:[{label:'Breakfast included',extra:0,tier:0}], flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:2200,tier:1}] } },
  { id:7, edition_id:'safari', name:'Jamala Madikwe',         location:'Madikwe, South Africa',            destination:'Madikwe',           subRegion:'madikwe',        region:'southern-africa', country:'South Africa', stars:5, trustScore:93, contentScore:85, netRate:28000, otaRate:38500, marginScore:27, malariaFree:true,  reelUrl:null, tags:['malaria-free','family-friendly'], image:'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80', funFact:'Malaria-free Big Five.', upgrades:{ rooms:[{label:'Classic Suite',extra:0,tier:0},{label:'Royal Suite',extra:15000,tier:1}], basis:[{label:'All-inclusive',extra:0,tier:0}], flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:2200,tier:1}] } },
  { id:8, edition_id:'safari', name:'Mara Plains Camp',       location:'Masai Mara, Kenya',                destination:'Masai Mara',        subRegion:'masai-mara',     region:'east-africa',     country:'Kenya',        stars:5, trustScore:96, contentScore:91, netRate:42000, otaRate:58000, marginScore:28, malariaFree:false, reelUrl:null, tags:[], image:'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=800&q=80', funFact:'Only 8 tents. Peak migration July–October.', upgrades:{ rooms:[{label:'Classic Tent',extra:0,tier:0},{label:'Family Tent',extra:18000,tier:1}], basis:[{label:'All-inclusive',extra:0,tier:0}], flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:3200,tier:1}] } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

// Region background images — used for scroll-based cross-fade
const REGION_BG_IMAGES: Record<string,string> = {
  'kruger-sabi-sand':'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1600&q=40',
  'okavango-delta':  'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=1600&q=40',
  'cape-town':       'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1600&q=40',
  'madikwe':         'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1600&q=40',
  'chobe-vic-falls': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600&q=40',
  'masai-mara':      'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=1600&q=40',
};

export default function SafariEdition({ edition = SAFARI_EDITION }: { edition?: EditionConfig }) {

  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window==='undefined') return false;
    return localStorage.getItem('tse_access')==='safari2026';
  });
  const [screen,    setScreen]    = useState<Screen>('landing');
  const [inputMode, setInputMode] = useState<InputMode>('socratic');
  const [specialist] = useState(() => SPECIALISTS[Math.floor(Math.random()*SPECIALISTS.length)] ?? SPECIALISTS[0]);

  // [V6-2] Default currency is USD (set in SAFARI_EDITION.defaultCurrency above)
  const [currency, setCurrency] = useState<Currency>(() => CURRENCIES.find(c=>c.code===edition.defaultCurrency)??CURRENCIES[0]);
  const fmt = useMemo(() => makeFmt(currency.symbol, currency.rate), [currency]);

  const [nights,   setNights]   = useState(7);
  const [adults,   setAdults]   = useState(2);
  const [children, setChildren] = useState(0);
  const [infants,  setInfants]  = useState(0);
  const totalPax = Math.max(adults+children,1);

  const [needsIntlFlight, setNeedsIntlFlight] = useState<boolean|null>(null);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
const toggleRegion = (id: string) => {
    setPanelFade(false);
    setTimeout(() => setPanelFade(true), 50);
    if (id==='inspire-me') { setSelectedRegions([]); return; }
    setSelectedRegions(prev => prev.includes(id) ? prev.filter(r=>r!==id) : [...prev.filter(r=>r!=='inspire-me'), id]);
  };
         
const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
const toggleTheme = (id: string) =>
  setSelectedThemes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
         const [panelFade, setPanelFade] = useState(true);
  const [budget, setBudget] = useState(230000);

  // Auto-updates when nights button is clicked
  // Based on luxury lodge rates + domestic flights + transfers, 2 adults, excl. international flights
  const BUDGET_DEFAULTS: Record<number, number> = {
    5:  160000,
    7:  230000,
    10: 340000,
    12: 415000,
    14: 490000,
    21: 735000,
  };
  useEffect(() => {
    if (BUDGET_DEFAULTS[nights]) setBudget(BUDGET_DEFAULTS[nights]);
  }, [nights]);
  const [origin,      setOrigin]      = useState('JNB');
  const [intlOrigin,  setIntlOrigin]  = useState('LHR');
  const [researchStep,setResearchStep]= useState(0);
  const [itinerary,   setItinerary]   = useState<Itinerary|null>(null);
  // Active region background — cross-fades as traveller scrolls
  const [activeBgSlug, setActiveBgSlug] = useState<string>('');
  const [prevBgSlug, setPrevBgSlug] = useState<string>('');
  const [bgTransition, setBgTransition] = useState(false);
  const [skeletonId,  setSkeletonId]  = useState<string|null>(null);
  const [skeletonFindings, setSkeletonFindings] = useState<any[]>([]);

  const [cityStays, setCityStays] = useState<Array<{ hotelId:string|number; nights:number; prefs:{rooms:number;basis:number;flexibility:number} }>>([]);
  // [Transfers v2] Live Duffel commercial-leg fares, keyed by target airport, in ZAR per person.
  // Populated once per itinerary (see useEffect). Empty = every leg uses its estimate fallback.
  const [transferFares, setTransferFares] = useState<Record<string, number>>({});
  // Commercial-leg detail per airport (airline, times, stops) for tile display.
  const [transferMeta, setTransferMeta] = useState<Record<string, any>>({});

  // [V7.1] Smart default: ~120 days out (plausible, non-blank so it stops blocking checkout).
  // Traveller can change it; this just removes the empty-field friction.
  const [checkinDate,        setCheckinDate]        = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 120);
    return d.toISOString().split('T')[0];
  });
  const [dateMode,      setDateMode]      = useState<'specific'|'month'|'window'|'flexible'>('specific');
  const [flexMonth,     setFlexMonth]     = useState('');
  const [windowStart,   setWindowStart]   = useState('');
  const [windowEnd,     setWindowEnd]     = useState('');
  const [selectedTransferIds, setSelectedTransferIds] = useState<Record<string,string>>({});
  const [departureHubId,    setDepartureHubId]    = useState<string>('');
  const [showDepartureXfer, setShowDepartureXfer] = useState(false);
  const [cityTransferIds, setCityTransferIds] = useState<Record<string,string>>({});
  const [selectedActivities, setSelectedActivities] = useState<Record<string, string[]>>({});
  const [arrivalAirport, setArrivalAirport] = useState('');
  const [arrivalFlightNo, setArrivalFlightNo] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [includeIntlFlight,  setIncludeIntlFlight]  = useState(false);
  const [builderIntlOrigin,  setBuilderIntlOrigin]  = useState('LHR');
  const [showValidation,     setShowValidation]     = useState(false);

  // [V7-2] Flight intent — richer than the needsIntlFlight boolean
  const [flightIntent,           setFlightIntent]           = useState<'include'|'own'|'flexible'|null>(null);
  const [gatewayPreference,      setGatewayPreference]      = useState<'return'|'open_jaw'|'custom'>('open_jaw');
  const [flightArrivalGateway,   setFlightArrivalGateway]   = useState<string>('JNB');
  const [flightDepartureGateway, setFlightDepartureGateway] = useState<string>('JNB');
  const [selectedFlightOffer,    setSelectedFlightOffer]    = useState<any>(null);
  const [flightAncillaryTotal,   setFlightAncillaryTotal]   = useState<number>(0);
  const [ownFlightDetails,       setOwnFlightDetails]       = useState<any>(null);
  const [routeReversalDismissed, setRouteReversalDismissed] = useState(false);

  const [curTheme,  setCurTheme]  = useState('all');
  const [curRegion, setCurRegion] = useState('all');
  const [curNights, setCurNights] = useState('all');
         const [dbCuratedJourneys,    setDbCuratedJourneys]    = useState<any[]>([]);
  const [selectedCuratedJourney, setSelectedCuratedJourney] = useState<any>(null);

  const [kbEntries,       setKbEntries]       = useState<KBEntry[]>(DEFAULT_KB);

  // Fetch real KB entries from Supabase (non-commercial, active)
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/rest/v1/knowledge_base?select=*&status=eq.active&order=guidance_importance.desc&limit=200`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        if (rows?.length > 0) setKbEntries(rows);
      })
      .catch(() => {});
  }, [edition.id]);
  const [hotels,          setHotels]          = useState<Hotel[]>(HOTELS_FALLBACK);
  const [activities,      setActivities]      = useState<Activity[]>(ACTIVITIES_FALLBACK);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const hotelsByMargin = useMemo(() => [...hotels].sort((a,b) => ((b.displayRate||0)-(b.netRate||0)) - ((a.displayRate||0)-(a.netRate||0))), [hotels]);
// Cinematic videos per region — for the inspire-input right panel
  const [regionVideoMap, setRegionVideoMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/rest/v1/cinematic_videos?select=region,url`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    })
      .then(r => r.json())
      .then((rows: any[]) => {
        if (rows?.length) {
          const map: Record<string,string> = {};
          rows.forEach(r => { if (r.region && r.url) map[r.region] = r.url; });
          setRegionVideoMap(map);
        }
      })
      .catch(() => {});
  }, []);
         const regionImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    REGIONS.forEach(r => {
      if (!r.slug) return;
      const best = hotelsByMargin.find(h => h.subRegion === r.slug && h.image && !h.image.includes('unsplash'));
      const fallback = hotelsByMargin.find(h => h.subRegion === r.slug && h.image);
      const img = best?.image || fallback?.image;
      if (img) map[r.slug] = img;
    });
    return map;
  }, [hotelsByMargin]);
  const [miniSiteHotel, setMiniSiteHotel] = useState<any>(null);
  const [miniSiteSupplier, setMiniSiteSupplier] = useState<string|undefined>(undefined);
  const [miniSiteIncludes, setMiniSiteIncludes] = useState<string[]>([]);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMsgs,    setChatMsgs]    = useState<ChatMessage[]>([{ role:'assistant', text:`Welcome to ${edition.name}. How can our team help?` }]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMsgs, setAdjustMsgs] = useState<ChatMessage[]>([{ role:'assistant', text:"Your journey is ready. Want to adjust anything?" }]);
  const [adjustInput, setAdjustInput] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const adjustEndRef = useRef<HTMLDivElement>(null);

  const FACTUAL = /visa|weather|pack|when|best time|malaria|safe|flight time|how long|currency|season/i;

useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url||!key) { setSuppliersLoaded(true); return; }
    const h = { apikey:key, Authorization:`Bearer ${key}` };
    const suppliersQ  = `${url}/rest/v1/suppliers?select=*&is_active=eq.true&region_slug=not.is.null&order=trust_score.desc&limit=100`;
    const roomTypesQ  = `${url}/rest/v1/room_types?select=id,supplier_id,name,net_rate_zar,category,max_occupancy,bed_type,view,meal_basis,description,images,keywords&is_active=eq.true&order=name.asc`;
    Promise.all([
      fetch(suppliersQ,  { headers:h }).then(r => r.ok ? r.json() : []),
      fetch(roomTypesQ,  { headers:h }).then(r => r.ok ? r.json() : []),
    ])
      .then(([supplierRows, roomTypeRows]: [any[], any[]]) => {
        const OPERATOR_NAMES = ['Federal Air','Fastjet South Africa','Mack Air Botswana','Wilderness Air Botswana','Cape Town Airport Transfers'];
        const lodges = supplierRows.filter(r => r.country && r.name && r.supplier_type!=='operator' && !OPERATOR_NAMES.includes(r.name));
        if (lodges.length > 0) {
          setHotels(lodges.map(s => mapSupplierRow(s, roomTypeRows.filter((rt: any) => rt.supplier_id === s.id))));
        }
        setSuppliersLoaded(true);
      })
      .catch(() => setSuppliersLoaded(true));
  }, [edition.id]);
// Load curated journeys from Supabase
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/rest/v1/curated_journeys?select=*&status=eq.published&edition_id=eq.safari&order=sort_order.asc&limit=12`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }).then(r => r.json()).then((rows: any[]) => {
      if (rows?.length > 0) setDbCuratedJourneys(rows);
    }).catch(() => {});
  }, [edition.id]);
  // [Activities] Load activities from Supabase (mirrors supplier fetch).
  // USD-priced rows are converted to ZAR using the USD display rate (XE snapshot
  // today; swap to live XE later). Falls back silently to empty on any error.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const usdToZar = CURRENCIES.find(c => c.code === 'USD')?.rate ?? 18.62;
    const query = `${url}/rest/v1/activities?select=*&is_active=eq.true&order=sort_order.asc`;
    fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
      .then(r => { if (!r.ok) throw new Error(`Supabase ${r.status}`); return r.json(); })
      .then((rows: any[]) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setActivities(rows.map(row => mapActivityRow(row, usdToZar)));
        }
      })
      .catch(() => { /* keep empty fallback — spool just shows nothing */ });
  }, [edition.id]);

  // Set initial region background when itinerary first loads
  useEffect(() => {
    if (!itinerary?.cities?.[0]) return;
    const slug = CITY_TO_SLUG[itinerary.cities[0].city?.toLowerCase().trim()??'']??'';
    if (slug && slug !== activeBgSlug) {
      setActiveBgSlug(slug);
      setBgTransition(true);
    }
  }, [itinerary?.cities?.[0]?.city]); // eslint-disable-line

  const M = edition.margins;

  // [Transfers v3] Fetch live commercial HUB-TO-HUB fares for the three-part chain.
  // For each inter-region leg we compute originHub -> destHub (e.g. MUB -> JNB) and
  // search that route. Results keyed by "ORIGINHUB-DESTHUB". Exit + arrival last-miles
  // are added in buildTransferOptions; this only prices the commercial middle leg.
  useEffect(() => {
    if (!itinerary?.cities || itinerary.cities.length < 2) { setTransferFares({}); setTransferMeta({}); return; }
    const lodgeFor = (slug: string, i: number) => {
      const pool = slug ? hotelsByMargin.filter(h => h.subRegion === slug) : hotelsByMargin;
      const stay = cityStays[i];
      return (pool.find(h => String(h.id) === String(stay?.hotelId)) ?? pool[0])?.name ?? '';
    };

    // Build the set of origin-hub -> dest-hub routes across all legs.
    const routeSet = new Map<string, { origin: string; destination: string }>();
    for (let i = 0; i < itinerary.cities.length - 1; i++) {
      const fromSlug = CITY_TO_SLUG[itinerary.cities[i].city.toLowerCase().trim()] ?? '';
      const toSlug   = CITY_TO_SLUG[itinerary.cities[i+1].city.toLowerCase().trim()] ?? '';
      if (!fromSlug || !toSlug || toSlug === 'cape-town') continue; // CPT dest handled separately
      const originHub = originHubAirport(lodgeFor(fromSlug, i), fromSlug);
      const destHub   = defaultCommercialTarget(lodgeFor(toSlug, i+1), toSlug);
      if (!originHub || !destHub || originHub === destHub) continue; // same hub = no commercial leg
      routeSet.set(`${originHub}-${destHub}`, { origin: originHub, destination: destHub });
    }
    if (routeSet.size === 0) { setTransferFares({}); setTransferMeta({}); return; }

    const depDate = checkinDate || todayPlusDays(120);
    const pax = Math.max(adults + children, 1);
    const usdToZar = CURRENCIES.find(c => c.code === 'USD')?.rate ?? 18.62;

    let cancelled = false;
    fetch('/api/transfers/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routes: [...routeSet.values()], departure_date: depDate, passengers: pax }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.fares) return;
        const zarFares: Record<string, number> = {};
        Object.entries(data.fares).forEach(([routeKey, usd]) => { zarFares[routeKey] = Math.round((usd as number) * usdToZar); });
        setTransferFares(zarFares);
        if (data.meta) setTransferMeta(data.meta);
      })
      .catch(() => { /* keep empty -> estimates used */ });
    return () => { cancelled = true; };
  }, [itinerary?.cities, cityStays, checkinDate, adults, children, hotelsByMargin]);

  const grandTotal = useMemo(() => {
    if (!itinerary?.cities || cityStays.length===0) return 0;
    const lodgeCost = itinerary.cities.reduce((sum, city, i) => {
      const stay = cityStays[i]; if (!stay) return sum;
      const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      const pool = slug ? hotelsByMargin.filter(h=>h.subRegion===slug) : hotelsByMargin;
      const hotel = pool.find(h=>String(h.id)===String(stay.hotelId)) ?? pool[0];
      if (!hotel) return sum;
      const { resolved } = resolveHotelUpgrades(hotel, stay.prefs);
      const extra = Object.values(resolved).reduce((s:number,v:any)=>s+(v?.extra??0),0);
      return sum + Math.round((hotel.netRate*stay.nights+extra)*M.hotels);
    }, 0);
    const transferCost = itinerary.cities.reduce((sum, city, i) => {
      if (i >= itinerary.cities.length - 1) return sum;
      const nextCity = itinerary.cities[i + 1];
      const fromSlug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      const toSlug   = CITY_TO_SLUG[nextCity.city.toLowerCase().trim()] ?? '';
      if (!fromSlug || !toSlug) return sum;
      const legKey  = `${fromSlug}→${toSlug}`;
      // Destination lodge for this leg (the next city's chosen hotel) resolves the airport.
      const nextStay = cityStays[i + 1];
      const nextPool = toSlug ? hotelsByMargin.filter(h => h.subRegion === toSlug) : hotelsByMargin;
      const destHotel = nextPool.find(h => String(h.id) === String(nextStay?.hotelId)) ?? nextPool[0];
      // Origin lodge for the EXIT leg = this city's chosen hotel.
      const thisStay = cityStays[i];
      const thisPool = fromSlug ? hotelsByMargin.filter(h => h.subRegion === fromSlug) : hotelsByMargin;
      const originHotel = thisPool.find(h => String(h.id) === String(thisStay?.hotelId)) ?? thisPool[0];
      const usdRate = CURRENCIES.find(c => c.code === 'USD')?.rate ?? 18.62;
      const options = buildTransferOptions(fromSlug, toSlug, destHotel?.name, Math.max(adults + children, 1), usdRate, transferFares, transferMeta, originHotel?.name);
      if (!options.length) return sum;
      const selId   = selectedTransferIds[legKey];
      const chosen  = selId ? options.find(o => o.id === selId) : options.find(o => o.recommended) ?? options[0];
      return sum + (chosen?.estimatedCostZAR ?? 0);
    }, 0);
    const activityCost = itinerary.cities.reduce((sum, city) => {
      const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      const sel = selectedActivities[slug] ?? [];
      return sum + activities.filter(a => sel.includes(String(a.id))).reduce((s, a) => s + Math.round(a.netRate * M.activities), 0);
    }, 0);
    const cityXferCost = itinerary.cities.reduce((sum, city) => {
      const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      if (!CITY_TYPE_SLUGS.has(slug)) return sum;
      const opts = CITY_TRANSFERS[slug] ?? [];
      if (!opts.length) return sum;
      const selId = cityTransferIds[slug];
      const chosen = selId ? opts.find(o => o.id === selId) : opts.find(o => o.recommended) ?? opts[0];
      return sum + (chosen?.estimatedCostZAR ?? 0);
    }, 0);
    // [V7.1] International flights — Duffel offer price is in USD; grandTotal is ZAR.
    // Convert USD -> ZAR using the fixed USD rate so the package total stays in ZAR.
    const USD_ZAR = CURRENCIES.find(c => c.code === 'USD')?.rate ?? 18.62;
    const flightCostZAR = selectedFlightOffer
      ? Math.round((selectedFlightOffer.display_price * (adults + children) + flightAncillaryTotal) * USD_ZAR)
      : 0;
    return lodgeCost + transferCost + activityCost + cityXferCost + flightCostZAR;
  }, [itinerary?.cities, cityStays, hotelsByMargin, M.hotels, selectedTransferIds, selectedActivities, cityTransferIds, selectedFlightOffer, flightAncillaryTotal, adults, children, activities, transferFares]);

  // [V7-4] Route reversal — uses real INTERNAL_LEGS transfer costs. Fires after itinerary builds.
  const routeReversalResult = useMemo(() => {
    if (!itinerary?.cities || itinerary.cities.length < 2) return null;
    const slugOf = (c: string) => CITY_TO_SLUG[c?.toLowerCase().trim() ?? ''] ?? '';
    const legCost = (from: string, to: string) => {
      const opts = buildTransferOptions(from, to, undefined, Math.max(adults + children, 1), CURRENCIES.find(c=>c.code==='USD')?.rate ?? 18.62, transferFares, transferMeta, undefined);
      if (!opts.length) return 0;
      return (opts.find(o => o.recommended) ?? opts[0])?.estimatedCostZAR ?? 0;
    };
    const cities = itinerary.cities;
    let original = 0;
    for (let i = 0; i < cities.length - 1; i++) original += legCost(slugOf(cities[i].city), slugOf(cities[i+1].city));
    const rev = [...cities].reverse();
    let reversed = 0;
    for (let i = 0; i < rev.length - 1; i++) reversed += legCost(slugOf(rev[i].city), slugOf(rev[i+1].city));
    const saving = original - reversed;
    const threshold = 150 * (currency.rate || 18.62);
    if (saving <= threshold) return null;
    return { saving, reversed_city_order: rev.map(c => c.city), is_cheaper: true };
  }, [itinerary?.cities, currency.rate]);

const rankedCurated = useMemo(() => {
    // Use DB data when available, fall back to hardcoded
    const source: any[] = dbCuratedJourneys.length > 0
      ? dbCuratedJourneys.map((j: any) => {
          const cities: any[] = j.cities || [];
          const slugs = cities.map((c: any) => c.regionSlug || '');
          const region = slugs.some(s => ['masai-mara','bwindi'].includes(s)) ? 'east-africa'
                       : slugs.length > 1 ? 'both' : 'southern-africa';
          const nights = j.nights || cities.reduce((s: number, c: any) => s + (c.nights || 0), 0);
          return {
            ...j,
            badgeColor:    j.badge_color ?? '#d4af37',
            image:         j.hero_image || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80',
            priceFrom:     j.price_from_zar,
            otaEquivalent: j.ota_price_zar,
            pax:           (j.themes || []).includes('family') ? 4 : 2,
            region,
            nights,
            nightsRange:   nights <= 6 ? 'short' : nights <= 10 ? 'medium' : 'long',
            includes:      cities.map((c: any) => `${c.nights}n ${c.city}`),
          };
        })
      : CURATED_JOURNEYS;

    return [...source].map(j => {
      let score = 0;
      if (curTheme !== 'all' && (j.themes || []).includes(curTheme))              score += 3;
      if (curRegion !== 'all' && (j.region === curRegion || j.region === 'both')) score += 2;
      if (curNights === 'short'  && j.nights <= 6)                                score += 1;
      if (curNights === 'medium' && j.nights >= 7 && j.nights <= 10)              score += 1;
      if (curNights === 'long'   && j.nights >= 11)                               score += 1;
      return { ...j, _score: score };
    }).sort((a: any, b: any) => b._score - a._score);
  }, [curTheme, curRegion, curNights, dbCuratedJourneys]);

const runEngine = async (request: any, mode: InputMode) => {
    setInputMode(mode); setScreen('inspire-research'); setResearchStep(0);
         setSkeletonId(null); setSkeletonFindings([]);
    window.scrollTo({ top:0, behavior:'instant' });
    track('itinerary_viewed', edition.id, { mode, nights, adults, budget });

    const slugs = selectedRegions.map(id => REGIONS.find(r=>r.id===id)?.slug??'').filter(Boolean);

    try {
      const res = await fetch('/api/build-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.itinerary?.cities) && data.itinerary.cities.length > 0) {
        data.itinerary.inputMode = mode;
        setItinerary(data.itinerary);
        // Map server hotel IDs back to local hotel objects for the builder UI
        const mappedStays = (data.itinerary.cities as any[]).map((city: any, i: number) => {
          const slug = CITY_TO_SLUG[city.city?.toLowerCase().trim() ?? ''] ?? '';
          const pool = slug ? hotelsByMargin.filter(h => h.subRegion === slug) : hotelsByMargin;
          const serverHotelId = data.cityStays?.[i]?.hotelId;
          const match = pool.find(h => String(h.id) === String(serverHotelId)) ?? pool[0] ?? hotelsByMargin[0];
          return { hotelId: match?.id ?? 0, nights: city.nights, prefs: { rooms:0, basis:0, flexibility:0 } };
        });
        setCityStays(mappedStays);
               setCityStays(mappedStays);

  // Fire skeleton engine — runs in background, does NOT block the builder screen.
  // Results stored in state for BCC tip panel and Selection Load page.
  fetch('/api/itinerary/skeleton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itinerary:      data.itinerary,
      cityStays:      mappedStays,
      checkinDate,
      adults,
      children,
      infants,
      nights,
      budget,
      flightIntent:   flightIntent ?? 'flexible',
      selectedFlight: selectedFlightOffer ?? null,
      theme:          selectedThemes[0] ?? undefined,
      occasion:       selectedThemes.find(t => ['honeymoon','anniversary','family','babymoon'].includes(t)) ?? undefined,
    }),
  })
    .then(r => r.json())
    .then(sk => {
      if (sk.success) {
        setSkeletonId(sk.skeleton_id);
        setSkeletonFindings(sk.findings ?? []);
      }
    })
    .catch(() => { /* silent — skeleton is non-critical */ });
      } else {
        throw new Error(data.error || 'Empty response');
      }
    } catch (e) {
      // Graceful fallback — client-side engine
      const fallback = buildFallbackItinerary(nights, budget, mode, slugs);
      fallback.inputMode = mode;
      setItinerary(fallback);
      const fallbackStays = fallback.cities.map((city) => {
        const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
        const pool = slug ? hotelsByMargin.filter(h => h.subRegion === slug) : hotelsByMargin;
        return { hotelId: pool[0]?.id ?? 0, nights: city.nights, prefs: { rooms:0, basis:0, flexibility:0 } };
      });
      setCityStays(fallbackStays);
    }

    setAdjustMsgs([{ role:'assistant', text:`Your journey is ready. Tap any lodge to browse options, or ask me to adjust anything below.` }]);
    if (needsIntlFlight) { setIncludeIntlFlight(true); setBuilderIntlOrigin(intlOrigin); }
    window.scrollTo({ top:0, behavior:'instant' });
  };
const runCuratedJourney = () => {
    if (!selectedCuratedJourney) return;
    const j = selectedCuratedJourney;
    const cities: any[] = j.cities || [];
    const regions = cities.map((c: any) => c.regionSlug).filter(Boolean);
    const totalNights = j.nights || cities.reduce((s: number, c: any) => s + (c.nights || 0), 0);
    setNights(totalNights);
    runEngine({
      mode: 'curated',
      budget: Math.round((j.price_from_zar || j.priceFrom || 150000) * 1.15),
      nights: totalNights,
      adults,
      children,
      infants,
      regions,
      origin: needsIntlFlight ? intlOrigin : origin,
      flightIntent: flightIntent || 'flexible',
      checkinDate: checkinDate || undefined,
      curatedTitle: j.name,
      curatedCities: cities,
      theme: (j.themes || [])[0],
    }, 'curated');
  };
         
const runSocraticPlanner = () => {
    const selectedSlugs = selectedRegions
      .map(id => REGIONS.find(r => r.id === id)?.slug ?? '')
      .filter(Boolean);
    runEngine({
      mode: 'socratic',
      budget,
      nights,
      adults,
      children,
      infants,
      regions: selectedSlugs,
      origin: needsIntlFlight ? intlOrigin : origin,
      flightIntent: flightIntent || 'flexible',
      checkinDate: checkinDate || undefined,
      theme: selectedThemes[0] || undefined,
      themes: selectedThemes,
    }, 'socratic');
  };

const runBriefPlanner = (briefText: string) => {
    runEngine({
      mode: 'brief',
      budget,
      nights,
      adults,
      children,
      infants,
      regions: [],
      origin: needsIntlFlight ? intlOrigin : origin,
      flightIntent: flightIntent || 'flexible',
      checkinDate: checkinDate || undefined,
      briefText,
    }, 'brief');
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim(); setChatInput('');
    setChatMsgs(m=>[...m,{role:'user',text:msg}]);
    setChatLoading(true);
    try { const reply = await chatWithSpecialist(msg, edition.ai); setChatMsgs(m=>[...m,{role:'assistant',text:reply}]); }
    catch { setChatMsgs(m=>[...m,{role:'assistant',text:'The dry season (June–Sept) is perfect — short grass, animals at water.'}]); }
    setChatLoading(false);
  };

  const sendAdjust = async () => {
    if (!adjustInput.trim()||!itinerary) return;
    const msg = adjustInput.trim(); setAdjustInput('');
    setAdjustMsgs(m=>[...m,{role:'user',text:msg}]);
    setAdjustLoading(true);
    try {
      const det = applyDeterministicChange(msg, itinerary, hotels);
      if (det) { setItinerary(det.itinerary); setAdjustMsgs(m=>[...m,{role:'assistant',text:det.reply}]); setAdjustLoading(false); return; }
      if (FACTUAL.test(msg)) { const answer = await answerFactual(msg, itinerary.cities[0]?.city??'Southern Africa', edition.ai); setAdjustMsgs(m=>[...m,{role:'assistant',text:answer}]); setAdjustLoading(false); return; }
      const diff = await applyCreativeDiff({ message:msg, itinerary, budget, nights, ai:edition.ai });
      if (diff.cities?.length) {
        const updatedCities = itinerary.cities.map(existing => { const changed=diff.cities!.find((c:any)=>c?.city===existing.city); return changed?{...existing,...changed}:existing; });
        const safe = updatedCities.filter((c:any)=>c?.city&&c?.country);
        if (safe.length>0) setItinerary({...itinerary, cities:safe, totalEstimate:diff.totalEstimate??itinerary.totalEstimate});
      }
      setAdjustMsgs(m=>[...m,{role:'assistant',text:diff.reply??'Done.'}]);
    } catch { setAdjustMsgs(m=>[...m,{role:'assistant',text:'Something went wrong. Please try again.'}]); }
    setAdjustLoading(false);
  };

  const escalateToSpecialist = (context: string) => {
    setChatOpen(true);
    setChatMsgs(m => [...m, { role:'assistant', text:`Happy to help with ${context} — what would you like to know?` }]);
  };

  const [checkoutKey] = useState(() => generateIdempotencyKey());
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleValidateAndPay = () => {
    const issues = validateItinerary({
      cities: itinerary?.cities ?? [],
      checkinDate,
      infants,
      hasOwnFlights: !includeIntlFlight,
      arrivalFlightNo,
    });
    const hardIssues = issues.filter(i => i.severity === 'hard');
    if (hardIssues.length > 0) {
      setShowValidation(true);
      return;
    }
    setScreen('journey-loading');
  };

  const doCheckout = async () => {
    setShowValidation(false);
    if (checkoutLoading||!itinerary) return;
    setCheckoutLoading(true);
    track('payment_initiated', edition.id, { grandTotal, nights, adults });
    try {
      const components: BookingComponent[] = (itinerary.cities??[]).map((city, i) => {
        const stay = cityStays[i]; if (!stay) return null;
        const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()]??'';
        const pool = slug ? hotelsByMargin.filter(h=>h.subRegion===slug) : hotelsByMargin;
        const hotel = pool.find(h=>String(h.id)===String(stay.hotelId)) ?? pool[0];
        if (!hotel) return null;
        const { resolved } = resolveHotelUpgrades(hotel, stay.prefs);
        const extra = Object.values(resolved).reduce((s:number,v:any)=>s+(v?.extra??0),0);
        return { pillar:'hotel', name:hotel.name, location:hotel.location, nights:stay.nights, net_rate_zar:hotel.netRate*stay.nights+extra, display_rate_zar:Math.round((hotel.netRate*stay.nights+extra)*M.hotels), margin_pct:15, inclusion_source:'contract' as const };
      }).filter(Boolean) as BookingComponent[];
      const booking: BookingIntent = { edition_id:edition.id, idempotency_key:checkoutKey, state:'quote', title:itinerary.title, adults, children_count:children, nights, check_in:checkinDate, check_out:addDays(checkinDate,nights), total_display_zar:grandTotal, total_net_zar:Math.round(grandTotal/M.hotels), budget_zar:budget, components, input_mode:inputMode };
      const res  = await fetch('/api/itinerary', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(booking) });
      const data = await res.json();
      if (data.success&&data.id) { track('checkout_started',edition.id,{bookingId:data.id,grandTotal}); window.location.href=`/checkout?id=${data.id}`; }
      else alert('Could not save booking: '+(data.error??'Unknown error'));
    } catch (e:any) { alert('Connection error: '+(e?.message??String(e))); }
    setCheckoutLoading(false);
  };

  const validationIssues = useMemo(() => validateItinerary({ cities:itinerary?.cities??[], checkinDate, infants, hasOwnFlights:!includeIntlFlight, arrivalFlightNo }), [itinerary?.cities, checkinDate, infants, includeIntlFlight, arrivalFlightNo]);

  const navProps = { edition, setScreen, currency, setCurrency, chatOpen, setChatOpen, totalZAR:grandTotal, fmt, hasPricedItems:grandTotal>0 };

  if (!unlocked) return <LoginGate onUnlock={()=>setUnlocked(true)} />;

  return (
    <>
      <style suppressHydrationWarning>{GLOBAL_CSS}</style>

      {showValidation && <ValidationModal issues={validationIssues} onProceed={doCheckout} onBack={()=>setShowValidation(false)} />}

     {/* LANDING */}
{screen === 'landing' && (
        <LandingHero
          onPlanJourney={() => {
            // Reset all form state so every journey starts fresh
            setSelectedRegions([]);
            setSelectedThemes([]);
            setNights(7);
            setBudget(230000);
            setAdults(2);
            setChildren(0);
            setInfants(0);
            setFlightIntent(null);
            setGatewayPreference('open_jaw');
            setCheckinDate('');
            setDateMode('specific');
            setFlexMonth('');
            setIntlOrigin('LHR');
            setOrigin('JNB');
            setScreen('inspire-input');
          }}
          onCuratedJourneys={() => setScreen('curated')}
          onSendBrief={() => setScreen('my-brief')}
          currency={currency}
          onCurrencyChange={setCurrency}
          currencies={CURRENCIES}
        />
      )}
      {/* CURATED */}
      {screen==='curated' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div className="fade-up" style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px 80px' }}>
            <button onClick={()=>setScreen('landing')} style={{ background:'transparent', border:`0.5px solid ${T.border}`, color:T.textDim, borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:24 }}>← Back</button>
            <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:6 }}>Curated Journeys</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, marginBottom:6, color:T.text }}>Ready to book — from price</h2>
            <p style={{ fontSize:14, color:T.textMid, marginBottom:24 }}>All-inclusive. Negotiated rates. Every detail handled.</p>
            <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:14, padding:'14px 18px', marginBottom:24, display:'flex', flexWrap:'wrap', gap:20 }}>
              {[{label:'Theme',val:curTheme,set:setCurTheme,opts:[{v:'all',l:'All'},{v:'safari',l:'Safari'},{v:'luxury',l:'Luxury'},{v:'romance',l:'Romance'},{v:'family',l:'Family'},{v:'adventure',l:'Adventure'},{v:'beach',l:'Beach'}]},{label:'Region',val:curRegion,set:setCurRegion,opts:[{v:'all',l:'Any'},{v:'southern-africa',l:'Southern Africa'},{v:'east-africa',l:'East Africa'},{v:'both',l:'Multi-region'}]},{label:'Length',val:curNights,set:setCurNights,opts:[{v:'all',l:'Any'},{v:'short',l:'≤6 nights'},{v:'medium',l:'7–10 nights'},{v:'long',l:'11+ nights'}]}].map(filt => (
                <div key={filt.label}>
                  <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600, marginBottom:6 }}>{filt.label}</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {filt.opts.map(o=>(
                      <button key={o.v} onClick={()=>filt.set(o.v)} style={{ padding:'5px 12px', borderRadius:20, border:`1.5px solid ${filt.val===o.v?T.gold:T.border}`, background:filt.val===o.v?T.goldDim:'transparent', color:filt.val===o.v?T.gold:T.textMid, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{o.l}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:18 }}>
              {rankedCurated.map((j:any,rank:number)=>(
              <div key={j.id} className="card" style={{ cursor:'pointer', position:'relative' as const }} onClick={()=>{ setSelectedCuratedJourney(j); setScreen('curated-customise'); }}>
                  {rank===0&&(curTheme!=='all'||curRegion!=='all'||curNights!=='all')&&<div style={{ position:'absolute', top:-8, left:12, zIndex:2, background:T.gold, color:'#0a0a0a', fontSize:9, fontWeight:800, padding:'3px 10px', borderRadius:20, textTransform:'uppercase' as const }}>Best match</div>}
                  <div style={{ position:'relative', height:195, overflow:'hidden' }}>
                    <img src={j.image} alt={j.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.68) 0%,transparent 52%)' }} />
                    <div style={{ position:'absolute', top:10, left:10, background:j.badgeColor, color:'#0a0a0a', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20 }}>{j.badge}</div>
                    <div style={{ position:'absolute', bottom:10, left:12, right:12 }}>
                      <div style={{ fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'#fff' }}>{j.name}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:1 }}>{j.tagline}</div>
                    </div>
                  </div>
                  <div style={{ padding:'14px 16px' }}>
{(() => {
                      const a = getCuratedAssumptions(j);
                      return (
                        <>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                            <div>
                              <div style={{ fontSize:10, color:T.textDim, marginBottom:3 }}>{a.priceNote}</div>
                              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:300, color:T.gold }}>{fmt(j.priceFrom)}</div>
                            </div>
                            <div style={{ textAlign:'right' as const }}>
                              <div style={{ fontSize:9, color:T.textDim, marginBottom:2 }}>vs direct</div>
                              <div style={{ fontSize:12, color:T.green, fontWeight:600 }}>Save {fmt(j.otaEquivalent - j.priceFrom)}</div>
                            </div>
                          </div>
                          {/* Smart inclusions */}
                          <div style={{ borderTop:`0.5px solid ${T.border}`, paddingTop:9, marginBottom:8 }}>
                            {a.inclusions.slice(0,2).map((inc: string, i: number) => (
                              <div key={i} style={{ fontSize:10, color:T.textMid, display:'flex', gap:5, marginBottom:3 }}>
                                <span style={{ color:T.green, flexShrink:0 }}>✓</span>{inc}
                              </div>
                            ))}
                            <div style={{ fontSize:10, color:'rgba(251,146,60,0.8)', display:'flex', gap:5, marginTop:4 }}>
                              <span style={{ flexShrink:0 }}>✗</span>{a.alwaysExcluded}
                            </div>
                            {a.notes[0] && (
                              <div style={{ fontSize:10, color:T.amber, display:'flex', gap:5, marginTop:3 }}>
                                <span style={{ flexShrink:0 }}>⚠</span>{a.notes[0]}
                              </div>
                            )}
                          </div>
                          <button className="btn-gold" style={{ width:'100%', padding:11, fontSize:12, letterSpacing:'0.04em' }}>
                            View & Customise →
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
{/* CURATED CUSTOMISE */}
      {screen==='curated-customise' && selectedCuratedJourney && (() => {
        const j = selectedCuratedJourney;
        const a = getCuratedAssumptions(j);
        const cities: any[] = j.cities || [];
        return (
          <div style={{ minHeight:'100vh', background:T.bg }}>
            <Nav {...navProps} />

            {/* Hero image header */}
            <div style={{ position:'relative', height:260, overflow:'hidden' }}>
              <img src={j.image || j.hero_image} alt={j.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(10,10,10,1) 0%,rgba(10,10,10,0.5) 50%,transparent 100%)' }} />
              <button onClick={()=>setScreen('curated')} style={{ position:'absolute', top:16, left:16, background:'rgba(0,0,0,0.5)', border:`0.5px solid rgba(255,255,255,0.2)`, color:'#fff', borderRadius:7, padding:'6px 14px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
              <div style={{ position:'absolute', bottom:24, left:24, right:24 }}>
                <div style={{ fontSize:9, color:T.gold, letterSpacing:'0.28em', textTransform:'uppercase' as const, marginBottom:8 }}>✦ Customise</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(26px,4vw,40px)', fontWeight:300, color:'#fff', lineHeight:1.1 }}>{j.name}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginTop:6 }}>{j.tagline}</div>
              </div>
            </div>

            <div style={{ maxWidth:620, margin:'0 auto', padding:'28px 20px 110px' }}>

              {/* Journey breakdown */}
              <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
                <div style={{ fontSize:10, color:T.gold, letterSpacing:'0.18em', textTransform:'uppercase' as const, marginBottom:12 }}>Journey breakdown</div>
                <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
                  {cities.map((city: any, i: number) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', background:T.bg3, borderRadius:8 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{city.city}</div>
                        <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>{city.country}{city.why ? ` · ${city.why.split('.')[0]}` : ''}</div>
                      </div>
                      <div style={{ fontSize:13, fontWeight:600, color:T.gold, flexShrink:0, marginLeft:12 }}>{city.nights}n</div>
                    </div>
                  ))}
                </div>
                {/* What's included */}
                <div style={{ marginTop:14, paddingTop:12, borderTop:`0.5px solid ${T.border}` }}>
                  {a.inclusions.map((inc: string, i: number) => (
                    <div key={i} style={{ fontSize:12, color:T.textMid, display:'flex', gap:7, marginBottom:5 }}>
                      <span style={{ color:T.green, flexShrink:0 }}>✓</span>{inc}
                    </div>
                  ))}
                  <div style={{ fontSize:12, color:'rgba(251,146,60,0.8)', display:'flex', gap:7, marginTop:6 }}>
                    <span style={{ flexShrink:0 }}>✗</span>International flights not included
                  </div>
                  {a.notes.map((note: string, i: number) => (
                    <div key={i} style={{ fontSize:11, color:T.amber, display:'flex', gap:7, marginTop:4 }}>
                      <span style={{ flexShrink:0 }}>⚠</span>{note}
                    </div>
                  ))}
                </div>
              </div>

              {/* When are you travelling? */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:10, color:T.textDim, letterSpacing:'0.16em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:10 }}>When are you travelling?</div>
                <DateSelector checkinDate={checkinDate} setCheckinDate={setCheckinDate} dateMode={dateMode} setDateMode={setDateMode} flexMonth={flexMonth} setFlexMonth={setFlexMonth} windowStart={windowStart} setWindowStart={setWindowStart} windowEnd={windowEnd} setWindowEnd={setWindowEnd} nights={j.nights} />
              </div>

              {/* Who's travelling */}
              <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
                <div style={{ fontSize:10, color:T.textDim, letterSpacing:'0.16em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:4 }}>Who's travelling?</div>
                <div style={{ fontSize:11, color:T.textDim, marginBottom:12 }}>
                  {a.priceNote} — adjust if different
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  {[
                    { label:'Adults', value:adults, set:setAdults, min:1 },
                    { label:'Children', value:children, set:setChildren, min:0 },
                    { label:'Infants', value:infants, set:setInfants, min:0 },
                  ].map(p => (
                    <div key={p.label}>
                      <div style={{ fontSize:9, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.12em', marginBottom:6 }}>{p.label}</div>
                      <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.04)', border:`0.5px solid ${T.border}`, borderRadius:8, overflow:'hidden', height:36 }}>
                        <button onClick={()=>p.set(Math.max(p.min,p.value-1))} style={{ width:36,height:36,border:'none',background:'transparent',color:p.value>p.min?T.text:T.textDim,fontSize:18,cursor:p.value>p.min?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>−</button>
                        <div style={{ flex:1,textAlign:'center' as const,fontSize:15,fontWeight:500,color:T.text }}>{p.value}</div>
                        <button onClick={()=>p.set(p.value+1)} style={{ width:36,height:36,border:'none',background:'transparent',color:T.text,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* International flights */}
              <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
                <div style={{ fontSize:10, color:T.textDim, letterSpacing:'0.16em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:12 }}>International flights</div>
                <div style={{ display:'flex', flexDirection:'column' as const, gap:7 }}>
                  {[
                    { val:'flexible' as const, title:'Source for me later', sub:'Your Journey Specialist finds the best fares once dates are confirmed' },
                    { val:'include'  as const, title:'Find & include now',  sub:"We'll search and add international flights to your package" },
                    { val:'own'      as const, title:"I've already booked", sub:'Share your arrival details so we can plan around your flights' },
                  ].map(opt => {
                    const isSel = flightIntent===opt.val;
                    return (
                      <button key={opt.val} onClick={()=>{ setFlightIntent(opt.val); setNeedsIntlFlight(opt.val==='include'); setIncludeIntlFlight(opt.val==='include'); }}
                        style={{ padding:'11px 14px', borderRadius:9, textAlign:'left' as const, border:`1px solid ${isSel?T.gold:T.border}`, background:isSel?T.goldDim:'transparent', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'flex-start', gap:10 }}>
                        <div style={{ width:14,height:14,borderRadius:'50%',border:`1.5px solid ${isSel?T.gold:'rgba(255,255,255,0.2)'}`,flexShrink:0,marginTop:3,display:'flex',alignItems:'center',justifyContent:'center' }}>
                          {isSel && <div style={{ width:5,height:5,borderRadius:'50%',background:T.gold }} />}
                        </div>
                        <div>
                          <div style={{ fontSize:12,fontWeight:600,color:isSel?T.gold:T.text,marginBottom:2 }}>{opt.title}</div>
                          <div style={{ fontSize:10,color:T.textDim,lineHeight:1.5 }}>{opt.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {flightIntent==='include' && (
                  <div style={{ marginTop:12,paddingTop:12,borderTop:`0.5px solid ${T.border}` }}>
                    <div style={{ fontSize:10,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.1em',fontWeight:600,marginBottom:8 }}>Flying from</div>
                    <select value={intlOrigin} onChange={e=>setIntlOrigin(e.target.value)} style={{ width:'100%',background:'rgba(255,255,255,0.04)',border:`0.5px solid ${T.border}`,color:T.text,borderRadius:8,padding:'10px 12px',fontSize:13,outline:'none',fontFamily:'inherit' }}>
                      {INTERNATIONAL_ORIGINS.map(o=><option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Disclaimer */}
              <div style={{ background:'rgba(212,175,55,0.05)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'14px 16px', marginBottom:28 }}>
                <div style={{ fontSize:10, color:T.gold, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' as const, marginBottom:8 }}>✦ Before you build</div>
                <div style={{ fontSize:12, color:T.textDim, lineHeight:1.7 }}>
                  Pricing shown is indicative and based on {a.priceNote}. <strong style={{ color:T.textMid }}>International flights are not included.</strong> All itineraries are subject to availability — your Journey Specialist confirms within 2 hours. Room upgrades, additional activities and international flights can all be added during customisation.
                </div>
                {a.notes.length > 0 && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column' as const, gap:4 }}>
                    {a.notes.map((note: string, i: number) => (
                      <div key={i} style={{ fontSize:11, color:T.amber }}>⚠ {note}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA */}
              <button className="btn-gold" style={{ width:'100%', padding:'17px 24px', fontSize:14, letterSpacing:'0.06em' }} onClick={runCuratedJourney}>
                ✦ Build &amp; Customise My Journey
              </button>
              <p style={{ textAlign:'center' as const, fontSize:11, color:T.textDim, marginTop:10 }}>
                Same pricing engine · Fully customisable · Journey Specialist assigned
              </p>
            </div>
          </div>
        );
      })()}
             
      {/* INSPIRE INPUT */}
{screen==='inspire-input' && (
  <div style={{ minHeight:'100vh', background: T.bg }}>
    <Nav {...navProps} />
    <div className="inspire-split">

      {/* ── LEFT FORM ────────────────────────────────────────────────── */}
      <div className="fade-up inspire-form" style={{ padding:'clamp(40px,6vh,72px) clamp(24px,5vw,60px) 120px' }}>

        {/* Back to home — resets state */}
        <button
          onClick={() => {
            setSelectedRegions([]); setSelectedThemes([]); setNights(7); setBudget(230000);
            setAdults(2); setChildren(0); setInfants(0); setFlightIntent(null);
            setCheckinDate(''); setDateMode('specific'); setFlexMonth('');
            setScreen('landing');
          }}
          style={{ background:'transparent', border:'none', color:'rgba(245,240,232,0.32)', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:48, letterSpacing:'0.16em', padding:0, display:'flex', alignItems:'center', gap:8 }}
        >
          ← &nbsp;Home
        </button>

        {/* Header */}
        <div style={{ marginBottom:52 }}>
          <div style={{ fontSize:9, color:T.gold, letterSpacing:'0.44em', textTransform:'uppercase' as const, fontWeight:200, marginBottom:20, display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ display:'inline-block', width:28, height:'0.5px', background:T.gold, opacity:0.5, flexShrink:0 }} />
            Plan your journey
          </div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(42px,5.5vw,62px)', fontWeight:300, marginBottom:18, color:T.text, lineHeight:0.95, letterSpacing:'-0.01em' }}>
            Tell us about<br />
            <em style={{ color:'rgba(212,175,55,0.88)', fontStyle:'italic' }}>your dream safari</em>
          </h2>
          <p style={{ fontSize:14, color:'rgba(245,240,232,0.42)', lineHeight:1.9, fontWeight:200, maxWidth:420, letterSpacing:'0.02em' }}>
            Five questions. A fully-priced, bookable itinerary built in minutes.
          </p>
        </div>

        {/* ── 1. DESTINATION ─────────────────────────────────────────── */}
        <div style={{ marginBottom:44 }}>
          <SectionLabel text="Where would you like to go?" sub="Select one or more — or let us inspire you" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {REGIONS.map(r => {
              const isActive = r.id==='inspire-me' ? selectedRegions.length===0 : selectedRegions.includes(r.id);
              return (
                <button key={r.id} onClick={()=>toggleRegion(r.id)}
                  style={{ padding:'17px 20px', borderRadius:8, border:`0.5px solid ${isActive?T.gold:'rgba(255,255,255,0.22)'}`, background:isActive?T.goldDim:'rgba(255,255,255,0.03)', color:isActive?T.gold:'rgba(245,240,232,0.92)', fontSize:isActive?16:14, fontFamily:isActive?"'Cormorant Garamond',serif":'inherit', fontWeight:isActive?400:300, fontStyle:isActive?'italic':'normal', cursor:'pointer', textAlign:'left' as const, letterSpacing:isActive?'0.02em':'0.03em', transition:'all 0.2s' }}>
                  {r.label}
                </button>
              );
            })}
          </div>
          {selectedRegions.length>1 && (
            <div style={{ marginTop:12, fontSize:12, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, padding:'8px 14px', fontWeight:300, letterSpacing:'0.04em' }}>
              ✦ &nbsp;{selectedRegions.length} regions — multi-destination journey
            </div>
          )}
        </div>

        <InputDivider />

        {/* ── 2. INTERNATIONAL FLIGHTS ───────────────────────────────── */}
        <div style={{ marginBottom:44 }}>
          <SectionLabel text="International flights" />
          <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
            {([
              { val:'include'  as const, title:'Find flights for me',  sub:"We'll search and include your international flights in the package" },
              { val:'own'      as const, title:"I've already booked",   sub:'Share your arrival details so we can plan around your schedule' },
              { val:'flexible' as const, title:'Dates still flexible', sub:'Your Journey Specialist will find the best fares once dates are confirmed' },
            ]).map(opt => {
              const isSel = flightIntent===opt.val;
              return (
                <button key={opt.val}
                  onClick={() => { setFlightIntent(opt.val); setNeedsIntlFlight(opt.val==='include'); setIncludeIntlFlight(opt.val==='include'); }}
                  style={{ padding:'15px 18px', borderRadius:10, textAlign:'left' as const, border:`0.5px solid ${isSel?T.gold:'rgba(255,255,255,0.15)'}`, background:isSel?T.goldDim:'rgba(255,255,255,0.02)', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'flex-start', gap:14, transition:'all 0.15s' }}>
                  <div style={{ width:16, height:16, borderRadius:'50%', border:`1.5px solid ${isSel?T.gold:'rgba(255,255,255,0.3)'}`, flexShrink:0, marginTop:2, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                    {isSel && <div style={{ width:6, height:6, borderRadius:'50%', background:T.gold }} />}
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:isSel?400:300, color:isSel?T.gold:T.text, marginBottom:3 }}>{opt.title}</div>
                    <div style={{ fontSize:12, color:'rgba(245,240,232,0.38)', lineHeight:1.55, fontWeight:200 }}>{opt.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {flightIntent==='include' && (
            <div style={{ marginTop:14, paddingTop:16, borderTop:'0.5px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.18em', fontWeight:300, marginBottom:8 }}>Flying from</div>
              <select value={intlOrigin} onChange={e=>setIntlOrigin(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.12)', color:T.text, borderRadius:8, padding:'12px 14px', fontSize:14, outline:'none', fontFamily:'inherit', marginBottom:14, cursor:'pointer' }}>
                {INTERNATIONAL_ORIGINS.map(o=><option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
              </select>
              <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.18em', fontWeight:300, marginBottom:10 }}>Gateway preference</div>
              <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
                {([
                  { val:'open_jaw' as const, label:'Cheapest combination', sub:'Open jaw if it saves money — e.g. LHR → JNB … CPT → LHR' },
                  { val:'return'   as const, label:'Same airport in and out', sub:'e.g. LHR → JNB → LHR' },
                ]).map(opt => (
                  <button key={opt.val} onClick={()=>setGatewayPreference(opt.val)}
                    style={{ padding:'12px 14px', borderRadius:8, textAlign:'left' as const, border:`0.5px solid ${gatewayPreference===opt.val?T.gold:'rgba(255,255,255,0.12)'}`, background:gatewayPreference===opt.val?T.goldDim:'transparent', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                    <div style={{ fontSize:13, color:gatewayPreference===opt.val?T.gold:T.text, fontWeight:400 }}>{opt.label}</div>
                    <div style={{ fontSize:11, color:T.textDim, marginTop:2, fontWeight:200 }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {flightIntent==='own' && (
            <div style={{ marginTop:14, paddingTop:16, borderTop:'0.5px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.18em', fontWeight:300, marginBottom:8 }}>Arriving into</div>
              <select value={origin} onChange={e=>setOrigin(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.12)', color:T.text, borderRadius:8, padding:'12px 14px', fontSize:14, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
                {REGIONAL_ORIGINS.map(o=><option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
              </select>
            </div>
          )}
          {flightIntent==='flexible' && (
            <div style={{ marginTop:12, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:9, padding:'12px 16px', fontSize:13, color:T.textDim, lineHeight:1.7, fontWeight:200 }}>
              Build your package now — your Journey Specialist will source the best international fares once your travel dates are confirmed.
            </div>
          )}
        </div>

        <InputDivider />

        {/* ── 3. JOURNEY THEME — multi-select ────────────────────────── */}
        <div style={{ marginBottom:44 }}>
          <SectionLabel text="Journey theme" sub="Select all that apply — we'll personalise your recommendations" />
          <div style={{ display:'flex', flexWrap:'wrap' as const, gap:8 }}>
            {([
              { id:'honeymoon',   label:'Honeymoon'    },
              { id:'anniversary', label:'Anniversary'  },
              { id:'family',      label:'Family'       },
              { id:'adventure',   label:'Adventure'    },
              { id:'bucket-list', label:'Bucket List'  },
              { id:'returning',   label:'Return Visit' },
            ] as {id:string;label:string}[]).map(t => {
              const active = selectedThemes.includes(t.id);
              return (
                <button key={t.id} onClick={()=>toggleTheme(t.id)}
                  style={{ padding:'10px 20px', borderRadius:2, border:`0.5px solid ${active?T.gold:'rgba(255,255,255,0.18)'}`, background:active?T.goldDim:'transparent', color:active?T.gold:'rgba(245,240,232,0.75)', fontSize:12, fontWeight:300, cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.1em', textTransform:'uppercase' as const, transition:'all 0.15s' }}>
                  {active && <span style={{ marginRight:5, fontSize:10 }}>✦</span>}
                  {t.label}
                </button>
              );
            })}
          </div>
          {selectedThemes.length > 1 && (
            <div style={{ marginTop:10, fontSize:11, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, padding:'6px 12px', fontWeight:300 }}>
              {selectedThemes.length} themes selected — your itinerary will reflect all of them
            </div>
          )}
        </div>

        <InputDivider />

        {/* ── 4. TRAVELLERS ──────────────────────────────────────────── */}
        <div style={{ marginBottom:44 }}>
          <SectionLabel text="Who's travelling?" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
            {([
              { label:'Adults',   sub:'\u00a0',    value:adults,   set:setAdults,   min:1 },
              { label:'Children', sub:'Ages 2–17', value:children, set:setChildren, min:0 },
              { label:'Infants',  sub:'Under 2',   value:infants,  set:setInfants,  min:0 },
            ]).map(p => (
              <div key={p.label}>
                <div style={{ fontSize:10, fontWeight:300, letterSpacing:'0.22em', color:'rgba(245,240,232,0.5)', textTransform:'uppercase' as const, marginBottom:2 }}>{p.label}</div>
                <div style={{ fontSize:10, color:'rgba(245,240,232,0.3)', marginBottom:10, minHeight:14, fontWeight:200 }}>{p.sub}</div>
                <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:8, overflow:'hidden', height:52 }}>
                  <button onClick={()=>p.set(Math.max(p.min,p.value-1))} style={{ width:44, height:52, border:'none', background:'transparent', color:p.value>p.min?T.text:'rgba(255,255,255,0.15)', fontSize:20, cursor:p.value>p.min?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>−</button>
                  <div style={{ flex:1, textAlign:'center' as const, fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:300, color:T.text }}>{p.value}</div>
                  <button onClick={()=>p.set(p.value+1)} style={{ width:44, height:52, border:'none', background:'transparent', color:T.text, fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>+</button>
                </div>
              </div>
            ))}
          </div>
          {infants>0 && (
            <div style={{ marginTop:14, background:'rgba(251,191,36,0.05)', border:'0.5px solid rgba(251,191,36,0.18)', borderRadius:8, padding:'10px 14px', fontSize:13, color:T.amber, lineHeight:1.65, fontWeight:200 }}>
              Some camps restrict under-5s on open game drives — we'll flag this and suggest malaria-free alternatives.
            </div>
          )}
        </div>

        <InputDivider />

        {/* ── 5. DATES ───────────────────────────────────────────────── */}
        <div style={{ marginBottom:44 }}>
          <SectionLabel text="When are you travelling?" sub="Set both dates and nights updates automatically" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:300, letterSpacing:'0.18em', color:'rgba(245,240,232,0.5)', textTransform:'uppercase', marginBottom:6 }}>Arrival date</div>
              <input type="date" value={checkinDate} onChange={e => {
                setCheckinDate(e.target.value);
                // Auto-calculate nights if checkout also set
                if (windowEnd && e.target.value) {
                  const d1 = new Date(e.target.value);
                  const d2 = new Date(windowEnd);
                  const diff = Math.round((d2.getTime()-d1.getTime())/(1000*60*60*24));
                  if (diff > 0 && diff <= 30) setNights(diff);
                }
              }} style={{ width:'100%', background:'rgba(255,255,255,0.03)', border:`0.5px solid ${checkinDate?T.gold:'rgba(255,255,255,0.15)'}`, color:T.text, borderRadius:8, padding:'12px 14px', fontSize:14, outline:'none', fontFamily:'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:300, letterSpacing:'0.18em', color:'rgba(245,240,232,0.5)', textTransform:'uppercase', marginBottom:6 }}>Departure date</div>
              <input type="date" value={windowEnd} min={checkinDate || undefined} onChange={e => {
                setWindowEnd(e.target.value);
                // Auto-calculate nights
                if (checkinDate && e.target.value) {
                  const d1 = new Date(checkinDate);
                  const d2 = new Date(e.target.value);
                  const diff = Math.round((d2.getTime()-d1.getTime())/(1000*60*60*24));
                  if (diff > 0 && diff <= 30) setNights(diff);
                }
              }} style={{ width:'100%', background:'rgba(255,255,255,0.03)', border:`0.5px solid ${windowEnd?T.gold:'rgba(255,255,255,0.15)'}`, color:T.text, borderRadius:8, padding:'12px 14px', fontSize:14, outline:'none', fontFamily:'inherit' }} />
            </div>
          </div>
          {checkinDate && windowEnd && (() => {
            const d1 = new Date(checkinDate);
            const d2 = new Date(windowEnd);
            const diff = Math.round((d2.getTime()-d1.getTime())/(1000*60*60*24));
            return diff > 0 ? (
              <div style={{ fontSize:12, color:T.gold, fontWeight:400, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, padding:'8px 14px' }}>
                ✦ {diff} night{diff!==1?'s':''} — {checkinDate} to {windowEnd}
              </div>
            ) : null;
          })()}
          {!checkinDate && (
            <div style={{ fontSize:11, color:'rgba(245,240,232,0.32)', fontWeight:200 }}>
              Dates not required — your specialist can work with a flexible window
            </div>
          )}
        </div>

        <InputDivider />

        {/* ── 6. TRIP LENGTH — hidden when dates calculate it automatically ── */}
        {!checkinDate && (
        <div style={{ marginBottom:44 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:18 }}>
            <SectionLabel text="Trip length" sub="Or set arrival &amp; departure dates above" noMargin />
            <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30, fontWeight:300, color:T.text }}>{nights} <span style={{ fontSize:15, color:T.textDim }}>nights</span></span>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
            {[5,7,10,12,14,21].map(n => (
              <button key={n} onClick={()=>setNights(n)}
                style={{ padding:'11px 24px', borderRadius:8, border:`0.5px solid ${nights===n?T.gold:'rgba(255,255,255,0.18)'}`, background:nights===n?T.goldDim:'transparent', color:nights===n?T.gold:'rgba(245,240,232,0.75)', fontSize:14, fontWeight:300, cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.04em', transition:'all 0.15s' }}>
                {n}n
              </button>
            ))}
          </div>
        </div>
        )}

        <InputDivider />

        {/* ── 7. BUDGET ──────────────────────────────────────────────── */}
        <div style={{ marginBottom:52 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:6 }}>
            <SectionLabel text="Total budget" noMargin />
            <div style={{ textAlign:'right' as const }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:38, fontWeight:300, color:T.gold, lineHeight:1 }}>{fmt(budget)}</div>
              {adults>0 && <div style={{ fontSize:11, color:'rgba(245,240,232,0.28)', marginTop:4, fontWeight:200, letterSpacing:'0.06em' }}>approx {fmt(Math.round(budget/adults))} per person</div>}
            </div>
          </div>
          <div style={{ paddingTop:18 }}>
            <input type="range" className="budget-range" min={20000} max={2000000} step={10000} value={budget} onChange={e=>setBudget(+e.target.value)} style={{ width:'100%' }} />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
              <span style={{ fontSize:11, color:'rgba(245,240,232,0.25)', fontWeight:200 }}>{fmt(20000)}</span>
              <span style={{ fontSize:11, color:'rgba(245,240,232,0.25)', fontWeight:200 }}>{fmt(2000000)}</span>
            </div>
          </div>
          <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.08)', borderRadius:8, fontSize:11, color:'rgba(245,240,232,0.32)', lineHeight:1.65, fontWeight:200 }}>
            * Budget covers lodges, domestic flights, transfers and activities. International flight costs are calculated separately in the next step.
          </div>
        </div>

        {/* ── DEPARTURE AIRPORT ─────────────────────────────────────── */}
        <div style={{ marginBottom:44 }}>
          <SectionLabel text="Flying home from?" sub="We'll arrange your final lodge-to-airport transfer to match" />
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { code:'JNB', label:'Johannesburg (O.R. Tambo)', note:'Main hub — most international routes via JNB' },
              { code:'CPT', label:'Cape Town', note:'Direct flights to London, Amsterdam, Frankfurt & New York' },
              { code:'', label:"Not sure yet", note:'Your specialist will confirm based on your final routing' },
            ].map(opt => {
              const isSel = departureHubId === opt.code;
              return (
                <button key={opt.code || 'tbd'} onClick={() => setDepartureHubId(opt.code)}
                  style={{ padding:'13px 16px', borderRadius:8, textAlign:'left' as const, border:`0.5px solid ${isSel?T.gold:'rgba(255,255,255,0.15)'}`, background:isSel?T.goldDim:'rgba(255,255,255,0.02)', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:isSel?400:300, color:isSel?T.gold:T.text }}>{opt.label}</div>
                    <div style={{ fontSize:12, color:'rgba(245,240,232,0.38)', lineHeight:1.5, fontWeight:200, marginTop:2 }}>{opt.note}</div>
                  </div>
                  {isSel && <span style={{ fontSize:12, color:T.gold, flexShrink:0 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <InputDivider />

        {/* ── BUILD BUTTON ───────────────────────────────────────────── */}
        <button className="btn-gold" style={{ width:'100%', padding:'18px 24px', fontSize:15, letterSpacing:'0.1em', borderRadius:4 }} onClick={runSocraticPlanner}>
          ✦ &nbsp; Build My Itinerary
        </button>
        <p style={{ textAlign:'center' as const, fontSize:12, color:'rgba(245,240,232,0.2)', marginTop:12, letterSpacing:'0.08em', fontWeight:200 }}>
          Itinerary built in minutes · Fully priced · No commitment
        </p>

      </div>{/* end inspire-form */}

      {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
      <div className="inspire-panel">
        <div style={{ position:'relative', width:'100%', height:'100%', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, opacity:panelFade?1:0, transition:'opacity 0.4s ease' }}>
            {selectedRegions.length<=1 ? (()=>{
              const slug    = selectedRegions.length===1?(REGIONS.find(r=>r.id===selectedRegions[0])?.slug??''):'';
              const videoSrc = regionVideoMap[slug];
              const imgSrc   = regionImageMap[slug]||REGION_DEFAULT_IMAGE;
              return videoSrc?(
                <video key={videoSrc} src={videoSrc} autoPlay muted loop playsInline style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
              ):(
                <div style={{ position:'absolute', inset:0, backgroundImage:`url(${imgSrc})`, backgroundSize:'cover', backgroundPosition:'center' }} />
              );
            })():(
              selectedRegions.map((id,idx)=>{
                const slug = REGIONS.find(r=>r.id===id)?.slug??'';
                const img  = regionImageMap[slug]||REGION_DEFAULT_IMAGE;
                const pct  = 100/selectedRegions.length;
                return (
                  <div key={id} style={{ position:'absolute', left:0, right:0, top:`${idx*pct}%`, height:`${pct}%`, overflow:'hidden' }}>
                    {regionVideoMap[slug]?(
                      <video key={regionVideoMap[slug]} src={regionVideoMap[slug]} autoPlay muted loop playsInline style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', transform:'scale(1.05)' }} />
                    ):(
                      <div style={{ position:'absolute', inset:0, backgroundImage:`url(${img})`, backgroundSize:'cover', backgroundPosition:'center', transform:'scale(1.05)' }} />
                    )}
                    <div style={{ position:'absolute', top:'50%', left:24, transform:'translateY(-50%)', fontSize:9, fontWeight:300, letterSpacing:'0.32em', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', textShadow:'0 1px 8px rgba(0,0,0,0.9)', zIndex:2 }}>
                      {REGIONS.find(r=>r.id===id)?.label}
                    </div>
                    {idx>0 && <div style={{ position:'absolute', top:0, left:0, right:0, height:'1px', background:'rgba(8,8,4,0.9)', zIndex:3 }} />}
                  </div>
                );
              })
            )}
          </div>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right,rgba(10,10,6,0.45) 0%,transparent 40%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(10,10,6,0.95) 0%,rgba(10,10,6,0.1) 40%,transparent 65%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'28px 28px 40px', zIndex:4 }}>
            {selectedRegions.length===0 && (
              <>
                <div style={{ fontSize:9, color:'rgba(212,175,55,0.45)', letterSpacing:'0.36em', textTransform:'uppercase', marginBottom:12, fontWeight:200 }}>Southern Africa</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:300, fontStyle:'italic', color:'rgba(245,240,232,0.55)', lineHeight:1.2 }}>Select a destination<br />to begin your journey</div>
              </>
            )}
            {selectedRegions.length===1&&(()=>{
              const slug=REGIONS.find(r=>r.id===selectedRegions[0])?.slug??'';
              const reg=REGIONS.find(r=>r.id===selectedRegions[0]);
              return (<>
                <div style={{ fontSize:9, color:'rgba(212,175,55,0.55)', letterSpacing:'0.36em', textTransform:'uppercase', marginBottom:10, fontWeight:200 }}>Selected destination</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:300, color:'rgba(245,240,232,0.95)', marginBottom:10, lineHeight:1.1 }}>{reg?.label}</div>
                {REGION_WHY[slug]&&<div style={{ fontSize:13, color:'rgba(245,240,232,0.42)', lineHeight:1.75, maxWidth:280, fontWeight:200 }}>{REGION_WHY[slug]}</div>}
              </>);
            })()}
            {selectedRegions.length>1&&(
              <>
                <div style={{ fontSize:9, color:'rgba(212,175,55,0.55)', letterSpacing:'0.36em', textTransform:'uppercase', marginBottom:10, fontWeight:200 }}>{selectedRegions.length}-destination journey</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:300, color:'rgba(245,240,232,0.88)', marginBottom:10, lineHeight:1.2 }}>
                  {selectedRegions.map(id=>REGIONS.find(r=>r.id===id)?.label).filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize:12, color:'rgba(245,240,232,0.35)', fontWeight:200 }}>
                  {selectedRegions.reduce((sum,id)=>{ const s=REGIONS.find(r=>r.id===id)?.slug??''; return sum+({'kruger-sabi-sand':3,'okavango-delta':3,'cape-town':3,'madikwe':2,'chobe-vic-falls':2} as Record<string,number>)[s]||2; },0)}+ recommended nights
                </div>
              </>
            )}
          </div>
        </div>
      </div>{/* end inspire-panel */}

    </div>{/* end inspire-split */}
  </div>
)}
      {/* INSPIRE RESEARCH */}
{screen === 'inspire-research' && (
  <SafariCinematicResearch
    answers={{
      experience:   adults === 1 ? 'first' : 'returning',
      regions:      selectedRegions,
      nights,
      travellers:   adults === 1 ? 'solo' : adults === 2 ? 'couple' : `group of ${adults}`,
      budget:       fmt(budget),
      budgetRaw:    budget,
      adults,
      children,
      infants,
      occasion:     selectedThemes[0] || '',
      origin:       needsIntlFlight ? intlOrigin : origin,
      checkinDate,
      flexMonth,
    }}
    aiReady={itinerary !== null}
    onComplete={() => setScreen('builder')}
  />
)}

      {/* BUILDER */}
      {screen==='builder' && itinerary && (
        <div style={{ minHeight:'100vh', background:'#121014', paddingBottom:120, position:'relative' }}>
          {/* ─── Fixed region background — cross-fades as traveller scrolls ─── */}
          <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
            {/* Previous region — fades out */}
            {prevBgSlug && REGION_BG_IMAGES[prevBgSlug] && (
              <div style={{
                position:'absolute', inset:0,
                backgroundImage:`url(${REGION_BG_IMAGES[prevBgSlug]})`,
                backgroundSize:'cover', backgroundPosition:'center',
                opacity: bgTransition ? 0 : 0.07,
                transition:'opacity 1.8s ease',
                filter:'saturate(0.5) contrast(0.85)',
              }}/>
            )}
            {/* Active region — fades in */}
            {activeBgSlug && REGION_BG_IMAGES[activeBgSlug] && (
              <div style={{
                position:'absolute', inset:0,
                backgroundImage:`url(${REGION_BG_IMAGES[activeBgSlug]})`,
                backgroundSize:'cover', backgroundPosition:'center',
                opacity: bgTransition ? 0.13 : 0,
                transition:'opacity 1.8s ease',
                filter:'saturate(0.5) contrast(0.85)',
              }}/>
            )}
            {/* Very light vignette */}
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(18,16,20,0.35) 0%, rgba(18,16,20,0.05) 20%, rgba(18,16,20,0.05) 80%, rgba(18,16,20,0.5) 100%)' }}/>
          </div>
          <div style={{ position:'relative', zIndex:1 }}>
          <Nav {...navProps} />

          <div style={{ maxWidth:1280, margin:'0 auto', padding:'20px 20px 0' }}>
            <div style={{ background:T.surface, border:`0.5px solid ${T.borderGold}`, borderRadius:14, padding:'14px 18px', marginBottom:24, maxWidth:680, margin:'0 auto 24px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:700, marginBottom:4 }}>✦ Your Journey</div>
                  <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif" }}>{itinerary.title}</div>
                  <div style={{ fontSize:12, color:T.textDim, marginTop:4 }}>{
                    itinerary.routing?.replace(/^JNB\s*→\s*/,'').replace(/\s*→\s*JNB$/,'') ?? itinerary.routing
                  }</div>
                </div>
                <div style={{ textAlign:'right' as const }}>
                  <div style={{ fontSize:11, color:T.textDim, marginBottom:2 }}>{itinerary.cities.reduce((s,c)=>s+c.nights,0)} nights · {selectedFlightOffer ? 'incl. flights' : 'excl. flights'}</div>
                  <div style={{ fontSize:22, fontWeight:700, color:T.gold, fontFamily:"'Cormorant Garamond',serif" }}>{fmt(grandTotal || itinerary.totalEstimate)}</div>
                </div>
              </div>

              <div style={{ marginTop:12, paddingTop:12, borderTop:`0.5px solid ${T.border}`, display:'flex', alignItems:'center', gap:12 }}>
                <img src={specialist.avatar} alt={specialist.name} style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', border:`1.5px solid ${T.borderGold}`, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:T.gold, fontWeight:600 }}>{specialist.name}</div>
                  <div style={{ fontSize:10, color:T.textDim }}>{specialist.role} · Available now</div>
                  <div style={{ fontSize:11, color:T.textMid, marginTop:2, fontStyle:'italic' }}>"{specialist.tip}"</div>
                </div>
                <button onClick={() => setChatOpen(true)} style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, color:T.gold, borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const, flexShrink:0 }}>Chat →</button>
              </div>

              <div style={{ marginTop:12, paddingTop:12, borderTop:`0.5px solid ${T.border}` }}>
                <button onClick={()=>setAdjustOpen(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, color:T.textDim, fontSize:12 }}>
                  <span>{adjustOpen?'▲':'▼'}</span> Adjust itinerary via chat
                </button>
                {adjustOpen && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                      {['Make it cheaper','Add a beach stop','Fewer destinations','Best time to go?','What visas do I need?'].map(q=>(
                        <button key={q} onClick={()=>{ setAdjustInput(q); setTimeout(()=>document.getElementById('adjust-send')?.click(),50); }} style={{ fontSize:11, padding:'4px 10px', borderRadius:20, border:`0.5px solid ${T.border}`, background:'rgba(255,255,255,0.04)', color:T.textMid, cursor:'pointer', fontFamily:'inherit' }}>{q}</button>
                      ))}
                    </div>
                    <div style={{ maxHeight:160, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                      {adjustMsgs.map((m:any,i:number)=>(
                        <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
                          <div style={{ maxWidth:'90%', padding:'8px 12px', borderRadius:10, background:m.role==='user'?'rgba(212,175,55,0.1)':T.surface, border:`0.5px solid ${m.role==='user'?T.borderGold:T.border}`, fontSize:13, color:T.text, lineHeight:1.6 }}>{m.text}</div>
                        </div>
                      ))}
                      {adjustLoading&&<div style={{ fontSize:12, color:T.textDim, padding:'4px 8px' }}>…</div>}
                      <div ref={adjustEndRef} />
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <input value={adjustInput} onChange={e=>setAdjustInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendAdjust()} placeholder="e.g. Swap Sabi Sand for Okavango..." style={{ flex:1, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.text, borderRadius:9, padding:'8px 12px', fontSize:13, outline:'none', fontFamily:'inherit' }} />
                      <button id="adjust-send" onClick={sendAdjust} className="btn-gold" style={{ padding:'8px 14px', fontSize:13 }}>→</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* [V7-1] International flights — top of builder */}
            {(flightIntent === 'include' || flightIntent === 'own' || flightIntent === 'flexible') && (
              <div style={{ marginBottom:24, background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:14, padding:'16px 18px' }}>
                <FlightSelector
                  flightIntent={flightIntent}
                  originIata={intlOrigin}
                  gatewayPreference={gatewayPreference}
                  preferredArrivalGateway={flightArrivalGateway}
                  preferredDepartureGateway={flightDepartureGateway}
                  travelDates={{ start: checkinDate, end: checkinDate ? new Date(new Date(checkinDate).getTime() + nights * 86400000).toISOString().split('T')[0] : '' }}
                  passengers={adults + children}
                  routeReversalResult={routeReversalResult}
                  onFlightSelected={(result:any) => {
                    setSelectedFlightOffer(result.offer);
                    setFlightAncillaryTotal(result.ancillary_total || 0);
                    setFlightArrivalGateway(result.arrival_gateway);
                    setFlightDepartureGateway(result.departure_gateway);
                    if (result.open_jaw_used) setGatewayPreference('open_jaw');
                  }}
                  onOwnFlightDetails={(details:any) => {
                    setOwnFlightDetails(details);
                    setArrivalAirport(details.arrivalAirport || details.arrivalGateway || 'JNB');
                    setArrivalTime(details.arrivalTime || details.arrivalDate || '');
                    // Set checkin date from arrival if not already set
                    if (!checkinDate && details.arrivalDate) setCheckinDate(details.arrivalDate);
                  }}
                  onDismissFlights={() => {
                    // Traveller chose "I'll book my own flights" — clear the selected
                    // Duffel offer (drops it from the package total) and switch the
                    // panel to the arrival-details form.
                    setSelectedFlightOffer(null);
                    setFlightAncillaryTotal(0);
                    setFlightIntent('own');
                    setIncludeIntlFlight(false);
                    setNeedsIntlFlight(false);
                  }}
                  onAcceptRouteReversal={(reversedOrder:string[]) => {
                    if (!itinerary) return;
                    const reversedCities = reversedOrder.map(cityName => itinerary.cities.find(c => c.city === cityName)).filter(Boolean) as ItineraryCity[];
                    setItinerary({ ...itinerary, cities: reversedCities });
                    setCityStays([...cityStays].reverse());
                  }}
                  currency={currency}
                  fmt={fmt}
                />
              </div>
            )}

            {/* Per-destination sections */}
            {itinerary.cities.map((city, cityIdx) => {
              const cityName = city.city.toLowerCase().trim();
              const slug = CITY_TO_SLUG[cityName] ?? '';
              const destLabel = city.city;
              const pool = slug
                ? hotelsByMargin.filter(h => h.subRegion === slug)
                : hotelsByMargin.filter(h => {
                    const dest = (h.destination ?? '').toLowerCase();
                    const name = (h.name ?? '').toLowerCase();
                    return dest.includes(cityName) || cityName.includes(dest.split(',')[0].trim()) || name.includes(cityName);
                  });
              const safePool = pool.length > 0
                ? pool.slice(0, 12)
                : hotelsByMargin.filter(h => (h.country ?? '') === (itinerary.cities[cityIdx]?.country ?? '')).slice(0, 3);
              const currentStay = cityStays[cityIdx] ?? { hotelId:safePool[0]?.id??0, nights:city.nights, prefs:{ rooms:0, basis:0, flexibility:0 } };

              const isCityAlways = CITY_TYPE_ALWAYS.has(slug);
              const isCityKB     = CITY_TYPE_KB.has(slug) && kbEntries.some(e => e.active && e.type === 'city_transfer' && (e.linkedTo ?? '').toLowerCase().includes(slug.replace(/-/g,' ')));
              const isCityDest   = isCityAlways || isCityKB;
              const cityXferOpts = isCityDest ? (CITY_TRANSFERS[slug] ?? []) : [];
              const selCityXferId = cityTransferIds[slug];

              // KB data for this region
              const regionKBAll = kbEntries.filter((e:any) =>
                (e.status === 'active' || e.active === true) &&
                (e.region_slug === slug || (e.linkedTo ?? '').toLowerCase().includes(slug.replace(/-/g,' '))) &&
                e.claim_type !== 'commercial'
              );
              // Support both new schema (entry_type/highlights) and old (type/structuredFields)
              const regionEntry = regionKBAll.find((e:any) =>
                e.entry_type === 'region' || e.type === 'regional'
              );
              const kbHighlights: string[] = (() => {
                if (!regionEntry) return [];
                if (Array.isArray(regionEntry.highlights) && regionEntry.highlights.length > 0)
                  return regionEntry.highlights;
                // Fallback: pull traveller-safe fields from structuredFields
                const sf = regionEntry.structuredFields ?? regionEntry.structured_fields ?? {};
                const safeKeys = ['why_visit','best_sightings','best_season','ideal_nights'];
                return safeKeys.map(k => sf[k]).filter((v:any) => typeof v === 'string' && v.length > 10) as string[];
              })();
              const kbTips: string[] = Array.isArray(regionEntry?.tips) ? regionEntry.tips : [];
              const seasonalNote: string | undefined = (() => {
                if (!checkinDate || !regionEntry?.seasonal_notes) return undefined;
                const m = new Date(checkinDate).toLocaleString('en',{month:'short'}).toLowerCase();
                return (regionEntry.seasonal_notes as any)[m] ?? undefined;
              })();
              const regionFindings = skeletonFindings.filter((f:any) =>
                f.severity !== 'confirmed'
              ).slice(0, 4);
              const selectedHotel = safePool.find((h:any) => String(h.id) === String(currentStay.hotelId));
              const selectedIncludes: string[] = (selectedHotel as any)?.rate_includes ?? [];
              const hotelMalariaFree = selectedHotel?.malariaFree ?? false;
              // Right sidebar: traveller-facing regional tip only (no specialist_recs)
              const specialistNote: string | undefined = (() => {
                const tip = kbTips[0];
                if (tip) return undefined; // don't duplicate if already in tips
                const fact = regionEntry?.structuredFields?.why_visit
                  ?? regionEntry?.structured_fields?.why_visit;
                return fact ? String(fact) : undefined;
              })();

              return (
                <RegionChapter
                  key={cityIdx}
                  chapterIndex={cityIdx}
                  totalChapters={itinerary.cities.length}
                  regionSlug={slug}
                  regionLabel={destLabel}
                  countryLabel={city.country}
                  nights={currentStay.nights}
                  checkinDate={checkinDate}
                  bgImageUrl={regionImageMap[slug]}
                  onRegionVisible={(s: string) => {
                    if (s !== activeBgSlug) {
                      setPrevBgSlug(activeBgSlug);
                      setBgTransition(false);
                      setActiveBgSlug(s);
                      requestAnimationFrame(() => requestAnimationFrame(() => setBgTransition(true)));
                    }
                  }}
                  kbHighlights={kbHighlights}
                  kbTips={kbTips}
                  skeletonFindings={regionFindings}
                  selectedHotelName={selectedHotel?.name}
                  selectedHotelIncludes={[]}
                  malariaFree={hotelMalariaFree}
                  seasonalNote={seasonalNote}
                  specialistNote={specialistNote}
                >
                  {/* [V6-3] Auto airport transfer for Cape Town & Vic Falls */}
                  {isCityDest && cityXferOpts.length > 0 && (
                    <CityTransferStrip slug={slug} destLabel={destLabel} opts={cityXferOpts} selectedId={selCityXferId} onSelect={id => setCityTransferIds(prev => ({ ...prev, [slug]: id }))} fmt={fmt} />
                  )}

                  <NestedPropertyCarousel
                    destinationLabel={destLabel}
                    destinationSlug={slug}
                    cityNights={currentStay.nights}
                    onNightsChange={delta => {
                      setCityStays(prev => prev.map((s,i) => i===cityIdx ? { ...s, nights:Math.max(1, s.nights+delta) } : s));
                    }}
                    hotels={safePool}
                    selectedHotelId={currentStay.hotelId}
                    onSelectHotel={hotel => {
                      setCityStays(prev => { const next = [...prev]; next[cityIdx] = { ...currentStay, hotelId:hotel.id }; return next; });
                    }}
                    stayPrefs={currentStay.prefs}
                    onUpgradeSelect={(key, opt) => {
                      setCityStays(prev => { const next = [...prev]; next[cityIdx] = { ...currentStay, prefs:{ ...currentStay.prefs, [key]:opt.tier ?? 0 } }; return next; });
                    }}
                    kbEntries={kbEntries}
                    fmt={fmt}
                    edition={edition}
                    onEscalateChat={escalateToSpecialist}
                    onExploreLodge={(hotel, supplierId, includes) => {
                      setMiniSiteHotel(hotel);
                      setMiniSiteSupplier(supplierId);
                      setMiniSiteIncludes(includes ?? []);
                    }}
                  />

                  {/* [V6-3] ACTIVITY SPOOL */}
                  <ActivitySpool
                    regionSlug={slug}
                    selectedIds={selectedActivities[slug] ?? []}
                    onToggle={id => setSelectedActivities(prev => {
                      const cur = prev[slug] ?? [];
                      const next = cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id];
                      return { ...prev, [slug]: next };
                    })}
                    fmt={fmt}
                    activities={activities}
                  />

                  {cityIdx < itinerary.cities.length-1 && (() => {
                    const nextCity = itinerary.cities[cityIdx+1];
                    const fromSlug = slug;
                    const toSlug = CITY_TO_SLUG[nextCity.city.toLowerCase().trim()] ?? '';
                    if (!fromSlug||!toSlug) return null;
                    const legKey = `${fromSlug}→${toSlug}`;
                    const nextStay = cityStays[cityIdx+1];
                    const nextPool = toSlug ? hotelsByMargin.filter(h => h.subRegion === toSlug) : hotelsByMargin;
                    const destHotel = nextPool.find(h => String(h.id) === String(nextStay?.hotelId)) ?? nextPool[0];
                    const thisStay = cityStays[cityIdx];
                    const thisPool = fromSlug ? hotelsByMargin.filter(h => h.subRegion === fromSlug) : hotelsByMargin;
                    const originHotel = thisPool.find(h => String(h.id) === String(thisStay?.hotelId)) ?? thisPool[0];
                    const usdRate = CURRENCIES.find(c => c.code === 'USD')?.rate ?? 18.62;
                    return (
                      <TransferCarousel key={legKey} fromSlug={fromSlug} toSlug={toSlug} fromLabel={itinerary.cities[cityIdx].city} toLabel={nextCity.city} fmt={fmt} kbEntries={kbEntries} selectedTransferId={selectedTransferIds[legKey] ?? null} onSelect={id => setSelectedTransferIds(prev => ({ ...prev, [legKey]: id }))} destLodge={destHotel?.name} pax={Math.max(adults + children, 1)} usdToZar={usdRate} commercialFares={transferFares} commercialMeta={transferMeta} originLodge={originHotel?.name} />
                    );
                  })()}
                </RegionChapter>
              );
            })}
             {/* PropertyMiniSite overlay — launched from Explore button */}
            {miniSiteHotel && (
              <PropertyMiniSite
                hotel={miniSiteHotel}
                supplierId={miniSiteSupplier}
                kbEntries={kbEntries}
                includes={miniSiteIncludes}
                onSelectRoom={(extra, label) => {
                  // Find the city index for this hotel and update prefs
                  const cityIdx = cityStays.findIndex(s => String(s.hotelId) === String(miniSiteHotel?.id));
                  if (cityIdx >= 0) {
                    const roomTier = miniSiteHotel?.upgrades?.rooms?.findIndex((r:any) => r.label === label) ?? 0;
                    setCityStays(prev => {
                      const next = [...prev];
                      next[cityIdx] = { ...next[cityIdx], prefs:{ ...next[cityIdx].prefs, rooms: roomTier >= 0 ? roomTier : 0 } };
                      return next;
                    });
                  }
                }}
                onClose={() => { setMiniSiteHotel(null); setMiniSiteSupplier(undefined); setMiniSiteIncludes([]); }}
              />
            )}      

            {itinerary.cities.length > 0 && (() => {
              const lastCity = itinerary.cities[itinerary.cities.length - 1];
              const lastSlug = CITY_TO_SLUG[lastCity?.city?.toLowerCase().trim() ?? ''] ?? '';
              return (
                <DepartureCard lastCity={lastCity} lastSlug={lastSlug} includeIntlFlight={includeIntlFlight} fmt={fmt} kbEntries={kbEntries} departureHubId={departureHubId} setDepartureHubId={setDepartureHubId} showDepartureXfer={showDepartureXfer} setShowDepartureXfer={setShowDepartureXfer} flightSelected={!!selectedFlightOffer} departureGateway={flightDepartureGateway} />
              );
            })()}

            {filterWarnings(itinerary.warnings??[]).length>0 && (
              <div style={{ background:'rgba(251,146,60,0.07)', border:'0.5px solid rgba(251,146,60,0.22)', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
                {filterWarnings(itinerary.warnings??[]).map((w:string,i:number)=><div key={i} style={{ fontSize:12, color:'rgba(251,146,60,0.9)', lineHeight:1.55 }}>⚠ {w}</div>)}
              </div>
            )}
            {infants>0&&<div style={{ background:'rgba(251,191,36,0.07)', border:'0.5px solid rgba(251,191,36,0.2)', borderRadius:12, padding:'12px 16px', marginBottom:16, fontSize:12, color:T.amber }}>⚠ {infants} infant{infants>1?'s':''} on this trip. Journey Specialist will confirm age policies with each property.</div>}
          </div>

          {/* Sticky bottom price bar */}
          <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:90, background:'rgba(10,10,10,0.97)', backdropFilter:'blur(20px)', borderTop:`0.5px solid ${T.borderGold}`, padding:'8px 16px' }}>
            {routeReversalResult?.is_cheaper && !routeReversalDismissed && (
              <div style={{ maxWidth:680, margin:'0 auto 10px', padding:'9px 12px', background:'rgba(74,222,128,0.06)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:8, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:14 }}>🔄</span>
                <div style={{ flex:1, fontSize:11, color:T.green }}>Tip: Reversing your route saves {fmt(routeReversalResult.saving)} on transfers</div>
                <button onClick={() => { setRouteReversalDismissed(true); if (itinerary) { const reversed = [...itinerary.cities].reverse(); setItinerary({ ...itinerary, cities: reversed }); setCityStays([...cityStays].reverse()); } }} style={{ fontSize:10, color:T.green, background:'rgba(74,222,128,0.12)', border:'0.5px solid rgba(74,222,128,0.3)', borderRadius:5, padding:'4px 9px', cursor:'pointer', fontFamily:'inherit', fontWeight:600, flexShrink:0 }}>Apply</button>
                <button onClick={() => setRouteReversalDismissed(true)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>×</button>
              </div>
            )}
            {selectedFlightOffer && (
              <div style={{ maxWidth:680, margin:'0 auto 6px', fontSize:11, color:T.textDim, display:'flex', justifyContent:'space-between' }}>
                <span>✈ Flights included ({adults + children} pax) · paid in full at booking</span>
                <span style={{ color:T.gold }}>{fmt((selectedFlightOffer.display_price * (adults + children) + flightAncillaryTotal) * (currency.rate || 18.62))}</span>
              </div>
            )}
            <div style={{ maxWidth:680, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div>
                <div style={{ fontSize:11, color:T.textDim, marginBottom:2 }}>Package total · {itinerary.cities.reduce((s,c)=>s+c.nights,0)} nights</div>
                <div style={{ fontSize:24, fontWeight:700, color:T.gold, fontFamily:"'Cormorant Garamond',serif", lineHeight:1 }}>{fmt(grandTotal)}</div>

              </div>
              <button className="btn-gold" style={{ padding:'14px 28px', fontSize:15, flexShrink:0 }} onClick={handleValidateAndPay} disabled={checkoutLoading}>
                {checkoutLoading ? 'Saving…' : (                   <span style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>                     <span>Validate & Firm up my choices →</span>                     <span style={{ fontSize:10, fontWeight:400, opacity:0.7, letterSpacing:'0.05em' }}>Price the journey</span>                   </span>                 )}
              </button>
            </div>
          </div>

          {chatOpen && <ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={()=>setChatOpen(false)} edition={edition} />}
          </div>{/* end position:relative z-index:1 */}
        </div>
      )}

{/* JOURNEY CONFIRMATION */}
      {screen==='confirming' && itinerary && (
        <JourneyConfirmation
          itinerary={itinerary}
          cityStays={cityStays}
          hotelsByMargin={hotelsByMargin}
          selectedTransferIds={selectedTransferIds}
          selectedActivities={selectedActivities}
          activities={activities}
          checkinDate={checkinDate}
          nights={nights}
          adults={adults}
          children={children}
          grandTotal={grandTotal}
          fmt={fmt}
          currency={currency}
          edition={edition}
          onConfirm={doCheckout}
          onBack={() => setScreen('builder')}
        />
      )}
    
     {/* JOURNEY LOADING */}
      {screen==='journey-loading' && itinerary && (
        <JourneyLoadingScreen
          itinerary={itinerary}
          cityStays={cityStays}
          hotelsByMargin={hotelsByMargin}
          checkinDate={checkinDate}
          nights={nights}
          grandTotal={grandTotal}
          fmt={fmt}
          edition={edition}
          selectedRegions={selectedRegions}
          onComplete={() => setScreen('confirming')}
        />
      )}
             
      {/* MY BRIEF */}
      {screen==='my-brief' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div style={{ maxWidth:660, margin:'0 auto', padding:'32px 20px 80px' }}>
            <button onClick={()=>setScreen('landing')} style={{ background:'transparent', border:`0.5px solid ${T.border}`, color:T.textDim, borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:24 }}>← Back</button>
            <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:6 }}>Your Brief</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, marginBottom:8, color:T.text }}>Tell us what you're dreaming of</h2>
            <p style={{ fontSize:14, color:T.textMid, marginBottom:24, lineHeight:1.65 }}>Write anything — we'll read it and build your journey around it.</p>
            <BriefScreen nights={nights} setNights={setNights} adults={adults} setAdults={setAdults} children={children} setChildren={setChildren} infants={infants} setInfants={setInfants} onBuild={(text:string)=>runBriefPlanner(text)} />
          </div>
        </div>
      )}
    </>
  );
}


function BriefScreen({ nights, setNights, adults, setAdults, children, setChildren, infants, setInfants, onBuild }: any) {
  const [brief, setBrief] = useState('');
  const maxLen = 1000;
  const ready = brief.trim().length >= 30;
  const hasDestination = /sabi|kruger|okavango|botswana|kenya|tanzania|zimbabwe|south africa|victoria falls|mara|madikwe|cape town/i.test(brief);
  const hasTheme = /honeymoon|anniversary|family|romantic|adventure|wildlife|beach|gorilla/i.test(brief);
  const hasDate  = /january|february|march|april|may|june|july|august|september|october|november|december|summer|winter/i.test(brief);
  const hasBudget= /R\s?\d|budget|afford|spend/i.test(brief);
  const PROMPTS = ["I'd love a honeymoon in the Okavango — very private, great food, not up at 5am every day.","10-day family safari with kids aged 8 and 12. Malaria-free preferred. Budget around R250,000.","We've done Kenya twice. Want southern Africa — Zimbabwe, Zambia, maybe Botswana.","First safari. Two of us. Big Five and a wow moment."];
  return (
    <div>
      <div style={{ position:'relative', marginBottom:16 }}>
        <textarea value={brief} onChange={e=>setBrief(e.target.value.slice(0,maxLen))} placeholder="e.g. We're celebrating our 20th anniversary. We've always wanted to see the Okavango from the air..." rows={8} style={{ width:'100%', background:T.surface, border:`1.5px solid ${brief.length>0?T.borderGold:T.border}`, borderRadius:14, padding:'18px 20px', fontSize:14, color:T.text, outline:'none', fontFamily:"'DM Sans',sans-serif", lineHeight:1.7, resize:'vertical' as const }} />
        <div style={{ position:'absolute', bottom:10, right:14, fontSize:11, color:T.textDim }}>{brief.length}/{maxLen}</div>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {[{label:'Destination',detected:hasDestination,hint:'Where in Africa?'},{label:'Occasion',detected:hasTheme,hint:'What kind of trip?'},{label:'Travel dates',detected:hasDate,hint:'When are you thinking?'},{label:'Budget',detected:hasBudget,hint:"What's your budget?"}].map(tag=>(
          <div key={tag.label} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, border:`0.5px solid ${tag.detected?T.borderGold:T.border}`, background:tag.detected?T.goldDim:'transparent', fontSize:12, color:tag.detected?T.gold:T.textDim }}><span>{tag.detected?'✓':'·'}</span>{tag.detected?tag.label:tag.hint}</div>
        ))}
      </div>

      {/* [V6-1] Counter pills aligned with planning form style */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
        {[
          { label:'Nights',   value:nights,   options:[5,7,10,12,14,21], onChange:setNights,   suffix:'n' },
          { label:'Adults',   value:adults,   options:[1,2,3,4,6],       onChange:setAdults,   suffix:''  },
          { label:'Children', value:children, options:[0,1,2,3,4],       onChange:setChildren, suffix:''  },
          { label:'Infants',  value:infants,  options:[0,1,2],           onChange:setInfants,  suffix:''  },
        ].map(p => (
          <div key={p.label} style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'12px 14px' }}>
            <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:8 }}>{p.label}</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {p.options.map(o => (
                <button key={o} onClick={() => p.onChange(o)} style={{ padding:'4px 8px', borderRadius:7, border:`0.5px solid ${p.value===o?T.borderGold:T.border}`, background:p.value===o?T.goldDim:'transparent', color:p.value===o?T.gold:T.textDim, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{o}{p.suffix}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {brief.length<10 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', marginBottom:10 }}>Examples — tap to use</div>
          {PROMPTS.map((p,i)=>(
            <button key={i} onClick={()=>setBrief(p)} style={{ display:'block', width:'100%', textAlign:'left' as const, padding:'12px 16px', background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:10, color:T.textMid, fontSize:13, cursor:'pointer', fontFamily:'inherit', lineHeight:1.5, marginBottom:8 }}>"{p}"</button>
          ))}
        </div>
      )}
      <button onClick={()=>{ if (ready) onBuild(brief+(nights>0?` Trip length: ${nights} nights.`:'')+(adults>0?` Travellers: ${adults} adults${children>0?`, ${children} children`:''}.`:'')); }} disabled={!ready} style={{ width:'100%', padding:18, background:ready?`linear-gradient(135deg,${T.gold},${T.goldLight})`:'rgba(255,255,255,0.06)', border:'none', borderRadius:12, color:ready?'#0a0a0a':T.textDim, fontSize:16, fontWeight:700, cursor:ready?'pointer':'not-allowed', fontFamily:'inherit' }}>
        {ready ? '✦ Build My Journey →' : `Write at least ${30-brief.trim().length} more characters to continue`}
      </button>
    </div>
  );
}
