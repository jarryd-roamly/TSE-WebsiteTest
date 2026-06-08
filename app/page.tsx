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

import React, { useState, useRef, useEffect, useCallback, useMemo, useReducer } from 'react';
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
import BudgetNudge from '@/components/BudgetNudge';
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

// Gateway airport → first region arrival transfer legs
const GATEWAY_LEGS: Record<string, { fromLabel:string; toLabel:string; provider:string; duration:string; estimatedCostZAR:number; aiNote:string }> = {
  'JNB→kruger-sabi-sand': { fromLabel:'Johannesburg (JNB)', toLabel:'Kruger / Sabi Sand', provider:'Federal Air JNB→SZK (Atlas Rd terminal)', duration:'~1h 30m', estimatedCostZAR:3800, aiNote:'Federal Air departs OR Tambo Atlas Rd terminal daily at 10:00 & 13:00. Lands directly on the lodge airstrip — no road transfer. 20kg soft bag; hard cases welcome on X class.' },
  'JNB→okavango-delta':   { fromLabel:'Johannesburg (JNB)', toLabel:'Okavango Delta',    provider:'Airlink JNB→Maun (4Z302) + Wilderness Air/MackAir to camp', duration:'~4h', estimatedCostZAR:9200, aiNote:'Fly Airlink (4Z302 JNB→MUB, dep 10:55). Then Wilderness Air or Mack Air light aircraft to your camp airstrip. 20kg soft bag limit on charter leg — strictly enforced. Note: Fastjet does not serve JNB→MUB.' },
  'JNB→madikwe':          { fromLabel:'Johannesburg (JNB)', toLabel:'Madikwe Reserve',   provider:'Federal Air JNB→Madikwe airstrip', duration:'~1h 15m', estimatedCostZAR:3200, aiNote:'Federal Air flies direct to Madikwe airstrip from OR Tambo Atlas Rd terminal. Daily at 10:00 & 13:00. Lodge vehicle meets on airstrip.' },
  'JNB→chobe-vic-falls':  { fromLabel:'Johannesburg (JNB)', toLabel:'Victoria Falls',    provider:'Airlink (4Z) or Fastjet (FN) JNB→VFA', duration:'~2h', estimatedCostZAR:6500, aiNote:'Direct Airlink or Fastjet from OR Tambo to Victoria Falls International (VFA). Multiple daily departures. Lodge transfer from VFA on arrival.' },
  'JNB→cape-town':        { fromLabel:'Johannesburg (JNB)', toLabel:'Cape Town',         provider:'Airlink / FlySafair / SAA JNB→CPT', duration:'~2h', estimatedCostZAR:2800, aiNote:'Multiple daily flights OR Tambo → Cape Town International. Airlink and FlySafair most frequent. ~30 min private transfer CPT → V&A Waterfront or Atlantic Seaboard on arrival.' },
  'CPT→kruger-sabi-sand': { fromLabel:'Cape Town (CPT)', toLabel:'Kruger / Sabi Sand',   provider:'Airlink CPT→JNB + Federal Air JNB→SZK', duration:'~2h 45m', estimatedCostZAR:8500, aiNote:'Morning departure from Cape Town recommended. Connect at OR Tambo — allow 2hrs. Federal Air from Atlas Rd terminal to Skukuza airstrip.' },
  'CPT→madikwe':          { fromLabel:'Cape Town (CPT)', toLabel:'Madikwe Reserve',      provider:'Airlink CPT→JNB + Federal Air JNB→Madikwe', duration:'~2h 45m', estimatedCostZAR:7200, aiNote:'Connect via OR Tambo. Allow 2hrs at JNB. Federal Air direct to Madikwe airstrip.' },
  'CPT→okavango-delta':   { fromLabel:'Cape Town (CPT)', toLabel:'Okavango Delta',       provider:'Airlink CPT→JNB + Airlink/Fastjet JNB→Maun + charter to camp', duration:'~5h 30m', estimatedCostZAR:12000, aiNote:'Full travel day. Fly CPT→JNB, connect JNB→MUB (Maun), then light aircraft to camp. 20kg soft bag limit on final leg.' },
};

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
  // CPT: private transfer only. No helicopters (removed), no shared shuttles (not appropriate for luxury guests).
  'cape-town': [
    { id:'private-car', icon:'🚗', label:'Private transfer', provider:'Private vehicle — door to door', duration:'30–45 min', estimatedCostZAR:850, note:'Driver meets you at arrivals with name board. Includes luggage handling and Cape Town welcome brief. R850 per transfer, per direction.', recommended:true },
  ],
  // VFA ARRIVAL: road transfer only. 20-30 min from VFA airport to any lodge in town.
  // NOTE: The departure options (VFA→JNB via Airlink/Fastjet) are handled by the
  // inter-region routing engine — NOT shown here as arrival transfers.
  'chobe-vic-falls': [
    { id:'vfa-road', icon:'🚗', label:'Private road transfer', provider:'Private vehicle — VFA airport to lodge', duration:'20–30 min', estimatedCostZAR:0, note:'Victoria Falls airport is a 20-minute drive from town. Your lodge vehicle will collect you at arrivals — included in your stay. No need to arrange separately.', recommended:true },
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
  // United Kingdom
  { code: 'LHR', label: 'London Heathrow',       flag: '🇬🇧' },
  { code: 'LGW', label: 'London Gatwick',         flag: '🇬🇧' },
  { code: 'LCY', label: 'London City',            flag: '🇬🇧' },
  { code: 'STN', label: 'London Stansted',        flag: '🇬🇧' },
  { code: 'MAN', label: 'Manchester',             flag: '🇬🇧' },
  { code: 'EDI', label: 'Edinburgh',              flag: '🇬🇧' },
  { code: 'BHX', label: 'Birmingham',             flag: '🇬🇧' },
  { code: 'GLA', label: 'Glasgow',                flag: '🇬🇧' },
  { code: 'BRS', label: 'Bristol',                flag: '🇬🇧' },
  // Europe
  { code: 'AMS', label: 'Amsterdam',              flag: '🇳🇱' },
  { code: 'FRA', label: 'Frankfurt',              flag: '🇩🇪' },
  { code: 'MUC', label: 'Munich',                 flag: '🇩🇪' },
  { code: 'DUS', label: 'Düsseldorf',             flag: '🇩🇪' },
  { code: 'BER', label: 'Berlin',                 flag: '🇩🇪' },
  { code: 'HAM', label: 'Hamburg',                flag: '🇩🇪' },
  { code: 'CDG', label: 'Paris Charles de Gaulle',flag: '🇫🇷' },
  { code: 'ORY', label: 'Paris Orly',             flag: '🇫🇷' },
  { code: 'NCE', label: 'Nice',                   flag: '🇫🇷' },
  { code: 'ZUR', label: 'Zurich',                 flag: '🇨🇭' },
  { code: 'GVA', label: 'Geneva',                 flag: '🇨🇭' },
  { code: 'VIE', label: 'Vienna',                 flag: '🇦🇹' },
  { code: 'BRU', label: 'Brussels',               flag: '🇧🇪' },
  { code: 'MAD', label: 'Madrid',                 flag: '🇪🇸' },
  { code: 'BCN', label: 'Barcelona',              flag: '🇪🇸' },
  { code: 'FCO', label: 'Rome Fiumicino',         flag: '🇮🇹' },
  { code: 'MXP', label: 'Milan Malpensa',         flag: '🇮🇹' },
  { code: 'LIS', label: 'Lisbon',                 flag: '🇵🇹' },
  { code: 'CPH', label: 'Copenhagen',             flag: '🇩🇰' },
  { code: 'ARN', label: 'Stockholm Arlanda',      flag: '🇸🇪' },
  { code: 'OSL', label: 'Oslo',                   flag: '🇳🇴' },
  { code: 'HEL', label: 'Helsinki',               flag: '🇫🇮' },
  { code: 'WAW', label: 'Warsaw',                 flag: '🇵🇱' },
  { code: 'PRG', label: 'Prague',                 flag: '🇨🇿' },
  { code: 'BUD', label: 'Budapest',               flag: '🇭🇺' },
  { code: 'ATH', label: 'Athens',                 flag: '🇬🇷' },
  { code: 'IST', label: 'Istanbul',               flag: '🇹🇷' },
  // United States
  { code: 'JFK', label: 'New York (JFK)',          flag: '🇺🇸' },
  { code: 'EWR', label: 'New York (Newark)',       flag: '🇺🇸' },
  { code: 'LAX', label: 'Los Angeles',             flag: '🇺🇸' },
  { code: 'ORD', label: 'Chicago O\'Hare',         flag: '🇺🇸' },
  { code: 'MIA', label: 'Miami',                   flag: '🇺🇸' },
  { code: 'SFO', label: 'San Francisco',           flag: '🇺🇸' },
  { code: 'BOS', label: 'Boston',                  flag: '🇺🇸' },
  { code: 'ATL', label: 'Atlanta',                 flag: '🇺🇸' },
  { code: 'IAD', label: 'Washington Dulles',       flag: '🇺🇸' },
  { code: 'DFW', label: 'Dallas Fort Worth',       flag: '🇺🇸' },
  { code: 'SEA', label: 'Seattle',                 flag: '🇺🇸' },
  { code: 'DEN', label: 'Denver',                  flag: '🇺🇸' },
  { code: 'HOU', label: 'Houston',                 flag: '🇺🇸' },
  { code: 'MSP', label: 'Minneapolis',             flag: '🇺🇸' },
  { code: 'PHX', label: 'Phoenix',                 flag: '🇺🇸' },
  { code: 'DTW', label: 'Detroit',                 flag: '🇺🇸' },
  // Canada
  { code: 'YYZ', label: 'Toronto Pearson',         flag: '🇨🇦' },
  { code: 'YVR', label: 'Vancouver',               flag: '🇨🇦' },
  { code: 'YUL', label: 'Montreal',                flag: '🇨🇦' },
  { code: 'YYC', label: 'Calgary',                 flag: '🇨🇦' },
  // Middle East
  { code: 'DXB', label: 'Dubai',                   flag: '🇦🇪' },
  { code: 'AUH', label: 'Abu Dhabi',               flag: '🇦🇪' },
  { code: 'DOH', label: 'Doha',                    flag: '🇶🇦' },
  { code: 'RUH', label: 'Riyadh',                  flag: '🇸🇦' },
  // Asia Pacific
  { code: 'SYD', label: 'Sydney',                  flag: '🇦🇺' },
  { code: 'MEL', label: 'Melbourne',               flag: '🇦🇺' },
  { code: 'PER', label: 'Perth',                   flag: '🇦🇺' },
  { code: 'BNE', label: 'Brisbane',                flag: '🇦🇺' },
  { code: 'AKL', label: 'Auckland',                flag: '🇳🇿' },
  { code: 'SIN', label: 'Singapore',               flag: '🇸🇬' },
  { code: 'HKG', label: 'Hong Kong',               flag: '🇭🇰' },
  { code: 'NRT', label: 'Tokyo Narita',            flag: '🇯🇵' },
  { code: 'PVG', label: 'Shanghai',                flag: '🇨🇳' },
  { code: 'PEK', label: 'Beijing',                 flag: '🇨🇳' },
  { code: 'BOM', label: 'Mumbai',                  flag: '🇮🇳' },
  { code: 'DEL', label: 'Delhi',                   flag: '🇮🇳' },
  { code: 'ICN', label: 'Seoul Incheon',           flag: '🇰🇷' },
  { code: 'KUL', label: 'Kuala Lumpur',            flag: '🇲🇾' },
  { code: 'BKK', label: 'Bangkok',                 flag: '🇹🇭' },
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
  // ── CPT departures ──────────────────────────────────────────────────────
  'cape-town→kruger-sabi-sand': {
    fromLabel:'Cape Town', toLabel:'Sabi Sand', mode:'scheduled',
    provider:'Airlink/CemAir CPT→HDS or CPT→MQP + FedAir Lowveld Shuttle to lodge',
    duration:'~3h 30m', estimatedCostZAR:11500,
    aiNote:'CPT→HDS Airlink 2x daily 07:00/13:00 (2h45) or CPT→MQP Airlink 2–3x daily 07:00 (2h40). FedAir Lowveld Shuttle HDS/MQP→lodge. Avoids JNB entirely. HDS for Timbavati/Klaserie/northern Sabi. MQP for Singita/Londolozi/southern Sabi.',
    bufferHours:3, road_viable:false },
  'cape-town→okavango-delta': {
    fromLabel:'Cape Town', toLabel:'Okavango Delta', mode:'scheduled',
    provider:'Airlink CPT→MUB direct (only nonstop) + Wilderness Air / Mack Air to camp',
    duration:'~3h total + charter to camp', estimatedCostZAR:16500,
    aiNote:'Airlink 4Z314 CPT→MUB dep 10:35 arr 13:05 daily. ONLY nonstop CPT–MUB. Book early — fills Jun–Sep. Wilderness Air or Mack Air charter to camp (15–45 min).',
    bufferHours:3.5, road_viable:false },
  'cape-town→chobe-vic-falls': {
    fromLabel:'Cape Town', toLabel:'Victoria Falls', mode:'scheduled',
    provider:'Airlink CPT→VFA direct daily or CPT→JNB→VFA',
    duration:'~3h direct', estimatedCostZAR:13500,
    aiNote:'Option 1 (preferred): Airlink CPT→VFA direct dep ~07:30 arr ~10:25. Option 2: CPT→JNB + Airlink JNB→VFA dep 11:35 arr 13:20 — allow 2h at OR Tambo.',
    bufferHours:3, road_viable:false },
  'cape-town→madikwe': {
    fromLabel:'Cape Town', toLabel:'Madikwe', mode:'combo',
    provider:'CPT→JNB (any carrier) + FedAir JNB→Madikwe or road',
    duration:'~4h total', estimatedCostZAR:11000,
    aiNote:'Fly CPT→JNB (from 06:00). FedAir dep JNB 10:00 or 13:00 from Atlas Rd terminal. Same-day achievable on early CPT departure catching 13:00 FedAir. Road: JNB→Madikwe 4.5–5.5hrs — practical for excess-luggage guests.',
    bufferHours:4, road_viable:true },
  // ── Kruger departures ───────────────────────────────────────────────────
  'kruger-sabi-sand→cape-town': {
    fromLabel:'Sabi Sand', toLabel:'Cape Town', mode:'scheduled',
    provider:'FedAir Lowveld Shuttle to HDS/MQP/SZK + direct commercial to CPT',
    duration:'~3h 30m', estimatedCostZAR:11500,
    aiNote:'FedAir Lowveld Shuttle dep lodge ~09:00 arr MQP 10:35. Direct: HDS→CPT Airlink 2x daily (08:00/14:00, 2h45), SZK→CPT Airlink 2x daily, MQP→CPT Airlink 2–3x daily + FlySafair Tue/Sat. Routing via JNB only if direct unavailable.',
    bufferHours:3, road_viable:false },
  'kruger-sabi-sand→okavango-delta': {
    fromLabel:'Sabi Sand', toLabel:'Okavango Delta', mode:'scheduled',
    provider:'FedAir Lowveld Shuttle to MQP + Airlink/CemAir MQP→JNB + Airlink JNB→MUB + charter to camp',
    duration:'~7h door-to-door (full travel day)', estimatedCostZAR:22000,
    aiNote:'FedAir lodge→MQP dep 09:00 arr 10:35. MQP→JNB Airlink/CemAir multiple daily (~1h). JNB→MUB Airlink dep ~10:00 arr ~12:10. Wilderness Air/Mack Air to camp. Maun overnight strongly recommended.',
    bufferHours:7, road_viable:false },
  'kruger-sabi-sand→chobe-vic-falls': {
    fromLabel:'Sabi Sand', toLabel:'Victoria Falls', mode:'scheduled',
    provider:'FedAir to MQP + Airlink MQP→VFA direct Mon/Wed/Fri/Sun',
    duration:'~3h door-to-door', estimatedCostZAR:14000,
    aiNote:'Option 1 (Mon/Wed/Fri/Sun): FedAir lodge→MQP dep 09:00, Airlink 4Z476 MQP→VFA dep 11:35 arr 13:25 (1h50 direct). Option 2 (other days): MQP→JNB + Airlink JNB→VFA dep 11:35 arr 13:20 — allow 2h at OR Tambo.',
    bufferHours:3, road_viable:false },
  'kruger-sabi-sand→madikwe': {
    fromLabel:'Sabi Sand', toLabel:'Madikwe', mode:'scheduled',
    provider:'FedAir Lowveld Shuttle to MQP + Airlink MQP→JNB + FedAir JNB→Madikwe',
    duration:'~4h door-to-door', estimatedCostZAR:10500,
    aiNote:'FedAir lodge→MQP dep 09:00 arr 10:35. MQP→JNB Airlink/CemAir multiple daily. FedAir JNB→Madikwe dep 13:00 arr 14:00. Allow 2h at OR Tambo.',
    bufferHours:4, road_viable:false },
  // ── Okavango departures ─────────────────────────────────────────────────
  'okavango-delta→cape-town': {
    fromLabel:'Okavango Delta', toLabel:'Cape Town', mode:'scheduled',
    provider:'Wilderness Air / Mack Air to MUB + Airlink MUB→CPT direct',
    duration:'~3h 30m + charter exit', estimatedCostZAR:16500,
    aiNote:'AM charter exit to MUB (arr ~09:00–10:00). Airlink 4Z314 reverse MUB→CPT dep ~13:30 arr ~16:00 (2h30). ONLY direct MUB→CPT — if missed, route MUB→JNB→CPT.',
    bufferHours:4, road_viable:false },
  'okavango-delta→kruger-sabi-sand': {
    fromLabel:'Okavango Delta', toLabel:'Sabi Sand', mode:'scheduled',
    provider:'Charter to MUB + Airlink MUB→JNB + FedAir / Airlink JNB→Lowveld',
    duration:'~7h door-to-door', estimatedCostZAR:22000,
    aiNote:'AM charter to MUB. Airlink/Air Botswana MUB→JNB dep ~12:00 arr ~14:10. JNB→Lowveld: FedAir dep 13:30 arr ~15:00 (lodge direct), or Airlink JNB→HDS/MQP multiple daily. Maun overnight removes all connection risk.',
    bufferHours:7, road_viable:false },
  'okavango-delta→chobe-vic-falls': {
    fromLabel:'Okavango Delta', toLabel:'Victoria Falls', mode:'charter',
    provider:'Wilderness Air / Mack Air to BBK + Mack Air MKB302 BBK→VFA',
    duration:'~3h same-day via Kasane', estimatedCostZAR:9500,
    aiNote:'PREFERRED: AM charter to Kasane (BBK) arr ~09:00. Mack Air MKB302 dep BBK 12:00 arr VFA 12:20 (20 min). Same-day achievable — only reliable option. JNB routing requires overnight.',
    bufferHours:3, road_viable:false },
  'okavango-delta→madikwe': {
    fromLabel:'Okavango Delta', toLabel:'Madikwe', mode:'scheduled',
    provider:'Charter to MUB + Airlink MUB→JNB + FedAir JNB→Madikwe (overnight JNB required)',
    duration:'~5h + JNB overnight', estimatedCostZAR:18000,
    aiNote:'AM charter to MUB. Airlink MUB→JNB dep ~12:00. Morning JNB→MUB flights depart before FedAir lands from Madikwe — same-day not possible. Overnight JNB standard.',
    bufferHours:5, road_viable:false },
  // ── Vic Falls departures ────────────────────────────────────────────────
  'chobe-vic-falls→cape-town': {
    fromLabel:'Victoria Falls', toLabel:'Cape Town', mode:'scheduled',
    provider:'Airlink VFA→CPT direct or VFA→JNB→CPT',
    duration:'~3h direct', estimatedCostZAR:13500,
    aiNote:'Airlink VFA→CPT direct dep ~14:20 arr ~17:30 (~3h). Or VFA→JNB dep 14:00 arr 15:45 + JNB→CPT — allow 2.5h at OR Tambo.',
    bufferHours:3, road_viable:false },
  'chobe-vic-falls→kruger-sabi-sand': {
    fromLabel:'Victoria Falls', toLabel:'Sabi Sand', mode:'scheduled',
    provider:'Airlink VFA→MQP direct Mon/Wed/Fri/Sun + FedAir lodge hop',
    duration:'~3h door-to-door', estimatedCostZAR:15000,
    aiNote:'Airlink 4Z476 VFA→MQP dep 13:35 arr 15:25 (1h50 direct) Mon/Wed/Fri/Sun. FedAir Lowveld Shuttle MQP→lodge. Other days: VFA→JNB + FedAir/Airlink JNB→Lowveld next morning.',
    bufferHours:3, road_viable:false },
  'chobe-vic-falls→okavango-delta': {
    fromLabel:'Victoria Falls / Chobe', toLabel:'Okavango Delta', mode:'charter',
    provider:'Mack Air MKB301 VFA→BBK + Wilderness Air / Mack Air BBK→Delta camp',
    duration:'~3h same-day via Kasane', estimatedCostZAR:9500,
    aiNote:'Mack Air MKB301 VFA→BBK dep 12:00 arr 12:20 (20 min). Wilderness Air or Mack Air charter BBK→camp. Same-day achievable — only reliable option for this crossing.',
    bufferHours:3, road_viable:false },
  'chobe-vic-falls→madikwe': {
    fromLabel:'Victoria Falls', toLabel:'Madikwe', mode:'scheduled',
    provider:'VFA→JNB + FedAir JNB→Madikwe (overnight JNB required)',
    duration:'~4h + JNB overnight', estimatedCostZAR:16000,
    aiNote:'VFA→JNB dep 14:00 arr 15:45. FedAir JNB→Madikwe dep next day 10:00 or 13:00. Same-day not feasible. Private FedAir charter only same-day option.',
    bufferHours:4, road_viable:false },
  // ── Madikwe departures ──────────────────────────────────────────────────
  'madikwe→cape-town': {
    fromLabel:'Madikwe', toLabel:'Cape Town', mode:'combo',
    provider:'FedAir Madikwe→JNB + any carrier JNB→CPT',
    duration:'~3h 30m', estimatedCostZAR:11000,
    aiNote:'FedAir dep MWD 11:15 arr JNB 12:15 or dep 14:30 arr 15:30. JNB→CPT Airlink/FlySafair/SAA multiple daily from ~12:00 (2h). Same-day achievable on 11:15 departure.',
    bufferHours:3.5, road_viable:true },
  'madikwe→kruger-sabi-sand': {
    fromLabel:'Madikwe', toLabel:'Sabi Sand', mode:'combo',
    provider:'FedAir Madikwe→JNB + FedAir/Airlink JNB→Lowveld',
    duration:'~3h 30m', estimatedCostZAR:10500,
    aiNote:'FedAir dep MWD 11:15 arr JNB 12:15. FedAir dep JNB 13:30 arr lodge ~15:00, or Airlink JNB→HDS/MQP multiple daily. Same-day Madikwe→Kruger achievable.',
    bufferHours:3.5, road_viable:false },
  'madikwe→chobe-vic-falls': {
    fromLabel:'Madikwe', toLabel:'Victoria Falls', mode:'combo',
    provider:'FedAir Madikwe→JNB + Airlink JNB→VFA (overnight JNB recommended)',
    duration:'~4h + overnight', estimatedCostZAR:16000,
    aiNote:'FedAir dep MWD 11:15 arr JNB 12:15. Airlink JNB→VFA dep 11:35 — too tight. Overnight JNB standard recommendation.',
    bufferHours:4, road_viable:false },
  'madikwe→okavango-delta': {
    fromLabel:'Madikwe', toLabel:'Okavango Delta', mode:'combo',
    provider:'FedAir Madikwe→JNB + Airlink JNB→MUB (overnight JNB required)',
    duration:'~5h + overnight', estimatedCostZAR:18000,
    aiNote:'FedAir dep MWD 11:15 arr JNB 12:15. JNB→MUB Airlink dep ~10:00 — departs before FedAir lands. Overnight Johannesburg is standard.',
    bufferHours:5, road_viable:false },
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

// Strips any string that is internal/specialist voice — not safe for guest display
function isGuestSafe(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const blockedPhrases = [
    'verify:', 'verify ', 'position for', 'position as', 'recommend to guests',
    'do not recommend', 'never recommend', 'specialist approval', 'trust score',
    'internal', 'margin', 'net rate', 'display rate', 'gross margin',
    'below threshold', 'below portfolio', 'requires verification',
    'explicit specialist', 'kb-', 'r$', 'r ',
  ];
  return !blockedPhrases.some(phrase => lower.includes(phrase));
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
    // Filter tips and highlights through guest-safe check before returning
    const tip = (propMatch.tips ?? []).find((t:string) => isGuestSafe(t))
             ?? (propMatch.highlights ?? []).find((h:string) => isGuestSafe(h));
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
            // Full room metadata preserved for the detail sheet
            meta: {
              description: rt.description ?? null,
              maxGuests:   rt.max_occupancy ?? null,
              bedType:     rt.bed_type ?? null,
              view:        rt.view ?? null,
              mealBasis:   rt.meal_basis ?? null,
              category:    rt.category ?? null,
              images: (() => { try {
                const arr = Array.isArray(rt.images) ? rt.images : (rt.images ? JSON.parse(rt.images) : []);
                return arr.map((img:any)=>typeof img==='string'?img:img?.url).filter(Boolean);
              } catch { return []; } })(),
            },
          }))
        : [{label:'Standard Suite',extra:0,tier:0,meta:null},{label:'Premium Suite',extra:Math.round(netRate*0.4),tier:1,meta:null}],
      basis:[{label:'All-inclusive',extra:0,tier:0}],
      flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:Math.round(netRate*0.08),tier:1}],
    },
  };
  return hotel;
}

function buildFallbackItinerary(nights: number, budget: number, mode: InputMode, selectedSlugs: string[]): Itinerary {
  // Clamp budget to a minimum viable amount to prevent nonsensical itinerary costs
  // Minimum is ~R18,000/night/adult for 2 adults + R30,000 transfers
  const minViable = Math.max(budget, nights * 36000 + 30000);
  budget = minViable;
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

  // 2+ destinations — distribute nights, HARD MINIMUM 2 nights per city (1-night stays are not viable)
  const rawSplit = validSlugs.map((_, i) => {
    const share = i === 0 ? 0.45 : i === validSlugs.length - 1 ? 0.25 : 0.30 / Math.max(1, validSlugs.length - 2);
    return Math.max(2, Math.round(nights * share));
  });
  const splitTotal = rawSplit.reduce((a, b) => a + b, 0);
  rawSplit[0] += (nights - splitTotal); // fix rounding on first city

  const cities = validSlugs.map((slug, i) => {
    const dest = destMap[slug];
    const cityNights = Math.max(2, rawSplit[i]); // Hard minimum 2 nights per destination
    return { city:dest.label, country:dest.country, nights:cityNights, why:dest.why, highlights:dest.highlights, estimatedCost:Math.round(budget*(cityNights/nights)), hotelRate:48000, flightCost:8000, transferCost:3500, activityCost:0, arrivalGap:'Arrive midday, first activity at 16:00', departureGap:'Final morning activity before departure' };
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
// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED PROPERTY DETAIL + CUSTOMISE SHEET
// Single sheet opened by the one carousel button. No chat tab. No base-price header.
// Room cards show features + incremental pricing. Functional KB diamond on hero.
// Traveller-safe content only — no internal trade notes, no duplication.
// ═══════════════════════════════════════════════════════════════════════════════
function UpgradeSheet({ hotel, stayPrefs, kbEntries, fmt, onSelect, onClose }: { hotel:Hotel; stayPrefs:{rooms:number;basis:number;flexibility:number}; kbEntries:KBEntry[]; fmt:(n:number)=>string; onSelect:(key:string,opt:any)=>void; onClose:()=>void; }) {

  const [heroSlide, setHeroSlide] = useState(0);
  const [kbNoteOpen, setKbNoteOpen] = useState(false);

  // Lock body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Traveller-safe KB only (never specialist_recs / internal_only / commercial)
  const kbEntry = kbEntries.find((e:any) =>
    (e.status === 'active' || e.active === true) &&
    (e.entry_type === 'property' || e.type === 'property') &&
    e.claim_type !== 'commercial' &&
    !e.internal_only &&
    ((e.linked_name ?? e.linkedTo ?? '').toLowerCase().includes(hotel.name.toLowerCase()))
  );
  const kbHighlights: string[] = kbEntry?.highlights ?? [];

  const allSlides = buildSlides(hotel);
  const heroKbNote = allSlides[heroSlide] ? getSlideKB(hotel, allSlides[heroSlide], kbEntries) : null;

  const [localPrefs, setLocalPrefs] = useState(stayPrefs);
  const handleSelect = (key: string, opt: any) => {
    setLocalPrefs(p => ({ ...p, [key]: opt.tier ?? 0 }));
    onSelect(key, opt);
  };

  const [roomSlides, setRoomSlides] = useState<Record<number,number>>({});

  const roomExtra  = hotel.upgrades?.rooms?.[localPrefs.rooms]?.extra ?? 0;
  const flexExtra  = hotel.upgrades?.flexibility?.[localPrefs.flexibility]?.extra ?? 0;
  const addedCost  = roomExtra + flexExtra;

  // Childcare guidance — traveller-safe, tag-driven
  const tags = (hotel.tags ?? []) as string[];
  const childcareNote = tags.includes('family-friendly')
    ? 'Family suites available · children of all ages welcome · dedicated kids\u2019 activities and babysitting on request.'
    : hotel.malariaFree
    ? 'Malaria-free — well suited to families. Children welcome; family rooms subject to availability.'
    : 'Children by arrangement — many camps set a minimum age for game drives. Your specialist confirms before booking.';

  const isRoomOnly = (hotel.rate_includes?.length ?? 0) === 0 ||
    ((hotel.rate_includes?.length ?? 0) === 1 && hotel.rate_includes?.[0] === 'accommodation');

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'#0f0f0f', borderRadius:'18px', width:'94vw', maxWidth:920, height:'92vh', display:'flex', flexDirection:'column', animation:'slideUp 0.3s ease', overflow:'hidden', border:`0.5px solid ${T.borderGold}` }}>

        {/* STICKY HEADER — no price */}
        <div style={{ flexShrink:0, padding:'16px 22px 14px', borderBottom:`0.5px solid rgba(255,255,255,0.08)`, background:'#0f0f0f', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:14 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.14em', fontWeight:700, marginBottom:3 }}>✦ Property detail</div>
            <div style={{ fontSize:22, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.15 }}>{hotel.name}</div>
            <div style={{ fontSize:12, color:T.textDim, marginTop:3, display:'flex', gap:10, flexWrap:'wrap' as const }}>
              <span>{hotel.destination} · {hotel.country}</span>
              <span style={{ color:T.green }}>★ {hotel.trustScore}/100</span>
              {hotel.malariaFree && <span style={{ color:T.gold }}>✦ Malaria-free</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:'none', color:T.textMid, width:36, height:36, borderRadius:'50%', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
        </div>

        {/* SCROLLABLE BODY — two-column on wide screens to reduce scrolling */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 0 130px' }}>

          {/* HERO CAROUSEL — prominent arrows + functional KB diamond */}
          {allSlides.length > 0 && (
            <div style={{ position:'relative', height:'min(46vh, 380px)', overflow:'hidden', background:'#111' }}>
              {allSlides[heroSlide] && (
                allSlides[heroSlide].type === 'youtube'
                  ? <iframe src={allSlides[heroSlide].url} title={hotel.name} style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none', pointerEvents:'none' }} allow="autoplay; encrypted-media" allowFullScreen={false} loading="lazy" />
                : allSlides[heroSlide].type === 'reel' || allSlides[heroSlide].type === 'video'
                  ? <video src={allSlides[heroSlide].url} poster={allSlides[heroSlide].poster} autoPlay muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <img src={allSlides[heroSlide].url} alt={hotel.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              )}
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.55) 0%,transparent 55%)' }} />

              {/* Prominent arrows */}
              {heroSlide > 0 && (
                <button onClick={() => { setHeroSlide(i => i-1); setKbNoteOpen(false); }} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', background:'rgba(10,10,10,0.78)', border:`1.5px solid ${T.gold}`, color:T.gold, width:44, height:44, borderRadius:'50%', cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5, boxShadow:'0 2px 12px rgba(0,0,0,0.6)' }}>‹</button>
              )}
              {heroSlide < allSlides.length - 1 && (
                <button onClick={() => { setHeroSlide(i => i+1); setKbNoteOpen(false); }} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'rgba(10,10,10,0.78)', border:`1.5px solid ${T.gold}`, color:T.gold, width:44, height:44, borderRadius:'50%', cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5, boxShadow:'0 2px 12px rgba(0,0,0,0.6)' }}>›</button>
              )}

              {/* Caption + dots */}
              <div style={{ position:'absolute', bottom:12, left:0, right:0, display:'flex', justifyContent:'space-between', alignItems:'flex-end', padding:'0 16px' }}>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', background:'rgba(0,0,0,0.45)', borderRadius:5, padding:'3px 9px' }}>{allSlides[heroSlide]?.label || ''}{allSlides[heroSlide]?.roomType ? ` · ${allSlides[heroSlide].roomType}` : ''}</div>
                {allSlides.length > 1 && (
                  <div style={{ display:'flex', gap:4 }}>
                    {allSlides.map((_,i) => <div key={i} onClick={() => { setHeroSlide(i); setKbNoteOpen(false); }} style={{ width:i===heroSlide?16:5, height:5, borderRadius:3, background:i===heroSlide?T.gold:'rgba(255,255,255,0.4)', cursor:'pointer', transition:'all 0.2s' }} />)}
                  </div>
                )}
              </div>

              {/* Functional KB diamond */}
              {heroKbNote && (
                <button onClick={() => setKbNoteOpen(o => !o)} title="Specialist note for this image" style={{ position:'absolute', top:14, right:14, zIndex:8, background:'transparent', border:'none', cursor:'pointer', padding:2 }}>
                  <div style={{ width:34, height:34, background:'linear-gradient(135deg,#c8a020,#f0c840)', transform:'rotate(45deg)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.55)' }}>
                    <span style={{ transform:'rotate(-45deg)', fontSize:14, color:'#0a0a0a', fontWeight:900 }}>✦</span>
                  </div>
                </button>
              )}
              {kbNoteOpen && heroKbNote && (
                <div style={{ position:'absolute', top:56, right:14, left:14, maxWidth:420, marginLeft:'auto', background:'rgba(8,8,8,0.97)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'12px 14px', zIndex:9, backdropFilter:'blur(16px)' }}>
                  <div style={{ fontSize:10, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:6 }}>✦ Why we recommend this</div>
                  <div style={{ fontSize:12.5, color:'rgba(240,237,230,0.85)', lineHeight:1.65 }}>{heroKbNote}</div>
                  <button onClick={() => setKbNoteOpen(false)} style={{ marginTop:8, fontSize:10, color:T.textDim, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Close ×</button>
                </div>
              )}
            </div>
          )}

          <div style={{ padding:'20px 22px 0' }}>

            {/* About + what's included */}
            {hotel.funFact && (
              <div style={{ fontSize:15, color:T.textMid, lineHeight:1.75, marginBottom:16, fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic' }}>{hotel.funFact}</div>
            )}

            <div style={{ marginBottom:20, padding:'11px 14px', background:isRoomOnly?'rgba(251,146,60,0.06)':'rgba(74,222,128,0.05)', border:`0.5px solid ${isRoomOnly?'rgba(251,146,60,0.2)':'rgba(74,222,128,0.15)'}`, borderRadius:10 }}>
              <div style={{ fontSize:9, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:600, marginBottom:6 }}>What's included</div>
              <InclusionPills includes={hotel.rate_includes ?? []} malariaFree={hotel.malariaFree} />
            </div>

            {/* Good to know — traveller-safe highlights, shown ONCE */}
            {kbHighlights.length > 0 && (
              <div style={{ marginBottom:22 }}>
                <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.12em', fontWeight:700, marginBottom:10 }}>✦ Good to know</div>
                <div style={{ display:'flex', flexWrap:'wrap' as const, gap:6 }}>
                  {kbHighlights.map((h:string,i:number) => (
                    <span key={i} style={{ fontSize:11.5, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:7, padding:'5px 11px' }}>{h}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Childcare / families */}
            <div style={{ marginBottom:22, padding:'12px 14px', background:'rgba(255,255,255,0.025)', border:`0.5px solid ${T.border}`, borderRadius:10 }}>
              <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:600, marginBottom:5 }}>👨‍👩‍👧 Children &amp; families</div>
              <div style={{ fontSize:12.5, color:T.textMid, lineHeight:1.6 }}>{childcareNote}</div>
            </div>

            {/* ROOM TYPES — features + incremental pricing */}
            <div style={{ marginBottom:22 }}>
              <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:600, marginBottom:12 }}>Room types</div>
              {(hotel.upgrades?.rooms ?? []).map((opt:any, roomIdx:number) => {
                const sel = opt.tier === localPrefs.rooms;
                const meta = opt.meta ?? null;
                const roomImgs: string[] = meta?.images?.length
                  ? meta.images
                  : allSlides.filter(s => s.roomType && s.roomType.toLowerCase().includes(opt.label.toLowerCase())).map(s => s.url);
                const rIdx  = roomSlides[roomIdx] ?? 0;
                const rImg  = roomImgs[rIdx] ?? hotel.image;
                const mealLabel = meta?.mealBasis === 'FI' ? 'Fully inclusive' : meta?.mealBasis === 'BB' ? 'Breakfast included' : meta?.mealBasis === 'HB' ? 'Half board' : null;
                return (
                  <div key={opt.label} onClick={() => handleSelect('rooms', opt)} style={{ marginBottom:12, borderRadius:12, border:`1.5px solid ${sel?T.gold:T.border}`, background:sel?'rgba(212,175,55,0.05)':T.surface, overflow:'hidden', cursor:'pointer', transition:'border-color 0.2s' }}>
                    <div style={{ position:'relative', height:180, overflow:'hidden' }}>
                      <img src={rImg} alt={opt.label} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 55%)' }} />
                      {roomImgs.length > 1 && rIdx > 0 && (
                        <button onClick={e => { e.stopPropagation(); setRoomSlides(prev => ({ ...prev, [roomIdx]: rIdx-1 })); }} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'rgba(10,10,10,0.7)', border:`1px solid ${T.gold}`, color:T.gold, width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>‹</button>
                      )}
                      {roomImgs.length > 1 && rIdx < roomImgs.length-1 && (
                        <button onClick={e => { e.stopPropagation(); setRoomSlides(prev => ({ ...prev, [roomIdx]: rIdx+1 })); }} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'rgba(10,10,10,0.7)', border:`1px solid ${T.gold}`, color:T.gold, width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>›</button>
                      )}
                      {/* selected pill + incremental price */}
                      <div style={{ position:'absolute', top:10, right:10, display:'flex', gap:6 }}>
                        {sel
                          ? <div style={{ fontSize:10, color:'#0a0a0a', background:T.gold, borderRadius:20, padding:'3px 10px', fontWeight:800 }}>✓ Selected</div>
                          : <div style={{ fontSize:10, color:T.textMid, background:'rgba(0,0,0,0.55)', border:`0.5px solid ${T.border}`, borderRadius:20, padding:'3px 10px' }}>Tap to select</div>}
                      </div>
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                        <div style={{ fontSize:17, fontWeight:700, color:'#fff', fontFamily:"'Cormorant Garamond',serif" }}>{opt.label}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:opt.extra===0?'rgba(255,255,255,0.7)':T.gold }}>
                          {opt.extra === 0 ? 'Included in rate' : `+${fmt(opt.extra)}/night`}
                        </div>
                      </div>
                    </div>
                    {/* Feature chips */}
                    <div style={{ padding:'12px 14px' }}>
                      <div style={{ display:'flex', gap:7, flexWrap:'wrap' as const, marginBottom: meta?.description ? 8 : 0 }}>
                        {meta?.maxGuests && <span style={{ fontSize:11, color:T.textMid, background:'rgba(255,255,255,0.04)', border:`0.5px solid ${T.border}`, borderRadius:6, padding:'3px 9px' }}>👥 Sleeps {meta.maxGuests}</span>}
                        {meta?.bedType && <span style={{ fontSize:11, color:T.textMid, background:'rgba(255,255,255,0.04)', border:`0.5px solid ${T.border}`, borderRadius:6, padding:'3px 9px' }}>🛏 {meta.bedType}</span>}
                        {meta?.view && <span style={{ fontSize:11, color:T.textMid, background:'rgba(255,255,255,0.04)', border:`0.5px solid ${T.border}`, borderRadius:6, padding:'3px 9px' }}>🌅 {meta.view}</span>}
                        {mealLabel && <span style={{ fontSize:11, color:T.green, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.25)', borderRadius:6, padding:'3px 9px' }}>✓ {mealLabel}</span>}
                      </div>
                      {meta?.description && <div style={{ fontSize:12, color:T.textMid, lineHeight:1.6 }}>{meta.description}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cancellation */}
            {hotel.upgrades?.flexibility && (
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:600, marginBottom:10 }}>Cancellation</div>
                <div style={{ display:'flex', gap:8 }}>
                  {hotel.upgrades.flexibility.map((opt:any) => {
                    const sel = opt.tier === localPrefs.flexibility;
                    return (
                      <button key={opt.label} onClick={() => handleSelect('flexibility', opt)} style={{ flex:1, padding:'11px 14px', borderRadius:9, border:`1.5px solid ${sel?T.gold:T.border}`, background:sel?T.goldDim:'transparent', color:sel?T.gold:T.textMid, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:sel?600:400, textAlign:'left' as const }}>
                        <div style={{ fontWeight:sel?700:400 }}>{opt.label}</div>
                        <div style={{ fontSize:10, marginTop:2, color:opt.extra===0?T.textDim:T.gold }}>{opt.extra===0?'No extra cost':`+${fmt(opt.extra)}/night`}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STICKY FOOTER */}
        <div style={{ flexShrink:0, padding:'14px 22px 22px', borderTop:`0.5px solid rgba(255,255,255,0.08)`, background:'#0f0f0f' }}>
          {addedCost > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:10 }}>
              <span style={{ color:T.textDim }}>Selected add-ons</span>
              <span style={{ color:T.gold, fontWeight:600 }}>+ {fmt(addedCost)}/night</span>
            </div>
          )}
          <button onClick={onClose} className="btn-gold" style={{ width:'100%', padding:15, fontSize:15 }}>
            Confirm &amp; return to itinerary →
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
function ActivitySpool({ regionSlug, selectedIds, onToggle, fmt, activities, pax = 1 }: {
  regionSlug:  string;
  selectedIds: string[];
  onToggle:    (id:string)=>void;
  fmt:         (n:number)=>string;
  activities:  Activity[];
  pax:         number;
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
          <span style={{ color:T.gold, fontWeight:600 }}>
            {selectedIds.length} experience{selectedIds.length===1?'':'s'} · {pax} {pax===1?'person':'people'}
          </span>
          <span style={{ color:T.textMid }}>
            {fmt(regionActs.filter(a=>selectedIds.includes(String(a.id))).reduce((s,a)=>s+Math.round(a.netRate*1.18)*pax,0))}
          </span>
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
  kbEntries, fmt, edition,
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
  const [upgradeOpenId, setUpgradeOpenId] = useState<string | null>(null);

  const stripRef = useRef<HTMLDivElement>(null);

  // [V6-4] scrollToIdx now also auto-selects the centred hotel
  const scrollToIdx = useCallback((idx: number) => {
    const strip = stripRef.current; if (!strip) return;
    const cards = strip.querySelectorAll<HTMLElement>('[data-card]');
    const card = cards[idx];
    if (card) card.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
    setActiveIdx(idx);
    setKbOpenId(null);
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
        const el = card as HTMLElement;
        const cardCenter = el.offsetLeft + el.offsetWidth / 2;
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
                    <button onClick={e => { e.stopPropagation(); setSlideIdx(hotel.id, slideIdx - 1); setKbOpenId(null); }} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'rgba(10,10,10,0.78)', border:`1.5px solid ${T.gold}`, color:T.gold, width:40, height:40, borderRadius:'50%', cursor:'pointer', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', zIndex:8, backdropFilter:'blur(4px)', boxShadow:'0 2px 12px rgba(0,0,0,0.6)' }} aria-label="Previous image">‹</button>
                  )}
                  {slideIdx < slides.length - 1 && (
                    <button onClick={e => { e.stopPropagation(); setSlideIdx(hotel.id, slideIdx + 1); setKbOpenId(null); }} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'rgba(10,10,10,0.78)', border:`1.5px solid ${T.gold}`, color:T.gold, width:40, height:40, borderRadius:'50%', cursor:'pointer', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', zIndex:8, backdropFilter:'blur(4px)', boxShadow:'0 2px 12px rgba(0,0,0,0.6)' }} aria-label="Next image">›</button>
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
                    <button onClick={e => { e.stopPropagation(); setKbOpenId(kbOpen ? null : String(hotel.id)); }} title="Specialist KB note for this image" style={{ position:'absolute', top:10, right:10, zIndex:9, background:'transparent', border:'none', cursor:'pointer', padding:2 }}>
                      <div style={{ width:30, height:30, background:'linear-gradient(135deg,#c8a020,#f0c840)', transform:'rotate(45deg)', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(0,0,0,0.5)' }}>
                        <span style={{ transform:'rotate(-45deg)', fontSize:12, color:'#0a0a0a', fontWeight:900, lineHeight:1 }}>✦</span>
                      </div>
                    </button>
                  )}

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
                    <div style={{ position:'absolute', top:48, right:8, left:8, background:'rgba(8,8,8,0.97)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'12px 14px', zIndex:18, backdropFilter:'blur(16px)' }}>
                      <div style={{ fontSize:10, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:6 }}>✦ Why we recommend this</div>
                      <div style={{ fontSize:12, color:'rgba(240,237,230,0.8)', lineHeight:1.65 }}>{kbNote}</div>
                      <button onClick={() => setKbOpenId(null)} style={{ marginTop:8, fontSize:10, color:T.textDim, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Close ×</button>
                    </div>
                  )}
                </div>

                <div style={{ padding:'12px 14px 14px' }}>
                  {hotel.funFact && (<div className="fun-fact" style={{ marginBottom:8 }}>✦ {hotel.funFact}</div>)}
                  {/* Inclusions strip — pulled from rate_includes */}
                  {isActive && hotel.rate_includes?.length > 0 && (
                    <InclusionPills includes={hotel.rate_includes ?? []} malariaFree={hotel.malariaFree} compact />
                  )}


                  {/* SINGLE BUTTON — opens combined detail + customise sheet */}
                  <div style={{ marginTop:4 }}>
                    <button onClick={() => setUpgradeOpenId(String(hotel.id))} style={{ width:'100%', padding:'14px 0', borderRadius:10, border:`1.5px solid ${T.gold}`, background:`linear-gradient(135deg, ${T.goldDim}, rgba(212,175,55,0.04))`, color:T.gold, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, letterSpacing:'0.03em', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      View rooms &amp; details
                      <span style={{ fontSize:15 }}>→</span>
                    </button>
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
// Structured leg data passed alongside the provider string.
// buildTransferLegs reads from structuredLegs when present — avoids all string parsing.
type StructuredLeg = {
  kind:    'exit'|'commercial'|'arrival'|'road'|'info';
  badge:   string;           // airline IATA code, 'road', 'charter', 'info'
  name:    string;           // "Airlink", "Federal Air", "Private transfer"
  from?:   string;           // IATA e.g. "CPT"
  to?:     string;           // IATA e.g. "MQP" or label "Lodge airstrip"
  depTime?: string;          // "08:30"
  arrTime?: string;          // "11:07"
  detail?: string;           // schedule / baggage info
  flightNum?: string;        // e.g. "4Z661"
  note?:   string;           // secondary line
  noteColor?: string;
};
type TransferOption = { id:string; mode:'road'|'commercial'|'charter'|'combo'|'boat'; icon:string; label:string; provider:string; duration:string; estimatedCostZAR:number; badges:Array<{text:string;color:string}>; aiNote:string; recommended:boolean; structuredLegs?: StructuredLeg[]; };

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

  const fmtT = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }
    catch { return ''; }
  };
  const durStr = (min?: number) =>
    min ? `${Math.floor(min/60)}h${min%60?` ${min%60}m`:''}` : '';

  // ── Helper: build a structured FedAir leg ───────────────────────────────
  // FedAir arrival leg: hub → lodge airstrip
  // Uses FEDAIR_BUSH lookup for specific lodge times (20–55 min direct routes).
  // Falls back to generic Lowveld Shuttle (Flt 302 13:00) or Madikwe schedule when lodge unknown.
  const fedairLeg = (hub: string, dest: string, isLowveld: boolean, isMadikwe: boolean, lodgeName?: string, depOverride?: string): StructuredLeg => {
    // Attempt lodge-specific route lookup
    const airstrip = lodgeName ? (LODGE_TO_AIRSTRIP[lodgeName] ?? null) : null;
    const bushKey  = airstrip ? `${hub}-${airstrip}` : null;
    const br       = bushKey ? (FEDAIR_BUSH[bushKey] ?? null) : null;

    if (br) {
      const stopsStr = br.stops === 0 ? 'direct' : `via ${br.via}`;
      return {
        kind: 'arrival' as const,
        badge: 'FA',
        name: 'Federal Air',
        from: hub,
        to: `${lodgeName ?? dest} airstrip`,
        flightNum: br.flt,
        depTime: br.dep,
        arrTime: br.arr,
        detail: `${br.flt} · ${hub} ${br.dep} → ${airstrip} ${br.arr} · ${br.dur}min ${stopsStr} · 20kg (hard cases OK)`,
        note: 'X Class available: 32kg + hard cases (+25%)',
        noteColor: 'rgba(212,175,55,0.5)',
      };
    }

    // Generic fallback
    return {
      kind: 'arrival' as const,
      badge: 'FA',
      name: 'Federal Air',
      from: hub,
      to: dest,
      flightNum: isLowveld ? 'FA302' : (isMadikwe ? (depOverride === '13:00' ? 'FA101' : 'FA103') : undefined),
      depTime: isLowveld ? '13:30' : (isMadikwe ? (depOverride ?? '13:00') : undefined),
      arrTime: isLowveld ? '15:00' : (isMadikwe ? (depOverride === '10:00' ? '11:00' : '14:00') : undefined),
      detail: isLowveld
        ? 'Flt 302 · MQP 13:30 → Lodge ~15:00 · 20kg (hard cases OK) · flexible departure'
        : isMadikwe
        ? (depOverride === '10:00'
            ? 'Flt 103 · JNB 10:00 → Madikwe 11:00 · 20kg (hard cases OK)'
            : 'Flt 101 · JNB 13:00 → Madikwe 14:00 · 20kg (hard cases OK)')
        : 'Daily 10:00 & 13:00 · ~55–65 min · 20kg (hard cases OK)',
      note: isLowveld
        ? 'X Class available: 32kg + hard cases (+25%)'
        : 'OR Tambo Atlas Rd terminal · allow 90 min from commercial arrival · X Class: 32kg + hard cases (+25%)',
      noteColor: 'rgba(212,175,55,0.5)',
    };
  };

  // FedAir 13:00 Madikwe arrival leg (second daily departure)
  const fedairLeg1300 = (hub: string, dest: string): StructuredLeg => ({
    kind: 'arrival',
    badge: 'FA',
    name: 'Federal Air',
    from: hub,
    to: dest,
    flightNum: 'FA101',
    depTime: '13:00',
    arrTime: '14:00',
    detail: 'Flt 101 · JNB 13:00 → Madikwe 14:00 · 20kg (hard cases OK)',
    note: 'OR Tambo Atlas Rd terminal · allows morning commercial arrivals to JNB · X Class: 32kg + hard cases (+25%)',
    noteColor: 'rgba(212,175,55,0.5)',
  });

  // ── Confirmed Airlink / Fastjet schedule — GDS verified (ExpertFlyer) ────
  // Only carriers with confirmed schedule data. No CemAir, FlySafair, SAA.
  // ── Confirmed schedule — source: ExpertFlyer GDS + Cirium screenshots ──────
  const SCHED: Record<string,{fn:string;dep:string;arr:string;dur:number;bag:string}> = {
    // CPT ↔ JNB (trunk — multiple daily; primary frequency shown)
    '4Z-CPT-JNB':{fn:'4Z926',dep:'06:05',arr:'08:10',dur:125,bag:'20kg · X Class 32kg avail'},
    '4Z-JNB-CPT':{fn:'4Z921',dep:'07:30',arr:'09:45',dur:135,bag:'20kg · X Class 32kg avail'},
    // CPT ↔ Kruger
    '4Z-CPT-MQP':{fn:'4Z661',dep:'07:50',arr:'10:10',dur:140,bag:'20kg · X Class 32kg avail'},
    '4Z-MQP-CPT':{fn:'4Z664',dep:'13:25',arr:'16:05',dur:160,bag:'20kg · X Class 32kg avail'},
    '4Z-CPT-SZK':{fn:'4Z651',dep:'10:30',arr:'12:55',dur:145,bag:'20kg · X Class 32kg avail'},
    '4Z-SZK-CPT':{fn:'4Z652',dep:'11:40',arr:'14:25',dur:165,bag:'20kg · X Class 32kg avail'},
    '4Z-CPT-HDS':{fn:'4Z655',dep:'08:35',arr:'11:05',dur:150,bag:'20kg · X Class 32kg avail'},
    '4Z-HDS-CPT':{fn:'4Z658',dep:'13:25',arr:'16:10',dur:165,bag:'20kg · X Class 32kg avail'},
    // CPT ↔ Other regions
    '4Z-CPT-VFA':{fn:'4Z390',dep:'09:45',arr:'12:40',dur:175,bag:'20kg · X Class 32kg avail'},
    '4Z-VFA-CPT':{fn:'4Z391',dep:'13:25',arr:'16:30',dur:185,bag:'20kg · X Class 32kg avail'},
    '4Z-CPT-MUB':{fn:'4Z314',dep:'10:35',arr:'13:10',dur:155,bag:'20kg · X Class 32kg avail'},
    '4Z-MUB-CPT':{fn:'4Z315',dep:'13:40',arr:'16:20',dur:160,bag:'20kg · X Class 32kg avail'},
    // JNB ↔ Kruger
    '4Z-JNB-MQP':{fn:'4Z823',dep:'07:00',arr:'07:55',dur:55, bag:'20kg · X Class 32kg avail'},
    '4Z-MQP-JNB':{fn:'4Z824',dep:'08:25',arr:'09:20',dur:55, bag:'20kg · X Class 32kg avail'},
    '4Z-JNB-SZK':{fn:'4Z861',dep:'10:05',arr:'11:05',dur:60, bag:'20kg · X Class 32kg avail'},
    '4Z-SZK-JNB':{fn:'4Z862',dep:'13:35',arr:'14:40',dur:65, bag:'20kg · X Class 32kg avail'},
    '4Z-JNB-HDS':{fn:'4Z871',dep:'10:30',arr:'11:30',dur:60, bag:'20kg · X Class 32kg avail'},
    '4Z-HDS-JNB':{fn:'4Z876',dep:'11:45',arr:'12:50',dur:65, bag:'20kg · X Class 32kg avail'},
    // JNB ↔ Other regions
    '4Z-JNB-VFA':{fn:'4Z492',dep:'10:00',arr:'11:45',dur:105,bag:'20kg · X Class 32kg avail'},
    '4Z-VFA-JNB':{fn:'4Z493',dep:'12:30',arr:'14:15',dur:105,bag:'20kg · X Class 32kg avail'},
    '4Z-JNB-MUB':{fn:'4Z302',dep:'10:55',arr:'12:35',dur:100,bag:'20kg · X Class 32kg avail'},
    '4Z-MUB-JNB':{fn:'4Z303',dep:'13:05',arr:'14:45',dur:100, bag:'20kg · X Class 32kg avail'},
    '4Z-JNB-BBK':{fn:'4Z306',dep:'11:50',arr:'13:35',dur:105,bag:'20kg · X Class 32kg avail'},
    '4Z-BBK-JNB':{fn:'4Z307',dep:'14:15',arr:'15:55',dur:100,bag:'20kg · X Class 32kg avail'},
    // Cross-regional
    '4Z-MQP-VFA':{fn:'4Z476',dep:'11:35',arr:'13:25',dur:110,bag:'20kg · X Class 32kg avail'},
    '4Z-VFA-MQP':{fn:'4Z477',dep:'14:00',arr:'15:40',dur:100,bag:'20kg · X Class 32kg avail'},
    // NOTE: 4Z477 arrives MQP 15:40 — too late for all FedAir lodge shuttles (last dep 13:30).
    // pickBestFlight returns null for this route when fedAirDep is set → option dropped correctly.
    // Fastjet Zimbabwe (IATA: FN)
    'FN-JNB-VFA':{fn:'FN8508',dep:'09:55',arr:'11:45',dur:110,bag:'20kg · hard cases OK'},
    'FN-VFA-JNB':{fn:'FN8503',dep:'12:45',arr:'14:35',dur:110,bag:'20kg · hard cases OK'},
    'FN-MQP-VFA':{fn:'FN8802',dep:'12:45',arr:'14:30',dur:105,bag:'20kg · hard cases OK'},
    'FN-VFA-MQP':{fn:'FN8801',dep:'10:30',arr:'12:15',dur:105,bag:'20kg · hard cases OK'},
  };

  // ── Multiple daily frequencies per commercial route ─────────────────────────
  // Source: Trip.com / directflights.com schedules (verified June 2026)
  // Only routes where 2+ daily options meaningfully change the recommendation.
  // Single-frequency routes stay in SCHED only.
  type SCHEDEntry = {fn:string;dep:string;arr:string;dur:number};
  const SCHED_MULTI: Record<string, SCHEDEntry[]> = {
    // VFA → MQP: Fastjet is the ONLY viable option when FedAir connection needed.
    // 4Z477 (14:00→15:40) arrives 2+ hours after FedAir departs — excluded by guardrail.
    'FN-VFA-MQP': [
      {fn:'FN8801', dep:'10:30', arr:'12:15', dur:105}, // ← 75 min buffer to FedAir 13:30 ✓
    ],
    // CPT → JNB: 4 viable Airlink frequencies (Trip.com confirmed June 2026)
    // 4Z922 dep 09:00 is the sweet-spot for FedAir 13:00 Madikwe (arrives JNB 11:05, 1h55 buffer ✅)
    '4Z-CPT-JNB': [
      {fn:'4Z926', dep:'06:05', arr:'08:10', dur:125},
      {fn:'4Z920', dep:'07:00', arr:'09:05', dur:125},
      {fn:'4Z922', dep:'09:00', arr:'11:05', dur:125}, // ← latest for FedAir 13:00 Madikwe
      {fn:'4Z950', dep:'09:55', arr:'12:00', dur:125}, // misses FedAir 13:00 (arr 12:00 + 90min = 13:30 > 13:00)
    ],
    // JNB → MQP: multiple daily (Trip.com / directflights confirmed)
    '4Z-JNB-MQP': [
      {fn:'4Z823', dep:'07:00', arr:'07:55', dur:55},
      {fn:'4Z829', dep:'10:05', arr:'11:00', dur:55},
      {fn:'4Z841', dep:'11:05', arr:'12:00', dur:55},  // ← best for FedAir 13:00+ (1h15 buffer ✅)
      {fn:'4Z845', dep:'16:10', arr:'16:50', dur:40},  // misses all FedAir
    ],
    // MQP → JNB: multiple daily outbound.
    // GUARDRAIL: 4Z824 (08:25) is too early for FedAir arrivals at MQP (earliest 10:35).
    // pickBestFlight with fedAirDep=null picks earliest → wrong for lodge exit days.
    // When exit leg arrives MQP 10:30+, use post-10:30 departures only.
    '4Z-MQP-JNB': [
      {fn:'4Z824', dep:'08:25', arr:'09:20', dur:55},   // early — only valid for overnight-at-MQP
      {fn:'4Z838', dep:'11:35', arr:'12:30', dur:55},   // ✅ good after FedAir 09:00→MQP 10:35
      {fn:'4Z842', dep:'13:00', arr:'13:55', dur:55},   // ✅ good after FedAir 12:05→MQP 12:30
      {fn:'4Z846', dep:'15:00', arr:'15:55', dur:55},   // ✅ late option
    ],
    // CPT → MQP: 4Z663 only connects if FedAir dep ≥ 13:45 (none currently)
    // pickBestFlight will correctly keep 4Z661 for all current FedAir times
    '4Z-CPT-MQP': [
      {fn:'4Z661', dep:'07:50', arr:'10:10', dur:140},
      {fn:'4Z663', dep:'10:25', arr:'12:45', dur:140},
    ],
    '4Z-CPT-HDS': [
      {fn:'4Z655', dep:'08:35', arr:'11:05', dur:150},
      {fn:'4Z657', dep:'10:15', arr:'12:45', dur:150},
    ],
  };

  // Routes that require a JNB hub connection — no direct Airlink service.
  // These must NEVER appear as single-hop commercial legs.
  const VIA_JNB_REQUIRED = new Set([
    'MQP-MUB', 'SZK-MUB', 'HDS-MUB',   // Kruger → Okavango (no direct, need JNB overnight)
    'MUB-MQP', 'MUB-SZK', 'MUB-HDS',   // Okavango → Kruger (same)
    'MUB-VFA', 'VFA-MUB',               // Okavango ↔ Vic Falls (charter via Kasane only)
  ]);

  // ── VIA-JNB MULTI-LEG BUILDER ──────────────────────────────────────────────
  // For routes that require a JNB connection (no direct service), build a
  // properly structured multi-leg option showing BOTH flight numbers + times.
  // Kruger→Okavango and reverse require overnight at JNB (4Z302 dep 10:55 is
  // the only JNB→MUB service — it departs before any same-day Lowveld exit lands).
  const buildViaJNBOption = (
    fromSlug: string, toSlug: string,
    originHub: string, exitRec: any, arrRec: any,
    pax: number
  ): TransferOption | null => {
    // ── Kruger hubs → Okavango ─────────────────────────────────────────────
    if (['kruger-sabi-sand','madikwe'].includes(fromSlug) && toSlug === 'okavango-delta') {
      const hub = originHub; // MQP, SZK, or HDS
      // Pick best MQP→JNB flight after FedAir arr 10:35 (min 45 min buffer = by 11:20)
      const jnbKey = `4Z-${hub}-JNB`;
      const jnbSc = SCHED_MULTI[jnbKey]
        ? SCHED_MULTI[jnbKey].find(f => t2m(f.dep) >= t2m('11:20')) ?? SCHED[jnbKey]
        : SCHED[jnbKey];
      const mubSc = SCHED['4Z-JNB-MUB']; // 4Z302 10:55→12:35
      if (!jnbSc || !mubSc) return null;

      const exitCost  = exitRec ? lastMileZar(exitRec, 18.62, pax) : 0;
      const arrCost   = arrRec  ? lastMileZar(arrRec,  18.62, pax) : 0;
      const leg1Cost  = Math.round((COMMERCIAL_FALLBACK_ZAR[hub] ?? 2800) * pax);
      const leg2Cost  = Math.round((COMMERCIAL_FALLBACK_ZAR['MUB'] ?? 8500) * pax);
      const totalCost = exitCost + leg1Cost + leg2Cost + arrCost;

      const structured: StructuredLeg[] = [];
      if (exitRec) { const ex = exitLeg(exitRec, hub, undefined); if (ex) structured.push(ex); }
      structured.push({
        kind:'commercial', badge:'4Z', name:'Airlink',
        from:hub, to:'JNB',
        depTime:jnbSc.dep, arrTime:jnbSc.arr,
        flightNum:(jnbSc as any).fn ?? `4Z-${hub}-JNB`,
        detail:`Nonstop · ${durStr(jnbSc.dur)} · 20kg · X Class 32kg avail`,
        note:'Schedule indicative · confirm seat availability at booking',
        noteColor:'rgba(212,175,55,0.4)',
      });
      structured.push({
        kind:'info', badge:'🌙', name:'Overnight at Johannesburg (JNB)',
        from:'JNB', to:'JNB',
        detail:'Airport hotel — arranged by your Journey Specialist',
        note:'4Z302 departs JNB 10:55 next morning. Same-day connection not possible.',
        noteColor:'rgba(96,165,250,0.6)',
      });
      structured.push({
        kind:'commercial', badge:'4Z', name:'Airlink',
        from:'JNB', to:'MUB',
        depTime:mubSc.dep, arrTime:mubSc.arr,
        flightNum:(mubSc as any).fn ?? '4Z302',
        detail:`Nonstop · ${durStr(mubSc.dur)} · 20kg · X Class 32kg avail`,
        note:'Schedule indicative · confirm seat availability at booking',
        noteColor:'rgba(212,175,55,0.4)',
      });
      if (arrRec) { buildArrivalLegs(arrRec, 'MUB', undefined, null).forEach(l => structured.push(l)); }

      return {
        id:'via-jnb-recommended', mode:'combo', icon:'✈',
        label:'Via Johannesburg (JNB) — overnight required',
        provider:`${hub}→JNB (${(jnbSc as any).fn}) + overnight + JNB→MUB (4Z302) + charter to camp`,
        duration:`~26h door-to-door · overnight JNB`,
        estimatedCostZAR: totalCost,
        badges:[
          {text:'✦ Recommended routing',color:'rgba(212,175,55,0.9)'},
          {text:'Overnight JNB required',color:'rgba(96,165,250,0.85)'},
          {text:'Est.',color:'rgba(255,255,255,0.3)'},
        ],
        aiNote:`Kruger→Okavango requires overnight at JNB. ${hub}→JNB ${(jnbSc as any).fn} dep ${jnbSc.dep}, arr ${jnbSc.arr}. Overnight JNB airport hotel (specialist arranges). Next morning: 4Z302 JNB 10:55→MUB 12:35 — Mack Air to camp. 20kg SOFT BAG strictly enforced on all charter legs.`,
        recommended: true,
        structuredLegs: structured,
      };
    }

    // ── Okavango → Kruger hubs ─────────────────────────────────────────────
    if (fromSlug === 'okavango-delta' && ['kruger-sabi-sand','madikwe'].includes(toSlug)) {
      // hub comes from arrRec parameter (arrival last-mile hub)
      const hub = arrRec?.fromAirport ?? 'MQP'; // MQP, SZK, or HDS
      const jnbSc = SCHED['4Z-MUB-JNB']; // 4Z303 13:05→14:45
      const hubKey = `4Z-JNB-${hub}`;
      const hubSc = SCHED_MULTI[hubKey]
        ? SCHED_MULTI[hubKey].find(f => t2m(f.dep) >= t2m('09:00')) ?? SCHED[hubKey]
        : SCHED[hubKey]; // 4Z829 10:05→11:00 for MQP
      if (!jnbSc || !hubSc) return null;

      const exitCost  = exitRec ? lastMileZar(exitRec, 18.62, pax) : 0;
      const arrCost   = arrRec  ? lastMileZar(arrRec,  18.62, pax) : 0;
      const leg1Cost  = Math.round((COMMERCIAL_FALLBACK_ZAR['MUB'] ?? 8500) * pax);
      const leg2Cost  = Math.round((COMMERCIAL_FALLBACK_ZAR[hub] ?? 2800) * pax);
      const totalCost = exitCost + leg1Cost + leg2Cost + arrCost;

      const structured: StructuredLeg[] = [];
      if (exitRec) { const ex = exitLeg(exitRec, 'MUB', undefined); if (ex) structured.push(ex); }
      structured.push({
        kind:'commercial', badge:'4Z', name:'Airlink',
        from:'MUB', to:'JNB',
        depTime:jnbSc.dep, arrTime:jnbSc.arr,
        flightNum:(jnbSc as any).fn ?? '4Z303',
        detail:`Nonstop · ${durStr(jnbSc.dur)} · 20kg · X Class 32kg avail`,
        note:'Schedule indicative · confirm seat availability at booking',
        noteColor:'rgba(212,175,55,0.4)',
      });
      structured.push({
        kind:'info', badge:'🌙', name:'Overnight at Johannesburg (JNB)',
        from:'JNB', to:'JNB',
        detail:'Airport hotel — arranged by your Journey Specialist',
        note:'FedAir lodge shuttles depart next morning from Atlas Rd terminal, OR Tambo.',
        noteColor:'rgba(96,165,250,0.6)',
      });
      structured.push({
        kind:'commercial', badge:'4Z', name:'Airlink',
        from:'JNB', to:hub,
        depTime:hubSc.dep, arrTime:hubSc.arr,
        flightNum:(hubSc as any).fn ?? `4Z-JNB-${hub}`,
        detail:`Nonstop · ${durStr(hubSc.dur)} · 20kg · X Class 32kg avail`,
        note:'Schedule indicative · confirm seat availability at booking',
        noteColor:'rgba(212,175,55,0.4)',
      });
      if (arrRec) { buildArrivalLegs(arrRec, hub, undefined, '13:30').forEach(l => structured.push(l)); }

      return {
        id:'via-jnb-recommended', mode:'combo', icon:'✈',
        label:'Via Johannesburg (JNB) — overnight required',
        provider:`MUB→JNB (4Z303) + overnight + JNB→${hub} (${(hubSc as any).fn}) + FedAir to lodge`,
        duration:`~26h door-to-door · overnight JNB`,
        estimatedCostZAR: totalCost,
        badges:[
          {text:'✦ Recommended routing',color:'rgba(212,175,55,0.9)'},
          {text:'Overnight JNB required',color:'rgba(96,165,250,0.85)'},
          {text:'Est.',color:'rgba(255,255,255,0.3)'},
        ],
        aiNote:`Okavango→Kruger requires overnight at JNB. 4Z303 MUB ${jnbSc.dep}→JNB ${jnbSc.arr}. Overnight JNB (specialist arranges). Morning: ${(hubSc as any).fn} JNB ${hubSc.dep}→${hub} ${hubSc.arr}, then FedAir 13:30→lodge. 20kg SOFT BAG on Mack Air.`,
        recommended: true,
        structuredLegs: structured,
      };
    }

    return null; // no specific handler — fall through to INTERNAL_LEGS
  };

  // Minimum connection buffer (minutes) at each regional hub before FedAir departure.
  // JNB = 90 min (must clear international/domestic, Atlas Rd terminal transit).
  // Lowveld hubs = 45 min (small terminal, no security re-screen).
  const CONNECTION_BUFFER: Record<string, number> = {
    'MQP':45, 'SZK':45, 'HDS':45, 'JNB':90,
  };

  // Generic FedAir departure times when specific lodge is unknown
  const FEDAIR_GENERIC_DEP: Record<string, string> = {
    'MQP':'13:30', // flexible afternoon — holds for 4Z663 (arr 12:45) and departs 13:30, lodges by 15:00
    'HDS':'11:55', 'SZK':'13:00',
    'JNB':'13:00', // FedAir 13:00 is primary Madikwe dep — allows 09:00 CPT departure (4Z922)
  };

  // Convert "HH:MM" to minutes since midnight for comparison
  const t2m = (t: string): number => { const [h,m] = t.split(':').map(Number); return h*60+m; };

  // Returns the LATEST viable commercial flight that leaves enough connection time.
  // "Latest" = best guest experience (late checkout, breakfast, civilised departure).
  // Falls back to earliest if nothing makes the connection.
  // minDep: if set, only pick flights departing AT or AFTER this time.
  // Used for exit scenarios where FedAir arrives at MQP and commercial must depart after.
  const pickBestFlight = (routeKey: string, fedAirDep: string | null, bag: string, minDep?: string): (SCHEDEntry & {bag:string}) | null => {
    const freqs = SCHED_MULTI[routeKey];
    const primary = SCHED[routeKey] ? { fn: SCHED[routeKey].fn, dep: SCHED[routeKey].dep, arr: SCHED[routeKey].arr, dur: SCHED[routeKey].dur } : null;
    const all: SCHEDEntry[] = freqs ?? (primary ? [primary] : []);
    if (!all.length) return null;

    // Filter by minDep first (for post-FedAir exit connections)
    const afterMin = minDep ? all.filter(f => t2m(f.dep) >= t2m(minDep)) : all;
    const pool = afterMin.length ? afterMin : all;

    if (!fedAirDep) return { ...pool[0], bag };

    // Extract dest hub from routeKey (e.g. '4Z-JNB-MQP' → 'MQP')
    const destHub = routeKey.split('-').pop()!;
    const bufferMin = CONNECTION_BUFFER[destHub] ?? 45;
    const deadline  = t2m(fedAirDep) - bufferMin;

    // All flights that arrive before the deadline (from filtered pool)
    const viable = pool.filter(f => t2m(f.arr) <= deadline);

    //     // GUARDRAIL: if no flight arrives in time for the FedAir connection, return null.
    // The caller (option generator) skips this option entirely — no impossible combos shown.
    if (!viable.length) return null;
    const best = viable.sort((a, b) => t2m(b.dep) - t2m(a.dep))[0]

    return { ...best, bag };
  };

  // ── Lodge name → FedAir bush airstrip code ──────────────────────────────────
  // Source: FedAir_Routes_Final.md (June 2026)
  // AIRSTRIP DISPLAY NAMES — shown on tile instead of lodge name (more accurate)
  const AIRSTRIP_DISPLAY_NAME: Record<string, string> = {
    'SSX': 'Singita private airstrip',
    'LDZ': 'Londolozi airstrip',
    'ULX': 'Ulusaba airstrip',      // Dulini is served by ULX (Ulusaba), NOT Dulini's own strip
    'ASS': 'Arathusa airstrip',     // Chitwa Chitwa is served by Arathusa (ASS)
    'GSS': 'Sabi Sabi airstrip',
    'SAT': 'Satara airstrip',
    'AAM': 'Inyati airstrip',
    'SZK': 'Skukuza Airport',       // Lion Sands → SZK ✓
  };
  const LODGE_TO_AIRSTRIP: Record<string, string> = {
    'Singita Boulders Lodge':   'SSX',
    'Singita Ebony Lodge':      'SSX',
    'Singita Lebombo Lodge':    'SAT',
    'Singita Sweni Lodge':      'SAT',
    'Londolozi Tree Camp':      'LDZ',
    'Londolozi Varty Camp':     'LDZ',
    'Ulusaba Rock Lodge':       'ULX',
    'Dulini Lodge':             'ULX',
    'Sabi Sabi Earth Lodge':    'GSS',
    'Chitwa Chitwa Game Lodge': 'ASS',
    'Lion Sands Ivory Lodge':   'SZK',
  };

  // ── FedAir bush routes: hub↔airstrip with specific flight times ─────────────
  // Source: FedAir_Routes_Final.md — confirmed point-to-point combinations
  // Only routes relevant to our lodge portfolio; expand as new properties onboard.
  type FBR = { flt:string; dep:string; arr:string; dur:number; stops:number; via?:string };
  const FEDAIR_BUSH: Record<string, FBR> = {
    // ── MQP → lodge arrivals ─────────────────────────────────────────
    'MQP-SSX': { flt:'FA3103', dep:'13:30', arr:'13:45', dur:30,  stops:0 },
    'MQP-LDZ': { flt:'FA3203', dep:'13:30', arr:'14:00', dur:40,  stops:1, via:'Sabi Sabi (GSS)' },
    'MQP-ULX': { flt:'FA3212', dep:'11:05', arr:'11:25', dur:20,  stops:0 },
    'MQP-ASS': { flt:'FA3103', dep:'13:30', arr:'13:55', dur:40,  stops:1, via:'Singita (SSX)' },
    'MQP-GSS': { flt:'FA3203', dep:'13:30', arr:'13:50', dur:30,  stops:0 },
    'MQP-SAT': { flt:'FA3301', dep:'08:20', arr:'09:15', dur:55,  stops:0 },
    'MQP-AAM': { flt:'FA3201', dep:'08:50', arr:'09:10', dur:20,  stops:0 },
    // ── Lodge → MQP exits ────────────────────────────────────────────
    'SSX-MQP': { flt:'FA3102', dep:'12:15', arr:'12:35', dur:20,  stops:0 },
    'LDZ-MQP': { flt:'FA3302', dep:'11:40', arr:'12:25', dur:45,  stops:1, via:'Sabi Sabi (GSS)' },
    'ULX-MQP': { flt:'FA3202', dep:'11:40', arr:'12:30', dur:50,  stops:1, via:'Arathusa (ASS)' },
    'ASS-MQP': { flt:'FA3202', dep:'12:05', arr:'12:30', dur:25,  stops:0 },
    'GSS-MQP': { flt:'FA3302', dep:'12:05', arr:'12:25', dur:20,  stops:0 },
    'SAT-MQP': { flt:'FA3301', dep:'09:15', arr:'10:10', dur:55,  stops:1, via:'Singita (SSX)' },
    'AAM-MQP': { flt:'FA3201', dep:'09:25', arr:'10:35', dur:70,  stops:2, via:'Londolozi/Arathusa' },
    // ── SZK connections ──────────────────────────────────────────────
    'ULX-SZK': { flt:'FA3101', dep:'09:00', arr:'09:10', dur:10,  stops:0 },
    'SZK-MQP': { flt:'FA3101', dep:'09:25', arr:'09:45', dur:20,  stops:0 },
    // ── HDS hub connections ──────────────────────────────────────────
    'MQP-HDS': { flt:'FA3402', dep:'10:50', arr:'11:25', dur:35,  stops:0 },
    'HDS-SAT': { flt:'FA3403', dep:'11:55', arr:'12:15', dur:20,  stops:0 },
    'HDS-ASS': { flt:'FA3403', dep:'11:55', arr:'12:50', dur:55,  stops:1, via:'Satara (SAT)' },
    'HDS-SZK': { flt:'FA3403', dep:'11:55', arr:'13:15', dur:80,  stops:2, via:'SAT/ASS' },
    // ── SZK → lodge ──────────────────────────────────────────────────
    'SZK-ULX': { flt:'FA3404', dep:'13:50', arr:'14:00', dur:10,  stops:0 },
    'SZK-SAT': { flt:'FA3404', dep:'13:50', arr:'14:30', dur:40,  stops:1, via:'Ulusaba (ULX)' },
    // ── ULX connections ──────────────────────────────────────────────
    'ULX-ASS': { flt:'FA3202', dep:'11:40', arr:'11:50', dur:10,  stops:0 },
    'ULX-SSX': { flt:'FA3501', dep:'09:25', arr:'09:35', dur:10,  stops:0 },
    // ── SSX connections ──────────────────────────────────────────────
    'SSX-ASS': { flt:'FA3501', dep:'09:50', arr:'10:00', dur:10,  stops:0 },
    'SSX-SZK': { flt:'FA3501', dep:'09:50', arr:'10:25', dur:35,  stops:1, via:'Arathusa (ASS)' },
  };

  // ── Helper: build a structured commercial leg ─────────────────────────────
  // When fedAirDep is provided, selects the LATEST viable flight (best experience).
  // Without fedAirDep, falls back to primary SCHED entry.
  // Duffel meta used ONLY for fare pricing upstream — NEVER shown on tile.
  const commercialLeg = (originHub: string, destHub: string, _meta: any, carrierName: string, carrierCode: string, fedAirDep?: string | null, minDep?: string): StructuredLeg => {
    const routeKey = `${carrierCode}-${originHub}-${destHub}`;
    const bag      = '20kg · X Class 32kg avail';
    const sc       = pickBestFlight(routeKey, fedAirDep ?? null, bag, minDep)
                     ?? (SCHED[routeKey] ? { ...SCHED[routeKey] } : null);
    const dur      = sc ? durStr(sc.dur) : '';
    return {
      kind: 'commercial',
      badge: carrierCode,
      name: carrierName,
      from: originHub,
      to: destHub,
      depTime: sc?.dep || undefined,
      arrTime: sc?.arr || undefined,
      flightNum: (sc as any)?.fn,
      detail: ['Nonstop', dur, (sc as any)?.bag ?? '20kg checked'].filter(Boolean).join(' · '),
      note: 'Schedule indicative · confirm seat availability at booking',
      noteColor: 'rgba(212,175,55,0.4)',
    };
  };

  // ── Helper: exit leg ─────────────────────────────────────────────────────
  const exitLeg = (lm: any, fromHub: string, lodgeName?: string): StructuredLeg | null => {
    if (!lm) return null;
    if (lm.mode === 'fedair') {
      const isMadikwe = fromHub === 'JNB';

      // Attempt lodge-specific route lookup from FEDAIR_BUSH
      const airstrip = lodgeName ? (LODGE_TO_AIRSTRIP[lodgeName] ?? null) : null;
      const bushKey  = airstrip ? `${airstrip}-${fromHub}` : null;
      const br       = (!isMadikwe && bushKey) ? (FEDAIR_BUSH[bushKey] ?? null) : null;

      if (br) {
        const stopsStr = br.stops === 0 ? 'direct' : `via ${br.via}`;
        return {
          kind: 'exit' as const,
          badge: 'FA',
          name: 'Federal Air',
          from: AIRSTRIP_DISPLAY_NAME[airstrip ?? ''] ?? `${lodgeName ?? airstrip ?? 'Lodge'} airstrip`,
          to: fromHub,
          flightNum: br.flt,
          depTime: br.dep,
          arrTime: br.arr,
          detail: `${br.flt} · ${airstrip} ${br.dep} → ${fromHub} ${br.arr} · ${br.dur}min ${stopsStr} · 20kg (hard cases OK)`,
          note: 'X Class available: 32kg + hard cases (+25%)',
          noteColor: 'rgba(212,175,55,0.5)',
        };
      }

      // Generic fallback (Madikwe or unknown lodge)
      return {
        kind: 'exit' as const,
        badge: 'FA',
        name: 'Federal Air',
        from: 'Lodge airstrip',
        to: fromHub,
        flightNum: isMadikwe ? 'FA102' : 'FA301',
        depTime:   isMadikwe ? '10:30' : '09:00',
        arrTime:   isMadikwe ? '12:30' : '10:35',
        detail: isMadikwe
          ? 'Flt 102 · Lodge 10:30 → JNB 12:30 · 20kg (hard cases OK)'
          : 'Flt 301 · Lodge 09:00 → MQP 10:35 · 20kg (hard cases OK)',
        note: isMadikwe
          ? 'Also Flt 104: dep 14:30 arr JNB 15:30 · OR Tambo Atlas Rd terminal · X Class: 32kg + hard cases (+25%)'
          : 'X Class available: 32kg + hard cases (+25%)',
        noteColor: 'rgba(212,175,55,0.5)',
      };
    }
    if (lm.mode === 'mackair' || lm.mode === 'wilderness') {
      return {
        kind: 'exit',
        badge: lm.mode === 'mackair' ? 'MK' : 'WA',
        name: lm.mode === 'mackair' ? 'Mack Air' : 'Wilderness Air',
        from: 'Lodge',
        to: lm.fromAirport,
        detail: lm.mode === 'wilderness'
          ? 'Included in lodge rate · 20kg soft bag strictly enforced'
          : '20kg soft bag · no hard cases · private airstrip',
        note: lm.note,
        noteColor: 'rgba(74,222,128,0.6)',
      };
    }
    return null;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // CASE 1: Cape Town as destination — commercial leg only, no last-mile
  // CityTransferStrip handles CPT airport → hotel separately.
  // ═══════════════════════════════════════════════════════════════════════
  if (toSlug === 'cape-town') {
    // VFA lodges: originHub must be VFA airport (not MQP — transfers.ts default is wrong for VFA)
    const originHub = fromSlug === 'chobe-vic-falls' ? 'VFA' : originHubAirport(originLodge ?? '', fromSlug);
    const routeKey  = `${originHub}-CPT`;
    const liveFare  = commercialFareZarByRoute?.[routeKey];
    const fallback  = COMMERCIAL_FALLBACK_ZAR['CPT'] ?? 2800;
    const meta      = commercialMetaByRoute?.[routeKey];

    const exitOptions = exitLastMileFor(originLodge ?? '', fromSlug);
    const exitRec     = exitOptions.find(l => l.recommended) ?? exitOptions[0] ?? null;
    const exitZar     = exitRec ? lastMileZar(exitRec, usdToZar, pax) : 0;
    const isEst       = liveFare == null;

    // Carriers that serve this route direct to CPT
    const carrierMatrix: Array<{code:string;name:string;adjust:number}> = [];
    if (['MQP','HDS','SZK'].includes(originHub)) {
      carrierMatrix.push({code:'4Z',name:'Airlink',adjust:1.0});
    } else if (originHub === 'MUB') {
      carrierMatrix.push({code:'4Z',name:'Airlink',adjust:1.0}); // Fastjet does not serve MUB
    } else if (['VFA','LVI'].includes(originHub)) {
      carrierMatrix.push({code:'4Z',name:'Airlink',adjust:1.0});
      carrierMatrix.push({code:'FN',name:'Fastjet',adjust:1.05});
    } else {
      carrierMatrix.push({code:'4Z',name:'Airlink',adjust:1.0});
    }

    // ── Generate one option per viable exit hub (SZK / MQP / HDS) ────────────
    // Each hub has its own FedAir exit time + direct Airlink to CPT.
    const LOWVELD_HUB_KEYS: Record<string,string> = {'MQP':'4Z-MQP-CPT','HDS':'4Z-HDS-CPT','SZK':'4Z-SZK-CPT'};
    const seenHubsC1 = new Set<string>();
    const exitHubOptions: any[] = [];
    for (const lm of exitOptions) {
      if (lm.mode === 'road') continue;
      const hub = lm.fromAirport;
      if (seenHubsC1.has(hub)) continue;
      seenHubsC1.add(hub);
      const schedKey = LOWVELD_HUB_KEYS[hub] ?? null;
      if (!schedKey && hub !== 'CPT' && hub !== 'JNB') continue; // no direct to CPT from this hub
      exitHubOptions.push({ lm, hub });
    }
    // Fallback to original exitRec if no hub-specific options found
    if (!exitHubOptions.length && exitRec) exitHubOptions.push({ lm: exitRec, hub: originHub });

    // Road transfer option (e.g. CPT→JNB road — rare, but for completeness)
    const roadExitC1 = exitOptions.find((l: any) => l.mode === 'road');

    const generatedC1 = exitHubOptions.map(({ lm: exitLmHub, hub }, i) => {
      const routeKeyHub = `${hub}-CPT`;
      const fareHub    = Math.round((hub === originHub ? (liveFare ?? fallback) : fallback) * 1.0);
      const exitZarHub = lastMileZar(exitLmHub, usdToZar, pax);
      const totalHub   = exitZarHub + Math.round(fareHub * pax);
      const metaHub    = (hub === originHub) ? meta : null;
      const commLeg    = commercialLeg(hub, 'CPT', metaHub, 'Airlink', '4Z', null); // CPT = no FedAir connection needed
      const ex         = exitLeg(exitLmHub, hub, originLodge ?? undefined);
      const structured: StructuredLeg[] = [];
      if (ex) structured.push(ex);
      structured.push(commLeg);
      const isEstHub  = (hub === originHub) ? isEst : true;
      const exitMin   = exitLmHub?.durationMin ?? 0;
      const flightMin = metaHub?.duration_min ?? ({'MQP':160,'HDS':165,'SZK':170,'JNB':120} as any)[hub] ?? 160;
      const totalMin  = exitMin + flightMin;
      return {
        id: i === 0 ? 'recommended' : `4Z-via-${hub}`,
        mode: 'commercial' as TransferOption['mode'],
        icon: '\u2708',
        label: `Airlink via ${hub} → Cape Town`,
        provider: `${exitLmHub?.label ?? ''} ${hub}→CPT`.trim(),
        duration: totalMin ? `~${durStr(totalMin)} + hotel transfer` : '~3h',
        estimatedCostZAR: totalHub,
        badges: [
          ...(i === 0 ? [{text:'\u2726 Recommended',color:'rgba(212,175,55,0.9)'}] : []),
          ...(isEstHub ? [{text:'Est.',color:'rgba(255,255,255,0.3)'}] : []),
          ...(exitLmHub?.mode === 'fedair' ? [{text:'\u2708 Federal Air included',color:'rgba(134,239,172,0.85)'}] : []),
        ],
        aiNote: `${hub}→CPT via Airlink. ${exitLmHub?.note ?? ''}. ${isEstHub ? 'Fare indicative.' : ''}`.trim(),
        recommended: i === 0,
        structuredLegs: structured,
      };
    });

    // Road transfer between regions intentionally omitted — we do not offer
    // lodge-to-airport road drives as an inter-region option. Too slow, loses
    // safari time, and TSE is responsible for any resulting flight costs.
    // (roadExitC1 retained in scope for excess-luggage override requests only)

    return generatedC1;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GATEWAY DEPARTURE: last lodge → international gateway (JNB or CPT).
  // toSlug is 'gateway-jnb' / 'gateway-cpt'. Real carrier options, no defer.
  // ═══════════════════════════════════════════════════════════════════════
  if (toSlug.startsWith('gateway-')) {
    const gw = toSlug.replace('gateway-', '').toUpperCase(); // 'JNB' | 'CPT'
    // VFA lodges: force VFA airport as origin hub (overrides incorrect MQP from transfers.ts)
    const originHub = fromSlug === 'chobe-vic-falls' ? 'VFA' : originHubAirport(originLodge ?? '', fromSlug);
    const exitOptions = exitLastMileFor(originLodge ?? '', fromSlug);
    const exitRec     = exitOptions.find(l => l.recommended) ?? exitOptions[0] ?? null;
    const exitZar     = exitRec ? lastMileZar(exitRec, usdToZar, pax) : 0;
    const routeKey    = `${originHub}-${gw}`;
    const liveFare    = commercialFareZarByRoute?.[routeKey] ?? null;
    const fallback    = COMMERCIAL_FALLBACK_ZAR[gw] ?? (gw === 'CPT' ? 2800 : 3500);
    const meta        = commercialMetaByRoute?.[routeKey];
    const isEst       = liveFare == null;

    // Carriers serving origin hub → gateway (real networks)
    const gwCarriers: Array<{code:string;name:string;adjust:number}> = (() => {
      if (originHub === gw) return [{ code:'', name:'', adjust:1 }]; // already at gateway
      if (gw === 'CPT') {
        if (['MQP','HDS','SZK'].includes(originHub)) { return [{code:'4Z',name:'Airlink',adjust:1.0}]; }
        if (originHub === 'MUB') return [{code:'4Z',name:'Airlink',adjust:1.0}];
        if (['VFA','LVI'].includes(originHub)) return [{code:'4Z',name:'Airlink',adjust:1.0},{code:'FN',name:'Fastjet',adjust:1.05}];
        return [{code:'4Z',name:'Airlink',adjust:1.0}];
      }
      // gw === 'JNB'
      if (['VFA','LVI'].includes(originHub)) return [{code:'FN',name:'Fastjet',adjust:0.92},{code:'4Z',name:'Airlink',adjust:1.0}];
      if (originHub === 'MUB')               return [{code:'4Z',name:'Airlink',adjust:1.0}]; // Fastjet does not serve MUB
      if (['MQP','HDS','SZK'].includes(originHub)) { return [{code:'4Z',name:'Airlink',adjust:1.0}]; }
      return [{code:'4Z',name:'Airlink',adjust:1.0}];
    })();

    const gwLabel = gw === 'CPT' ? 'Cape Town International (CPT)' : 'O.R. Tambo International (JNB)';
    const flightMinFallback: Record<string,number> = { 'MQP':110,'HDS':75,'SZK':75,'MUB':130,'VFA':105,'LVI':105 };

    return gwCarriers.map((c, i) => {
      const noFlight = c.code === ''; // already at gateway hub — exit transfer only
      const fare  = noFlight ? 0 : Math.round((liveFare ?? fallback) * c.adjust);
      const total = exitZar + Math.round(fare * pax);
      const metaForThis = (!noFlight && meta && (meta.carrier === c.code)) ? meta : null;

      const structured: StructuredLeg[] = [];
      // Compute FedAir exit arrival time — commercial from MQP must depart AFTER this.
      // This fixes Image 7: FA3202 arr MQP 12:30, so commercial must depart ≥ 13:15 (12:30+45).
      let exitArrAtHub: string | undefined;
      if (exitRec?.mode === 'fedair' && !noFlight) {
        const airstrip = originLodge ? (LODGE_TO_AIRSTRIP[originLodge] ?? null) : null;
        const bushKey  = airstrip ? `${airstrip}-${originHub}` : null;
        const br       = bushKey ? (FEDAIR_BUSH[bushKey] ?? null) : null;
        if (br?.arr) {
          // minDep = FedAir arrival + 45 min buffer
          const arrMins = t2m(br.arr) + 45;
          exitArrAtHub = `${Math.floor(arrMins/60).toString().padStart(2,'0')}:${(arrMins%60).toString().padStart(2,'0')}`;
        }
      }
      if (exitRec) { const ex = exitLeg(exitRec, noFlight ? gw : originHub, originLodge ?? undefined); if (ex) structured.push(ex); }
      if (!noFlight) structured.push(commercialLeg(originHub, gw, metaForThis, c.name, c.code, null, exitArrAtHub)); // minDep guards against pre-FedAir-arrival departures

      const exitMin   = exitRec?.durationMin ?? 0;
      const flightMin = noFlight ? 0 : (meta?.duration_min ?? flightMinFallback[originHub] ?? 120);
      const totalMin  = exitMin + flightMin;

      const badges: Array<{text:string;color:string}> = [];
      if (i === 0) badges.push({ text:'\u2726 Recommended', color:'rgba(212,175,55,0.9)' });
      if (c.code === 'FN') badges.push({ text:'\u2708 Fastjet', color:'rgba(211,84,0,0.9)' });
      if (exitRec?.mode === 'fedair') badges.push({ text:'\u2708 Federal Air charter included', color:'rgba(134,239,172,0.85)' });
      if (isEst && !noFlight) badges.push({ text:'Est.', color:'rgba(255,255,255,0.3)' });

      return {
        id: i === 0 ? 'recommended' : `${c.code || 'xfer'}-${i}`,
        mode: 'commercial' as TransferOption['mode'],
        icon: '\u2708',
        label: noFlight ? `Transfer to ${gwLabel}` : `${c.name} \u2192 ${gw}`,
        provider: noFlight ? (exitRec?.label ?? 'Lodge transfer') : `${c.name} ${originHub}\u2192${gw}`,
        duration: totalMin ? `~${durStr(totalMin)} door-to-door` : '',
        estimatedCostZAR: total,
        badges,
        aiNote: noFlight
          ? `Final transfer from your lodge to ${gwLabel}.`
          : [`${c.name} ${originHub}\u2192${gw} for your international departure from ${gwLabel}.`, exitRec?.note, isEst ? 'Fare indicative.' : null].filter(Boolean).join(' '),
        recommended: i === 0,
        structuredLegs: structured,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CASE 2: Standard inter-regional — EXIT + COMMERCIAL + ARRIVAL
  // ═══════════════════════════════════════════════════════════════════════
  const arrivalLastMiles = lastMileFor(destLodge ?? '', toSlug);

  if (!arrivalLastMiles.length) {
    const leg = getInternalLeg(fromSlug, toSlug);
    if (!leg) return [];
    return [{
      id: 'recommended',
      mode: (leg.mode === 'charter' ? 'charter' : leg.mode === 'road' ? 'road' : 'commercial') as TransferOption['mode'],
      icon: '\u2708',
      label: leg.provider,
      provider: leg.provider,
      duration: leg.duration,
      estimatedCostZAR: leg.estimatedCostZAR,
      badges: [{text:'\u2726 Recommended',color:'rgba(212,175,55,0.9)'}],
      aiNote: leg.aiNote,
      recommended: true,
    }];
  }

  const exitOptions = exitLastMileFor(originLodge ?? '', fromSlug);
  const exitRec2    = exitOptions.find(l => l.recommended) ?? exitOptions[0] ?? null;
  // VFA override: transfers.ts returns MQP for VFA lodges (wrong — VFA airport is the hub)
  const originHub   = fromSlug === 'chobe-vic-falls' ? 'VFA' : originHubAirport(originLodge ?? '', fromSlug);
  // ── Carriers serving a commercial hub-to-hub leg, Fastjet prioritised on its network ──
  const carriersForRoute = (oHub: string, dHub: string): Array<{code:string;name:string;adjust:number}> => {
    const key = `${oHub}-${dHub}`;
    // Fastjet (TC) DIRECT routes — listed FIRST so they are the recommended option.
    // MQP↔VFA confirmed direct (Fastjet 8802, daily exc. Thu, MQP–VFA 12:45–14:30).
    // Fastjet confirmed routes ONLY. JNB↔MUB removed — Fastjet does NOT serve Maun.
    const FASTJET_DIRECT = new Set([
      'JNB-VFA','VFA-JNB',   // Fastjet Zimbabwe confirmed JNB↔VFA
      'MQP-VFA','VFA-MQP',   // Fastjet Zimbabwe confirmed MQP↔VFA
      // JNB-MUB / MUB-JNB intentionally absent — Airlink only on this route
    ]);
    if (FASTJET_DIRECT.has(key)) {
      return [
        { code:'FN', name:'Fastjet', adjust:0.92 },
        { code:'4Z', name:'Airlink', adjust:1.0 },
      ];
    }
    // Lowveld carriers (HDS/SZK have no Fastjet service)
    if (['MQP','HDS','SZK'].includes(dHub) || ['MQP','HDS','SZK'].includes(oHub)) {
      return [{ code:'4Z', name:'Airlink', adjust:1.0 }];
    }
    // Default — single carrier
    return [{ code:'4Z', name:'Airlink', adjust:1.0 }];
  };

  // Recommended arrival last-mile (destHub → lodge). The arrival is the same regardless of carrier,
  // so the meaningful choice axis is the CARRIER, not the arrival transfer.
  const arrRec   = arrivalLastMiles.find(a => a.recommended) ?? arrivalLastMiles[0];
  const destHubR = arrRec.fromAirport;
  const needCommR = originHub !== destHubR;
  const carriersR = needCommR ? carriersForRoute(originHub, destHubR) : [];

  // Build the arrival structured-leg(s) for a given arrival record + destination hub.
  const buildArrivalLegs = (arr: any, destHub: string, lodgeName?: string, fedAirDep?: string | null): StructuredLeg[] => {
    const out: StructuredLeg[] = [];
    const isLowveld = ['MQP','HDS','SZK'].includes(destHub);
    const isMadikweArr = toSlug === 'madikwe';
    const isGBE = arr.fromAirport === 'GBE';
    if (isGBE) {
      out.push({ kind:'arrival', badge:'\u2708', name:'Charter — land at Gaborone (GBE)', from:'CPT / JNB', to:'GBE', detail:'Light aircraft · ~30 min from origin · lands Gaborone International', note:'Flat rate per charter up to 6 pax', noteColor:'rgba(212,175,55,0.5)' });
      out.push({ kind:'road', badge:'\uD83D\uDEC2', name:'\u26A0 Road transfer + 2 border crossings', from:'Gaborone Airport (GBE)', to:'Madikwe Lodge', detail:'~28km road · Botswana exit + SA entry (Kopfontein/Derdepoort border posts)', note:'Allow 2–3 hours. Border hours: 07:00–20:00. Not recommended for tight connections or evening arrivals.', noteColor:'rgba(251,146,60,0.8)' });
    } else if (arr.mode === 'fedair') {
      out.push(fedairLeg(destHub, 'Lodge airstrip', isLowveld, isMadikweArr, lodgeName, fedAirDep ?? undefined));
    } else if (arr.mode === 'mackair') {
      out.push({ kind:'arrival', badge:'MK', name:'Mack Air', from:destHub, to:'Camp airstrip', detail:'20kg soft bag · no hard cases · lands at camp', note:arr.note, noteColor:'rgba(74,222,128,0.6)' });
    } else if (arr.mode === 'wilderness') {
      out.push({ kind:'arrival', badge:'WA', name:'Wilderness Air', from:destHub, to:'Camp airstrip', detail:'Included in lodge rate · 20kg soft bag strictly enforced', note:'Do not charge separately', noteColor:'rgba(74,222,128,0.6)' });
    } else if (arr.mode === 'road') {
      out.push({ kind:'road', badge:'road', name:'Private road transfer', from:destHub, to:'Lodge', detail:`${arr.durationMin} min · no baggage restriction`, note:arr.note, noteColor:'rgba(255,255,255,0.35)' });
    }
    if (arr.mode === 'mackair' || arr.mode === 'wilderness') {
      out.push({ kind:'info', badge:'bag', name:'20kg soft bag — strictly enforced on all charter legs', detail:'No hard-sided cases. Duffel bag rental at most camps.', noteColor:'rgba(251,191,36,0.7)' });
    }
    return out;
  };

  const commDurFallback: Record<string, number> = {
    'CPT-MQP':160, 'CPT-HDS':160, 'CPT-SZK':165, 'CPT-MUB':150, 'CPT-VFA':180,
    'JNB-MQP':60,  'JNB-HDS':60,  'JNB-SZK':75,  'JNB-MUB':130, 'JNB-VFA':105,
    'MQP-VFA':110, 'MQP-CPT':160, 'HDS-CPT':160,  'MUB-CPT':150, 'MUB-JNB':130,
    'VFA-CPT':180, 'VFA-MQP':110, 'BBK-VFA':20,   'VFA-JNB':105,
  };

  // ── If there is a real commercial leg with a carrier choice → options axis = CARRIER ──
  // fedAirDepMain: FedAir dep time at dest hub — hoisted here so both carrier-choice
  // AND arrival-variant paths can use it without scope errors.
  const fedAirDepMain = destLodge
    ? (FEDAIR_BUSH[`${destHubR}-${LODGE_TO_AIRSTRIP[destLodge] ?? ''}`]?.dep ?? FEDAIR_GENERIC_DEP[destHubR] ?? null)
    : (FEDAIR_GENERIC_DEP[destHubR] ?? null);

  // GUARDRAIL: if the hub-to-hub route requires a JNB connection, build a proper
  // multi-leg structured option instead of falling through to a generic text description.
  // Madikwe exits via JNB (FedAir arr 12:30) — 4Z302 JNB→MUB dep 10:55 always missed.
  // Force overnight even though the hub pair is JNB-MUB (not in VIA_JNB_REQUIRED set).
  const madikweToOkavango = fromSlug === 'madikwe' && toSlug === 'okavango-delta';
  const routeRequiresJNB = VIA_JNB_REQUIRED.has(`${originHub}-${destHubR}`) || madikweToOkavango;

  if (routeRequiresJNB) {
    const viaOpt = buildViaJNBOption(fromSlug, toSlug, originHub, exitRec2, arrRec, pax ?? 2);
    if (viaOpt) return [viaOpt];
    // No structured handler — fall through to INTERNAL_LEGS text description
    const fallback = getInternalLeg(fromSlug, toSlug);
    if (!fallback) return [];
    return [{ id:'via-jnb-fallback', mode:'combo' as TransferOption['mode'], icon:'✈',
      label:fallback.provider, provider:fallback.provider,
      duration:fallback.duration, estimatedCostZAR:fallback.estimatedCostZAR,
      badges:[{text:'✦ Overnight JNB required',color:'rgba(96,165,250,0.85)'},{text:'Est.',color:'rgba(255,255,255,0.3)'}],
      aiNote:fallback.aiNote, recommended:true }];
  }

  if (needCommR && carriersR.length > 0) {
    const destHub  = destHubR;
    const routeKey = `${originHub}-${destHub}`;
    const liveMeta = commercialMetaByRoute?.[routeKey];
    const liveFare = commercialFareZarByRoute?.[routeKey] ?? null;
    const fallback = COMMERCIAL_FALLBACK_ZAR[destHub] ?? 4000;
    const isEst    = liveFare == null;
    const exitZar  = exitRec2 ? lastMileZar(exitRec2, usdToZar, pax) : 0;
    const arrZar   = lastMileZar(arrRec, usdToZar, pax);

    const destName = toSlug.replace(/-/g,' ').replace(/\b\w/g, ch => ch.toUpperCase());
    const mainOptions: TransferOption[] = carriersR.map((c, i) => {
      const fare  = Math.round((liveFare ?? fallback) * c.adjust);
      const total = exitZar + Math.round(fare * pax) + arrZar;
      const metaForThis = (liveMeta && (liveMeta.carrier === c.code)) ? liveMeta : null;

      const structured: StructuredLeg[] = [];
      if (exitRec2) { const ex = exitLeg(exitRec2, originHub, originLodge ?? undefined); if (ex) structured.push(ex); }
      structured.push(commercialLeg(originHub, destHub, metaForThis, c.name, c.code, fedAirDepMain));
      buildArrivalLegs(arrRec, destHub, destLodge ?? undefined, fedAirDepMain).forEach(l => structured.push(l));

      const flightMin = liveMeta?.duration_min ?? SCHED[`${c.code}-${originHub}-${destHub}`]?.dur ?? commDurFallback[routeKey] ?? 120;
      const totalMin  = (exitRec2?.durationMin ?? 0) + flightMin + (arrRec.durationMin ?? 0);

      const badges: Array<{text:string;color:string}> = [];
      if (i === 0) badges.push({ text:'\u2726 Recommended', color:'rgba(212,175,55,0.9)' });
      if (c.code === 'FN') badges.push({ text:'\u2708 Fastjet', color:'rgba(211,84,0,0.9)' });
      if (arrRec.mode === 'fedair') badges.push({ text:'\u2708 Federal Air included', color:'rgba(134,239,172,0.85)' });
      if (isEst) badges.push({ text:'Est.', color:'rgba(255,255,255,0.3)' });

      const routeDesc = `${c.name} ${originHub}\u2192${destHub}.`;

      return {
        id: i === 0 ? 'recommended' : `${c.code}-${i}`,
        mode: 'commercial' as TransferOption['mode'],
        icon: '\u2708',
        label: `${c.name} \u2192 ${destName}`,
        provider: `${c.name} ${originHub}\u2192${destHub}`,
        duration: totalMin ? `~${durStr(totalMin)} door-to-door` : '',
        estimatedCostZAR: total,
        badges,
        aiNote: [`Commercial: ${routeDesc}`, arrRec.note, isEst ? 'Fare indicative.' : null].filter(Boolean).join(' '),
        recommended: i === 0,
        structuredLegs: structured,
      };
    });

    // ── Alternative Kruger hub options ────────────────────────────────────
    // When primary is MQP, also offer HDS and SZK (Airlink from CPT/JNB + FedAir to lodge).
    const LOWVELD = ['MQP','HDS','SZK'];
    if (LOWVELD.includes(destHub)) {
      for (const ah of LOWVELD.filter(h => h !== destHub)) {
        // GUARDRAIL: only generate alternative if a real schedule exists for this hub.
        // Prevents phantom VFA→HDS, VFA→SZK, and any via-JNB single-hop options.
        const altSchedKey = `4Z-${originHub}-${ah}`;
        const altFnSchedKey = `FN-${originHub}-${ah}`;
        const hasAltSched = !!(SCHED[altSchedKey] || SCHED[altFnSchedKey]);
        const altNeedsJNB = VIA_JNB_REQUIRED.has(`${originHub}-${ah}`);
        if (!hasAltSched || altNeedsJNB) continue; // drops phantom routes silently
        const altKey    = `${originHub}-${ah}`;
        const altMeta   = commercialMetaByRoute?.[altKey];
        const altFare   = commercialFareZarByRoute?.[altKey] ?? (COMMERCIAL_FALLBACK_ZAR[ah] ?? 4000);
        const altTotal  = exitZar + Math.round(altFare * pax) + arrZar;
        const altFlMin  = altMeta?.duration_min ?? SCHED[`4Z-${originHub}-${ah}`]?.dur ?? commDurFallback[altKey] ?? 120;
        const altTotMin = (exitRec2?.durationMin ?? 0) + altFlMin + (arrRec.durationMin ?? 0);
        const altLegs: StructuredLeg[] = [];
        if (exitRec2) { const ex = exitLeg(exitRec2, originHub); if (ex) altLegs.push(ex); }
        const fedAirDepAlt = destLodge ? (FEDAIR_BUSH[`${ah}-${LODGE_TO_AIRSTRIP[destLodge] ?? ''}`]?.dep ?? FEDAIR_GENERIC_DEP[ah] ?? null) : (FEDAIR_GENERIC_DEP[ah] ?? null);
        altLegs.push(commercialLeg(originHub, ah, altMeta, 'Airlink', '4Z', fedAirDepAlt));
        altLegs.push(fedairLeg(ah, 'Lodge airstrip', true, false, destLodge ?? undefined));
        mainOptions.push({
          id: `4Z-via-${ah}`,
          mode: 'commercial' as TransferOption['mode'],
          icon: '\u2708',
          label: `Airlink via ${ah} \u2192 ${destName}`,
          provider: `Airlink ${originHub}\u2192${ah}`,
          duration: altTotMin ? `~${durStr(altTotMin)} door-to-door` : '',
          estimatedCostZAR: altTotal,
          badges: [{text:'Est.',color:'rgba(255,255,255,0.3)'}],
          aiNote: `Alternative via ${ah}: Airlink ${originHub}\u2192${ah} + FedAir to lodge. Good if primary is full.`,
          recommended: false,
          structuredLegs: altLegs,
        });
      }
    }

    // ── Madikwe: add 13:00 FedAir departure as second option + road transfer ───
    if (toSlug === 'madikwe' && arrRec.mode === 'fedair') {
      // 13:00 FedAir option (allows morning JNB connections)
      const fare1300  = Math.round((liveFare ?? fallback) * (carriersR[0]?.adjust ?? 1));
      const struct1300: StructuredLeg[] = [];
      if (exitRec2) { const ex = exitLeg(exitRec2, originHub); if (ex) struct1300.push(ex); }
      struct1300.push(commercialLeg(originHub, 'JNB', null, 'Airlink', '4Z', '13:00'));
      struct1300.push(fedairLeg1300('JNB', 'Madikwe Lodge'));
      mainOptions.push({
        id: 'fedair-1300',
        mode: 'commercial' as TransferOption['mode'],
        icon: '\u2708',
        label: 'Airlink \u2192 JNB · FedAir 13:00',
        provider: 'FedAir Flt 101 · JNB 13:00 → Madikwe 14:00',
        duration: '~3h 45m door-to-door',
        estimatedCostZAR: exitZar + Math.round(fare1300 * pax) + arrZar,
        badges: [{text:'\u2708 Afternoon FedAir',color:'rgba(134,239,172,0.85)'},{text:'Est.',color:'rgba(255,255,255,0.3)'}],
        aiNote: 'Afternoon FedAir 13:00 departure — suits later morning commercial arrivals at JNB. OR Tambo Atlas Rd terminal.',
        recommended: false,
        structuredLegs: struct1300,
      });
      // Road transfer option
      const roadArr = arrivalLastMiles.find((a: any) => a.mode === 'road');
      if (roadArr) {
        const roadArrZar = lastMileZar(roadArr, usdToZar, pax);
        const roadCommZar = Math.round((liveFare ?? fallback) * pax);
        const roadLegs: StructuredLeg[] = [];
        if (exitRec2) { const ex = exitLeg(exitRec2, originHub); if (ex) roadLegs.push(ex); }
        roadLegs.push(commercialLeg(originHub, 'JNB', null, 'Airlink', '4Z', null));
        roadLegs.push({ kind:'road' as const, badge:'road', name:'Private road transfer', from:'JNB', to:'Madikwe Lodge', detail:'4.5–5.5 hrs · no baggage restriction', note:roadArr.note, noteColor:'rgba(255,255,255,0.35)' });
        mainOptions.push({
          id: 'road-jnb-madikwe',
          mode: 'road' as TransferOption['mode'],
          icon: '\uD83D\uDE97',
          label: 'Airlink → JNB · Road to Madikwe',
          provider: 'Road transfer JNB → Madikwe',
          duration: '~6h door-to-door',
          estimatedCostZAR: exitZar + roadCommZar + roadArrZar,
          badges: [{text:'Road option',color:'rgba(255,255,255,0.35)'},{text:'No luggage limit',color:'rgba(74,222,128,0.7)'}],
          aiNote: `Road transfer JNB→Madikwe. ${roadArr.note ?? ''}. Good for guests with excess luggage.`,
          recommended: false,
          structuredLegs: roadLegs,
        });
      }
    }

    return mainOptions;
  }

  // ── Otherwise (charter/road only, no carrier choice) → options axis = arrival variant ──
  return arrivalLastMiles.map((arr, i) => {
    const destHub  = arr.fromAirport;
    const routeKey = `${originHub}-${destHub}`;
    const needComm = originHub !== destHub;

    const liveFare = needComm ? (commercialFareZarByRoute?.[routeKey] ?? null) : null;
    const fallback = needComm ? (COMMERCIAL_FALLBACK_ZAR[destHub] ?? 4000) : 0;
    const isEst    = needComm && liveFare == null;
    const meta     = commercialMetaByRoute?.[routeKey];

    const exitZar  = exitRec2 ? lastMileZar(exitRec2, usdToZar, pax) : 0;
    const arrZar   = lastMileZar(arr, usdToZar, pax);
    const commZar  = needComm ? Math.round((liveFare ?? fallback) * pax) : 0;
    const total    = exitZar + commZar + arrZar;

    const structured: StructuredLeg[] = [];
    if (exitRec2) { const ex = exitLeg(exitRec2, originHub, originLodge ?? undefined); if (ex) structured.push(ex); }
    if (needComm) {
      const hasLiveMeta = meta && (meta.carrier || meta.departing_at);
      const carrierCode = hasLiveMeta ? (meta.carrier ?? '4Z') : '4Z';
      const carrierName = AIRLINE_META[carrierCode]?.name ?? 'Airlink';
      structured.push(commercialLeg(originHub, destHub, meta, carrierName, carrierCode, fedAirDepMain));
    }
    buildArrivalLegs(arr, destHub, destLodge ?? undefined, fedAirDepMain).forEach(l => structured.push(l));

    const commDur = meta?.duration_min ?? commDurFallback[routeKey] ?? 120;
    const totalMin = (exitRec2?.durationMin ?? 0) + commDur + arr.durationMin;
    const isGBERoute = arr.fromAirport === 'GBE';
    const badges: Array<{text:string;color:string}> = [];
    if (arr.recommended && i === 0) badges.push({text:'\u2726 Recommended',color:'rgba(212,175,55,0.9)'});
    if (arr.perCharter || isGBERoute) badges.push({text:'Private charter',color:'#a78bfa'});
    if (arr.mode === 'fedair') badges.push({text:'\u2708 Federal Air charter included',color:'rgba(134,239,172,0.85)'});
    if (isGBERoute) badges.push({text:'\u26A0 2 border crossings required',color:'rgba(251,146,60,0.9)'});
    if (isEst) badges.push({text:'Est.',color:'rgba(255,255,255,0.3)'});

    const airline = meta?.carrier ? (AIRLINE_META[meta.carrier]?.name ?? meta.carrier) : null;
    const depT = fmtT(meta?.departing_at);
    const arrT = fmtT(meta?.arriving_at);
    const commDesc = needComm
      ? (airline && depT && arrT ? `${airline} ${originHub} ${depT}\u2192${destHub} ${arrT}` : `${originHub} \u2192 ${destHub}`)
      : null;

    return {
      id: arr.recommended ? 'recommended' : `${arr.mode}-${i}`,
      mode: (arr.mode==='charter'||arr.mode==='mackair'||arr.mode==='wilderness'?'charter':arr.mode==='road'?'road':'commercial') as TransferOption['mode'],
      icon: '\u2708',
      label: arr.label,
      provider: arr.label,
      duration: totalMin ? `~${durStr(totalMin)} door-to-door` : '',
      estimatedCostZAR: total,
      badges,
      aiNote: [commDesc ? `Commercial: ${commDesc}.` : null, arr.note, isEst ? 'Fare indicative.' : null].filter(Boolean).join(' '),
      recommended: !!arr.recommended,
      structuredLegs: structured,
    };
  });
}


// ── AIRLINE METADATA for logo badges ─────────────────────────────────────────
const AIRLINE_META: Record<string,{name:string;code:string;color:string}> = {
  // FedAir
  'FA':         {name:'Federal Air',    code:'FA', color:'#1a3a6e'},
  'FedAir':     {name:'Federal Air',    code:'FA', color:'#1a3a6e'},
  'Federal Air':{name:'Federal Air',    code:'FA', color:'#1a3a6e'},
  // Airlink
  '4Z':         {name:'Airlink',        code:'4Z', color:'#c0392b'},
  'Airlink':    {name:'Airlink',        code:'4Z', color:'#c0392b'},
  // CemAir
  '5Z':         {name:'CemAir',         code:'5Z', color:'#2c3e50'},
  'CemAir':     {name:'CemAir',         code:'5Z', color:'#2c3e50'},
  // FlySafair
  'FA_FS':      {name:'FlySafair',      code:'FS', color:'#e67e22'},
  'FlySafair':  {name:'FlySafair',      code:'FS', color:'#e67e22'},
  'FS':         {name:'FlySafair',      code:'FS', color:'#e67e22'},
  // Fastjet
  'TC':         {name:'Fastjet',        code:'TC', color:'#d35400'},
  'Fastjet':    {name:'Fastjet',        code:'FN', color:'#d35400'},
  // SAA
  'SA':         {name:'SAA',            code:'SA', color:'#1a5276'},
  'SAA':        {name:'SAA',            code:'SA', color:'#1a5276'},
  // Air Botswana
  'BP':         {name:'Air Botswana',   code:'BP', color:'#1e8449'},
  'Air Botswana':{name:'Air Botswana',  code:'BP', color:'#1e8449'},
  // Kenya Airways
  'KQ':         {name:'Kenya Airways',  code:'KQ', color:'#922b21'},
  // Charter operators
  'WA':         {name:'Wilderness Air', code:'WA', color:'#1d6a54'},
  'Wilderness Air':{name:'Wilderness Air',code:'WA',color:'#1d6a54'},
  'MK':         {name:'Mack Air',       code:'MK', color:'#5d4037'}, // IATA: MK
  'MA':         {name:'Mack Air',       code:'MK', color:'#5d4037'}, // legacy alias → MK
  'Mack Air':   {name:'Mack Air',       code:'MK', color:'#5d4037'},
};

const _lc: Record<string, string | null> = {};
let _ll = false; let _lp: Promise<void> | null = null;
function _loadLogos() {
  if (_ll) return Promise.resolve();
  if (_lp) return _lp;
  _lp = fetch('https://tkthsbxuyihoblpcfnml.supabase.co/rest/v1/airlines?select=iata_code,logo_url&is_active=eq.true', {
    headers: { 'apikey': 'sb_publishable_N1f-OiHXmxQiQTv_EkELcA_IvNtnHsx', 'Authorization': 'Bearer sb_publishable_N1f-OiHXmxQiQTv_EkELcA_IvNtnHsx' }
  }).then(r => r.json()).then((d: any[]) => { d.forEach((a: any) => { _lc[a.iata_code] = a.logo_url; }); _ll = true; }).catch(() => { _ll = true; });
  return _lp;
}

function AirlineBadge({ code, size=28 }: { code:string; size?:number }) {
  const meta = AIRLINE_META[code] ?? {name:code, code:code.slice(0,2).toUpperCase(), color:'#1a1a2e'};
  const [logo, setLogo] = useState<string|null>(_lc[code] !== undefined ? _lc[code] : null);
  useEffect(() => {
    if (_lc[code] !== undefined) { setLogo(_lc[code]); return; }
    _loadLogos().then(() => setLogo(_lc[code] ?? null));
  }, [code]);
  if (logo) return (
    <div style={{ width:size, height:size, borderRadius:6, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0, border:'0.5px solid rgba(255,255,255,0.15)' }}>
      <img src={logo} alt={meta.name} style={{ width:'90%', height:'90%', objectFit:'contain' }} />
    </div>
  );
  return (
    <div style={{ width:size, height:size, borderRadius:6, background:meta.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size<30?9:10, fontWeight:700, color:'#fff', letterSpacing:'0.04em', flexShrink:0, border:'0.5px solid rgba(255,255,255,0.15)' }}>
      {meta.code}
    </div>
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

function buildTransferLegs(opt: any, _meta?: any): TransferLeg[] {
  // ── STRUCTURED PATH: use pre-built legs when available ────────────────────
  // This is the correct path for all options built by the new buildTransferOptions.
  // No string parsing — data comes from typed StructuredLeg objects.
  if (opt.structuredLegs && opt.structuredLegs.length > 0) {
    return (opt.structuredLegs as StructuredLeg[]).map(sl => {
      // ── Info / baggage warnings ─────────────────────────────────────────
      if (sl.kind === 'info') {
        return {
          type: 'info' as const,
          badge: sl.badge === 'bag' ? '\u26A0' : '\u25C8',
          primary: sl.name,
          detail: sl.detail,
          noteColor: sl.noteColor ?? 'rgba(251,191,36,0.7)',
        };
      }

      // ── Road transfers ──────────────────────────────────────────────────
      if (sl.kind === 'road' || sl.badge === 'road') {
        return {
          type: 'road' as const,
          badge: '\uD83D\uDE97',
          primary: sl.name,
          route: sl.from && sl.to ? `${sl.from} \u2192 ${sl.to}` : undefined,
          detail: sl.detail,
          note: sl.note,
          noteColor: sl.noteColor ?? 'rgba(255,255,255,0.35)',
        };
      }

      // ── Charter operators (Mack Air, Wilderness Air) ────────────────────
      if (sl.badge === 'MK' || sl.badge === 'MA' || sl.badge === 'WA') { // MA = legacy Mack Air code
        return {
          type: 'charter' as const,
          badge: sl.badge,
          primary: sl.name,
          route: sl.from && sl.to ? `${sl.from} \u2192 ${sl.to}` : undefined,
          detail: sl.detail,
          note: sl.note,
          noteColor: sl.noteColor ?? 'rgba(74,222,128,0.6)',
        };
      }

      // ── All scheduled airlines ────────────────────────────────────────────
      const timeStr = sl.depTime && sl.arrTime
        ? `${sl.from ?? ''} ${sl.depTime} \u2192 ${sl.to ?? ''} ${sl.arrTime}`
        : sl.from && sl.to ? `${sl.from} \u2192 ${sl.to}` : undefined;
      const routeDisplay = sl.flightNum && timeStr
        ? `${sl.flightNum}  \u00b7  ${timeStr}`
        : timeStr;

      return {
        type: 'airline' as const,
        badge: sl.badge,
        primary: sl.name,
        route: routeDisplay,
        detail: sl.detail,
        note: sl.note,
        noteColor: sl.noteColor ?? 'rgba(212,175,55,0.45)',
      };
    });
  }

  // ── LEGACY FALLBACK PATH: parse provider string ───────────────────────────
  // Only reached for GATEWAY_LEGS / INTERNAL_LEGS fallback entries that
  // don't have structuredLegs. Kept for safety but should rarely fire.
  const legs: TransferLeg[] = [];
  const provider = opt.provider ?? '';
  const parts = provider.split(/\s{1,4}\u2192\s{1,4}|\s*->\s*/);

  for (const p of parts) {
    if (!p.trim()) continue;
    const isFedAir     = /FedAir|Federal Air/i.test(p);
    const isAirlink    = /Airlink/i.test(p);
    const isCemAir     = /CemAir/i.test(p);
    const isFlySafair  = /FlySafair/i.test(p);
    const isFastjet    = /Fastjet/i.test(p);
    const isSAA        = /\bSAA\b/i.test(p);
    const isMackAir    = /Mack Air/i.test(p);
    const isWilderness = /Wilderness Air/i.test(p);
    const isRoad       = /road|private.*transfer/i.test(p) && !isFedAir;

    if (isRoad) {
      legs.push({ type:'road', badge:'\uD83D\uDE97', primary:'Private road transfer', detail:'Luggage assistance included' });
    } else if (isFedAir) {
      const hub = p.match(/\b(JNB|MQP|HDS|SZK|MUB|VFA|BBK)\b/i)?.[1]?.toUpperCase() ?? 'JNB';
      const isLowveld = /MQP|HDS|SZK|Lowveld/i.test(p);
      legs.push({
        type:'airline', badge:'FA', primary:'Federal Air',
        route:`${hub} \u2192 Lodge airstrip`,
        detail: isLowveld ? 'Lowveld Shuttle · dep 09:00 · 20kg (hard cases OK)' : 'Daily 10:00 & 13:00 · 20kg (hard cases OK)',
        note:'OR Tambo Atlas Rd terminal · X Class: 32kg + hard cases (+25%)',
      });
    } else if (isMackAir) {
      legs.push({ type:'charter', badge:'MK', primary:'Mack Air', detail:'20kg soft bag · no hard cases' });
    } else if (isWilderness) {
      legs.push({ type:'charter', badge:'WA', primary:'Wilderness Air', detail:'Included in lodge rate · 20kg soft bag' });
    } else if (isAirlink || isCemAir || isFlySafair || isFastjet || isSAA) {
      const code = isAirlink?'4Z':isCemAir?'5Z':isFlySafair?'FS':isFastjet?'FN':isSAA?'SA':'4Z';
      const name = AIRLINE_META[code]?.name ?? code;
      const rm   = p.match(/([A-Z]{3})\s*\u2192\s*([A-Z]{3})/);
      legs.push({
        type:'airline', badge:code, primary:name,
        route: rm ? `${rm[1]} \u2192 ${rm[2]}` : undefined,
        detail:'Economy · 20kg checked',
        note:'Indicative fare · confirmed at booking',
      });
    } else {
      const clean = p.trim();
      if (clean.length > 2 && !/^\s*$/.test(clean)) {
        legs.push({ type:'info', badge:'\u25C8', primary:clean, noteColor:'rgba(255,255,255,0.4)' });
      }
    }
  }

  if (!legs.length) {
    legs.push({ type:'airline', badge:'\u2708', primary:opt.label || 'Transfer', detail:opt.duration });
  }

  return legs;
}
// ── TransferHeader ─────────────────────────────────────────────────────────────
// Replaces the plain blue rule with a gold editorial chapter header.

function TransferHeader({ fromLabel, toLabel }: { fromLabel: string; toLabel: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
    }}>
      <div style={{ flex: 1, height: '0.5px', background: `linear-gradient(to right, transparent, ${T.gold}40)` }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
        textTransform: 'uppercase' as const,
        color: T.gold, opacity: 0.7, whiteSpace: 'nowrap' as const,
        fontFamily: "'Jost', sans-serif",
      }}>
        <span style={{ opacity: 0.5 }}>✦</span>
        {fromLabel}
        <span style={{ fontSize: 10, opacity: 0.4, letterSpacing: 0 }}>→</span>
        {toLabel}
      </div>
      <div style={{ flex: 1, height: '0.5px', background: `linear-gradient(to left, transparent, ${T.gold}40)` }} />
    </div>
  );
}

// ── JourneyCardBody ────────────────────────────────────────────────────────────
// Horizontal left-to-right timeline with real carrier logos.

function JourneyCardBody({ legs, duration, aiNote, badges, optionCount, activeIdx, onPrev, onNext, isSelected, onSelect, fmt, cost }: {
  legs: TransferLeg[]; duration: string; aiNote: string;
  badges: Array<{text: string; color: string}>; optionCount: number; activeIdx: number;
  onPrev: () => void; onNext: () => void; isSelected: boolean; onSelect?: () => void;
  fmt: (n: number) => string; cost: number;
}) {
  const durDisplay = duration.replace(/~|total\s*door-to-door|door-to-door/gi,'').replace(/\b0h\s*/g,'').trim();
  const isRec = badges.some(b => b.text.toLowerCase().includes('recommended'));
  const optLabel = isRec ? 'Recommended routing' : `Option ${activeIdx + 1} of ${optionCount}`;
  const mainLegs = legs.filter(l => l.type !== 'info');
  const infoLegs = legs.filter(l => l.type === 'info');
  const arrowStyle = { position:'absolute' as const, top:'50%', transform:'translateY(-50%)', zIndex:20, background:T.gold, border:`1px solid ${T.gold}`, color:'#0a0a0a', width:34, height:52, cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'3px 0 16px rgba(0,0,0,0.55)', fontWeight:700 };

  return (
    <div style={{ background:'rgba(8,7,12,0.96)', border:`0.5px solid ${isSelected?`${T.gold}55`:'rgba(212,175,55,0.12)'}`, borderRadius:10, overflow:'visible', position:'relative' as const, transition:'border-color 0.25s ease', boxShadow:isSelected?`0 0 0 1px ${T.gold}18, 0 4px 24px rgba(0,0,0,0.4)`:'0 2px 12px rgba(0,0,0,0.3)' }}>

      {optionCount > 1 && activeIdx > 0             && <button onClick={onPrev} aria-label="Previous" style={{...arrowStyle, left:-16,  borderRadius:'0 10px 10px 0'}}>◂</button>}
      {optionCount > 1 && activeIdx < optionCount-1 && <button onClick={onNext} aria-label="Next"     style={{...arrowStyle, right:-16, borderRadius:'10px 0 0 10px'}}>▸</button>}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px 9px', borderBottom:'0.5px solid rgba(212,175,55,0.08)', background:'rgba(212,175,55,0.03)' }}>
        <div>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' as const, color:isRec?T.gold:T.textDim, fontFamily:"'Jost',sans-serif" }}>
            {isRec && <span style={{marginRight:5,opacity:0.8}}>✦</span>}{optLabel}
          </span>
          {durDisplay && <div style={{ fontSize:15, fontWeight:300, color:T.text, fontFamily:"'Cormorant Garamond',serif", letterSpacing:'0.02em', marginTop:1 }}>{durDisplay}</div>}
        </div>
        {optionCount > 1 && (
          <span style={{ fontSize:9, color:T.gold, letterSpacing:'0.08em', fontFamily:"'Jost',sans-serif", fontWeight:700, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:20, padding:'3px 10px' }}>
            {activeIdx+1} of {optionCount} options
          </span>
        )}
      </div>

      {/* Horizontal timeline */}
      <div style={{ padding:'14px 14px 10px', overflowX:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', minWidth:'min-content' }}>
          {mainLegs.map((leg, i) => (
            <div key={i} style={{ display:'contents' }}>
              <div style={{ flex:1, display:'flex', flexDirection:'column' as const, gap:5, padding:'0 14px 0 4px', borderRight: i < mainLegs.length-1 ? `0.5px solid ${T.gold}18` : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <AirlineBadge code={leg.badge} size={40} />
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:14, fontWeight:600, color:T.text, lineHeight:1.2 }}>{leg.primary}</div>
                </div>
                {leg.route && (
                  <div style={{ fontSize:10, color:'rgba(147,197,253,0.9)', fontFamily:"'Jost',sans-serif", fontWeight:700, letterSpacing:'0.04em' }}>
                    {leg.route}
                  </div>
                )}
                {leg.detail && (
                  <div style={{ fontSize:9.5, color:T.textMid, fontFamily:"'Jost',sans-serif", lineHeight:1.55 }}>
                    {leg.detail}
                  </div>
                )}
                {leg.note && (
                  <div style={{ fontSize:9, color:leg.noteColor ?? T.textDim, fontFamily:"'Jost',sans-serif", lineHeight:1.4, fontStyle:'italic', opacity:0.85 }}>
                    {leg.note}
                  </div>
                )}
              </div>
              {i < mainLegs.length-1 && <div style={{ color:`${T.gold}35`, fontSize:20, flexShrink:0, alignSelf:'center', padding:'0 6px' }}>›</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Baggage / info pills */}
      {infoLegs.length > 0 && (
        <div style={{ padding:'0 14px 10px', display:'flex', gap:6, flexWrap:'wrap' as const }}>
          {infoLegs.map((leg,i) => (
            <span key={i} style={{ fontSize:9.5, padding:'2px 8px', borderRadius:6, background:'rgba(251,191,36,0.08)', border:'0.5px solid rgba(251,191,36,0.2)', color:'rgba(251,191,36,0.8)', fontFamily:"'Jost',sans-serif" }}>
              {leg.primary}
            </span>
          ))}
        </div>
      )}

      {/* Routing note */}
      {aiNote && (
        <div style={{ margin:'0 14px 8px', padding:'7px 10px', background:'rgba(212,175,55,0.04)', borderLeft:`1.5px solid ${T.gold}35`, borderRadius:'0 5px 5px 0' }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:`${T.gold}70`, marginBottom:2, fontFamily:"'Jost',sans-serif" }}>Routing note</div>
          <div style={{ fontSize:10.5, color:T.textMid, lineHeight:1.65, fontFamily:"'Jost',sans-serif", fontStyle:'italic' }}>{aiNote}</div>
        </div>
      )}

      {/* Select row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 14px 11px', marginTop:8, borderTop:'0.5px solid rgba(212,175,55,0.07)' }}>
        <span style={{ fontSize:9, color:T.textDim, letterSpacing:'0.06em', fontFamily:"'Jost',sans-serif" }}>Included in your journey · confirmed by specialist</span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {isSelected && <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:T.gold, fontFamily:"'Jost',sans-serif" }}>✦ Selected</span>}
          {onSelect && optionCount > 1 && !isSelected && (
            <button onClick={onSelect} style={{ fontSize:10, fontWeight:600, color:T.gold, background:'transparent', border:`0.5px solid ${T.gold}40`, borderRadius:4, padding:'5px 12px', cursor:'pointer', fontFamily:"'Jost',sans-serif", letterSpacing:'0.06em', transition:'all 0.2s' }}>Select</button>
          )}
        </div>
      </div>

    </div>
  );
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

  // Derive the correct routeKey from the provider string's airport codes
  // e.g. provider "FedAir ...  →  Airlink MQP→CPT  →  ..." → routeKey "MQP-CPT"
  const routeKey = (() => {
    const airports = (cur.provider ?? '').match(/\b(JNB|CPT|MQP|HDS|SZK|MUB|VFA|BBK|LVI|GBE)\b/gi)?.map(a => a.toUpperCase()) ?? [];
    // routeKey is origin_hub-dest_hub — the two COMMERCIAL airports (skip lodge-side codes)
    const origin = originHubAirport(originLodge ?? '', fromSlug);
    const destHub = airports.find(a => a !== origin && ['CPT','JNB','MQP','HDS','SZK','MUB','VFA','BBK','LVI'].includes(a)) ?? '';
    return destHub ? `${origin}-${destHub}` : '';
  })();
  const liveMeta = routeKey ? (commercialMeta??{})[routeKey] : undefined;
  const legs = buildTransferLegs(cur, liveMeta);

  // FIX 6: auto-select the active option as user scrolls — updates grandTotal immediately
  useEffect(() => {
    if (ready && cur) onSelect(cur.id);
  }, [activeIdx, ready]); // eslint-disable-line

  return (
    <div style={{ marginBottom:24 }}>
      <TransferHeader fromLabel={fromLabel} toLabel={toLabel}/>
      {!ready ? (
        <div style={{ background:'rgba(212,175,55,0.04)', border:`0.5px solid ${T.gold}18`, borderRadius:10, padding:'14px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <div className="spinner" style={{width:14,height:14,borderWidth:2}}/>
          <div style={{fontSize:11, color:T.textDim, fontFamily:"'Jost',sans-serif", letterSpacing:'0.04em'}}>Checking live fares…</div>
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


// ── BUILD INSTRUCTION BANNER ──────────────────────────────────────────────
function BuildInstruction({ step, text, subdued = false }: { step: number; text: string; subdued?: boolean }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      margin: subdued ? '8px 0 6px' : '16px 0 10px',
      padding: subdued ? '7px 12px' : '10px 14px',
      background: subdued ? 'rgba(212,175,55,0.03)' : 'rgba(212,175,55,0.06)',
      border: `0.5px solid ${subdued ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.28)'}`,
      borderRadius: 8,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        background: subdued ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.22)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: 9, fontWeight: 700, color: T.gold, fontFamily:"'Jost',sans-serif",
        letterSpacing: '0.04em',
      }}>
        {step}
      </div>
      <div style={{ fontSize: 11, color: subdued ? 'rgba(212,175,55,0.6)' : T.gold, fontWeight: 300, letterSpacing: '0.04em', lineHeight: 1.4 }}>
        {text}
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


// ─────────────────────────────────────────────────────────────────────────────
// DEPARTURE CARD
// Gateway is derived from the selected international flight (departureGateway).
// Shows REAL lodge→gateway transfer options via the same TransferCarousel engine
// (Fastjet / Airlink / FedAir) — no "your specialist will confirm" placeholder.
// ─────────────────────────────────────────────────────────────────────────────
function DepartureCard({
  lastCity, lastSlug, includeIntlFlight, fmt, kbEntries,
  departureHubId, setDepartureHubId, flightSelected, departureGateway,
  originLodge, usdToZar, commercialFares, commercialMeta, pax,
  selectedTransferId, onSelectTransfer,
}: {
  lastCity:any; lastSlug:string; includeIntlFlight:boolean; fmt:(n:number)=>string; kbEntries:KBEntry[];
  departureHubId:string; setDepartureHubId:(v:string)=>void; flightSelected?:boolean; departureGateway?:string;
  originLodge?:string; usdToZar?:number; commercialFares?:Record<string,number>; commercialMeta?:Record<string,any>; pax?:number;
  selectedTransferId?:string|null; onSelectTransfer?:(id:string)=>void;
}) {
  const GATEWAY_LABEL: Record<string,string> = {
    JNB:'O.R. Tambo International (JNB)', CPT:'Cape Town International (CPT)',
    VFA:'Victoria Falls (VFA)', LVI:'Livingstone (LVI)', MUB:'Maun (MUB)',
    HDS:'Hoedspruit (HDS)', MQP:'Kruger Mpumalanga (MQP)', SZK:'Skukuza (SZK)', BBK:'Kasane (BBK)',
  };

  // PRIORITY: gateway comes from the selected international flight.
  // Auto-default: if last slug is VFA or chobe-vic-falls, default to JNB (most common).
  // CPT: default to CPT. Other regions: JNB.
  const autoDefaultHub = lastSlug === 'cape-town' ? 'CPT' : 'JNB';
  const resolvedGateway =
    (flightSelected && departureGateway) ? departureGateway
    : departureHubId || autoDefaultHub;

  // International airports we can route a real departure transfer to.
  const INTL_GATEWAYS = new Set(['JNB','CPT']);
  const gatewayForRouting = INTL_GATEWAYS.has(resolvedGateway) ? resolvedGateway : '';

  // Hubs to offer ONLY when nothing is known yet (no flight selected, no choice made).
  const fallbackHubs = lastSlug === 'cape-town'
    ? [{ code:'CPT', label:'Cape Town International (CPT)', note:'Direct international departures to London, Amsterdam, Frankfurt, New York.' }]
    : [{ code:'JNB', label:'O.R. Tambo International (JNB)', note:'Main hub — most international routes connect via JNB.' },
       { code:'CPT', label:'Cape Town International (CPT)', note:'Good if your itinerary ends in or near Cape Town.' }];

  return (
    <div style={{ marginBottom:24, background:'rgba(212,175,55,0.05)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'16px 18px' }}>
      <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:700, marginBottom:4 }}>✦ Departure from {lastCity.city}</div>

      <div style={{ fontSize:13, color:T.text, fontWeight:600, marginBottom:6 }}>
        {resolvedGateway
          ? (flightSelected ? 'Departing on your selected international flight' : 'Departure airport set')
          : 'Where are you flying home from?'}
      </div>
      <div style={{ fontSize:12, color:T.textDim, marginBottom:14, lineHeight:1.55 }}>
        {resolvedGateway
          ? `Flying from ${GATEWAY_LABEL[resolvedGateway] ?? resolvedGateway}. Choose how you'd like to reach the airport from your final lodge.`
          : includeIntlFlight
            ? 'Once you select your international flight above, your departure airport and transfer options appear here automatically.'
            : "Select your departure airport — we'll show real transfer options from your final lodge."}
      </div>

      {/* Hub selector — always shown when no gateway resolved yet.
           Previously gated on !includeIntlFlight which left guests stranded (Screenshot 11).
           Now always visible so departure routing is never a dead end. */}
      {!resolvedGateway && (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:8, marginBottom:4 }}>
          <div style={{ fontSize:11, color:T.textDim, marginBottom:4 }}>Select where you're flying home from — we'll show transfer options from your final lodge:</div>
          {fallbackHubs.map(hub => (
            <button key={hub.code} onClick={() => setDepartureHubId(hub.code)} style={{ width:'100%', padding:'11px 14px', background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:10, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const }}>
              <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{hub.label}</div>
              <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>{hub.note}</div>
            </button>
          ))}
        </div>
      )}

      {/* REAL transfer options — same engine as inter-region tiles */}
      {gatewayForRouting && (
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:11, color:T.gold, fontWeight:600, marginBottom:10, letterSpacing:'0.04em' }}>
            Transfer options → {GATEWAY_LABEL[gatewayForRouting]}
          </div>
          <TransferCarousel
            fromSlug={lastSlug}
            toSlug={`gateway-${gatewayForRouting.toLowerCase()}`}
            fromLabel={lastCity.city}
            toLabel={GATEWAY_LABEL[gatewayForRouting]}
            fmt={fmt}
            kbEntries={kbEntries}
            selectedTransferId={selectedTransferId ?? null}
            onSelect={id => onSelectTransfer?.(id)}
            destLodge={undefined}
            pax={pax ?? 2}
            usdToZar={usdToZar}
            commercialFares={commercialFares}
            commercialMeta={commercialMeta}
            originLodge={originLodge}
          />
        </div>
      )}

      <div style={{ marginTop:12, fontSize:11, color:T.textDim, borderTop:`0.5px solid ${T.border}`, paddingTop:10 }}>💬 Your Journey Specialist confirms final flight times and airport timing before travel.</div>
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
  // South Africa
  'kruger-sabi-sand': 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1600&q=40',  // leopard on tree
  'cape-town':        'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1600&q=40',  // Table Mountain Atlantic
  'madikwe':          'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1600&q=40',     // elephant at sunset
  'phinda':           'https://images.unsplash.com/photo-1551085254-e96b210db58a?w=1600&q=40',     // KZN coastal bush
  // Botswana
  'okavango-delta':   'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=1600&q=40',  // delta water and reeds
  'chobe-vic-falls':  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600&q=40',  // Victoria Falls mist
  // East Africa
  'masai-mara':       'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=1600&q=40',  // Mara savanna migration
  'bwindi':           'https://images.unsplash.com/photo-1564760055775-d63b17a55c44?w=1600&q=40',  // mountain gorilla Uganda
  // Other
  'mozambique':       'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=40',  // Indian Ocean beach
};

// ── DATE RANGE PICKER ──────────────────────────────────────────────────────
function DateRangePicker({
  startDate, endDate, onRangeChange, T: theme
}: {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string, nights: number) => void;
  T: any;
}) {
  const today = new Date(); today.setHours(0,0,0,0);
  const minDate = new Date(today); minDate.setDate(today.getDate() + 7);

  const [open,        setOpen]        = useState(false);
  const [hoverDate,   setHoverDate]   = useState<string>('');
  const [selecting,   setSelecting]   = useState<'start'|'end'|null>(null);
  const [viewYear,    setViewYear]    = useState(() => {
    if (startDate) return new Date(startDate).getFullYear();
    return new Date(minDate).getFullYear();
  });
  const [viewMonth,   setViewMonth]   = useState(() => {
    if (startDate) return new Date(startDate).getMonth();
    return new Date(minDate).getMonth();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setSelecting(null); setHoverDate('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function fmt(iso: string) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  }
  function toISO(d: Date) {
    return d.toISOString().split('T')[0];
  }
  function nightsBetween(a: string, b: string) {
    if (!a || !b) return 0;
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  }

  const nights = nightsBetween(startDate, endDate);
  const hasRange = !!(startDate && endDate && nights > 0);

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay  = new Date(viewYear, viewMonth + 1, 0);
  const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon-start
  const totalCells = startPad + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);
  const cells: (Date|null)[] = [];
  for (let i = 0; i < rows * 7; i++) {
    const dayNum = i - startPad + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) cells.push(null);
    else cells.push(new Date(viewYear, viewMonth, dayNum));
  }

  function handleDayClick(d: Date) {
    const iso = toISO(d);
    if (d < minDate) return;

    if (!startDate || selecting === 'start' || (startDate && endDate)) {
      // Start fresh
      onRangeChange(iso, '', 0);
      setSelecting('end');
    } else {
      // We have startDate, picking end
      if (iso <= startDate) {
        // Clicked before start — restart
        onRangeChange(iso, '', 0);
        setSelecting('end');
      } else {
        const n = nightsBetween(startDate, iso);
        onRangeChange(startDate, iso, n);
        setSelecting(null);
        setOpen(false);
        setHoverDate('');
      }
    }
  }

  function dayState(d: Date): 'past'|'start'|'end'|'in-range'|'hover-range'|'normal' {
    if (d < minDate) return 'past';
    const iso = toISO(d);
    if (startDate && iso === startDate) return 'start';
    if (endDate && iso === endDate) return 'end';
    if (startDate && endDate && iso > startDate && iso < endDate) return 'in-range';
    if (startDate && !endDate && hoverDate && iso > startDate && iso <= hoverDate) return 'hover-range';
    return 'normal';
  }

  const DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); }
    else setViewMonth(m => m-1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); }
    else setViewMonth(m => m+1);
  }
  // Disable prev if we'd go before the min month
  const canGoPrev = viewYear > minDate.getFullYear() || (viewYear === minDate.getFullYear() && viewMonth > minDate.getMonth());

  const gold = theme.gold;
  const goldDim = theme.goldDim;

  // Display bar text
  let displayLeft = 'Arrival date';
  let displayRight = 'Departure date';
  let displayLeftActive = selecting === 'start' || (!startDate && open);
  let displayRightActive = selecting === 'end';
  if (startDate) displayLeft = fmt(startDate);
  if (endDate)   displayRight = fmt(endDate);

  return (
    <div ref={containerRef} style={{ position:'relative' }}>
      {/* Trigger bar */}
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open) {
            // Determine what we're selecting next
            if (!startDate) setSelecting('start');
            else if (!endDate) setSelecting('end');
            else { setSelecting('start'); }
            // Snap view to startDate month if set
            if (startDate) {
              const d = new Date(startDate);
              setViewYear(d.getFullYear()); setViewMonth(d.getMonth());
            } else {
              setViewYear(minDate.getFullYear()); setViewMonth(minDate.getMonth());
            }
          }
        }}
        style={{
          width:'100%', display:'flex', alignItems:'stretch',
          background:'rgba(255,255,255,0.03)',
          border:`0.5px solid ${open || hasRange ? gold : 'rgba(255,255,255,0.15)'}`,
          borderRadius:10, overflow:'hidden', cursor:'pointer',
          fontFamily:'inherit', transition:'border-color 0.15s', padding:0,
        }}
      >
        {/* Left — arrival */}
        <div style={{
          flex:1, padding:'14px 16px', textAlign:'left' as const,
          borderRight:`0.5px solid ${open||hasRange ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)'}`,
          background: displayLeftActive ? goldDim : 'transparent',
          transition:'background 0.15s',
        }}>
          <div style={{ fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase' as const, color:'rgba(245,240,232,0.4)', fontWeight:300, marginBottom:4 }}>Arrival</div>
          <div style={{ fontSize:14, color: startDate ? gold : 'rgba(245,240,232,0.35)', fontWeight: startDate ? 400 : 200 }}>
            {startDate ? fmt(startDate) : 'Select date'}
          </div>
        </div>
        {/* Nights pill */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'0 12px', flexShrink:0,
          background: hasRange ? goldDim : 'transparent',
        }}>
          {hasRange ? (
            <div style={{ fontSize:11, color:gold, fontWeight:400, whiteSpace:'nowrap' as const, letterSpacing:'0.04em' }}>
              {nights}n
            </div>
          ) : (
            <div style={{ fontSize:16, color:'rgba(255,255,255,0.12)' }}>→</div>
          )}
        </div>
        {/* Right — departure */}
        <div style={{
          flex:1, padding:'14px 16px', textAlign:'left' as const,
          borderLeft:`0.5px solid ${open||hasRange ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)'}`,
          background: displayRightActive ? goldDim : 'transparent',
          transition:'background 0.15s',
        }}>
          <div style={{ fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase' as const, color:'rgba(245,240,232,0.4)', fontWeight:300, marginBottom:4 }}>Departure</div>
          <div style={{ fontSize:14, color: endDate ? gold : 'rgba(245,240,232,0.35)', fontWeight: endDate ? 400 : 200 }}>
            {endDate ? fmt(endDate) : 'Select date'}
          </div>
        </div>
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:300,
          background:'#1c1810', border:`0.5px solid ${gold}`,
          borderRadius:14, padding:'20px 18px 16px',
          boxShadow:'0 16px 56px rgba(0,0,0,0.7)',
        }}>
          {/* Prompt */}
          <div style={{ fontSize:11, color: selecting==='end' ? gold : 'rgba(245,240,232,0.45)', textAlign:'center' as const, marginBottom:14, letterSpacing:'0.12em', fontWeight:200 }}>
            {selecting === 'start' || !startDate ? '✦  Select your arrival date' :
             selecting === 'end' ? '✦  Now select your departure date' :
             `✦  ${nights} night${nights!==1?'s':''} selected`}
          </div>

          {/* Month navigation */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <button onClick={canGoPrev ? prevMonth : undefined}
              style={{ background:'transparent', border:'none', cursor: canGoPrev ? 'pointer' : 'default', color: canGoPrev ? 'rgba(245,240,232,0.6)' : 'rgba(245,240,232,0.15)', fontSize:18, padding:'4px 8px', fontFamily:'inherit', lineHeight:1 }}>
              ‹
            </button>
            <div style={{ fontSize:13, color:theme.text, fontWeight:300, letterSpacing:'0.1em' }}>
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <button onClick={nextMonth}
              style={{ background:'transparent', border:'none', cursor:'pointer', color:'rgba(245,240,232,0.6)', fontSize:18, padding:'4px 8px', fontFamily:'inherit', lineHeight:1 }}>
              ›
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign:'center' as const, fontSize:10, color:'rgba(245,240,232,0.3)', fontWeight:300, letterSpacing:'0.08em', padding:'4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px 0' }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const state = dayState(d);
              const iso   = toISO(d);
              const isStart = state === 'start';
              const isEnd   = state === 'end';
              const inRange = state === 'in-range' || state === 'hover-range';
              const isPast  = state === 'past';
              const isEndpoint = isStart || isEnd;

              return (
                <div
                  key={i}
                  onMouseEnter={() => { if (startDate && !endDate) setHoverDate(iso); }}
                  onMouseLeave={() => setHoverDate('')}
                  onMouseDown={e => { e.preventDefault(); if (!isPast) handleDayClick(d); }}
                  style={{
                    textAlign:'center' as const,
                    padding:'7px 0',
                    cursor: isPast ? 'default' : 'pointer',
                    background: isEndpoint ? gold : inRange ? 'rgba(212,175,55,0.12)' : 'transparent',
                    borderRadius: isStart ? '6px 0 0 6px' : isEnd ? '0 6px 6px 0' : 0,
                    transition:'background 0.08s',
                  }}
                >
                  <div style={{
                    width:30, height:30, lineHeight:'30px',
                    margin:'0 auto',
                    borderRadius: isEndpoint ? '50%' : 4,
                    background: isEndpoint ? gold : 'transparent',
                    fontSize:13,
                    fontWeight: isEndpoint ? 500 : 300,
                    color: isEndpoint ? '#0e0c08' : isPast ? 'rgba(245,240,232,0.18)' : inRange ? gold : theme.text,
                    transition:'all 0.08s',
                  }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clear link */}
          {(startDate || endDate) && (
            <div style={{ marginTop:14, textAlign:'center' as const }}>
              <button
                onMouseDown={e => { e.preventDefault(); onRangeChange('','',0); setSelecting('start'); }}
                style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:11, color:'rgba(245,240,232,0.28)', fontFamily:'inherit', letterSpacing:'0.1em', padding:'4px 8px' }}
              >
                Clear dates
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CITY TYPEAHEAD ─────────────────────────────────────────────────────────
function CityTypeahead({
  value, onChange, options, T: theme
}: {
  value: string;
  onChange: (code: string) => void;
  options: { code: string; label: string; flag: string }[];
  T: any;
}) {
  const selected = options.find(o => o.code === value);
  const [query,    setQuery]    = useState('');
  const [open,     setOpen]     = useState(false);
  const [focused,  setFocused]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
    );
  }, [query, options]);

  const displayText = focused ? query : (selected ? `${selected.flag}  ${selected.label}` : '');

  return (
    <div ref={containerRef} style={{ position:'relative', marginBottom:4 }}>
      <div style={{ position:'relative' }}>
        <input
          type="text"
          value={displayText}
          placeholder={selected ? `${selected.flag}  ${selected.label}` : 'Search city or airport…'}
          onFocus={() => { setFocused(true); setQuery(''); setOpen(true); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          style={{
            width:'100%', boxSizing:'border-box' as const,
            background:'rgba(255,255,255,0.04)',
            border:`0.5px solid ${open ? theme.gold : 'rgba(255,255,255,0.12)'}`,
            color: theme.text, borderRadius:8,
            padding:'12px 40px 12px 14px',
            fontSize:14, outline:'none', fontFamily:'inherit',
            cursor:'text', transition:'border-color 0.15s',
          }}
        />
        <div style={{
          position:'absolute', right:14, top:'50%', transform:`translateY(-50%) rotate(${open?'180deg':'0deg'})`,
          transition:'transform 0.15s', pointerEvents:'none',
          color:'rgba(245,240,232,0.35)', fontSize:10,
        }}>▼</div>
      </div>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200,
          background:'#1a1610', border:`0.5px solid ${theme.gold}`,
          borderRadius:10, maxHeight:240, overflowY:'auto' as const,
          boxShadow:'0 12px 40px rgba(0,0,0,0.6)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding:'14px 16px', fontSize:13, color:'rgba(245,240,232,0.35)', textAlign:'center' as const }}>
              No cities found
            </div>
          ) : filtered.map(o => {
            const isActive = o.code === value;
            return (
              <button
                key={o.code}
                onMouseDown={e => { e.preventDefault(); onChange(o.code); setOpen(false); setQuery(''); setFocused(false); }}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  width:'100%', padding:'11px 16px',
                  background: isActive ? theme.goldDim : 'transparent',
                  border:'none', cursor:'pointer', fontFamily:'inherit',
                  textAlign:'left' as const, transition:'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize:16, flexShrink:0 }}>{o.flag}</span>
                <span style={{ fontSize:13, color: isActive ? theme.gold : theme.text, fontWeight: isActive ? 400 : 300 }}>{o.label}</span>
                <span style={{ fontSize:11, color:'rgba(245,240,232,0.28)', marginLeft:'auto', fontWeight:200 }}>{o.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  // ── Minimum budget tables — per 2 adults, ZAR, excl. international flights ──
  // Derived from cheapest viable combinations across all 5 regions.
  // FLOOR  = absolute cheapest (2n safari + filler CPT) — slider hard lower bound.
  // RECOMMENDED = TSE product minimum — enough safari nights for a real experience.
  // Source: systematic optimisation across all region/night combinations Jun 2026.
  const BUDGET_FLOOR_ZAR: Record<number, number> = {
     5:  90000,   // 2n Madikwe + 3n Cape Town
     6: 100000,   // 2n Madikwe + 4n Cape Town
     7: 110000,   // 2n Madikwe + 5n Cape Town
     8: 120000,   // 2n Madikwe + 6n Cape Town
     9: 130000,   // 2n Madikwe + 7n Cape Town
    10: 140000,   // 2n Madikwe + 8n Cape Town
    12: 155000,   // 2n Madikwe + 10n Cape Town
    14: 175000,   // 2n Madikwe + 12n Cape Town
    21: 250000,   // 2n Madikwe + 19n Cape Town (not a safari — floor only)
  };
  const BUDGET_RECOMMENDED_ZAR: Record<number, number> = {
     5: 100000,   // 3n Madikwe + 2n Cape Town
     6: 120000,   // 4n Madikwe + 2n Cape Town
     7: 130000,   // 4n Madikwe + 3n Cape Town
     8: 145000,   // 5n Madikwe + 3n Cape Town
     9: 190000,   // 4n Madikwe + 2n Vic Falls + 3n Cape Town
    10: 205000,   // 4n Madikwe + 3n Kruger + 3n Cape Town
    12: 255000,   // 4n Madikwe + 4n Kruger + 4n Vic Falls
    14: 305000,   // 4n Madikwe + 4n Kruger + 3n Vic Falls + 3n Cape Town
    21: 455000,   // Grand circuit: Kruger + Okavango + Vic Falls + Cape Town
  };

  // Interpolate between defined night-count points
  const interpolateMin = (table: Record<number,number>, n: number): number => {
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    if (n <= keys[0]) return table[keys[0]];
    if (n >= keys[keys.length-1]) return table[keys[keys.length-1]];
    const lo = keys.filter(k=>k<=n).pop()!;
    const hi = keys.filter(k=>k>=n)[0]!;
    if (lo === hi) return table[lo];
    const t = (n - lo) / (hi - lo);
    return Math.round((table[lo] + t * (table[hi] - table[lo])) / 5000) * 5000;
  };

  // Scale minimums for actual party size (2-adult base; children at 40% adult rate)
  const partyScale = (base2AdultMin: number, adults_: number, children_: number): number => {
    if (adults_ <= 0) return base2AdultMin;
    // Transfer costs are fixed regardless of party; lodge costs scale.
    // Approximate transfer cost share = ~25% of base; lodge = ~75%.
    const transferShare = Math.round(base2AdultMin * 0.25);
    const lodgeShare    = base2AdultMin - transferShare;
    const scaledLodge   = Math.round(lodgeShare * (adults_ + children_ * 0.4) / 2);
    return Math.round((transferShare + scaledLodge) / 5000) * 5000;
  };

  const budgetFloorZAR = partyScale(interpolateMin(BUDGET_FLOOR_ZAR, nights), adults, children);
  const budgetRecZAR   = partyScale(interpolateMin(BUDGET_RECOMMENDED_ZAR, nights), adults, children);

  // Per-night spend basis (for default auto-suggest)
  const AVG_NIGHTLY_PER_ADULT = 22000; // luxury mid-tier all-in
  const CHILD_UPLIFT_FACTOR   = 0.40;

  useEffect(() => {
    const base     = nights * adults * AVG_NIGHTLY_PER_ADULT;
    const childAdd = nights * children * AVG_NIGHTLY_PER_ADULT * CHILD_UPLIFT_FACTOR;
    const raw      = base + childAdd;
    // Snap to nearest R10k; clamp to at least the recommended minimum
    const snapped  = Math.max(budgetRecZAR, Math.round(raw / 10000) * 10000);
    setBudget(snapped);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nights, adults, children]);
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
      if (!fromSlug || !toSlug) continue;
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

  // ── Cost breakdown — source of truth for bottom bar + deposit calculation ───
  // Separated so the bottom bar can show lodge vs flight+transfer split cleanly.
  // Rule: ALL inter-region transfers + city transfers settled immediately (100%).
  //       Lodge + activity costs use the configured deposit percentage (30%).
  const costBreakdown = useMemo(() => {
    if (!itinerary?.cities || cityStays.length === 0)
      return { lodgeCost:0, transferCost:0, cityXferCost:0, activityCost:0 };

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

    // ALL inter-region transfer costs — regardless of mode (commercial/charter/road).
    // Every leg between regions is settled upfront.
    const transferCost = itinerary.cities.reduce((sum, city, i) => {
      if (i >= itinerary.cities.length - 1) return sum;
      const nextCity = itinerary.cities[i + 1];
      const fromSlug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      const toSlug   = CITY_TO_SLUG[nextCity.city.toLowerCase().trim()] ?? '';
      if (!fromSlug || !toSlug) return sum;
      const legKey  = `${fromSlug}→${toSlug}`;
      const nextStay = cityStays[i + 1];
      const nextPool = toSlug ? hotelsByMargin.filter(h => h.subRegion === toSlug) : hotelsByMargin;
      const destHotel = nextPool.find(h => String(h.id) === String(nextStay?.hotelId)) ?? nextPool[0];
      const thisStay = cityStays[i];
      const thisPool = fromSlug ? hotelsByMargin.filter(h => h.subRegion === fromSlug) : hotelsByMargin;
      const originHotel = thisPool.find(h => String(h.id) === String(thisStay?.hotelId)) ?? thisPool[0];
      const usdRate = CURRENCIES.find(c => c.code === 'USD')?.rate ?? 18.62;
      const options = buildTransferOptions(fromSlug, toSlug, destHotel?.name, Math.max(adults + children, 1), usdRate, transferFares, transferMeta, originHotel?.name);
      if (!options.length) return sum;
      const selId  = selectedTransferIds[legKey];
      const chosen = selId ? options.find(o => o.id === selId) : options.find(o => o.recommended) ?? options[0];
      return sum + (chosen?.estimatedCostZAR ?? 0);
    }, 0);

    const activityCost = itinerary.cities.reduce((sum, city) => {
      const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      const sel = selectedActivities[slug] ?? [];
      const pax = Math.max(adults + children, 1);
      return sum + activities.filter(a => sel.includes(String(a.id))).reduce((s, a) => s + Math.round(a.netRate * M.activities) * pax, 0);
    }, 0);

    // City arrival/departure transfers (VFA road, CPT road etc) — also settled immediately
    const cityXferCost = itinerary.cities.reduce((sum, city) => {
      const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      if (!CITY_TYPE_SLUGS.has(slug)) return sum;
      const opts = CITY_TRANSFERS[slug] ?? [];
      if (!opts.length) return sum;
      const selId = cityTransferIds[slug];
      const chosen = selId ? opts.find(o => o.id === selId) : opts.find(o => o.recommended) ?? opts[0];
      return sum + (chosen?.estimatedCostZAR ?? 0);
    }, 0);

    return { lodgeCost, transferCost, cityXferCost, activityCost };
  }, [itinerary?.cities, cityStays, hotelsByMargin, M.hotels, selectedTransferIds,
      selectedActivities, cityTransferIds, adults, children, activities, transferFares]);

  const grandTotal = useMemo(() => {
    const { lodgeCost, transferCost, cityXferCost, activityCost } = costBreakdown;
    const USD_ZAR = CURRENCIES.find(c => c.code === 'USD')?.rate ?? 18.62;
    const intlFlightZAR = selectedFlightOffer
      ? Math.round((selectedFlightOffer.display_price * (adults + children) + flightAncillaryTotal) * USD_ZAR)
      : 0;
    return lodgeCost + transferCost + activityCost + cityXferCost + intlFlightZAR;
  }, [costBreakdown, selectedFlightOffer, flightAncillaryTotal, adults, children]);

  // ── Scroll-reveal for KB columns ──────────────────────────────────────────
  const kbRevealRefs = React.useRef(new Map<string, HTMLDivElement>());
  React.useEffect(() => {
    const observers: IntersectionObserver[] = [];
    kbRevealRefs.current.forEach((el) => {
      if (!el) return;
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          // Add kb-vis to any elements carrying the kb-col-* classes inside the chapter
          el.querySelectorAll('.kb-col-left, .kb-col-right').forEach(d => d.classList.add('kb-vis'));
          obs.disconnect();
        }
      }, { threshold: 0.12 });
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [itinerary?.cities]);

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
    // ── Pre-flight budget check: reject itineraries with impossible budgets ──
    if (budget < budgetFloorZAR) {
      // Snap budget to recommended minimum and show a warning — don't block entirely
      setBudget(budgetRecZAR);
      // Allow the build to proceed with the corrected budget
    }
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
      // Deposit = flights+transfers 100% + lodges 30% (per V7-5 spec)
      const _bd = costBreakdown;
      const _USD = CURRENCIES.find(cur => cur.code === 'USD')?.rate ?? 18.62;
      const _intl = selectedFlightOffer
        ? Math.round((selectedFlightOffer.display_price * (adults+children) + flightAncillaryTotal) * _USD) : 0;
      const _transfersTotal = _bd.transferCost + _bd.cityXferCost + _intl;
      const _lodgesTotal    = _bd.lodgeCost + _bd.activityCost;
      const depositZar = _transfersTotal + Math.round(_lodgesTotal * (edition.payment.depositPercent/100));
      const booking: BookingIntent = { edition_id:edition.id, idempotency_key:checkoutKey, state:'quote', title:itinerary.title, adults, children_count:children, nights, check_in:checkinDate, check_out:addDays(checkinDate,nights), total_display_zar:grandTotal, total_net_zar:Math.round(grandTotal/M.hotels), deposit_zar:depositZar, budget_zar:budget, components, input_mode:inputMode };
      const res  = await fetch('/api/itinerary', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(booking) });
      const data = await res.json();
      if (data.success&&data.id) { track('checkout_started',edition.id,{bookingId:data.id,grandTotal}); window.location.href=`/checkout?id=${data.id}`; }
      else alert('Could not save booking: '+(data.error??'Unknown error'));
    } catch (e:any) { alert('Connection error: '+(e?.message??String(e))); }
    setCheckoutLoading(false);
  };

  const validationIssues = useMemo(() => validateItinerary({ cities:itinerary?.cities??[], checkinDate, infants, hasOwnFlights:!includeIntlFlight, arrivalFlightNo }), [itinerary?.cities, checkinDate, infants, includeIntlFlight, arrivalFlightNo]);

  const navProps = { edition, setScreen, currency, setCurrency, chatOpen, setChatOpen, totalZAR:grandTotal, fmt, hasPricedItems:grandTotal>0 };

  const handleRoomUpgrade = (cityIdx: number, tier: number) => {
    setCityStays(prev => prev.map((s, i) => i === cityIdx ? { ...s, prefs: { ...s.prefs, rooms: tier } } : s));
  };

  if (!unlocked) return <LoginGate onUnlock={()=>setUnlocked(true)} />;

  return (
    <>
      <style suppressHydrationWarning>{GLOBAL_CSS}</style>
      <style>{`
        @keyframes kbFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .kb-col-left  { opacity:0; transition:none; }
        .kb-col-right { opacity:0; transition:none; }
        .kb-col-left.kb-vis  { animation: kbFadeUp 0.75s ease forwards; }
        .kb-col-right.kb-vis { animation: kbFadeUp 0.75s ease forwards 0.5s; }
      `}</style>

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
                    <CityTypeahead
                      value={intlOrigin}
                      onChange={setIntlOrigin}
                      options={INTERNATIONAL_ORIGINS}
                      T={T}
                    />
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
              <CityTypeahead
                value={intlOrigin}
                onChange={setIntlOrigin}
                options={INTERNATIONAL_ORIGINS}
                T={T}
              />
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
          <SectionLabel text="When are you travelling?" sub="Tap arrival then departure — nights calculated automatically" />
          <DateRangePicker
            startDate={checkinDate}
            endDate={windowEnd}
            onRangeChange={(start, end, n) => {
              setCheckinDate(start);
              setWindowEnd(end);
              if (n > 0) setNights(n);
            }}
            T={T}
          />
          {!checkinDate && (
            <div style={{ marginTop:10, fontSize:11, color:'rgba(245,240,232,0.32)', fontWeight:200 }}>
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
              {adults>0 && <div style={{ fontSize:11, color:'rgba(245,240,232,0.28)', marginTop:4, fontWeight:200, letterSpacing:'0.06em' }}>approx {fmt(Math.round(budget/(adults + children*0.4 || 1)))} per person</div>}
              {children>0 && <div style={{ fontSize:10, color:'rgba(212,175,55,0.45)', marginTop:2, fontWeight:200, letterSpacing:'0.06em' }}>includes {children} child{children>1?'ren':''} — adjusted for family accommodation</div>}
              {budget < budgetRecZAR && (
                <div style={{ fontSize:10, color:'rgba(251,146,60,0.7)', marginTop:2, fontWeight:200, letterSpacing:'0.04em' }}>
                  rec. min {fmt(budgetRecZAR)} for {nights}n
                </div>
              )}
            </div>
          </div>
          {/* ── Budget slider with dynamic minimum ── */}
          <div style={{ paddingTop:18 }}>
            <input
              type="range"
              className="budget-range"
              min={budgetFloorZAR}
              max={2000000}
              step={5000}
              value={Math.max(budget, budgetFloorZAR)}
              onChange={e => setBudget(+e.target.value)}
              style={{ width:'100%' }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
              <div>
                <span style={{ fontSize:11, color:'rgba(245,240,232,0.25)', fontWeight:200 }}>{fmt(budgetFloorZAR)}</span>
                <span style={{ fontSize:9, color:'rgba(245,240,232,0.18)', fontWeight:200, marginLeft:4, letterSpacing:'0.04em' }}>min</span>
              </div>
              <span style={{ fontSize:11, color:'rgba(245,240,232,0.25)', fontWeight:200 }}>{fmt(2000000)}</span>
            </div>
          </div>

          {/* ── Budget warnings: two thresholds ── */}
          {(() => {
            const isBelowFloor = budget < budgetFloorZAR;
            const isBelowRec   = budget >= budgetFloorZAR && budget < budgetRecZAR;
            const isOk         = budget >= budgetRecZAR;

            if (isBelowFloor) {
              // Shouldn't reach here (slider min = floor), but protect against manual state
              return (
                <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(248,113,113,0.07)', border:'0.5px solid rgba(248,113,113,0.35)', borderRadius:8 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#f87171', marginBottom:3 }}>⚠ Below minimum for {nights} nights</div>
                  <div style={{ fontSize:11, color:'rgba(248,113,113,0.8)', lineHeight:1.55 }}>
                    The minimum cost for a {nights}-night trip (2 nights safari + Cape Town) is {fmt(budgetFloorZAR)}. No viable itinerary exists below this. Increase your budget or reduce nights.
                  </div>
                  <button onClick={() => setBudget(budgetRecZAR)} style={{ marginTop:8, padding:'5px 12px', background:'rgba(248,113,113,0.12)', border:'0.5px solid rgba(248,113,113,0.3)', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                    Set to recommended minimum → {fmt(budgetRecZAR)}
                  </button>
                </div>
              );
            }
            if (isBelowRec) {
              const gap = budgetRecZAR - budget;
              return (
                <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(251,146,60,0.06)', border:'0.5px solid rgba(251,146,60,0.3)', borderRadius:8 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#fb923c', marginBottom:3 }}>◈ Limited budget for {nights} nights</div>
                  <div style={{ fontSize:11, color:'rgba(251,191,36,0.8)', lineHeight:1.55 }}>
                    At this budget your itinerary will be restricted to a 2-night bush stay with Cape Town for the remaining nights. For a proper {nights}-night safari experience, {fmt(budgetRecZAR)} is the recommended minimum — just {fmt(gap)} more.
                  </div>
                  <button onClick={() => setBudget(budgetRecZAR)} style={{ marginTop:8, padding:'5px 12px', background:'rgba(251,146,60,0.10)', border:'0.5px solid rgba(251,146,60,0.28)', borderRadius:6, color:'#fb923c', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                    Increase to recommended → {fmt(budgetRecZAR)}
                  </button>
                </div>
              );
            }
            if (isOk) {
              return (
                <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.08)', borderRadius:8 }}>
                  <div style={{ fontSize:11, color:'rgba(245,240,232,0.32)', lineHeight:1.65, fontWeight:200 }}>
                    ✦ Budget covers lodges, all domestic flights, transfers and activities for {nights} nights. International flights are calculated separately.
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* ── DEPARTURE AIRPORT — only when flights not yet confirmed ── */}
        {(flightIntent === 'flexible' || !flightIntent) && (
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
        )}

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
                  <BudgetNudge
                cities={itinerary.cities}
                cityStays={cityStays}
                hotels={hotelsByMargin}
                budget={budget}
                grandTotal={grandTotal}
                marginMult={M.hotels}
                fmt={fmt}
                onApply={handleRoomUpgrade}
              />
              <div style={{ marginTop:12, paddingTop:12, borderTop:`0.5px solid ${T.border}`, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(212,175,55,0.08)', border:`1.5px solid ${T.borderGold}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:16, color:T.gold, opacity:0.8 }}>&#10022;</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:T.gold, fontWeight:600 }}>A specialist will be assigned to your journey</div>
                  <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>Questions before you confirm? Chat with our team now.</div>
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

            {/* ── ARRIVAL TRANSFER: gateway airport → first region ─────── */}
            {(() => {
              const gateway = flightArrivalGateway || arrivalAirport || departureHubId || 'JNB';
              if (!gateway || !itinerary.cities[0]) return null;
              const firstSlug = CITY_TO_SLUG[itinerary.cities[0].city.toLowerCase().trim()] ?? '';
              if (!firstSlug) return null;
              // Cape Town as first city: show CityTransferStrip only (CPT→hotel handled there)
              // All other first regions: use TransferCarousel with GATEWAY_LEGS fallback
              if (firstSlug === 'cape-town') return null; // CityTransferStrip handles CPT arrival
              const firstStay = cityStays[0];
              const firstPool = hotelsByMargin.filter(h => h.subRegion === firstSlug);
              const firstHotel = firstPool.find(h => String(h.id) === String(firstStay?.hotelId)) ?? firstPool[0];
              const usdRate = CURRENCIES.find(c => c.code === 'USD')?.rate ?? 18.62;
              const legKey = `gateway-${gateway}-${firstSlug}`;
              return (
                <TransferCarousel
                  key={legKey}
                  fromSlug={gateway.toLowerCase()}
                  toSlug={firstSlug}
                  fromLabel={gateway}
                  toLabel={itinerary.cities[0].city}
                  fmt={fmt}
                  kbEntries={kbEntries}
                  selectedTransferId={selectedTransferIds[legKey] ?? null}
                  onSelect={id => setSelectedTransferIds(prev => ({ ...prev, [legKey]: id }))}
                  destLodge={firstHotel?.name}
                  pax={Math.max(adults + children, 1)}
                  usdToZar={usdRate}
                  commercialFares={transferFares}
                  commercialMeta={transferMeta}
                  originLodge={undefined}
                />
              );
            })()}

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
              // Never filter by pax — all properties shown; specialist confirms family suitability
              const safePool = pool.length > 0
                ? pool.slice(0, 20)
                : hotelsByMargin.filter(h => (h.country ?? '') === (itinerary.cities[cityIdx]?.country ?? '')).slice(0, 6);
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
                // Only include traveller-oriented fields. 'specialist_notes', 'booking_notes',
                // 'margin_notes', and anything starting with ops context is excluded.
                const safeKeys = ['best_sightings','best_season','ideal_nights'];
                return safeKeys.map(k => sf[k]).filter((v:any) => typeof v === 'string' && v.length > 10) as string[];
              })();
              // Filter out consultant-coded language not appropriate for travellers.
              // Tips starting with "Lead with", "Route via", "For honeymooners:" etc.
              // should stay in the specialist KB, not surface to the traveller.
              const SPECIALIST_PREFIXES = [
                'lead with','route via','for honeymooners','for guests with','for multi-family',
                'our rates','DMC','override','book via','commission','margin',
              ];
              const kbTips: string[] = (Array.isArray(regionEntry?.tips) ? regionEntry.tips : [])
                .filter((tip: string) => {
                  const lower = tip.toLowerCase();
                  return !SPECIALIST_PREFIXES.some(p => lower.startsWith(p));
                });
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
                <div ref={(el) => { if (el) kbRevealRefs.current.set(slug+'-'+cityIdx, el); else kbRevealRefs.current.delete(slug+'-'+cityIdx); }}>
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
                  selectedHotelIncludes={(() => {
                    // Cape Town properties always include breakfast (standard in CPT market).
                    // Other regions: pull from hotel.rate_includes.
                    const hotelIncludes = selectedHotel?.rate_includes ?? [];
                    if (slug === 'cape-town') {
                      // Always include breakfast for Cape Town, even if rate_includes is empty
                      return hotelIncludes.includes('all_meals')
                        ? hotelIncludes
                        : ['accommodation', ...hotelIncludes.filter((i:string) => i !== 'accommodation'), 'breakfast_included'].filter(Boolean);
                    }
                    return hotelIncludes;
                  })()}
                  malariaFree={hotelMalariaFree}
                  seasonalNote={seasonalNote}
                  specialistNote={specialistNote}
                >
                  {/* ── STEP 1: ARRIVAL TRANSFER ── */}
                  {isCityDest && cityXferOpts.length > 0 && (
                    <>
                      <BuildInstruction step={1} text={`Select how you'd like to get from ${destLabel === 'Cape Town' ? 'Cape Town International Airport' : destLabel + ' Airport'} to your hotel`} />
                      <CityTransferStrip slug={slug} destLabel={destLabel} opts={cityXferOpts} selectedId={selCityXferId} onSelect={id => setCityTransferIds(prev => ({ ...prev, [slug]: id }))} fmt={fmt} />
                    </>
                  )}

                  {/* ── STEP 2: PROPERTY ── */}
                  {/* ── Minimum nights guardrail — visible BEFORE traveller gets to Validate ── */}
                  {currentStay.nights < 2 && (
                    <div style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 14px', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:9, marginBottom:12 }}>
                      <span style={{ fontSize:14 }}>⚠</span>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#f87171', marginBottom:2 }}>1 night is too short for {destLabel}</div>
                        <div style={{ fontSize:11, color:'rgba(248,113,113,0.8)', lineHeight:1.5 }}>We recommend a minimum of 2 nights at any destination — guests need time to arrive, settle in, and experience at least two game drives. Use the + button above to add a night.</div>
                      </div>
                    </div>
                  )}
                  <BuildInstruction step={isCityDest && cityXferOpts.length > 0 ? 2 : 1} text={`Select your ${destLabel} property — swipe to compare options`} />
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
                  />

                  {/* ── STEP 3: EXPERIENCES ── */}
                  <BuildInstruction step={isCityDest && cityXferOpts.length > 0 ? 3 : 2} text={`Add ${destLabel} experiences to your package — priced per person × ${Math.max(adults+children,1)}`} subdued />
                  {/* Step numbering reference: city=1(airport)+2(prop)+3(exp)+4(dep), non-city=1(prop)+2(exp)+3(dep) */}
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
                    pax={Math.max(adults + children, 1)}
                  />

                  {/* Cape Town DEPARTURE transfer: hotel → CPT airport for onward flight */}
                  {slug === 'cape-town' && cityIdx < itinerary.cities.length - 1 && cityXferOpts.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <BuildInstruction step={4} text={`Select your transfer from your ${destLabel} hotel back to Cape Town International Airport`} />
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'0 2px' }}>
                        <div style={{ flex:1, height:1, background:'rgba(74,222,128,0.15)' }} />
                        <div style={{ fontSize:11, color:T.green, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const }}>
                          🚗 Hotel → Cape Town Airport
                        </div>
                        <div style={{ flex:1, height:1, background:'rgba(74,222,128,0.15)' }} />
                      </div>
                      <div style={{ background:'rgba(8,7,12,0.96)', border:`0.5px solid rgba(74,222,128,0.18)`, borderRadius:10, padding:'12px 14px' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:T.text, fontFamily:"'Cormorant Garamond',serif", marginBottom:4 }}>Private transfer to CPT</div>
                        <div style={{ fontSize:10, color:T.textMid }}>30–45 min · Hotel → Cape Town International</div>
                        <div style={{ fontSize:9.5, color:T.textDim, marginTop:3 }}>Driver meets at hotel · luggage assistance · same provider as arrival transfer</div>
                        <div style={{ marginTop:8, fontSize:9, color:T.textDim, letterSpacing:'0.05em' }}>Allow 2h before departure · confirm timing with specialist</div>
                      </div>
                    </div>
                  )}

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
                      <>
                        {/* Departure step: non-city=3, city-with-airport=4, CPT-with-return=5 */}
                        <BuildInstruction step={(() => {
                          if (!isCityDest || cityXferOpts.length === 0) return 3;
                          if (slug === 'cape-town' && cityIdx < itinerary.cities.length - 1) return 5;
                          return 4;
                        })()} text={`Select your flight from ${itinerary.cities[cityIdx].city} to ${nextCity.city} — options include commercial routes and charter connections`} />
                        <TransferCarousel key={legKey} fromSlug={fromSlug} toSlug={toSlug} fromLabel={itinerary.cities[cityIdx].city} toLabel={nextCity.city} fmt={fmt} kbEntries={kbEntries} selectedTransferId={selectedTransferIds[legKey] ?? null} onSelect={id => setSelectedTransferIds(prev => ({ ...prev, [legKey]: id }))} destLodge={destHotel?.name} pax={Math.max(adults + children, 1)} usdToZar={usdRate} commercialFares={transferFares} commercialMeta={transferMeta} originLodge={originHotel?.name} />
                      </>
                    );
                  })()}
                </RegionChapter>
                </div>
              );
            })}

            {itinerary.cities.length > 0 && (() => {
              const lastCity = itinerary.cities[itinerary.cities.length - 1];
              const lastSlug = CITY_TO_SLUG[lastCity?.city?.toLowerCase().trim() ?? ''] ?? '';
              const lastStay = cityStays[cityStays.length - 1];
              const lastPool = hotelsByMargin.filter(h => h.subRegion === lastSlug);
              const lastHotel = lastPool.find(h => String(h.id) === String(lastStay?.hotelId)) ?? lastPool[0];
              const usdRate = CURRENCIES.find(c => c.code === 'USD')?.rate ?? 18.62;
              const depGw = (selectedFlightOffer && flightDepartureGateway) ? flightDepartureGateway : departureHubId;
              const depKey = `depart-${depGw || 'tbd'}`;
              return (
                <DepartureCard
                  lastCity={lastCity}
                  lastSlug={lastSlug}
                  includeIntlFlight={includeIntlFlight}
                  fmt={fmt}
                  kbEntries={kbEntries}
                  departureHubId={departureHubId}
                  setDepartureHubId={setDepartureHubId}
                  flightSelected={!!selectedFlightOffer}
                  departureGateway={flightDepartureGateway}
                  originLodge={lastHotel?.name}
                  usdToZar={usdRate}
                  commercialFares={transferFares}
                  commercialMeta={transferMeta}
                  pax={Math.max(adults + children, 1)}
                  selectedTransferId={selectedTransferIds[depKey] ?? null}
                  onSelectTransfer={id => setSelectedTransferIds(prev => ({ ...prev, [depKey]: id }))}
                />
              );
            })()}

            {filterWarnings(itinerary.warnings??[]).length>0 && (
              <div style={{ background:'rgba(251,146,60,0.07)', border:'0.5px solid rgba(251,146,60,0.22)', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
                {filterWarnings(itinerary.warnings??[]).map((w:string,i:number)=><div key={i} style={{ fontSize:12, color:'rgba(251,146,60,0.9)', lineHeight:1.55 }}>⚠ {w}</div>)}
              </div>
            )}
            {infants>0&&<div style={{ background:'rgba(251,191,36,0.07)', border:'0.5px solid rgba(251,191,36,0.2)', borderRadius:12, padding:'12px 16px', marginBottom:16, fontSize:12, color:T.amber }}>⚠ {infants} infant{infants>1?'s':''} on this trip. Journey Specialist will confirm age policies with each property.</div>}
          </div>

          {/* ── Sticky bottom price bar ─────────────────────────────────────── */}
          <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:90, background:'rgba(8,8,8,0.98)', backdropFilter:'blur(24px)', borderTop:`0.5px solid ${T.borderGold}`, padding:'10px 16px 12px' }}>

            {/* Route reversal tip */}
            {routeReversalResult?.is_cheaper && !routeReversalDismissed && (
              <div style={{ maxWidth:680, margin:'0 auto 10px', padding:'9px 12px', background:'rgba(74,222,128,0.06)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:8, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:14 }}>🔄</span>
                <div style={{ flex:1, fontSize:11, color:T.green }}>Tip: Reversing your route saves {fmt(routeReversalResult.saving)} on transfers</div>
                <button onClick={() => { setRouteReversalDismissed(true); if (itinerary) { const reversed = [...itinerary.cities].reverse(); setItinerary({ ...itinerary, cities: reversed }); setCityStays([...cityStays].reverse()); } }} style={{ fontSize:10, color:T.green, background:'rgba(74,222,128,0.12)', border:'0.5px solid rgba(74,222,128,0.3)', borderRadius:5, padding:'4px 9px', cursor:'pointer', fontFamily:'inherit', fontWeight:600, flexShrink:0 }}>Apply</button>
                <button onClick={() => setRouteReversalDismissed(true)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>×</button>
              </div>
            )}

            <div style={{ maxWidth:680, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              {/* Left: breakdown — inline, same row as total */}
              {(() => {
                const { lodgeCost, transferCost, cityXferCost, activityCost } = costBreakdown;
                const USD_ZAR = CURRENCIES.find((c:any) => c.code === 'USD')?.rate ?? 18.62;
                // International flights (Duffel)
                const intlFlightZAR = selectedFlightOffer
                  ? Math.round((selectedFlightOffer.display_price * (adults + children) + flightAncillaryTotal) * USD_ZAR)
                  : 0;
                // ALL transfers settled immediately (100%) — inter-region + city transfers
                const allTransferZAR = transferCost + cityXferCost;
                // Total in ✈ Flights & Transfers column
                const flightsAndTransfersTotal = intlFlightZAR + allTransferZAR;
                // Lodge & activities column (subject to 30% deposit)
                const lodgesOnly = lodgeCost + activityCost;
                const hasFlightsOrTransfers = flightsAndTransfersTotal > 0;
                // Deposit = 100% of all flights+transfers + 30% of lodges
                const depositPct = edition.payment.depositPercent / 100;
                const depositAmount = flightsAndTransfersTotal + Math.round(lodgesOnly * depositPct);
                const nights = itinerary.cities.reduce((s:number,c:any)=>s+c.nights,0);
                return (
                  <>
                    {grandTotal > 0 && (
                      <div style={{ display:'flex', gap:20, alignItems:'flex-end' }}>
                        {/* Column 1: Lodges */}
                        <div>
                          <div style={{ fontSize:8, color:'rgba(245,240,232,0.38)', textTransform:'uppercase' as const, letterSpacing:'0.12em', marginBottom:2 }}>Lodges</div>
                          <div style={{ fontSize:13, color:'rgba(245,240,232,0.78)', fontWeight:400 }}>{fmt(lodgesOnly)}</div>
                        </div>
                        {/* Column 2: Flights & Transfers — settled immediately */}
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                            <span style={{ fontSize:8, color:'rgba(245,240,232,0.38)', textTransform:'uppercase' as const, letterSpacing:'0.12em' }}>✈ Flights & Transfers</span>
                            {hasFlightsOrTransfers && (
                              <span style={{ fontSize:7, background:'rgba(212,175,55,0.12)', color:T.gold, border:'0.5px solid rgba(212,175,55,0.35)', borderRadius:3, padding:'1px 4px', letterSpacing:'0.08em', fontWeight:700 }}>SETTLED IN FULL</span>
                            )}
                          </div>
                          <div style={{ fontSize:13, color: hasFlightsOrTransfers ? T.gold : 'rgba(245,240,232,0.28)', fontWeight:400 }}>
                            {hasFlightsOrTransfers
                              ? fmt(flightsAndTransfersTotal)
                              : <span style={{ fontSize:11 }}>Add international flights</span>
                            }
                          </div>
                        </div>
                        {/* Divider */}
                        <div style={{ width:'0.5px', height:28, background:'rgba(255,255,255,0.08)', alignSelf:'center' }} />
                        {/* Column 3: Total + deposit note */}
                        <div>
                          <div style={{ fontSize:8, color:'rgba(245,240,232,0.38)', textTransform:'uppercase' as const, letterSpacing:'0.12em', marginBottom:2 }}>Total · {nights}n · {adults+children} guests</div>
                          <div style={{ fontSize:22, fontWeight:700, color:T.gold, fontFamily:"'Cormorant Garamond',serif", lineHeight:1 }}>{fmt(grandTotal || itinerary.totalEstimate)}</div>
                          {depositAmount > 0 && depositAmount < grandTotal && (
                            <div style={{ fontSize:9, color:T.textDim, marginTop:2 }}>
                              Pay today: <span style={{ color:T.gold, fontWeight:600 }}>{fmt(depositAmount)}</span>
                              <span style={{ opacity:0.5 }}> · balance 30 days before travel</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {grandTotal === 0 && (
                      <div>
                        <div style={{ fontSize:8, color:'rgba(245,240,232,0.38)', textTransform:'uppercase' as const, letterSpacing:'0.12em', marginBottom:2 }}>Package total · {itinerary.cities.reduce((s:number,c:any)=>s+c.nights,0)} nights</div>
                        <div style={{ fontSize:22, fontWeight:700, color:T.gold, fontFamily:"'Cormorant Garamond',serif", lineHeight:1 }}>{fmt(itinerary.totalEstimate)}</div>
                      </div>
                    )}
                    <button className="btn-gold" style={{ padding:'13px 24px', fontSize:14, flexShrink:0 }} onClick={handleValidateAndPay} disabled={checkoutLoading}>
                      {checkoutLoading ? 'Saving…' : (
                        <span style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                          <span style={{ fontWeight:600 }}>Validate & Firm up →</span>
                          <span style={{ fontSize:9, fontWeight:400, opacity:0.6, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Confirm & price journey</span>
                        </span>
                      )}
                    </button>
                  </>
                );
              })()}
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
