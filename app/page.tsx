'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// THE TRAVEL CATALOGUE — page.tsx
// Safari Edition · v5.0 · Built on v4.0
//
// CHANGES FROM v4.0:
// [V5-1]  inspire-plan screen REMOVED. AI runs silently, pre-loads builder.
//         Minimal AI summary banner at top of Price & Book (title + routing + total).
//         Adjust-via-chat panel embedded as collapsible inside Price & Book.
// [V5-2]  Landing CTAs: bigger buttons with descriptor text under each label.
// [V5-3]  Price & Book = single unified screen. Flow: Socratic/Brief → Research →
//         Price & Book → Validate → Payment.
// [V5-4]  NESTED PEEKING CAROUSEL per destination:
//         - Outer: property carousel (tap arrows to switch properties)
//         - Inner: image/reel carousel per property tile (swipe or tap arrows)
//         - Active property = selected; price total auto-updates on navigation
//         - AI pre-selected property shown first, stays active until explicit tap
// [V5-5]  PropertyTile: hero image first, then reel/video, then approved images
//         (from Supabase images JSONB). Sources: images array + reel_url/video_url.
// [V5-6]  TSE Diamond (◆): tapped to reveal image-specific KB note.
//         Hidden if no KB entry maps to the current image/room. Gold diamond icon.
// [V5-7]  ? Button: inline mini-chat (3 message limit) pre-seeded with property +
//         current image context. After 3 messages: "Talk to a specialist" escalates
//         to the existing Journey Specialists drawer with full context pre-loaded.
// [V5-8]  "Upgrade or Personalise" bottom-sheet modal: 85% screen, slides up.
//         Shows room types, meal bases, KB specialist notes, review score, social
//         links — only sections where data exists. Empty sections hidden.
// [V5-9]  Floating sticky price bar at BOTTOM. Destination subtotals in each
//         section header. Grand total updates live on every carousel interaction.
// [V5-10] Nights control moved below each destination carousel.
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
import type { Screen, Pillar, InputMode, Hotel, PropertyStay,
              InterTransferState, UpgradeState, Itinerary,
              ItineraryCity, Currency, KBEntry, ChatMessage,
              BookingIntent, BookingComponent,
              AvailResult, AltDate, EditionConfig }  from './lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// EDITION CONFIG  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const SAFARI_EDITION: EditionConfig = {
  id: 'safari', name: 'The Safari Edition',
  tagline: 'Sub-Saharan Africa · Curated',
  heroImage: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1400&q=80',
  primaryRegion: 'southern-africa', defaultCurrency: 'ZAR',
  margins: { flights: 1.08, hotels: 1.15, transfers: 1.20, activities: 1.18, intl: 1.08 },
  ai: { plannerModel: 'claude-sonnet-4-5', chatModel: 'claude-haiku-4-5-20251001', maxPlanTokens: 1200, maxChatTokens: 400, monthlyBudgetZAR: 5000 },
  payment: { gateways: ['payfast', 'stripe'], depositPercent: 30, balanceDaysBefore: 30 },
  support: { email: 'journeys@thesafariedition.com', whatsapp: '+27000000000' },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA  (carried from v4.0)
// ─────────────────────────────────────────────────────────────────────────────
const CURRENCIES: Currency[] = [
  { code: 'ZAR', symbol: 'R ',  rate: 1     },
  { code: 'USD', symbol: '$',   rate: 18.62 },
  { code: 'EUR', symbol: '€',   rate: 20.14 },
  { code: 'GBP', symbol: '£',   rate: 23.48 },
];

const OTHER_EDITIONS = [
  { id:'island',    name:'The Island Edition',    icon:'🏝', color:'#60a5fa', desc:'Maldives · Seychelles · Zanzibar' },
  { id:'adventure', name:'The Adventure Edition', icon:'🧗', color:'#4ade80', desc:'Nepal · Patagonia · Arctic' },
  { id:'japan',     name:'The Japan Edition',     icon:'⛩',  color:'#f87171', desc:'Tokyo · Kyoto · Hokkaido' },
  { id:'ski',       name:'The Ski Edition',       icon:'⛷',  color:'#a78bfa', desc:'Alps · Aspen · Hokkaido' },
];

const REGIONS = [
  { id: 'kruger',     label: 'Kruger / Sabi Sand',  icon: '🐆', slug: 'kruger-sabi-sand' },
  { id: 'okavango',   label: 'Okavango Delta',       icon: '🛶', slug: 'okavango-delta'   },
  { id: 'cape-town',  label: 'Cape Town',            icon: '🏔', slug: 'cape-town'        },
  { id: 'madikwe',    label: 'Madikwe',              icon: '🦏', slug: 'madikwe'          },
  { id: 'chobe',      label: 'Chobe / Vic Falls',    icon: '🌊', slug: 'chobe-vic-falls'  },
  { id: 'masai-mara', label: 'Masai Mara',           icon: '🦒', slug: 'masai-mara'       },
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

// Destinations that are cities / hubs — need airport ↔ hotel transfer cards
// (wilderness camps don't need this; cities do)
// Always show airport transfer card for these city-type destinations
const CITY_TYPE_ALWAYS = new Set(['cape-town','chobe-vic-falls']);
// Show for these only if KB has an entry flagging in-city transfers (type='city_transfer')
const CITY_TYPE_KB = new Set(['masai-mara','bwindi','mozambique']);
// Combined for grandTotal calculation
const CITY_TYPE_SLUGS = new Set([...CITY_TYPE_ALWAYS, ...CITY_TYPE_KB]);

// City airport transfer options — different from inter-region legs
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

const ACTIVITIES = [
  { id:2, name:'Bush Walk with Armed Ranger',    type:'Adventure',    duration:'3 hours · dawn',            trustScore:97, netRate:1800, otaRate:2600, image:'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80', funFact:'Tracks, plants — the detail you miss from a vehicle.', region_tags:['kruger-sabi-sand','okavango-delta','masai-mara','madikwe','chobe-vic-falls'], upgrades:{ options:[{label:'Group walk',extra:0},{label:'Private walk',extra:2400}], extras:[{label:'Standard',extra:0},{label:'Breakfast in the bush',extra:680}] } },
  { id:3, name:'Hot Air Balloon Safari',         type:'Luxury',       duration:'3 hours · dawn',            trustScore:94, netRate:4800, otaRate:7200, image:'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', funFact:'The Mara from above — one of the great experiences on Earth.', region_tags:['masai-mara','kruger-sabi-sand'], upgrades:{ options:[{label:'Shared basket',extra:0},{label:'Private basket',extra:8500}], extras:[{label:'Champagne breakfast',extra:0},{label:'Private bush breakfast',extra:1200}] } },
  { id:4, name:'Night Drive & Spotlight Safari', type:'Wildlife',     duration:'2.5 hours · 20:00',         trustScore:95, netRate:1200, otaRate:1800, image:'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=800&q=80', funFact:'Leopards, civets, honey badgers — the nocturnal world.', region_tags:['kruger-sabi-sand','okavango-delta','masai-mara','madikwe','chobe-vic-falls'], upgrades:{ options:[{label:'Group drive',extra:0},{label:'Private drive',extra:2800}], extras:[{label:'Standard',extra:0},{label:'Add sundowners',extra:480}] } },
  { id:5, name:'Victoria Falls Helicopter',      type:'Scenic',       duration:"15 min 'Flight of Angels'", trustScore:96, netRate:2800, otaRate:4200, image:'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80', funFact:'108m high, 1.7km wide — the only way to grasp the scale.', region_tags:['chobe-vic-falls'], upgrades:{ options:[{label:'15-minute flight',extra:0},{label:'30-minute flight',extra:2200}], extras:[{label:'Standard',extra:0},{label:'Private helicopter',extra:5800}] } },
  { id:6, name:'Rhino Tracking on Foot',         type:'Conservation', duration:'Half day',                  trustScore:93, netRate:2200, otaRate:3200, image:'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80', funFact:'One of only a handful of places you can approach white rhino on foot.', region_tags:['madikwe','kruger-sabi-sand'], upgrades:{ options:[{label:'Group tracking',extra:0},{label:'Private with conservationist',extra:3400}], extras:[{label:'Standard',extra:0},{label:'Full conservation day',extra:4800}] } },
  { id:7, name:'Mokoro Safari',                  type:'Wildlife',     duration:'2 hours',                   trustScore:96, netRate:1600, otaRate:null,  image:'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&q=80', funFact:'Silent dugout canoe through papyrus — the sound of the Delta.', region_tags:['okavango-delta'], upgrades:{ options:[{label:'Shared mokoro',extra:0},{label:'Private mokoro',extra:1800}], extras:[{label:'Standard',extra:0},{label:'Sundowner picnic',extra:550}] } },
  { id:8, name:'Cape Town Winelands Day Tour',   type:'Culture',      duration:'Full day',                  trustScore:92, netRate:2400, otaRate:3600, image:'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80', funFact:'Franschhoek, Stellenbosch, Paarl — three valleys in one day.', region_tags:['cape-town'], upgrades:{ options:[{label:'Shared tour',extra:0},{label:'Private guide & vehicle',extra:3200}], extras:[{label:'Standard',extra:0},{label:'Private cellar tastings',extra:800}] } },
  { id:9, name:'Great Migration River Crossing', type:'Wildlife',     duration:'Full day river camp',       trustScore:98, netRate:3600, otaRate:5400, image:'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80', funFact:'Wildebeest cross with crocs waiting — raw nature at its most dramatic.', region_tags:['masai-mara'], upgrades:{ options:[{label:'Group vehicle',extra:0},{label:'Private vehicle all day',extra:4500}], extras:[{label:'Standard',extra:0},{label:'Sundowner at river',extra:680}] } },
];

const SPECIALISTS = [
  { name: 'Sarah Mitchell', role: 'Senior Safari Specialist', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80', tip: 'June–August is peak — book 6 months ahead for Sabi Sand.' },
  { name: 'James Okonkwo',  role: 'East Africa Specialist',   avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80', tip: 'The Migration crosses the Mara River July–October. Don\'t miss it.' },
  { name: 'Priya Naidoo',   role: 'Indian Ocean Specialist',  avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80', tip: 'Combine 4 nights bush with 4 nights beach — the perfect balance.' },
];

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

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL LEGS  (v4.0 unchanged)
// ─────────────────────────────────────────────────────────────────────────────
type InternalLeg = { fromLabel:string; toLabel:string; mode:'charter'|'scheduled'|'road'|'boat'; provider:string; duration:string; estimatedCostZAR:number; aiNote:string; bufferHours:number; };

// road_viable: false = road transfer is geographically impossible / impractical.
// This prevents buildTransferOptions from hallucinating road alternatives.
const INTERNAL_LEGS: Record<string, InternalLeg & { road_viable?: boolean }> = {
  'cape-town→kruger-sabi-sand': { fromLabel:'Cape Town', toLabel:'Sabi Sand', mode:'scheduled', provider:'Airlink CPT→JNB + Federal Air JNB→Skukuza', duration:'~2h 45m', estimatedCostZAR:12000, aiNote:'Morning departure from CPT recommended to catch the afternoon game drive.', bufferHours:3, road_viable:false },
  'kruger-sabi-sand→okavango-delta': { fromLabel:'Sabi Sand', toLabel:'Okavango Delta', mode:'charter', provider:'Federal Air / Wilderness Air charter', duration:'~2h 15m', estimatedCostZAR:18000, aiNote:'Direct charter from Skukuza. Departs post-morning game drive (~10:00).', bufferHours:1.5, road_viable:false },
  'okavango-delta→chobe-vic-falls': { fromLabel:'Okavango Delta', toLabel:'Chobe / Victoria Falls', mode:'charter', provider:'Air Botswana / Wilderness Air', duration:'~1h 30m', estimatedCostZAR:9500, aiNote:'Afternoon departure post-morning activity recommended.', bufferHours:1.5, road_viable:false },
  'kruger-sabi-sand→chobe-vic-falls': { fromLabel:'Sabi Sand', toLabel:'Victoria Falls', mode:'charter', provider:'Charter or scheduled via JNB', duration:'~2h 30m', estimatedCostZAR:14000, aiNote:'Journey Specialist confirms best routing based on travel dates.', bufferHours:2, road_viable:false },
  'kruger-sabi-sand→cape-town': { fromLabel:'Sabi Sand', toLabel:'Cape Town', mode:'scheduled', provider:'Federal Air Skukuza→JNB + Airlink JNB→CPT', duration:'~3h', estimatedCostZAR:12000, aiNote:'Allow 2hr connection at O.R. Tambo.', bufferHours:2.5, road_viable:false },
  'cape-town→okavango-delta': { fromLabel:'Cape Town', toLabel:'Okavango Delta', mode:'scheduled', provider:'Airlink CPT→JNB + Mack Air JNB→Maun', duration:'~4h', estimatedCostZAR:16500, aiNote:'Connect through Johannesburg. Afternoon arrival in Maun.', bufferHours:3.5, road_viable:false },
  'cape-town→madikwe':        { fromLabel:'Cape Town', toLabel:'Madikwe',         mode:'scheduled', provider:'Airlink CPT→JNB + 3.5hr private drive or 45min charter', duration:'~4h total', estimatedCostZAR:11000, aiNote:'Fly CPT→JNB, then 3.5hr private drive north or 45min charter to Madikwe airstrip.', bufferHours:4, road_viable:false },
  'kruger-sabi-sand→madikwe': { fromLabel:'Sabi Sand', toLabel:'Madikwe',         mode:'scheduled', provider:'Federal Air + Airlink JNB connection', duration:'~3h', estimatedCostZAR:9500, aiNote:'Connect via O.R. Tambo. Allow 2hr connection.', bufferHours:3, road_viable:false },
  'madikwe→cape-town':        { fromLabel:'Madikwe', toLabel:'Cape Town',         mode:'scheduled', provider:'Road to JNB (3.5hr) + Airlink JNB→CPT', duration:'~4h total', estimatedCostZAR:11000, aiNote:'Early morning departure from Madikwe to catch morning flights from JNB.', bufferHours:4, road_viable:false },
};

function getInternalLeg(fromSlug: string, toSlug: string): InternalLeg | null {
  const fwd = `${fromSlug}→${toSlug}`;
  const rev = `${toSlug}→${fromSlug}`;
  if (INTERNAL_LEGS[fwd]) return INTERNAL_LEGS[fwd];
  if (INTERNAL_LEGS[rev]) { const r = INTERNAL_LEGS[rev]; return { ...r, fromLabel:r.toLabel, toLabel:r.fromLabel }; }
  return { fromLabel:fromSlug.replace(/-/g,' '), toLabel:toSlug.replace(/-/g,' '), mode:'charter', provider:'TBC — Journey Specialist confirms', duration:'TBC', estimatedCostZAR:10000, aiNote:'Your Journey Specialist will recommend the best routing.', bufferHours:2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
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

// [V5-5] Build ordered slide array for a property: hero first, reel/video, then rest of approved images
type Slide = { type:'image'|'video'|'reel'; url:string; poster?:string; label?:string; roomType?:string; };

function buildSlides(hotel: Hotel): Slide[] {
  const slides: Slide[] = [];
  // 1. Hero image (is_primary=true from Supabase, or first approved)
  if (hotel.image) slides.push({ type:'image', url:hotel.image, label:'Hero' });
  // 2. Reel / video if present
  if (hotel.reelUrl) slides.push({ type:'reel', url:hotel.reelUrl, poster:hotel.image, label:'Reel' });
  // 3. Additional images from the raw _images array (injected by mapSupplierRow)
  const extras = (hotel as any)._images as Slide[] | undefined;
  if (extras) {
    extras.forEach(img => {
      if (!slides.find(s => s.url === img.url)) slides.push(img);
    });
  }
  // Deduplicate
  const seen = new Set<string>();
  return slides.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true; });
}

// [V5-6] Find KB note for a specific slide (image-specific matching)
function getSlideKB(hotel: Hotel, slide: Slide, kbEntries: KBEntry[]): string | null {
  const entries = kbEntries.filter(e => e.active);
  // Room-specific match
  if (slide.roomType) {
    const roomMatch = entries.find(e => e.linkedTo?.toLowerCase().includes(slide.roomType!.toLowerCase()));
    if (roomMatch) return roomMatch.specialistNotes || Object.values(roomMatch.structuredFields ?? {}).find((v:any) => typeof v==='string'&&v.length>20) as string;
  }
  // Property-specific match
  const propMatch = entries.find(e => e.type==='property' && e.linkedTo?.toLowerCase().includes(hotel.name.toLowerCase()));
  if (propMatch) return propMatch.specialistNotes || null;
  // Regional match (hero/generic images)
  if (slide.label === 'Hero' || !slide.roomType) {
    const regionMatch = entries.find(e => e.type==='regional' && hotel.subRegion && e.linkedTo?.toLowerCase().includes(hotel.subRegion.replace(/-/g,' ')));
    if (regionMatch) return regionMatch.specialistNotes || null;
  }
  return null;
}

function mapSupplierRow(s: any): Hotel {
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
      // Build extra slides from remaining approved images
      extraSlides = images
        .filter((img:any) => img.status==='approved' && img.url && img.url !== imageUrl)
        .map((img:any) => ({ type:'image' as const, url:img.url, label:img.caption || img.room_type || undefined, roomType:img.room_type || undefined }));
    }
  } catch { /* keep fallback */ }
  if (imageUrl.includes('unsplash') && s.hero_image)    imageUrl = s.hero_image;
  if (imageUrl.includes('unsplash') && s.cover_image)   imageUrl = s.cover_image;
  const destination = REGION_LABEL[s.region_slug] ?? s.destination ?? s.region_slug ?? '';
  const hotel: any = {
    id:s.id, edition_id:s.edition_id||'safari', name:s.name,
    location:destination ? `${destination}, ${s.country}` : s.country??'',
    destination, subRegion:s.region_slug??'', region:COUNTRY_REGION[s.country]||'southern-africa',
    country:s.country||'', stars:5, trustScore:s.trust_score||85, contentScore:s.content_score||70,
    netRate, otaRate:s.ota_rate_per_night ? Number(s.ota_rate_per_night) : null,
    marginScore:displayRate>0 ? Math.round((displayRate-netRate)/displayRate*100) : 20,
    image:imageUrl, reelUrl:s.reel_url??s.video_url??null,
    funFact:s.short_tagline??(s.description ? String(s.description).slice(0,120) : null),
    malariaFree:s.malaria_status==='malaria-free', tags:s.tags||[],
    reviewScore:s.review_score??null, reviewCount:s.review_count??null,
    socialLinks:s.social_media_links??null,
    _images:extraSlides,
    upgrades:{
      rooms:[{label:'Standard Suite',extra:0,tier:0},{label:'Premium Suite',extra:Math.round(netRate*0.4),tier:1}],
      basis:[{label:'All-inclusive',extra:0,tier:0}],
      flexibility:[{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:Math.round(netRate*0.08),tier:1}],
    },
  };
  return hotel;
}

function buildFallbackItinerary(nights: number, budget: number, mode: InputMode, selectedSlugs: string[]): Itinerary {
  const firstSlug = selectedSlugs[0];
  const destMap: Record<string, {label:string;country:string;why:string;highlights:string[]}> = {
    'kruger-sabi-sand':{ label:'Kruger / Sabi Sand', country:'South Africa', why:'Highest leopard density in Africa. The benchmark safari experience.', highlights:['Leopard tracking at dawn','Night drive','Sundowner in the bush'] },
    'okavango-delta':  { label:'Okavango Delta',     country:'Botswana',     why:"No roads. No fences. The world's finest wilderness safari.", highlights:['Mokoro through papyrus','Walking safari','Helicopter over Delta'] },
    'cape-town':       { label:'Cape Town',          country:'South Africa', why:'World-class city, mountain, winelands — the perfect safari bookend.', highlights:['Table Mountain','Winelands','V&A Waterfront'] },
    'chobe-vic-falls': { label:'Chobe / Victoria Falls', country:'Zimbabwe', why:'One of the Seven Wonders of Nature.', highlights:['Victoria Falls','Chobe River cruise','Elephant herds'] },
    'masai-mara':      { label:'Masai Mara',         country:'Kenya',        why:'The greatest wildlife spectacle on Earth.', highlights:['Great Migration','Hot air balloon','Big cats'] },
    'madikwe':         { label:'Madikwe',            country:'South Africa', why:'Malaria-free Big Five. Excellent for families.', highlights:['Big Five game drives','Malaria-free','Excellent guiding'] },
  };
  if (firstSlug && destMap[firstSlug]) {
    const dest = destMap[firstSlug];
    if (selectedSlugs.length >= 2 && destMap[selectedSlugs[1]]) {
      const dest2 = destMap[selectedSlugs[1]];
      const n1 = Math.ceil(nights*0.55); const n2 = nights-n1;
      return { title:`${nights}-Night ${dest.label} & ${dest2.label}`, summary:`A perfectly sequenced journey combining ${dest.label} and ${dest2.label}.`, routing:`JNB → ${dest.label} (${n1}n) → ${dest2.label} (${n2}n) → JNB`, bestTiming:'June–September: dry season, short grass, animals at water.', cities:[{ city:dest.label, country:dest.country, nights:n1, why:dest.why, highlights:dest.highlights, estimatedCost:Math.round(budget*0.52), hotelRate:45000, flightCost:7600, transferCost:3800, activityCost:0, arrivalGap:'Arrive midday, first drive at 16:00', departureGap:'Final morning drive before charter' },{ city:dest2.label, country:dest2.country, nights:n2, why:dest2.why, highlights:dest2.highlights, estimatedCost:Math.round(budget*0.40), hotelRate:45000, flightCost:8200, transferCost:2400, activityCost:0, arrivalGap:'Land 12:00, settle in for evening drive', departureGap:'Final morning before departure' }], totalEstimate:Math.round(budget*0.92), aiInsights:['Our rates are 20–27% below booking direct'], warnings:[], inputMode:mode };
    }
    return { title:`${nights}-Night ${dest.label}`, summary:`A focused ${nights}-night journey in ${dest.label}.`, routing:`JNB → ${dest.label} (${nights}n) → JNB`, bestTiming:'June–September: dry season, short grass, animals at water.', cities:[{ city:dest.label, country:dest.country, nights, why:dest.why, highlights:dest.highlights, estimatedCost:Math.round(budget*0.92), hotelRate:45000, flightCost:7600, transferCost:3800, activityCost:0, arrivalGap:'Arrive midday, first drive at 16:00', departureGap:'Final morning drive before departure' }], totalEstimate:Math.round(budget*0.92), aiInsights:['Our rates are 20–27% below booking direct'], warnings:[], inputMode:mode };
  }
  return { title:`${nights}-Night Safari Journey`, summary:`A perfectly sequenced ${nights}-night journey across two of Africa's finest wilderness areas.`, routing:`JNB → Kruger / Sabi Sand (${Math.ceil(nights*0.55)}n) → Okavango (${Math.floor(nights*0.45)}n) → JNB`, bestTiming:'June–September: dry season, short grass, animals at water.', cities:[{ city:'Kruger / Sabi Sand', country:'South Africa', nights:Math.ceil(nights*0.55), why:'First destination while fresh.', highlights:['Leopard tracking','Night drive','Sundowner'], estimatedCost:Math.round(budget*0.52), hotelRate:56000, flightCost:7600, transferCost:3800, activityCost:0, arrivalGap:'Land Skukuza 09:30, lodge 11:00', departureGap:'Final morning drive 05:30–09:30' },{ city:'Okavango Delta', country:'Botswana', nights:Math.floor(nights*0.45), why:'Contrast — water, mokoro, birds after dry Lowveld.', highlights:['Mokoro','Walking safari','Helicopter'], estimatedCost:Math.round(budget*0.42), hotelRate:62000, flightCost:9200, transferCost:2400, activityCost:1800, arrivalGap:'Land 12:00, evening drive', departureGap:'Final mokoro 07:00–10:00' }], totalEstimate:Math.round(budget*0.94), aiInsights:['Federal Air JNB→Skukuza saves R8,000 vs road','Our Singita rate is 27% below Booking.com'], warnings:budget<100000?['Budget tight for premium lodges — consider single destination']:[], inputMode:mode };
}

// ─────────────────────────────────────────────────────────────────────────────
// [P9] VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
type ValidationIssue = { severity:'hard'|'warning'; code:string; message:string; };

function validateItinerary(params: { cities:ItineraryCity[]; checkinDate:string; infants:number; hasOwnFlights?:boolean; arrivalFlightNo?:string; }): ValidationIssue[] {
  const { cities, checkinDate, infants } = params;
  const issues: ValidationIssue[] = [];
  // Warn if own flights but no arrival details — needed to build first transfer
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

// ─────────────────────────────────────────────────────────────────────────────
// [V5-7] IMAGE MINI-CHAT
// ─────────────────────────────────────────────────────────────────────────────
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
    // Try /api/ai-gateway first (server-side proxy)
    try {
      const res = await fetch('/api/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-haiku-4-5-20251001',
          max_tokens:200,
          system:`You are a knowledgeable safari specialist. Answer questions about ${hotel.name} in ${hotel.destination} concisely (2-3 sentences). Be specific and helpful. Context: ${context}`,
          messages:[{ role:'user', content:msg }]
        })
      });
      if (res.ok) {
        const d = await res.json();
        const text = d.content?.[0]?.text;
        if (text) { setMsgs(m => [...m, { role:'ai', text }]); replied = true; }
      }
    } catch { /* fall through to direct API */ }
    // Fallback: call Anthropic API directly
    if (!replied) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
          body:JSON.stringify({
            model:'claude-haiku-4-5-20251001',
            max_tokens:200,
            system:`You are a knowledgeable safari specialist. Answer questions about ${hotel.name} in ${hotel.destination} concisely (2-3 sentences). Be specific and helpful. Context: ${context}`,
            messages:[{ role:'user', content:msg }]
          })
        });
        if (res.ok) {
          const d = await res.json();
          const text = d.content?.[0]?.text;
          if (text) { setMsgs(m => [...m, { role:'ai', text }]); replied = true; }
        }
      } catch { /* both failed */ }
    }
    if (!replied) {
      setMsgs(m => [...m, { role:'ai', text:`${hotel.name} is in ${hotel.destination}. For detailed information, your Journey Specialist can help — tap the escalate button below.` }]);
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// [V5-8] UPGRADE / PERSONALISE BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────
const M_HOTELS = 1.15; // margin multiplier — defined here so all components can use it

function UpgradeSheet({ hotel, stayPrefs, kbEntries, fmt, onSelect, onClose, selectedActivityIds, onActivityToggle, regionSlug }: { hotel:Hotel; stayPrefs:{rooms:number;basis:number;flexibility:number}; kbEntries:KBEntry[]; fmt:(n:number)=>string; onSelect:(key:string,opt:any)=>void; onClose:()=>void; selectedActivityIds:string[]; onActivityToggle:(id:string)=>void; regionSlug:string; }) {

  // Image carousel state
  const [heroSlide, setHeroSlide] = useState(0);
  const kbEntry = kbEntries.find(e => e.active && e.type==='property' && e.linkedTo?.toLowerCase().includes(hotel.name.toLowerCase()));
  const allSlides = buildSlides(hotel);

  // Mirror stayPrefs into LOCAL state so buttons feel instant (no prop round-trip lag)
  const [localPrefs, setLocalPrefs] = useState(stayPrefs);
  const handleSelect = (key: string, opt: any) => {
    setLocalPrefs(p => ({ ...p, [key]: opt.tier ?? 0 }));
    onSelect(key, opt);
  };

  // Room-type image state: roomIdx → slideIdx within that room's images
  const [roomSlides, setRoomSlides]   = useState<Record<number,number>>({});
  const [expandedRoom, setExpandedRoom] = useState<number | null>(null);

  // Activities filtered to this region
  const regionActs = ACTIVITIES.filter(a =>
    !a.region_tags?.length || a.region_tags.includes(regionSlug)
  );

  // Running additions cost (use localPrefs for instant feedback)
  const roomExtra  = hotel.upgrades?.rooms?.[localPrefs.rooms]?.extra ?? 0;
  const flexExtra  = hotel.upgrades?.flexibility?.[localPrefs.flexibility]?.extra ?? 0;
  const actCost    = ACTIVITIES.filter(a => selectedActivityIds.includes(String(a.id)))
                               .reduce((s,a) => s + Math.round(a.netRate * 1.18), 0);
  const addedCost  = roomExtra + flexExtra + actCost;

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Full-screen sheet — 95vh, scrollable, no tabs */}
      <div style={{
        background:'#0f0f0f',
        borderRadius:'20px 20px 0 0',
        width:'100%',
        maxWidth:680,
        height:'95vh',
        display:'flex',
        flexDirection:'column',
        animation:'slideUp 0.3s ease',
        overflow:'hidden',
      }}>

        {/* ── STICKY HEADER ── */}
        <div style={{ flexShrink:0, padding:'18px 20px 14px', borderBottom:`0.5px solid rgba(255,255,255,0.08)`, background:'#0f0f0f' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.12em', fontWeight:700, marginBottom:3 }}>✦ Upgrade &amp; Personalise</div>
              <div style={{ fontSize:18, fontWeight:700, color:T.text, fontFamily:"'Playfair Display',serif", lineHeight:1.2 }}>{hotel.name}</div>
              <div style={{ fontSize:12, color:T.textDim, marginTop:2 }}>{hotel.destination} · {hotel.country}</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:'none', color:T.textMid, width:34, height:34, borderRadius:'50%', cursor:'pointer', fontSize:17, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginLeft:12 }}>×</button>
          </div>
          {/* Price summary bar */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:10, flexWrap:'wrap' }}>
            <div style={{ fontSize:20, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>
              {fmt(hotel.netRate * M_HOTELS)}
              <span style={{ fontSize:11, color:T.textDim, fontWeight:400 }}>/night base</span>
            </div>
            {addedCost > 0 && (
              <div style={{ fontSize:12, color:T.green }}>+ {fmt(addedCost)} in selected add-ons</div>
            )}
            {hotel.otaRate && (
              <div style={{ fontSize:11, color:T.textDim, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'2px 10px' }}>
                Save {fmt(Math.max(0, hotel.otaRate - hotel.netRate * M_HOTELS))}/night vs direct
              </div>
            )}
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 0 120px' }}>

          {/* ══ SECTION 1: PROPERTY HERO IMAGE CAROUSEL ══ */}
          {allSlides.length > 0 && (
            <div style={{ position:'relative', height:240, overflow:'hidden', background:'#111' }}>
              {allSlides[heroSlide] && (
                allSlides[heroSlide].type === 'reel' || allSlides[heroSlide].type === 'video'
                  ? <video src={allSlides[heroSlide].url} poster={allSlides[heroSlide].poster} autoPlay muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <img src={allSlides[heroSlide].url} alt={hotel.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              )}
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 60%)' }} />
              {/* Inner image nav */}
              {heroSlide > 0 && (
                <button onClick={() => setHeroSlide(i => i-1)} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.55)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>‹</button>
              )}
              {heroSlide < allSlides.length - 1 && (
                <button onClick={() => setHeroSlide(i => i+1)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.55)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>›</button>
              )}
              {/* Slide label + dots */}
              <div style={{ position:'absolute', bottom:10, left:0, right:0, display:'flex', justifyContent:'space-between', alignItems:'flex-end', padding:'0 14px' }}>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', background:'rgba(0,0,0,0.4)', borderRadius:4, padding:'2px 7px' }}>
                  {allSlides[heroSlide]?.label || ''}{allSlides[heroSlide]?.roomType ? ` · ${allSlides[heroSlide].roomType}` : ''}
                </div>
                {allSlides.length > 1 && (
                  <div style={{ display:'flex', gap:3 }}>
                    {allSlides.map((_,i) => <div key={i} onClick={() => setHeroSlide(i)} style={{ width:i===heroSlide?14:4, height:4, borderRadius:2, background:i===heroSlide?T.gold:'rgba(255,255,255,0.35)', cursor:'pointer', transition:'all 0.2s' }} />)}
                  </div>
                )}
              </div>
              {/* KB diamond for this image */}
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

            {/* ══ SECTION 2: PROPERTY DESCRIPTION + FAST FACTS ══ */}
            {hotel.funFact && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:14, color:T.textMid, lineHeight:1.75 }}>{hotel.funFact}</div>
              </div>
            )}
            {/* Trust + review row */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'4px 12px', fontSize:12, color:T.green }}>★ {hotel.trustScore}/100 trust score</div>
              {hotel.malariaFree && <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'4px 12px', fontSize:12, color:T.green }}>✓ Malaria-free</div>}
              {(hotel as any).reviewScore && <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, borderRadius:20, padding:'4px 12px', fontSize:12, color:T.textMid }}>{(hotel as any).reviewScore}★ guest rating</div>}
            </div>

            {/* ══ SECTION 3: SPECIALIST NOTES (KB) — if available ══ */}
            {kbEntry && (
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:700, marginBottom:10 }}>✦ Our Specialist Notes</div>
                {kbEntry.specialistNotes && (
                  <div style={{ background:'rgba(212,175,55,0.07)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'14px 16px', marginBottom:12, fontSize:13, color:'rgba(240,237,230,0.85)', lineHeight:1.75 }}>{kbEntry.specialistNotes}</div>
                )}
                {Object.entries(kbEntry.structuredFields ?? {}).filter(([,v]) => typeof v === 'string' && (v as string).length > 10).map(([key, val]) => (
                  <div key={key} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
                    <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.06em', fontWeight:700, minWidth:80, paddingTop:2, flexShrink:0 }}>{key.replace(/_/g,' ')}</div>
                    <div style={{ fontSize:12, color:T.textMid, lineHeight:1.6, flex:1 }}>{String(val)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ══ SECTION 4: ROOM TYPES ══ */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:600, marginBottom:12 }}>Room types &amp; upgrades</div>
              {(hotel.upgrades?.rooms ?? []).map((opt:any, roomIdx:number) => {
                const sel      = opt.tier === localPrefs.rooms;
                const expanded = expandedRoom === roomIdx;
                // Room-specific slides: use all slides tagged with this room type, fall back to hero
                const roomSlideList = allSlides.filter(s => !s.roomType || s.roomType?.toLowerCase().includes(opt.label.toLowerCase()));
                const rSlideIdx = roomSlides[roomIdx] ?? 0;
                const rSlide    = roomSlideList[rSlideIdx] ?? allSlides[0];

                return (
                  <div key={opt.label} style={{ marginBottom:10, borderRadius:12, border:`1.5px solid ${sel?T.gold:T.border}`, background:sel?'rgba(212,175,55,0.04)':T.surface, overflow:'hidden', transition:'border-color 0.2s' }}>
                    {/* Room image carousel — always visible */}
                    <div style={{ position:'relative', height:160, overflow:'hidden', cursor:'pointer' }} onClick={() => { onSelect('rooms', opt); }}>
                      {rSlide && (rSlide.type==='reel'||rSlide.type==='video'
                        ? <video src={rSlide.url} poster={rSlide.poster} autoPlay muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <img src={rSlide.url} alt={opt.label} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      )}
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 50%)' }} />
                      {/* Room image nav — only if multiple slides */}
                      {roomSlideList.length > 1 && rSlideIdx > 0 && (
                        <button onClick={e => { e.stopPropagation(); setRoomSlides(prev => ({ ...prev, [roomIdx]: rSlideIdx-1 })); }} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:24, height:24, borderRadius:'50%', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>‹</button>
                      )}
                      {roomSlideList.length > 1 && rSlideIdx < roomSlideList.length-1 && (
                        <button onClick={e => { e.stopPropagation(); setRoomSlides(prev => ({ ...prev, [roomIdx]: rSlideIdx+1 })); }} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:24, height:24, borderRadius:'50%', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>›</button>
                      )}
                      {/* Bottom row inside image */}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color:'#fff', fontFamily:"'Playfair Display',serif" }}>{opt.label}</div>
                          {roomSlideList.length > 1 && (
                            <div style={{ display:'flex', gap:3, marginTop:4 }}>
                              {roomSlideList.map((_,i) => <div key={i} style={{ width:i===rSlideIdx?12:4, height:4, borderRadius:2, background:i===rSlideIdx?T.gold:'rgba(255,255,255,0.35)', transition:'all 0.2s' }} />)}
                            </div>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          {sel && <div style={{ fontSize:10, color:'#0a0a0a', background:T.gold, borderRadius:20, padding:'2px 8px', fontWeight:800 }}>Selected</div>}
                          <div style={{ fontSize:14, fontWeight:700, color:T.gold }}>{opt.extra===0?'Included':`+${fmt(opt.extra)}/night`}</div>
                        </div>
                      </div>
                    </div>
                    {/* Expandable detail row */}
                    <div style={{ padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <button
                        onClick={() => setExpandedRoom(expanded ? null : roomIdx)}
                        style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12, color:T.textDim, display:'flex', alignItems:'center', gap:4 }}
                      >
                        {expanded ? '▲ Hide details' : '▼ Room details'}
                      </button>
                      <button
                        onClick={() => handleSelect('rooms', opt)}
                        style={{ padding:'7px 16px', borderRadius:8, border:`1.5px solid ${sel?T.gold:T.border}`, background:sel?T.goldDim:'transparent', color:sel?T.gold:T.textMid, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:sel?700:400 }}
                      >
                        {sel ? '✓ Selected' : 'Select this room'}
                      </button>
                    </div>
                    {expanded && (
                      <div style={{ padding:'0 14px 14px', borderTop:`0.5px solid ${T.border}` }}>
                        <div style={{ fontSize:12, color:T.textMid, lineHeight:1.65, paddingTop:10 }}>
                          {/* In production this comes from room-level KB or Supabase room description */}
                          {kbEntry?.structuredFields?.best_room && opt.tier === 1
                            ? String(kbEntry.structuredFields.best_room)
                            : `${opt.label} — ${opt.extra === 0 ? 'included in your base rate' : `upgrade at ${fmt(opt.extra)}/night`}. All meals and game activities included.`}
                        </div>
                        {/* Meal basis for this room */}
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
              {/* Cancellation policy */}
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

            {/* ══ SECTION 5: ACTIVITIES — anchored to this lodge's region ══ */}
            {regionActs.length > 0 && (
              <div style={{ marginBottom:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                  <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:600 }}>Experiences near {hotel.destination}</div>
                  {selectedActivityIds.length > 0 && <div style={{ fontSize:11, color:T.gold }}>{selectedActivityIds.length} selected</div>}
                </div>
                <div style={{ fontSize:12, color:T.textDim, marginBottom:14, lineHeight:1.5 }}>Add to your package · all priced per person · confirmed by your Journey Specialist</div>
                {/* Horizontal scroll carousel */}
                <div style={{ position:'relative', margin:'0 -20px' }}>
                  {actIdx > 0 && (
                    <button onClick={() => scrollActTo(actIdx - 1)} style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', zIndex:10, background:'rgba(10,10,10,0.92)', border:`1px solid ${T.borderGold}`, color:T.gold, width:32, height:52, borderRadius:'0 10px 10px 0', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'3px 0 12px rgba(0,0,0,0.5)' }}>‹</button>
                  )}
                  {actIdx < regionActs.length - 1 && (
                    <button onClick={() => scrollActTo(actIdx + 1)} style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', zIndex:10, background:'rgba(10,10,10,0.92)', border:`1px solid ${T.borderGold}`, color:T.gold, width:32, height:52, borderRadius:'10px 0 0 10px', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'-3px 0 12px rgba(0,0,0,0.5)' }}>›</button>
                  )}
                  <div ref={actStripRef} style={{ display:'flex', gap:12, overflowX:'auto', scrollSnapType:'x mandatory' as any, WebkitOverflowScrolling:'touch' as any, scrollbarWidth:'none' as any, paddingLeft:20, paddingRight:20, paddingBottom:4 }}>
                    {regionActs.map((act, actI) => {
                      const isSel   = selectedActivityIds.includes(String(act.id));
                      const display = Math.round(act.netRate * 1.18);
                      const saving  = act.otaRate ? Math.round(act.otaRate - display) : 0;
                      return (
                        <div
                          key={act.id}
                          data-act-card={actI}
                          onClick={() => { onActivityToggle(String(act.id)); setActIdx(actI); }}
                          style={{ flexShrink:0, width:'min(70vw, 240px)', scrollSnapAlign:'center', borderRadius:12, border:`1.5px solid ${isSel?T.gold:T.border}`, background:isSel?'rgba(212,175,55,0.06)':T.surface, cursor:'pointer', overflow:'hidden', transition:'border-color 0.2s' }}
                        >
                          <div style={{ position:'relative', height:130, overflow:'hidden' }}>
                            <img src={act.image} alt={act.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.68) 0%,transparent 50%)' }} />
                            {isSel && <div style={{ position:'absolute', top:8, right:8, width:20, height:20, borderRadius:'50%', background:T.gold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#0a0a0a', fontWeight:800 }}>✓</div>}
                            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'8px 10px' }}>
                              <div style={{ fontSize:12, fontWeight:700, color:'#fff', lineHeight:1.2, fontFamily:"'Playfair Display',serif" }}>{act.name}</div>
                              <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:1 }}>{act.duration}</div>
                            </div>
                          </div>
                          <div style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                              <div style={{ fontSize:11, color:T.textDim }}>★ {act.trustScore}/100</div>
                              <div style={{ textAlign:'right' as const }}>
                                <div style={{ fontSize:14, fontWeight:700, color:isSel?T.gold:T.text }}>{fmt(display)}<span style={{ fontSize:9, color:T.textDim, fontWeight:400 }}>/pp</span></div>
                                {saving > 0 && <div style={{ fontSize:9, color:T.green }}>Save {fmt(saving)}</div>}
                              </div>
                            </div>
                            <div style={{ fontSize:10, color:T.textDim, lineHeight:1.4 }}>{act.funFact}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {selectedActivityIds.length > 0 && (
                  <div style={{ marginTop:10, padding:'9px 14px', background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:T.gold, fontWeight:600 }}>{selectedActivityIds.length} activit{selectedActivityIds.length===1?'y':'ies'} added</span>
                    <span style={{ color:T.textMid }}>{fmt(ACTIVITIES.filter(a=>selectedActivityIds.includes(String(a.id))).reduce((s,a)=>s+Math.round(a.netRate*1.18),0))}</span>
                  </div>
                )}
              </div>
            )}

            {/* ══ SECTION 6: SOCIAL LINKS (if available) ══ */}
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

          </div>{/* end scroll padding wrapper */}
        </div>{/* end scrollable body */}

        {/* ── STICKY FOOTER ── */}
        <div style={{ flexShrink:0, padding:'14px 20px 24px', borderTop:`0.5px solid rgba(255,255,255,0.08)`, background:'#0f0f0f' }}>
          {addedCost > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:10 }}>
              <span style={{ color:T.textDim }}>Base rate + add-ons</span>
              <span style={{ color:T.gold, fontWeight:600 }}>{fmt(hotel.netRate * M_HOTELS + addedCost)}/night equivalent</span>
            </div>
          )}
          <button onClick={onClose} className="btn-gold" style={{ width:'100%', padding:15, fontSize:15 }}>
            Confirm &amp; return to itinerary →
          </button>
          <div style={{ textAlign:'center' as const, fontSize:11, color:T.textDim, marginTop:8 }}>
            Tap outside or press × to close without saving
          </div>
        </div>

      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// [V5-4] NESTED PEEKING CAROUSEL — core component
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// [V5-4] NESTED PEEKING CAROUSEL — real scroll-snap implementation
//
// Architecture:
//   Outer level: CSS scroll-snap horizontal strip.
//     Each property card is ~84vw wide (max 520px), cards sit side-by-side.
//     Adjacent cards peek in from left and right — genuinely visible, not faked.
//     Programmatic scroll on arrow tap OR JS-driven index tracking via IntersectionObserver.
//   Inner level: per-property image strip — also scroll-snap.
//     Swipe OR tap grey arrow buttons to cycle images.
//     Image dots show position.
//   Controls:
//     Big arrows (◂ ▸) outside the strip on left/right — switch properties.
//     Small circle arrows (‹ ›) overlaid on image — switch images within property.
//     TSE diamond (◆) — image-specific KB note overlay.
//     ? button — inline mini-chat (3 messages) then escalate.
//     "Upgrade or Personalise" — UpgradeSheet bottom sheet.
//   Selection:
//     AI pre-selects on load (first card). User must tap "Select this property" to change.
//     Selected property gets gold border. Subtotal shows in section header.
//   Price total:
//     grandTotal (parent state) auto-recomputes any time selectedHotelId or prefs change.
// ─────────────────────────────────────────────────────────────────────────────
function NestedPropertyCarousel({
  destinationLabel, destinationSlug, cityNights, onNightsChange,
  hotels, selectedHotelId, onSelectHotel, stayPrefs, onUpgradeSelect,
  kbEntries, fmt, edition, onEscalateChat,
  selectedActivityIds, onActivityToggle,
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
  selectedActivityIds:  string[];
  onActivityToggle:     (id: string) => void;
}) {
  // Which property is currently centred in the outer strip
  const [activeIdx,   setActiveIdx]   = useState(() => {
    // Pre-focus the selected hotel if possible
    const idx = hotels.findIndex(h => String(h.id) === String(selectedHotelId));
    return idx >= 0 ? idx : 0;
  });

  // Per-property image index map: { hotelId → slideIdx }
  const [slideIdxMap, setSlideIdxMap] = useState<Record<string, number>>({});
  const getSlideIdx = (hotelId: string | number) => slideIdxMap[String(hotelId)] ?? 0;
  const setSlideIdx = (hotelId: string | number, idx: number) =>
    setSlideIdxMap(prev => ({ ...prev, [String(hotelId)]: idx }));

  // Per-property UI state
  const [kbOpenId,      setKbOpenId]      = useState<string | null>(null);
  const [chatOpenId,    setChatOpenId]     = useState<string | null>(null);
  const [upgradeOpenId, setUpgradeOpenId]  = useState<string | null>(null);

  // Outer scroll strip ref
  const stripRef = useRef<HTMLDivElement>(null);

  // Scroll to card by index (programmatic)
  const scrollToIdx = useCallback((idx: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    const cards = strip.querySelectorAll<HTMLElement>('[data-card]');
    const card = cards[idx];
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    setActiveIdx(idx);
    setKbOpenId(null);
    setChatOpenId(null);
  }, []);

  // Track scroll position to update activeIdx
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onScroll = () => {
      const cards = Array.from(strip.querySelectorAll<HTMLElement>('[data-card]'));
      const stripCenter = strip.scrollLeft + strip.clientWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(stripCenter - cardCenter);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setActiveIdx(closest);
    };
    strip.addEventListener('scroll', onScroll, { passive: true });
    return () => strip.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll to selected hotel on mount if it's not index 0
  useEffect(() => {
    const idx = hotels.findIndex(h => String(h.id) === String(selectedHotelId));
    if (idx > 0) setTimeout(() => scrollToIdx(idx), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedHotel = hotels.find(h => String(h.id) === String(selectedHotelId)) ?? hotels[0];
  const { resolved }   = selectedHotel ? resolveHotelUpgrades(selectedHotel, stayPrefs) : { resolved: {} };
  const upgradeExtra   = Object.values(resolved).reduce((s: number, v: any) => s + (v?.extra ?? 0), 0);
  const selectedTotal  = selectedHotel
    ? Math.round((selectedHotel.netRate * cityNights + upgradeExtra) * M_HOTELS)
    : 0;

  if (!hotels.length) return null;

  return (
    <div style={{ marginBottom: 32 }}>

      {/* ── Destination header with selected subtotal */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:12, paddingLeft:2 }}>
        <div>
          <div style={{ fontSize:11, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>{destinationLabel}</div>
          <div style={{ fontSize:12, color:T.textDim, marginTop:1 }}>{hotels.length} propert{hotels.length===1?'y':'ies'} · swipe or tap to browse</div>
        </div>
        <div style={{ textAlign:'right' as const }}>
          <div style={{ fontSize:11, color:T.textDim }}>{hotels.length} option{hotels.length!==1?'s':''}</div>
        </div>
      </div>

      {/* ── Outer carousel row with peeking big arrows */}
      <div style={{ position:'relative' as const }}>

        {/* Big left property arrow */}
        {activeIdx > 0 && (
          <button
            onClick={() => scrollToIdx(activeIdx - 1)}
            aria-label="Previous property"
            style={{ position:'absolute', left:-18, top:'50%', transform:'translateY(-60%)', zIndex:20, background:T.surface, border:`1px solid ${T.border}`, color:T.text, width:36, height:56, borderRadius:'0 10px 10px 0', cursor:'pointer', fontSize:20, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'3px 0 16px rgba(0,0,0,0.55)', transition:'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = T.bg3)}
            onMouseLeave={e => (e.currentTarget.style.background = T.surface)}
          >◂</button>
        )}
        {/* Big right property arrow */}
        {activeIdx < hotels.length - 1 && (
          <button
            onClick={() => scrollToIdx(activeIdx + 1)}
            aria-label="Next property"
            style={{ position:'absolute', right:-18, top:'50%', transform:'translateY(-60%)', zIndex:20, background:T.surface, border:`1px solid ${T.border}`, color:T.text, width:36, height:56, borderRadius:'10px 0 0 10px', cursor:'pointer', fontSize:20, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'-3px 0 16px rgba(0,0,0,0.55)', transition:'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = T.bg3)}
            onMouseLeave={e => (e.currentTarget.style.background = T.surface)}
          >▸</button>
        )}

        {/* ── Scroll strip — real peeking carousel */}
        <div
          ref={stripRef}
          style={{
            display:'flex',
            gap:12,
            overflowX:'auto',
            scrollSnapType:'x mandatory',
            WebkitOverflowScrolling:'touch',
            scrollbarWidth:'none',
            msOverflowStyle:'none',
            paddingLeft:24,   // allows peek of previous card
            paddingRight:24,  // allows peek of next card
            paddingBottom:4,
          } as React.CSSProperties}
        >
          <style>{`.carousel-strip::-webkit-scrollbar{display:none}`}</style>

          {hotels.map((hotel, propIdx) => {
            const isActive   = propIdx === activeIdx;
            const isSelected = String(hotel.id) === String(selectedHotelId);
            const slideIdx   = getSlideIdx(hotel.id);
            const slides     = buildSlides(hotel);
            const currentSlide = slides[slideIdx] ?? slides[0];
            const kbNote     = currentSlide ? getSlideKB(hotel, currentSlide, kbEntries) : null;
            const kbOpen     = kbOpenId === String(hotel.id);
            const chatOpen   = chatOpenId === String(hotel.id);

            const { resolved: res } = resolveHotelUpgrades(hotel, isSelected ? stayPrefs : { rooms:0,basis:0,flexibility:0 });
            const upExtra  = Object.values(res).reduce((s: number, v: any) => s + (v?.extra ?? 0), 0);
            const tileTotal = Math.round((hotel.netRate * cityNights + upExtra) * M_HOTELS);
            const saving    = hotel.otaRate ? Math.round(hotel.otaRate * cityNights - tileTotal) : 0;

            // Touch swipe for inner image carousel — plain mutable object (no hook, safe in .map)
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
              <div
                key={hotel.id}
                data-card={propIdx}
                style={{
                  flexShrink: 0,
                  width: 'min(84vw, 500px)',
                  scrollSnapAlign: 'center',
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: `1.5px solid ${isSelected ? T.gold : isActive ? T.border : 'rgba(255,255,255,0.08)'}`,
                  background: T.surface,
                  transition: 'border-color 0.25s, opacity 0.2s',
                  opacity: isActive ? 1 : 0.72,
                  position: 'relative' as const,
                }}
              >
                {/* Selected badge */}
                {isSelected && (
                  <div style={{ position:'absolute', top:10, left:10, zIndex:15, background:T.gold, color:'#0a0a0a', fontSize:9, fontWeight:800, padding:'3px 10px', borderRadius:20, letterSpacing:'0.08em', textTransform:'uppercase' as const }}>
                    ✓ Selected
                  </div>
                )}

                {/* ─── INNER IMAGE CAROUSEL ─── */}
                <div
                  style={{ position:'relative' as const, height:240, overflow:'hidden', cursor:'ew-resize', userSelect:'none' }}
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                >
                  {/* Current slide */}
                  {currentSlide && (
                    currentSlide.type === 'reel' || currentSlide.type === 'video'
                      ? <video src={currentSlide.url} poster={currentSlide.poster} autoPlay muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <img src={currentSlide.url} alt={hotel.name} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'opacity 0.18s' }} />
                  )}
                  {/* Image gradient */}
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.78) 0%,transparent 50%)' }} />

                  {/* Small inner image arrows — grey circle */}
                  {slideIdx > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); setSlideIdx(hotel.id, slideIdx - 1); setKbOpenId(null); }}
                      style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'rgba(30,30,30,0.72)', border:'1px solid rgba(255,255,255,0.18)', color:'rgba(255,255,255,0.85)', width:28, height:28, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:8, backdropFilter:'blur(4px)' }}
                      aria-label="Previous image"
                    >‹</button>
                  )}
                  {slideIdx < slides.length - 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); setSlideIdx(hotel.id, slideIdx + 1); setKbOpenId(null); }}
                      style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'rgba(30,30,30,0.72)', border:'1px solid rgba(255,255,255,0.18)', color:'rgba(255,255,255,0.85)', width:28, height:28, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:8, backdropFilter:'blur(4px)' }}
                      aria-label="Next image"
                    >›</button>
                  )}

                  {/* Image progress dots */}
                  {slides.length > 1 && (
                    <div style={{ position:'absolute', bottom:50, left:0, right:0, display:'flex', justifyContent:'center', gap:4, pointerEvents:'none' }}>
                      {slides.map((_,i) => (
                        <div key={i} style={{ width:i===slideIdx?16:5, height:5, borderRadius:3, background:i===slideIdx?T.gold:'rgba(255,255,255,0.35)', transition:'all 0.2s' }} />
                      ))}
                    </div>
                  )}

                  {/* Reel / room type label */}
                  {(currentSlide?.type==='reel'||currentSlide?.type==='video') && (
                    <div style={{ position:'absolute', bottom:52, left:10, fontSize:9, color:'rgba(255,255,255,0.6)', background:'rgba(0,0,0,0.45)', borderRadius:4, padding:'2px 6px' }}>▶ Reel</div>
                  )}
                  {currentSlide?.roomType && (
                    <div style={{ position:'absolute', bottom:52, left:10, fontSize:9, color:'rgba(255,255,255,0.65)', background:'rgba(0,0,0,0.5)', borderRadius:4, padding:'2px 7px' }}>{currentSlide.roomType}</div>
                  )}

                  {/* [V5-6] TSE Diamond — image-specific KB. Rotated gold square. Hidden if no note. */}
                  {kbNote && (
                    <button
                      onClick={e => { e.stopPropagation(); setKbOpenId(kbOpen ? null : String(hotel.id)); setChatOpenId(null); }}
                      title="Specialist KB note for this image"
                      style={{ position:'absolute', top:10, right:48, zIndex:9, background:'transparent', border:'none', cursor:'pointer', padding:2 }}
                    >
                      <div style={{ width:28, height:28, background:'linear-gradient(135deg,#c8a020,#f0c840)', transform:'rotate(45deg)', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(0,0,0,0.5)' }}>
                        <span style={{ transform:'rotate(-45deg)', fontSize:11, color:'#0a0a0a', fontWeight:900, lineHeight:1 }}>✦</span>
                      </div>
                    </button>
                  )}

                  {/* [V5-7] ? Chat button — blue circle */}
                  <button
                    onClick={e => { e.stopPropagation(); setChatOpenId(chatOpen ? null : String(hotel.id)); setKbOpenId(null); }}
                    title="Ask about this image"
                    style={{ position:'absolute', top:10, right:10, zIndex:9, width:28, height:28, borderRadius:'50%', background:'rgba(96,165,250,0.22)', border:'1.5px solid rgba(96,165,250,0.6)', color:'#93c5fd', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}
                  >?</button>

                  {/* Property name + price overlay */}
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 14px 12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                      <div>
                        <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Playfair Display',serif", color:'#fff', lineHeight:1.2 }}>{hotel.name}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{hotel.destination} · ★ {hotel.trustScore}/100</div>
                      </div>
                      <div style={{ textAlign:'right' as const }}>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', background:'rgba(0,0,0,0.35)', borderRadius:6, padding:'3px 8px' }}>{cityNights}n selected</div>
                      </div>
                    </div>
                  </div>

                  {/* [V5-6] KB tooltip */}
                  {kbOpen && kbNote && (
                    <div style={{ position:'absolute', top:44, right:8, left:8, background:'rgba(8,8,8,0.97)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'12px 14px', zIndex:18, backdropFilter:'blur(16px)' }}>
                      <div style={{ fontSize:10, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:6 }}>✦ Specialist note</div>
                      <div style={{ fontSize:12, color:'rgba(240,237,230,0.8)', lineHeight:1.65 }}>{kbNote}</div>
                      <button onClick={() => setKbOpenId(null)} style={{ marginTop:8, fontSize:10, color:T.textDim, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Close ×</button>
                    </div>
                  )}

                  {/* [V5-7] Image mini-chat */}
                  {chatOpen && currentSlide && (
                    <ImageMiniChat
                      hotel={hotel}
                      slide={currentSlide}
                      edition={edition}
                      onEscalate={ctx => { setChatOpenId(null); onEscalateChat(ctx); }}
                      onClose={() => setChatOpenId(null)}
                    />
                  )}
                </div>

                {/* ─── TILE BODY ─── */}
                <div style={{ padding:'12px 14px 14px' }}>
                  {hotel.funFact && (
                    <div className="fun-fact" style={{ marginBottom:10 }}>✦ {hotel.funFact}</div>
                  )}

                  {/* Savings badge */}
                  {saving > 500 && (
                    <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.22)', borderRadius:8, padding:'4px 10px', marginBottom:10, fontSize:11, color:T.green }}>
                      Save {fmt(saving)} vs booking direct
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:4 }}>
                    <button
                      onClick={() => onSelectHotel(hotel)}
                      style={{
                        padding:'11px 0', borderRadius:9,
                        border:`1.5px solid ${isSelected ? T.gold : T.border}`,
                        background: isSelected ? T.goldDim : 'transparent',
                        color: isSelected ? T.gold : T.textMid,
                        cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:isSelected?700:400,
                      }}
                    >
                      {isSelected ? '✓ Selected' : 'Select property'}
                    </button>
                    <button
                      onClick={() => setUpgradeOpenId(String(hotel.id))}
                      style={{ padding:'11px 0', borderRadius:9, border:`1px solid ${T.borderGold}`, background:T.goldDim, color:T.gold, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}
                    >
                      Upgrade / Personalise
                    </button>
                  </div>
                </div>

                {/* Upgrade sheet for this specific hotel */}
                {upgradeOpenId === String(hotel.id) && (
                  <UpgradeSheet
                    hotel={hotel}
                    stayPrefs={isSelected ? stayPrefs : { rooms:0, basis:0, flexibility:0 }}
                    kbEntries={kbEntries}
                    fmt={fmt}
                    onSelect={(key, opt) => { onSelectHotel(hotel); onUpgradeSelect(key, opt); }}
                    onClose={() => setUpgradeOpenId(null)}
                    selectedActivityIds={selectedActivityIds}
                    onActivityToggle={onActivityToggle}
                    regionSlug={destinationSlug}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Scroll hint: hide scrollbar cross-browser */}
        <style>{`[data-strip] > div::-webkit-scrollbar { display:none }`}</style>
      </div>

      {/* Property position indicator */}
      {hotels.length > 1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>
          {hotels.map((_,i) => (
            <div
              key={i}
              onClick={() => scrollToIdx(i)}
              style={{ width:i===activeIdx?20:7, height:7, borderRadius:4, background:i===activeIdx?T.gold:'rgba(255,255,255,0.2)', cursor:'pointer', transition:'all 0.2s' }}
            />
          ))}
        </div>
      )}

      {/* ── Nights control below carousel */}
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
// DATE SELECTOR — 4 modes: specific date | month | window | flexible
// Placed in the journey summary banner on the Price & Book screen.
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS_AHEAD = Array.from({ length: 18 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() + i + 1);
  return {
    value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
    label: d.toLocaleDateString('en-GB', { month:'long', year:'numeric' }),
  };
});

function DateSelector({ checkinDate, setCheckinDate, dateMode, setDateMode, flexMonth, setFlexMonth, windowStart, setWindowStart, windowEnd, setWindowEnd, nights }: {
  checkinDate:    string; setCheckinDate:  (v:string)=>void;
  dateMode:       'specific'|'month'|'window'|'flexible';
  setDateMode:    (v:'specific'|'month'|'window'|'flexible')=>void;
  flexMonth:      string; setFlexMonth:    (v:string)=>void;
  windowStart:    string; setWindowStart:  (v:string)=>void;
  windowEnd:      string; setWindowEnd:    (v:string)=>void;
  nights:         number;
}) {
  const isSet = !!(checkinDate || flexMonth || (windowStart && windowEnd) || dateMode==='flexible');
  const modeLabel: Record<string, string> = { specific:'Specific date', month:'Month', window:'Date window', flexible:"I'm flexible" };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:600, color:T.text }}>Travel dates</div>
        <div style={{ fontSize:11, color:isSet?T.green:T.amber, fontWeight:600 }}>{isSet?'✓ Set':'Required before payment'}</div>
      </div>
      {/* Mode selector tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {(['specific','month','window','flexible'] as const).map(mode => (
          <button key={mode} onClick={() => setDateMode(mode)} style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${dateMode===mode?T.gold:T.border}`, background:dateMode===mode?T.goldDim:'transparent', color:dateMode===mode?T.gold:T.textMid, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:dateMode===mode?600:400 }}>
            {modeLabel[mode]}
          </button>
        ))}
      </div>

      {/* Specific date */}
      {dateMode==='specific' && (
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <input type="date" value={checkinDate} onChange={e=>setCheckinDate(e.target.value)} style={{ background:T.bg3, border:`1.5px solid ${checkinDate?T.borderGold:T.border}`, color:T.text, borderRadius:9, padding:'8px 12px', fontSize:13, outline:'none', fontFamily:'inherit', flexShrink:0 }} />
          {checkinDate && nights > 0 && (
            <div style={{ fontSize:11, color:T.textDim }}>
              Check-out: {new Date(new Date(checkinDate).getTime() + nights*86400000).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
            </div>
          )}
        </div>
      )}

      {/* Month */}
      {dateMode==='month' && (
        <select value={flexMonth} onChange={e=>setFlexMonth(e.target.value)} style={{ width:'100%', background:T.bg3, border:`1.5px solid ${flexMonth?T.borderGold:T.border}`, color:flexMonth?T.text:T.textDim, borderRadius:9, padding:'9px 12px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
          <option value="">Select a month…</option>
          {MONTHS_AHEAD.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      )}

      {/* Date window */}
      {dateMode==='window' && (
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:10, color:T.textDim, marginBottom:4, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Earliest</div>
            <input type="date" value={windowStart} onChange={e=>setWindowStart(e.target.value)} style={{ background:T.bg3, border:`1.5px solid ${windowStart?T.borderGold:T.border}`, color:T.text, borderRadius:9, padding:'7px 11px', fontSize:12, outline:'none', fontFamily:'inherit' }} />
          </div>
          <div style={{ fontSize:14, color:T.textDim, paddingTop:18 }}>→</div>
          <div>
            <div style={{ fontSize:10, color:T.textDim, marginBottom:4, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Latest</div>
            <input type="date" value={windowEnd} min={windowStart} onChange={e=>setWindowEnd(e.target.value)} style={{ background:T.bg3, border:`1.5px solid ${windowEnd?T.borderGold:T.border}`, color:T.text, borderRadius:9, padding:'7px 11px', fontSize:12, outline:'none', fontFamily:'inherit' }} />
          </div>
          {windowStart && windowEnd && <div style={{ fontSize:11, color:T.green, paddingTop:18 }}>✓ Window set</div>}
        </div>
      )}

      {/* Flexible */}
      {dateMode==='flexible' && (
        <div style={{ background:'rgba(212,175,55,0.06)', border:`0.5px solid ${T.borderGold}`, borderRadius:10, padding:'12px 14px' }}>
          <div style={{ fontSize:13, color:T.text, fontWeight:600, marginBottom:4 }}>We'll find the best available dates for you</div>
          <div style={{ fontSize:12, color:T.textDim, lineHeight:1.6 }}>
            Your Journey Specialist will check live availability across your preferred travel window and recommend the best-value dates — including any savings from shifting ±14 days.
          </div>
          <div style={{ marginTop:8, fontSize:11, color:T.gold }}>✦ Flexible dates often unlock 10–20% savings on lodge rates.</div>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// TRANSFER CAROUSEL — same peeking scroll-snap pattern as property carousel
// Sits between destination sections. Shows 3–5 transfer options per route.
// Options: Road Transfer | Commercial Flight | Private Charter | Combo
// Each option shows: mode, provider, duration, estimated cost, quality badges
// Recommended option (from KB) marked prominently.
// Cost is always labelled "est." — updates grandTotal as estimate.
// ─────────────────────────────────────────────────────────────────────────────

type TransferOption = {
  id:          string;
  mode:        'road' | 'commercial' | 'charter' | 'combo' | 'boat';
  icon:        string;
  label:       string;
  provider:    string;
  duration:    string;
  estimatedCostZAR: number;
  badges:      Array<{ text:string; color:string }>;
  aiNote:      string;
  recommended: boolean;
};

function buildTransferOptions(fromSlug: string, toSlug: string): TransferOption[] {
  const leg = getInternalLeg(fromSlug, toSlug);
  if (!leg) return [];

  // Generate options array from the base leg data
  const options: TransferOption[] = [];

  // Always include the KB-recommended option first
  options.push({
    id: 'recommended',
    mode: leg.mode,
    icon: leg.mode==='charter' ? '✈' : leg.mode==='road' ? '🚗' : leg.mode==='scheduled' ? '🛫' : '🛥',
    label: leg.mode==='charter' ? 'Private Charter' : leg.mode==='road' ? 'Road Transfer' : leg.mode==='scheduled' ? 'Commercial Flight' : 'Boat / Charter',
    provider: leg.provider,
    duration: leg.duration,
    estimatedCostZAR: leg.estimatedCostZAR,
    badges: [{ text:'✦ Recommended', color:T.gold }, { text:'Most efficient', color:T.green }],
    aiNote: leg.aiNote,
    recommended: true,
  });

  // Add alternative options based on route type
  const base = leg.estimatedCostZAR;

  if (leg.mode === 'charter') {
    // Cheaper commercial alternative
    options.push({
      id: 'commercial',
      mode: 'commercial',
      icon: '🛫',
      label: 'Commercial Flight',
      provider: 'Scheduled airline connection via hub',
      duration: `+45–90 min vs charter`,
      estimatedCostZAR: Math.round(base * 0.55),
      badges: [{ text:'Cheapest', color:'#60a5fa' }],
      aiNote: 'Connects via a regional hub. Saves cost but adds transfer time and baggage handling.',
      recommended: false,
    });
    // Combo option if long route
    if (base > 12000) {
      options.push({
        id: 'combo',
        mode: 'combo',
        icon: '🔀',
        label: 'Combo Transfer',
        provider: 'Commercial to hub + road transfer to lodge',
        duration: `${leg.duration} + 1h road`,
        estimatedCostZAR: Math.round(base * 0.45),
        badges: [{ text:'Budget option', color:'#a78bfa' }],
        aiNote: 'Mix of commercial flight and private vehicle. Best value for price-sensitive travellers.',
        recommended: false,
      });
    }
  } else if (leg.mode === 'scheduled') {
    // Upgrade to private charter — always a valid alternative for scheduled flights
    options.push({
      id: 'charter-upgrade',
      mode: 'charter',
      icon: '✈',
      label: 'Private Charter',
      provider: 'Direct charter — no connections',
      duration: 'Faster — no layover',
      estimatedCostZAR: Math.round(base * 1.8),
      badges: [{ text:'Fastest', color:T.green }, { text:'Most comfortable', color:T.gold }],
      aiNote: 'Direct charter eliminates connection risk. Recommended for guests with tight schedules or peak season.',
      recommended: false,
    });
    // Road ONLY if explicitly flagged viable in INTERNAL_LEGS — never auto-generate.
    // Cape Town → Kruger is 1,600km and is NOT a road transfer option.
    if ((leg as any).road_viable === true) {
      options.push({
        id: 'road',
        mode: 'road',
        icon: '🚗',
        label: 'Private Road Transfer',
        provider: 'Private vehicle with refreshments',
        duration: '2–4 hrs depending on route',
        estimatedCostZAR: Math.round(base * 0.3),
        badges: [{ text:'Cheapest', color:'#60a5fa' }, { text:'Scenic', color:'#4ade80' }],
        aiNote: 'Scenic drive. Relaxed pacing — stop when you want.',
        recommended: false,
      });
    }
  } else if (leg.mode === 'road') {
    options.push({
      id: 'charter-upgrade',
      mode: 'charter',
      icon: '✈',
      label: 'Light Aircraft Charter',
      provider: 'Private charter — fly over the reserve',
      duration: '20–45 min vs 2–4hr road',
      estimatedCostZAR: Math.round(base * 4.5),
      badges: [{ text:'Fastest', color:T.green }, { text:'Aerial views', color:T.gold }],
      aiNote: 'Arrive in style with aerial views over the reserve. Dramatically faster than road.',
      recommended: false,
    });
  }

  return options;
}

function TransferCarousel({ fromSlug, toSlug, fromLabel, toLabel, fmt, kbEntries, selectedTransferId, onSelect }: {
  fromSlug:           string;
  toSlug:             string;
  fromLabel:          string;
  toLabel:            string;
  fmt:                (n:number) => string;
  kbEntries:          KBEntry[];
  selectedTransferId: string | null;
  onSelect:           (id:string) => void;
}) {
  const options = useMemo(() => buildTransferOptions(fromSlug, toSlug), [fromSlug, toSlug]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [spinning,  setSpinning]  = useState(true);
  const stripRef = useRef<HTMLDivElement>(null);

  // Brief spin on mount to show it's loading options
  useEffect(() => {
    const t = setTimeout(() => {
      setSpinning(false);
      // Auto-select recommended
      const rec = options.find(o => o.recommended);
      if (rec && !selectedTransferId) onSelect(rec.id);
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToIdx = (idx: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    const cards = strip.querySelectorAll<HTMLElement>('[data-transfer-card]');
    cards[idx]?.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
    setActiveIdx(idx);
  };

  if (!options.length) return null;

  const selected = selectedTransferId
    ? options.find(o => o.id === selectedTransferId) ?? options[0]
    : options[0];

  return (
    <div style={{ marginBottom:24 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'0 2px' }}>
        <div style={{ flex:1, height:1, background:'rgba(96,165,250,0.15)' }} />
        <div style={{ fontSize:11, color:'#60a5fa', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' as const, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' as const }}>
          ✈ {fromLabel} → {toLabel}
        </div>
        <div style={{ flex:1, height:1, background:'rgba(96,165,250,0.15)' }} />
      </div>

      {spinning ? (
        /* Mini spinner while options load */
        <div style={{ background:'rgba(96,165,250,0.06)', border:'0.5px solid rgba(96,165,250,0.2)', borderRadius:10, padding:'16px', display:'flex', alignItems:'center', gap:12 }}>
          <div className="spinner" style={{ width:20, height:20, borderWidth:2 }} />
          <div style={{ fontSize:12, color:'#60a5fa' }}>Finding transfer options…</div>
        </div>
      ) : (
        <div style={{ position:'relative' as const, margin:'0 -4px' }}>
          {/* Left arrow — always visible when not at start */}
          {activeIdx > 0 && (
            <button onClick={() => scrollToIdx(activeIdx-1)} style={{ position:'absolute', left:-4, top:'50%', transform:'translateY(-50%)', zIndex:12, background:'rgba(10,10,10,0.95)', border:'1px solid rgba(96,165,250,0.5)', color:'#60a5fa', width:34, height:52, borderRadius:'0 10px 10px 0', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'3px 0 16px rgba(0,0,0,0.6)' }}>‹</button>
          )}
          {activeIdx < options.length-1 && (
            <button onClick={() => scrollToIdx(activeIdx+1)} style={{ position:'absolute', right:-4, top:'50%', transform:'translateY(-50%)', zIndex:12, background:'rgba(10,10,10,0.95)', border:'1px solid rgba(96,165,250,0.5)', color:'#60a5fa', width:34, height:52, borderRadius:'10px 0 0 10px', cursor:'pointer', fontSize:18, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'-3px 0 16px rgba(0,0,0,0.6)' }}>›</button>
          )}

          {/* Scroll strip */}
          <div ref={stripRef} style={{ display:'flex', gap:10, overflowX:'auto', scrollSnapType:'x mandatory' as const, WebkitOverflowScrolling:'touch' as any, scrollbarWidth:'none' as any, paddingLeft:20, paddingRight:20, paddingBottom:2 }}>
            {options.map((opt, idx) => {
              const isSel = selectedTransferId === opt.id || (!selectedTransferId && opt.recommended);
              return (
                <div
                  key={opt.id}
                  data-transfer-card={idx}
                  onClick={() => { onSelect(opt.id); scrollToIdx(idx); }}
                  style={{ flexShrink:0, width:'min(78vw, 360px)', scrollSnapAlign:'center', borderRadius:12, overflow:'hidden', border:`1.5px solid ${isSel?'#60a5fa':T.border}`, background:isSel?'rgba(96,165,250,0.07)':T.surface, cursor:'pointer', transition:'border-color 0.2s, background 0.2s', opacity:idx===activeIdx?1:0.72 }}
                >
                  <div style={{ padding:'14px 16px' }}>
                    {/* Mode header */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:22 }}>{opt.icon}</span>
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color:isSel?'#93c5fd':T.text }}>{opt.label}</div>
                          <div style={{ fontSize:11, color:T.textDim, marginTop:1 }}>{opt.provider}</div>
                        </div>
                      </div>
                      {isSel && <div style={{ fontSize:10, color:'#60a5fa', background:'rgba(96,165,250,0.12)', border:'0.5px solid rgba(96,165,250,0.3)', borderRadius:20, padding:'2px 8px', fontWeight:700 }}>Selected</div>}
                    </div>

                    {/* Badges */}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      {opt.badges.map((b,i) => (
                        <span key={i} style={{ fontSize:10, color:b.color, background:`${b.color}14`, border:`0.5px solid ${b.color}40`, borderRadius:20, padding:'2px 8px', fontWeight:700 }}>{b.text}</span>
                      ))}
                    </div>

                    {/* Duration + cost */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <div style={{ fontSize:13, color:T.textMid }}>{opt.duration}</div>
                      <div style={{ textAlign:'right' as const }}>
                        <div style={{ fontSize:15, fontWeight:700, color:'#60a5fa' }}>{fmt(opt.estimatedCostZAR)}</div>
                        <div style={{ fontSize:9, color:T.textDim }}>est. · subject to confirmation</div>
                      </div>
                    </div>

                    {/* AI note */}
                    <div style={{ fontSize:11, color:T.textDim, lineHeight:1.55, background:'rgba(96,165,250,0.04)', borderRadius:7, padding:'7px 10px' }}>{opt.aiNote}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Position dots */}
          {options.length > 1 && (
            <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:8 }}>
              {options.map((_,i) => (
                <div key={i} onClick={() => scrollToIdx(i)} style={{ width:i===activeIdx?16:5, height:5, borderRadius:3, background:i===activeIdx?'#60a5fa':'rgba(255,255,255,0.2)', cursor:'pointer', transition:'all 0.2s' }} />
              ))}
            </div>
          )}

          {/* Selected summary */}
          {selected && (
            <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(96,165,250,0.06)', border:'0.5px solid rgba(96,165,250,0.18)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:11, color:'#60a5fa' }}>{selected.icon} {selected.label} · {selected.duration}</div>
              <div style={{ fontSize:11, color:T.textDim }}>{fmt(selected.estimatedCostZAR)} est.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// LOGIN GATE  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
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
        <div style={{ fontSize:28, color:'#d4af37', fontFamily:"'Playfair Display',serif", fontWeight:700, marginBottom:8 }}>✦ The Safari Edition</div>
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

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────────────────────
function Spinner() { return <div className="spinner" />; }
function StepDot({ active }: { active: boolean }) { return <div style={{ width:8, height:8, borderRadius:'50%', background:active?T.gold:'rgba(255,255,255,0.15)', transition:'all 0.3s' }} />; }

function Nav({ edition, setScreen, currency, setCurrency, chatOpen, setChatOpen, totalZAR, fmt, hasPricedItems }: any) {
  const [editionOpen, setEditionOpen] = useState(false);
  return (
    <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(10,10,10,0.96)', backdropFilter:'blur(16px)', borderBottom:`0.5px solid ${T.border}`, padding:'0 20px' }}>
      <div style={{ maxWidth:900, margin:'0 auto', height:58, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <button onClick={() => setScreen('landing')} title="Home" style={{ background:'none', border:'none', cursor:'pointer', color:T.textDim, width:34, height:34, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontFamily:'inherit' }}>🏠</button>
          <div style={{ position:'relative' }}>
            <button onClick={() => setEditionOpen((x:boolean)=>!x)} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:14, fontWeight:700, color:T.gold, letterSpacing:'0.05em' }}>✦ {edition.name}</span>
              <span style={{ fontSize:10, color:T.textDim }}>{editionOpen?'▲':'▼'}</span>
            </button>
            {editionOpen && (
              <div style={{ position:'absolute', top:'calc(100% + 8px)', left:0, background:'#111', border:`0.5px solid rgba(212,175,55,0.3)`, borderRadius:14, padding:10, minWidth:240, zIndex:200, boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
                <div style={{ padding:'8px 12px', marginBottom:6, background:'rgba(212,175,55,0.08)', borderRadius:10 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.gold }}>✦ {edition.name}</div>
                  <div style={{ fontSize:10, color:T.textDim, marginTop:1 }}>Sub-Saharan Africa · Active</div>
                </div>
                {OTHER_EDITIONS.map((e:any) => (
                  <div key={e.id} style={{ padding:'8px 12px', borderRadius:10, display:'flex', alignItems:'center', gap:10, opacity:0.6 }}>
                    <span style={{ fontSize:18 }}>{e.icon}</span>
                    <div style={{ flex:1 }}><div style={{ fontSize:12, color:T.text, fontWeight:600 }}>{e.name}</div><div style={{ fontSize:10, color:T.textDim }}>{e.desc}</div></div>
                    <span style={{ fontSize:9, color:e.color, background:`${e.color}18`, border:`0.5px solid ${e.color}40`, borderRadius:20, padding:'2px 7px', fontWeight:700 }}>Soon</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setScreen('curated')} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMid, fontSize:12, fontFamily:'inherit', padding:'6px 10px', borderRadius:7 }}>Curated →</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {hasPricedItems && <div style={{ fontSize:13, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(totalZAR)}</div>}
          <select value={currency.code} onChange={(e:any)=>setCurrency(CURRENCIES.find((c:any)=>c.code===e.target.value)!)} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, borderRadius:8, padding:'5px 10px', fontSize:12, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
            {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
          <button onClick={()=>setChatOpen((x:boolean)=>!x)} style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, color:T.gold, borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{chatOpen?'✕ Close':'✦ Specialists'}</button>
          <a href="/admin" style={{ background:'rgba(255,255,255,0.06)', border:`0.5px solid rgba(255,255,255,0.14)`, color:T.textMid, borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textDecoration:'none' }}>Admin →</a>
        </div>
      </div>
      {editionOpen && <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={()=>setEditionOpen(false)} />}
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

// ─────────────────────────────────────────────────────────────────────────────
// HOTELS FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SafariEdition({ edition = SAFARI_EDITION }: { edition?: EditionConfig }) {

  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window==='undefined') return false;
    return localStorage.getItem('tse_access')==='safari2026';
  });

  const [screen,    setScreen]    = useState<Screen>('landing');
  const [inputMode, setInputMode] = useState<InputMode>('socratic');
  const [specialist] = useState(() => SPECIALISTS[Math.floor(Math.random()*SPECIALISTS.length)] ?? SPECIALISTS[0]);

  const [currency,    setCurrency]    = useState<Currency>(() => CURRENCIES.find(c=>c.code===edition.defaultCurrency)??CURRENCIES[0]);
  const fmt = useMemo(() => makeFmt(currency.symbol, currency.rate), [currency]);

  const [nights,   setNights]   = useState(7);
  const [adults,   setAdults]   = useState(2);
  const [children, setChildren] = useState(0);
  const [infants,  setInfants]  = useState(0);
  const totalPax = Math.max(adults+children,1);

  const [needsIntlFlight, setNeedsIntlFlight] = useState<boolean|null>(null);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const toggleRegion = (id: string) => {
    if (id==='inspire-me') { setSelectedRegions([]); return; }
    setSelectedRegions(prev => prev.includes(id) ? prev.filter(r=>r!==id) : [...prev.filter(r=>r!=='inspire-me'), id]);
  };

  const [budget,      setBudget]      = useState(120000);
  const [origin,      setOrigin]      = useState('JNB');
  const [intlOrigin,  setIntlOrigin]  = useState('LHR');
  const [researchStep,setResearchStep]= useState(0);
  const [itinerary,   setItinerary]   = useState<Itinerary|null>(null);

  // [V5-4] Per-destination: selected hotel id + prefs
  // propertyStays maps cityIdx → { hotelId, nights, prefs }
  const [cityStays, setCityStays] = useState<Array<{ hotelId:string|number; nights:number; prefs:{rooms:number;basis:number;flexibility:number} }>>([]);

  const [checkinDate,        setCheckinDate]        = useState('');
  // Date mode: 'specific' | 'month' | 'window' | 'flexible'
  const [dateMode,      setDateMode]      = useState<'specific'|'month'|'window'|'flexible'>('specific');
  const [flexMonth,     setFlexMonth]     = useState('');      // e.g. '2026-08'
  const [windowStart,   setWindowStart]   = useState('');
  const [windowEnd,     setWindowEnd]     = useState('');
  // Transfer selection: legKey → transferOptionId
  const [selectedTransferIds, setSelectedTransferIds] = useState<Record<string,string>>({});
  // City transfer selections: citySlug → transferOptionId
  const [cityTransferIds, setCityTransferIds] = useState<Record<string,string>>({});
  // Activity selections: citySlug → Set of activity ids
  const [selectedActivities, setSelectedActivities] = useState<Record<string, string[]>>({});
  // Activities section open per city
  const [activitiesOpen, setActivitiesOpen] = useState<Record<string,boolean>>({});
  // Arrival details (for own-flight travellers)
  const [arrivalAirport, setArrivalAirport] = useState('');
  const [arrivalFlightNo, setArrivalFlightNo] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [includeIntlFlight,  setIncludeIntlFlight]  = useState(false);
  const [builderIntlOrigin,  setBuilderIntlOrigin]  = useState('LHR');
  const [showValidation,     setShowValidation]     = useState(false);

  const [curTheme,  setCurTheme]  = useState('all');
  const [curRegion, setCurRegion] = useState('all');
  const [curNights, setCurNights] = useState('all');

  const [kbEntries,       setKbEntries]       = useState<KBEntry[]>(DEFAULT_KB);
  const [hotels,          setHotels]          = useState<Hotel[]>(HOTELS_FALLBACK);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const hotelsByMargin = useMemo(() => [...hotels].sort((a,b) => b.marginScore-a.marginScore), [hotels]);

  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMsgs,    setChatMsgs]    = useState<ChatMessage[]>([{ role:'assistant', text:`Welcome to ${edition.name}. How can our team help?` }]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // [V5-1] Collapsible adjust-chat in builder
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMsgs, setAdjustMsgs] = useState<ChatMessage[]>([{ role:'assistant', text:"Your journey is ready. Want to adjust anything?" }]);
  const [adjustInput, setAdjustInput] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const adjustEndRef = useRef<HTMLDivElement>(null);

  const FACTUAL = /visa|weather|pack|when|best time|malaria|safe|flight time|how long|currency|season/i;

  // Supabase fetch
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url||!key) { setSuppliersLoaded(true); return; }
    const query = `${url}/rest/v1/suppliers?select=*&is_active=eq.true&region_slug=not.is.null&order=trust_score.desc&limit=100`;
    fetch(query, { headers:{ apikey:key, Authorization:`Bearer ${key}` } })
      .then(r => { if (!r.ok) throw new Error(`Supabase ${r.status}`); return r.json(); })
      .then((rows: any[]) => {
        const OPERATOR_NAMES = ['Federal Air','Fastjet South Africa','Mack Air Botswana','Wilderness Air Botswana','Cape Town Airport Transfers'];
        const lodges = rows.filter(r => r.country && r.name && r.supplier_type!=='operator' && !OPERATOR_NAMES.includes(r.name));
        if (lodges.length>0) setHotels(lodges.map(mapSupplierRow));
        setSuppliersLoaded(true);
      })
      .catch(() => setSuppliersLoaded(true));
  }, [edition.id]);

  const M = edition.margins;

  // [V5-9] Grand total — sum of selected hotels across all cities
  const grandTotal = useMemo(() => {
    if (!itinerary?.cities || cityStays.length===0) return 0;

    // Lodge costs
    const lodgeCost = itinerary.cities.reduce((sum, city, i) => {
      const stay = cityStays[i];
      if (!stay) return sum;
      const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      const pool = slug ? hotelsByMargin.filter(h=>h.subRegion===slug) : hotelsByMargin;
      const hotel = pool.find(h=>String(h.id)===String(stay.hotelId)) ?? pool[0];
      if (!hotel) return sum;
      const { resolved } = resolveHotelUpgrades(hotel, stay.prefs);
      const extra = Object.values(resolved).reduce((s:number,v:any)=>s+(v?.extra??0),0);
      return sum + Math.round((hotel.netRate*stay.nights+extra)*M.hotels);
    }, 0);

    // Transfer costs — sum all selected transfer options between cities
    // Each selectedTransferIds[legKey] maps to a TransferOption id.
    // We re-derive the cost from buildTransferOptions to stay in sync with carousel.
    const transferCost = itinerary.cities.reduce((sum, city, i) => {
      if (i >= itinerary.cities.length - 1) return sum;
      const nextCity = itinerary.cities[i + 1];
      const fromSlug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      const toSlug   = CITY_TO_SLUG[nextCity.city.toLowerCase().trim()] ?? '';
      if (!fromSlug || !toSlug) return sum;
      const legKey  = `${fromSlug}→${toSlug}`;
      const options = buildTransferOptions(fromSlug, toSlug);
      if (!options.length) return sum;
      const selId   = selectedTransferIds[legKey];
      const chosen  = selId ? options.find(o => o.id === selId) : options.find(o => o.recommended) ?? options[0];
      return sum + (chosen?.estimatedCostZAR ?? 0);
    }, 0);

    // Activity costs — sum all selected activities per city
    const activityCost = itinerary.cities.reduce((sum, city) => {
      const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      const sel = selectedActivities[slug] ?? [];
      return sum + ACTIVITIES.filter(a => sel.includes(String(a.id))).reduce((s, a) => s + a.netRate, 0);
    }, 0);

    // City transfer costs (airport ↔ hotel for city-type destinations)
    const cityXferCost = itinerary.cities.reduce((sum, city) => {
      const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()] ?? '';
      if (!CITY_TYPE_SLUGS.has(slug)) return sum;
      const opts = CITY_TRANSFERS[slug] ?? [];
      if (!opts.length) return sum;
      const selId = cityTransferIds[slug];
      const chosen = selId ? opts.find(o => o.id === selId) : opts.find(o => o.recommended) ?? opts[0];
      return sum + (chosen?.estimatedCostZAR ?? 0);
    }, 0);

    return lodgeCost + transferCost + activityCost + cityXferCost;
  }, [itinerary?.cities, cityStays, hotelsByMargin, M.hotels, selectedTransferIds, selectedActivities, cityTransferIds]);

  const rankedCurated = useMemo(() => {
    return [...CURATED_JOURNEYS].map(j => {
      let score = 0;
      if (curTheme!=='all' && j.themes.includes(curTheme)) score+=3;
      if (curRegion!=='all' && (j.region===curRegion||j.region==='both')) score+=2;
      if (curNights==='short'&&j.nights<=6) score+=1;
      if (curNights==='medium'&&j.nights>=7&&j.nights<=10) score+=1;
      if (curNights==='long'&&j.nights>=11) score+=1;
      return { ...j, _score:score };
    }).sort((a:any,b:any)=>b._score-a._score);
  }, [curTheme,curRegion,curNights]);

  const runEngine = async (promptBody: string, mode: InputMode) => {
    setInputMode(mode);
    setScreen('inspire-research');
    setResearchStep(0);
    window.scrollTo({ top:0, behavior:'instant' });
    const kbCtx = buildKBContext(kbEntries, kbEntries.map(k=>k.id), edition.id);
    const aiPromise = runPlannerEngine({ kbContext:kbCtx, promptBody, ai:edition.ai }).catch(()=>null);
    let spinStep=0;
    const spinInterval = setInterval(()=>{ spinStep=Math.min(spinStep+1,RESEARCH_STEPS.length-1); setResearchStep(spinStep); },600);
    track('itinerary_viewed', edition.id, { mode, nights, adults, budget });
    const result = await aiPromise;
    clearInterval(spinInterval);
    const validResult = result && Array.isArray(result.cities) && result.cities.length>0 && result.cities.every((c:any)=>c?.city&&c?.country);
    let finalItinerary: Itinerary;
    if (validResult) { result.inputMode=mode; finalItinerary=result; }
    else { const slugs=selectedRegions.map(id=>REGIONS.find(r=>r.id===id)?.slug??'').filter(Boolean); finalItinerary=buildFallbackItinerary(nights,budget,mode,slugs); }
    setItinerary(finalItinerary);

    // [V5-1] Pre-load cityStays from AI itinerary — AI pre-selects best hotel per city
    const newStays = finalItinerary.cities.map((city) => {
      const slug = CITY_TO_SLUG[city.city.toLowerCase().trim()]??'';
      const pool = slug ? hotelsByMargin.filter(h=>h.subRegion===slug) : hotelsByMargin;
      const best = pool[0] ?? hotelsByMargin[0];
      return { hotelId:best?.id??0, nights:city.nights, prefs:{ rooms:0, basis:0, flexibility:0 } };
    });
    setCityStays(newStays);
    setAdjustMsgs([{ role:'assistant', text:`Your ${finalItinerary.title} is ready. Tap any lodge to browse options, or ask me to adjust anything below.` }]);

    if (needsIntlFlight) { setIncludeIntlFlight(true); setBuilderIntlOrigin(intlOrigin); }
    window.scrollTo({ top:0, behavior:'instant' });
    setScreen('builder'); // [V5-1] Skip inspire-plan entirely
  };

  const runSocraticPlanner = () => {
    const selectedRegionObjs = REGIONS.filter(r=>selectedRegions.includes(r.id));
    const selectedSlugs = selectedRegionObjs.map(r=>r.slug).filter(Boolean) as string[];
    const regionLabels = selectedRegionObjs.map(r=>r.label);
    const themeLabels = 'safari';
    const intlNote = needsIntlFlight ? `Guest flying from ${intlOrigin} — include international flight.` : 'Guest handling own international flights.';
    const regionSuppliers = selectedSlugs.length>0 ? hotels.filter(h=>selectedSlugs.includes(h.subRegion)).map(h=>`- ${h.name} (${h.destination}, ${h.country})`) : hotels.map(h=>`- ${h.name} (${h.destination}, ${h.country})`);
    let regionConstraint = selectedSlugs.length===0 ? 'Choose the best 1–2 destinations from the supplier list.' : selectedSlugs.length===1 ? `SINGLE DESTINATION ONLY: "${regionLabels[0]}". All ${nights} nights must be there.` : `Use ONLY these destinations: ${regionLabels.join(' and ')}.`;
    const infantNote = infants>0 ? `\nIMPORTANT: ${infants} infant(s). Flag lodge age restrictions.` : '';
    const promptBody = `You are a luxury safari journey designer at ${edition.name}.\n\nGUEST INPUTS:\n- Origin: ${origin}\n- ${intlNote}\n- Budget: R${budget.toLocaleString()}\n- Trip: exactly ${nights} nights total\n- Travellers: ${adults} adults${children>0?`, ${children} children`:''}${infants>0?`, ${infants} infants`:''}\n${infantNote}\n\nREGION CONSTRAINT: ${regionConstraint}\n\nAVAILABLE SUPPLIERS:\n${regionSuppliers.join('\n')}\n\nHARD RULES:\n1. Total nights across ALL cities must equal exactly ${nights}.\n2. Use only property names from the supplier list.\n3. Respond ONLY with valid JSON matching the Itinerary type. No preamble.`;
    runEngine(promptBody, 'socratic');
  };

  const runBriefPlanner = (briefText: string) => {
    const nightsMatch = briefText.match(/(\d+)\s*night/i);
    const extractedNights = nightsMatch ? parseInt(nightsMatch[1]) : nights;
    const supplierContext = hotels.filter(h=>h.name&&h.destination).map(h=>`- ${h.name} (${h.destination}, ${h.country}) — trust ${h.trustScore}/100`).join('\n');
    const infantNote = infants>0 ? `\nIMPORTANT: ${infants} infant(s). Flag lodge age restrictions.` : '';
    const promptBody = `You are a luxury safari journey designer at ${edition.name}.\nTRAVELLER BRIEF: "${briefText}"\n\nAVAILABLE SUPPLIERS:\n${supplierContext}\n\nHARD CONSTRAINTS:\n1. TOTAL NIGHTS: exactly ${extractedNights} nights.\n2. Use only properties from the supplier list.\n3. TRAVELLERS: ${adults} adults${children>0?`, ${children} children`:''}${infants>0?`, ${infants} infants`:''}.\n${infantNote}\nRespond ONLY with valid JSON matching the Itinerary type. No preamble.`;
    if (extractedNights!==nights) setNights(extractedNights);
    runEngine(promptBody, 'brief');
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
    const prev = itinerary;
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

  // Escalate from image mini-chat to specialist drawer
  const escalateToSpecialist = (context: string) => {
    setChatOpen(true);
    setChatMsgs(m => [...m, { role:'assistant', text:`Happy to help with ${context} — what would you like to know?` }]);
  };

  const [checkoutKey] = useState(() => generateIdempotencyKey());
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleValidateAndPay = () => setShowValidation(true);

  const doCheckout = async () => {
    setShowValidation(false);
    if (checkoutLoading||!itinerary) return;
    setCheckoutLoading(true);
    track('payment_initiated', edition.id, { grandTotal, nights, adults });
    try {
      const components: BookingComponent[] = (itinerary.cities??[]).map((city, i) => {
        const stay = cityStays[i];
        if (!stay) return null;
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

      {/* ═══════════════════════════════════════════════════════════════════
          LANDING
      ═══════════════════════════════════════════════════════════════════ */}
      {screen==='landing' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div style={{ position:'relative', height:'82vh', minHeight:520, overflow:'hidden' }}>
            <img src={edition.heroImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 40%' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom,rgba(10,10,10,0.1) 0%,rgba(10,10,10,0.45) 55%,rgba(10,10,10,1) 100%)' }} />
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'0 24px 52px', maxWidth:900, margin:'0 auto' }}>
              <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.2em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:12 }}>{edition.name}</div>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(30px,5.5vw,56px)', fontWeight:700, lineHeight:1.1, marginBottom:16, color:T.text }}>Africa's finest wilderness,<br /><em style={{ color:T.gold }}>curated for you.</em></h1>
              <p style={{ fontSize:16, color:T.textMid, lineHeight:1.7, marginBottom:32, maxWidth:500 }}>Handpicked lodges, negotiated rates, perfectly sequenced journeys.</p>
              {/* [V5-2] Bigger CTAs with descriptor sub-text */}
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {[
                  { label:'✦ Plan My Journey', sub:"We'll build your dream trip in a few clicks", action:()=>setScreen('inspire-input'), primary:true },
                  { label:'Curated Journeys', sub:'Ready to book — from price', action:()=>setScreen('curated'), primary:false },
                  { label:'Send Your Brief', sub:'Write anything — we\'ll handle the rest', action:()=>setScreen('my-brief'), primary:false },
                ].map(btn => (
                  <button key={btn.label} onClick={btn.action} style={{ padding:'16px 24px', borderRadius:12, border:`1.5px solid ${btn.primary?T.gold:T.border}`, background:btn.primary?`linear-gradient(135deg,${T.gold},${T.goldLight})`:'rgba(255,255,255,0.06)', color:btn.primary?'#0a0a0a':T.text, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, minWidth:180 }}>
                    <div style={{ fontSize:15, fontWeight:700 }}>{btn.label}</div>
                    <div style={{ fontSize:11, marginTop:4, opacity:0.7, fontWeight:400 }}>{btn.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Curated bottom section */}
          <div style={{ maxWidth:900, margin:'0 auto', padding:'52px 20px 80px' }}>
            <div style={{ marginBottom:40 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:20, flexWrap:'wrap', gap:8 }}>
                <div><div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:4 }}>Curated Journeys</div><h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:T.text, margin:0 }}>Ready to book — from price</h2></div>
                <button onClick={()=>setScreen('curated')} style={{ background:'none', border:`0.5px solid ${T.border}`, color:T.textDim, borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>View all →</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
                {CURATED_JOURNEYS.slice(0,4).map(j => (
                  <div key={j.id} className="card" style={{ cursor:'pointer' }} onClick={()=>setScreen('curated')}>
                    <div style={{ position:'relative', height:180, overflow:'hidden' }}>
                      <img src={j.image} alt={j.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.68) 0%,transparent 52%)' }} />
                      <div style={{ position:'absolute', top:10, left:10, background:j.badgeColor, color:'#0a0a0a', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20 }}>{j.badge}</div>
                      <div style={{ position:'absolute', bottom:10, left:12, right:12 }}>
                        <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Playfair Display',serif", color:'#fff' }}>{j.name}</div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:4 }}>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)' }}>{j.nights}n · {j.pax} pax</div>
                          <div style={{ fontSize:15, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(j.priceFrom)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12 }}>
              {[{icon:'✦',title:'Negotiated rates',sub:"Contracted directly with Africa's finest lodges."},{icon:'🛡',title:'Verified lodges',sub:'Every property vetted for service and reliability.'},{icon:'📞',title:'Journey specialists',sub:'Real people, available before and during your trip.'},{icon:'🔄',title:'Flexible booking',sub:'Our cancellation terms are the most generous available.'}].map(f => (
                <div key={f.title} style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:14, padding:'18px 16px' }}>
                  <div style={{ fontSize:20, marginBottom:8 }}>{f.icon}</div>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:5, color:T.text }}>{f.title}</div>
                  <div style={{ fontSize:12, color:T.textDim, lineHeight:1.65 }}>{f.sub}</div>
                </div>
              ))}
            </div>
          </div>
          {chatOpen && <ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={()=>setChatOpen(false)} edition={edition} />}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          CURATED SCREEN
      ═══════════════════════════════════════════════════════════════════ */}
      {screen==='curated' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div className="fade-up" style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px 80px' }}>
            <button onClick={()=>setScreen('landing')} style={{ background:'transparent', border:`0.5px solid ${T.border}`, color:T.textDim, borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:24 }}>← Back</button>
            <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:6 }}>Curated Journeys</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, marginBottom:6, color:T.text }}>Ready to book — from price</h2>
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
                <div key={j.id} className="card" style={{ cursor:'pointer', position:'relative' as const }} onClick={()=>setScreen('inspire-input')}>
                  {rank===0&&(curTheme!=='all'||curRegion!=='all'||curNights!=='all')&&<div style={{ position:'absolute', top:-8, left:12, zIndex:2, background:T.gold, color:'#0a0a0a', fontSize:9, fontWeight:800, padding:'3px 10px', borderRadius:20, textTransform:'uppercase' as const }}>Best match</div>}
                  <div style={{ position:'relative', height:195, overflow:'hidden' }}>
                    <img src={j.image} alt={j.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.68) 0%,transparent 52%)' }} />
                    <div style={{ position:'absolute', top:10, left:10, background:j.badgeColor, color:'#0a0a0a', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20 }}>{j.badge}</div>
                    <div style={{ position:'absolute', bottom:10, left:12, right:12 }}>
                      <div style={{ fontSize:15, fontWeight:700, fontFamily:"'Playfair Display',serif", color:'#fff' }}>{j.name}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:1 }}>{j.tagline}</div>
                    </div>
                  </div>
                  <div style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
                      <div><div style={{ fontSize:11, color:T.textDim, marginBottom:2 }}>{j.nights}n · {j.pax} pax</div><div style={{ fontSize:22, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(j.priceFrom)}</div></div>
                      <div style={{ textAlign:'right' as const }}><div style={{ fontSize:10, color:T.textDim, marginBottom:2 }}>vs direct</div><div style={{ fontSize:13, color:T.green, fontWeight:600 }}>Save {fmt(j.otaEquivalent-j.priceFrom)}</div></div>
                    </div>
                    <div style={{ borderTop:`0.5px solid ${T.border}`, paddingTop:10 }}>{j.includes.slice(0,3).map((inc:string,i:number)=><div key={i} style={{ fontSize:11, color:T.textMid, display:'flex', gap:6, marginBottom:3 }}><span style={{ color:T.gold, flexShrink:0 }}>✓</span>{inc}</div>)}</div>
                    <button className="btn-gold" style={{ width:'100%', padding:11, fontSize:13, marginTop:12 }}>View & Customise →</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          INSPIRE INPUT
      ═══════════════════════════════════════════════════════════════════ */}
      {screen==='inspire-input' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div className="fade-up" style={{ maxWidth:660, margin:'0 auto', padding:'32px 20px 100px' }}>
            <button onClick={()=>setScreen('landing')} style={{ background:'transparent', border:`0.5px solid ${T.border}`, color:T.textDim, borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:24 }}>← Back</button>
            <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:6 }}>Journey Planner</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, marginBottom:8, color:T.text }}>Tell us about your dream safari</h2>
            <p style={{ fontSize:14, color:T.textMid, marginBottom:28, lineHeight:1.65 }}>We'll build a fully-priced, bookable itinerary in under 30 seconds.</p>

            <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:14, padding:'16px 18px', marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:12 }}>Do you need international flights included?</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:needsIntlFlight===true?12:0 }}>
                {[{val:true,label:"Yes — include from my home country",icon:'✈'},{val:false,label:"No — I'll arrange my own flights",icon:'🏠'}].map(opt=>(
                  <button key={String(opt.val)} onClick={()=>setNeedsIntlFlight(opt.val)} style={{ padding:'12px 14px', borderRadius:10, border:`1.5px solid ${needsIntlFlight===opt.val?T.gold:T.border}`, background:needsIntlFlight===opt.val?T.goldDim:T.bg3, color:needsIntlFlight===opt.val?T.gold:T.textMid, fontSize:13, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, display:'flex', alignItems:'flex-start', gap:8 }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{opt.icon}</span><span style={{ lineHeight:1.4 }}>{opt.label}</span>
                  </button>
                ))}
              </div>
              {needsIntlFlight===true && (
                <div>
                  <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.06em', fontWeight:600, marginBottom:6 }}>Flying from</div>
                  <select value={intlOrigin} onChange={e=>setIntlOrigin(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.text, borderRadius:10, padding:'11px 13px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
                    {INTERNATIONAL_ORIGINS.map(o=><option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
                  </select>
                </div>
              )}
              {needsIntlFlight===false && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.06em', fontWeight:600, marginBottom:6 }}>Arriving into</div>
                  <select value={origin} onChange={e=>setOrigin(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.text, borderRadius:10, padding:'11px 13px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
                    {REGIONAL_ORIGINS.map(o=><option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
                  </select>

                </div>
              )}
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:T.textDim, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:4 }}>Destination region</div>
              <div style={{ fontSize:11, color:T.textDim, marginBottom:8 }}>Select one or more — or tap Inspire Me</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {REGIONS.map(r=>{
                  const isActive = r.id==='inspire-me' ? selectedRegions.length===0 : selectedRegions.includes(r.id);
                  return (
                    <button key={r.id} onClick={()=>toggleRegion(r.id)} style={{ padding:'12px 14px', borderRadius:10, border:`1.5px solid ${isActive?T.gold:T.border}`, background:isActive?T.goldDim:T.surface, color:isActive?T.gold:T.textMid, fontSize:13, fontWeight:isActive?600:400, cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:'inherit', position:'relative' as const }}>
                      {isActive&&r.id!=='inspire-me'&&<div style={{ position:'absolute', top:6, right:6, width:14, height:14, borderRadius:'50%', background:T.gold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#0a0a0a', fontWeight:800 }}>✓</div>}
                      <span>{r.icon}</span>{r.label}
                    </button>
                  );
                })}
              </div>
              {selectedRegions.length>1&&<div style={{ marginTop:8, fontSize:11, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, padding:'6px 12px' }}>✦ {selectedRegions.length} regions selected — multi-destination journey</div>}
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11, color:T.textDim, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>Total budget</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(budget)}</div>
              </div>
              <input type="range" min={20000} max={2000000} step={10000} value={budget} onChange={e=>setBudget(+e.target.value)} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}><span style={{ fontSize:10, color:T.textDim }}>{fmt(20000)}</span><span style={{ fontSize:10, color:T.textDim }}>{fmt(2000000)}</span></div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11, color:T.textDim, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>Trip length</div>
                <div style={{ fontSize:14, fontWeight:600, color:T.text }}>{nights} nights</div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[5,7,10,12,14,21].map(n=>(
                  <button key={n} onClick={()=>setNights(n)} style={{ padding:'7px 14px', borderRadius:8, border:`1.5px solid ${nights===n?T.gold:T.border}`, background:nights===n?T.goldDim:'transparent', color:nights===n?T.gold:T.textMid, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{n}n</button>
                ))}
              </div>
            </div>

            <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'16px 18px', marginBottom:24 }}>
              <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600, marginBottom:12 }}>Travellers</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                {[{label:'Adults',sub:'',value:adults,set:setAdults,min:1},{label:'Children',sub:'Ages 2–17',value:children,set:setChildren,min:0},{label:'Infants',sub:'Under 2',value:infants,set:setInfants,min:0}].map(p=>(
                  <div key={p.label}>
                    <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600, marginBottom:2 }}>{p.label}</div>
                    {p.sub&&<div style={{ fontSize:10, color:T.textDim, marginBottom:6 }}>{p.sub}</div>}
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <button onClick={()=>p.set(Math.max(p.min,p.value-1))} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:28, height:28, borderRadius:7, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>−</button>
                      <span style={{ fontSize:16, fontWeight:700, color:T.text, minWidth:24, textAlign:'center' as const }}>{p.value}</span>
                      <button onClick={()=>p.set(p.value+1)} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:28, height:28, borderRadius:7, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              {infants>0&&<div style={{ marginTop:12, background:'rgba(251,191,36,0.07)', border:'0.5px solid rgba(251,191,36,0.2)', borderRadius:8, padding:'8px 12px', fontSize:12, color:T.amber, lineHeight:1.55 }}>⚠ Some camps restrict under-5s on open game drives — we'll flag this in your itinerary.</div>}
            </div>

            {/* Date selector on the planning form */}
            <div style={{ marginBottom:20 }}>
              <DateSelector checkinDate={checkinDate} setCheckinDate={setCheckinDate} dateMode={dateMode} setDateMode={setDateMode} flexMonth={flexMonth} setFlexMonth={setFlexMonth} windowStart={windowStart} setWindowStart={setWindowStart} windowEnd={windowEnd} setWindowEnd={setWindowEnd} nights={nights} />
            </div>

            <button className="btn-gold" style={{ width:'100%', padding:16, fontSize:15 }} onClick={runSocraticPlanner}>✦ Build My Itinerary →</button>
            <p style={{ textAlign:'center' as const, fontSize:12, color:T.textDim, marginTop:10 }}>Usually ready in under 30 seconds</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          INSPIRE RESEARCH
      ═══════════════════════════════════════════════════════════════════ */}
      {screen==='inspire-research' && (
        <div style={{ minHeight:'100vh', background:T.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
          <div style={{ marginBottom:32, display:'flex', gap:6 }}>{RESEARCH_STEPS.map((_,i)=><StepDot key={i} active={i<=researchStep} />)}</div>
          <Spinner />
          <div style={{ fontSize:14, color:T.textMid, textAlign:'center' as const, marginTop:20, maxWidth:360 }}>{RESEARCH_STEPS[researchStep]}</div>
          <div style={{ fontSize:12, color:T.textDim, marginTop:8 }}>Checking lodge availability · Building your itinerary</div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          [V5-3] PRICE & BOOK — unified builder with nested carousels
      ═══════════════════════════════════════════════════════════════════ */}
      {screen==='builder' && itinerary && (
        <div style={{ minHeight:'100vh', background:T.bg, paddingBottom:120 }}>
          <Nav {...navProps} />

          <div style={{ maxWidth:680, margin:'0 auto', padding:'20px 20px 0' }}>
            {/* [V5-1] AI itinerary summary banner */}
            <div style={{ background:T.surface, border:`0.5px solid ${T.borderGold}`, borderRadius:14, padding:'14px 18px', marginBottom:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:700, marginBottom:4 }}>✦ Your Journey</div>
                  <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:"'Playfair Display',serif" }}>{itinerary.title}</div>
                  <div style={{ fontSize:12, color:T.textDim, marginTop:4 }}>{itinerary.routing}</div>
                </div>
                <div style={{ textAlign:'right' as const }}>
                  <div style={{ fontSize:11, color:T.textDim, marginBottom:2 }}>{itinerary.cities.reduce((s,c)=>s+c.nights,0)} nights · all-in estimate</div>
                  <div style={{ fontSize:22, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(itinerary.totalEstimate)}</div>
                </div>
              </div>

              {/* Journey Specialist mini-profile */}
              <div style={{ marginTop:12, paddingTop:12, borderTop:`0.5px solid ${T.border}`, display:'flex', alignItems:'center', gap:12 }}>
                <img src={specialist.avatar} alt={specialist.name} style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', border:`1.5px solid ${T.borderGold}`, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:T.gold, fontWeight:600 }}>{specialist.name}</div>
                  <div style={{ fontSize:10, color:T.textDim }}>{specialist.role} · Available now</div>
                  <div style={{ fontSize:11, color:T.textMid, marginTop:2, fontStyle:'italic' }}>"{specialist.tip}"</div>
                </div>
                <button onClick={() => setChatOpen(true)} style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, color:T.gold, borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const, flexShrink:0 }}>Chat →</button>
              </div>

              {/* [V5-1] Collapsible adjust chat */}
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

            {/* [V5-4] Per-destination nested carousel sections */}
            {itinerary.cities.map((city, cityIdx) => {
              const cityName = city.city.toLowerCase().trim();
              const slug = CITY_TO_SLUG[cityName] ?? '';
              const destLabel = city.city;
              // Strict region filter: only show properties matching this city's slug.
              // If slug unknown (AI named a city not in CITY_TO_SLUG), try name fuzzy match.
              // NEVER fall back to full list — that causes 51 properties for one city.
              const pool = slug
                ? hotelsByMargin.filter(h => h.subRegion === slug)
                : hotelsByMargin.filter(h => {
                    const dest = (h.destination ?? '').toLowerCase();
                    const name = (h.name ?? '').toLowerCase();
                    // Require meaningful match: city name contains dest word or vice versa
                    return dest.includes(cityName) || cityName.includes(dest.split(',')[0].trim()) || name.includes(cityName);
                  });
              // If still empty: show top 3 from the same country to avoid blank section.
              // Cap at 5 max — never show the full unfiltered list.
              const safePool = pool.length > 0
                ? pool.slice(0, 12)
                : hotelsByMargin.filter(h => (h.country ?? '') === (itinerary.cities[cityIdx]?.country ?? '')).slice(0, 3);
              const currentStay = cityStays[cityIdx] ?? { hotelId:safePool[0]?.id??0, nights:city.nights, prefs:{ rooms:0, basis:0, flexibility:0 } };

              // Show city transfer if always-on OR if KB has a city_transfer entry for this slug
              const isCityAlways = CITY_TYPE_ALWAYS.has(slug);
              const isCityKB     = CITY_TYPE_KB.has(slug) && kbEntries.some(e => e.active && e.type === 'city_transfer' && (e.linkedTo ?? '').toLowerCase().includes(slug.replace(/-/g,' ')));
              const isCityDest   = isCityAlways || isCityKB;
              const cityXferOpts = isCityDest ? (CITY_TRANSFERS[slug] ?? []) : [];
              const selCityXferId = cityTransferIds[slug];

              return (
                <div key={cityIdx}>

                  {/* [GAP 2] City airport transfer card — auto-shown for city-type destinations */}
                  {isCityDest && cityXferOpts.length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'0 2px' }}>
                        <div style={{ flex:1, height:1, background:'rgba(74,222,128,0.15)' }} />
                        <div style={{ fontSize:11, color:T.green, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' as const, whiteSpace:'nowrap' as const }}>
                          🚗 Airport transfer — {destLabel}
                        </div>
                        <div style={{ flex:1, height:1, background:'rgba(74,222,128,0.15)' }} />
                      </div>
                      <div style={{ display:'flex', gap:10, overflowX:'auto', scrollSnapType:'x mandatory' as any, WebkitOverflowScrolling:'touch' as any, scrollbarWidth:'none' as any, paddingBottom:2 }}>
                        {cityXferOpts.map(opt => {
                          const isSel = selCityXferId ? selCityXferId===opt.id : opt.recommended;
                          return (
                            <div key={opt.id} onClick={() => setCityTransferIds(prev => ({ ...prev, [slug]: opt.id }))} style={{ flexShrink:0, width:'min(75vw,320px)', scrollSnapAlign:'center', borderRadius:12, border:`1.5px solid ${isSel?T.green:T.border}`, background:isSel?'rgba(74,222,128,0.07)':T.surface, cursor:'pointer', padding:'14px 16px', transition:'border-color 0.2s' }}>
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
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                                <div style={{ fontSize:12, color:T.textMid }}>{opt.duration}</div>
                                <div style={{ textAlign:'right' as const }}>
                                  <div style={{ fontSize:14, fontWeight:700, color:T.green }}>{fmt(opt.estimatedCostZAR)}</div>
                                  <div style={{ fontSize:9, color:T.textDim }}>est.</div>
                                </div>
                              </div>
                              <div style={{ fontSize:11, color:T.textDim, lineHeight:1.5, background:'rgba(74,222,128,0.04)', borderRadius:7, padding:'7px 10px' }}>{opt.note}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}



                  <NestedPropertyCarousel
                    destinationLabel={destLabel}
                    destinationSlug={slug}
                    cityNights={currentStay.nights}
                    onNightsChange={delta => {
                      setCityStays(prev => {
                        const next = prev.map((s,i) => i===cityIdx ? { ...s, nights:Math.max(1, s.nights+delta) } : s);
                        return next;
                      });
                    }}
                    hotels={safePool}
                    selectedHotelId={currentStay.hotelId}
                    onSelectHotel={hotel => {
                      setCityStays(prev => {
                        const next = [...prev];
                        next[cityIdx] = { ...currentStay, hotelId:hotel.id };
                        return next;
                      });
                    }}
                    stayPrefs={currentStay.prefs}
                    onUpgradeSelect={(key, opt) => {
                      setCityStays(prev => {
                        const next = [...prev];
                        next[cityIdx] = { ...currentStay, prefs:{ ...currentStay.prefs, [key]:opt.tier ?? 0 } };
                        return next;
                      });
                    }}
                    kbEntries={kbEntries}
                    fmt={fmt}
                    edition={edition}
                    onEscalateChat={escalateToSpecialist}
                    selectedActivityIds={selectedActivities[slug] ?? []}
                    onActivityToggle={id => setSelectedActivities(prev => {
                      const cur = prev[slug] ?? [];
                      const next = cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id];
                      return { ...prev, [slug]: next };
                    })}
                  />


                  {/* Transfer carousel between cities */}
                  {cityIdx < itinerary.cities.length-1 && (() => {
                    const nextCity = itinerary.cities[cityIdx+1];
                    const fromSlug = slug;
                    const toSlug = CITY_TO_SLUG[nextCity.city.toLowerCase().trim()] ?? '';
                    if (!fromSlug||!toSlug) return null;
                    const legKey = `${fromSlug}→${toSlug}`;
                    return (
                      <TransferCarousel
                        key={legKey}
                        fromSlug={fromSlug}
                        toSlug={toSlug}
                        fromLabel={itinerary.cities[cityIdx].city}
                        toLabel={nextCity.city}
                        fmt={fmt}
                        kbEntries={kbEntries}
                        selectedTransferId={selectedTransferIds[legKey] ?? null}
                        onSelect={id => setSelectedTransferIds(prev => ({ ...prev, [legKey]: id }))}
                      />
                    );
                  })()}
                </div>
              );
            })}

            {/* ── DEPARTURE CARD — after last city ── */}
            {(() => {
              const lastCity = itinerary.cities[itinerary.cities.length - 1];
              if (!lastCity) return null;
              const lastSlug = CITY_TO_SLUG[lastCity.city.toLowerCase().trim()] ?? '';
              // Determine likely departure hubs based on last destination
              const hubs: {code:string; label:string; note:string}[] = lastSlug === 'cape-town'
                ? [{ code:'CPT', label:'Cape Town International (CPT)', note:'Direct international departures to London, Amsterdam, Frankfurt, New York and more.' }]
                : lastSlug === 'masai-mara'
                ? [{ code:'NBO', label:'Nairobi Jomo Kenyatta (NBO)', note:'45-min charter from Mara airstrip to NBO. Book early for peak season connections.' }, { code:'MBA', label:'Mombasa Moi (MBA)', note:'Alternative via scheduled carrier — useful if combining with coast.' }]
                : [{ code:'JNB', label:'Johannesburg O.R. Tambo (JNB)', note:'Main hub for onward international connections. Allow 3hr connection from bush charters.' },
                   { code:'CPT', label:'Cape Town International (CPT)', note:'Domestic connection from JNB. Good option for guests ending in Cape Town.' }];
              const bookingFlight = includeIntlFlight;
              return (
                <div style={{ marginBottom:24, background:`rgba(212,175,55,0.05)`, border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'16px 18px' }}>
                  <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.1em', fontWeight:700, marginBottom:4 }}>✦ Departure from {lastCity.city}</div>
                  <div style={{ fontSize:13, color:T.text, fontWeight:600, marginBottom:8 }}>Where do you fly home from?</div>
                  <div style={{ fontSize:12, color:T.textDim, marginBottom:12, lineHeight:1.55 }}>
                    {bookingFlight
                      ? 'Your return flight is included. Your Journey Specialist will confirm your departure timing and transfer from the final lodge.'
                      : 'You're arranging your own return flight. Select your departure airport so we can add your final transfer.'}
                  </div>
                  {!bookingFlight && hubs.map(hub => (
                    <div key={hub.code} style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:9, padding:'10px 14px', marginBottom:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{hub.label}</div>
                        <div style={{ fontSize:10, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:20, padding:'2px 8px', fontWeight:700, flexShrink:0, marginLeft:8 }}>Add transfer</div>
                      </div>
                      <div style={{ fontSize:11, color:T.textDim, lineHeight:1.5 }}>{hub.note}</div>
                    </div>
                  ))}
                  {bookingFlight && (
                    <div style={{ fontSize:11, color:T.green }}>✓ Return flight included — your Journey Specialist handles all final transfers and airport timing.</div>
                  )}
                  <div style={{ marginTop:10, fontSize:11, color:T.textDim, borderTop:`0.5px solid ${T.border}`, paddingTop:10 }}>
                    💬 Your Journey Specialist will confirm all final logistics before travel.
                  </div>
                </div>
              );
            })()}

            {/* Warnings */}
            {filterWarnings(itinerary.warnings??[]).length>0 && (
              <div style={{ background:'rgba(251,146,60,0.07)', border:'0.5px solid rgba(251,146,60,0.22)', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
                {filterWarnings(itinerary.warnings??[]).map((w:string,i:number)=><div key={i} style={{ fontSize:12, color:'rgba(251,146,60,0.9)', lineHeight:1.55 }}>⚠ {w}</div>)}
              </div>
            )}
            {infants>0&&<div style={{ background:'rgba(251,191,36,0.07)', border:'0.5px solid rgba(251,191,36,0.2)', borderRadius:12, padding:'12px 16px', marginBottom:16, fontSize:12, color:T.amber }}>⚠ {infants} infant{infants>1?'s':''} on this trip. Journey Specialist will confirm age policies with each property.</div>}
          </div>

          {/* [V5-9] Sticky bottom price bar + CTA */}
          <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:90, background:'rgba(10,10,10,0.97)', backdropFilter:'blur(20px)', borderTop:`0.5px solid ${T.borderGold}`, padding:'14px 20px' }}>
            <div style={{ maxWidth:680, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div>
                <div style={{ fontSize:11, color:T.textDim, marginBottom:2 }}>Package total · {itinerary.cities.reduce((s,c)=>s+c.nights,0)} nights</div>
                <div style={{ fontSize:24, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif", lineHeight:1 }}>{fmt(grandTotal)}</div>
                {(() => {
                  const actCost = itinerary.cities.reduce((sum,city) => {
                    const sl = CITY_TO_SLUG[city.city.toLowerCase().trim()]??'';
                    const sel = selectedActivities[sl]??[];
                    return sum + ACTIVITIES.filter(a=>sel.includes(String(a.id))).reduce((s,a)=>s+a.netRate,0);
                  },0);
                  return actCost > 0 ? (
                    <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>
                      Lodges & transfers: {fmt(grandTotal - actCost)} · Activities: {fmt(actCost)}
                    </div>
                  ) : <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>Lodges, transfers & activities</div>;
                })()}
              </div>
              <button className="btn-gold" style={{ padding:'14px 28px', fontSize:15, flexShrink:0 }} onClick={handleValidateAndPay} disabled={checkoutLoading}>
                {checkoutLoading ? 'Saving…' : 'Validate & Pay →'}
              </button>
            </div>
          </div>

          {chatOpen && <ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={()=>setChatOpen(false)} edition={edition} />}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MY BRIEF
      ═══════════════════════════════════════════════════════════════════ */}
      {screen==='my-brief' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div style={{ maxWidth:660, margin:'0 auto', padding:'32px 20px 80px' }}>
            <button onClick={()=>setScreen('landing')} style={{ background:'transparent', border:`0.5px solid ${T.border}`, color:T.textDim, borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:24 }}>← Back</button>
            <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:6 }}>Your Brief</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, marginBottom:8, color:T.text }}>Tell us what you're dreaming of</h2>
            <p style={{ fontSize:14, color:T.textMid, marginBottom:24, lineHeight:1.65 }}>Write anything — we'll read it and build your journey around it.</p>
            <BriefScreen nights={nights} setNights={setNights} adults={adults} setAdults={setAdults} children={children} setChildren={setChildren} infants={infants} setInfants={setInfants} onBuild={(text:string)=>runBriefPlanner(text)} />
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIEF SCREEN
// ─────────────────────────────────────────────────────────────────────────────
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
        {[{label:'Nights',value:nights,options:[5,7,10,12,14,21],onChange:setNights,suffix:'n'},{label:'Adults',value:adults,options:[1,2,3,4,6],onChange:setAdults,suffix:''},{label:'Children',value:children,options:[0,1,2,3,4],onChange:setChildren,suffix:''},{label:'Infants',value:infants,options:[0,1,2],onChange:setInfants,suffix:''}].map(p=>(
          <div key={p.label} style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'12px 14px' }}>
            <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:8 }}>{p.label}</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {p.options.map(o=>(
                <button key={o} onClick={()=>p.onChange(o)} style={{ padding:'4px 8px', borderRadius:7, border:`0.5px solid ${p.value===o?T.borderGold:T.border}`, background:p.value===o?T.goldDim:'transparent', color:p.value===o?T.gold:T.textDim, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{o}{p.suffix}</button>
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
