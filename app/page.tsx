'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// THE TRAVEL CATALOGUE — page.tsx
// Safari Edition · v3.3
// Fixes: Supabase pull, multi-region select, parallel spinner, builder region
//        context, carousel scoping, warnings tone
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { T, GLOBAL_CSS }                     from './lib/theme';
import { buildKBContext, runPlannerEngine,
         answerFactual, applyCreativeDiff,
         chatWithSpecialist }                from './lib/aiGateway';
import { fetchAvailability, findAlternativeDate,
         preloadHotels, availCache,
         addDays, todayPlusDays }            from './lib/availability';
import { resolveHotelUpgrades, makeFmt }     from './lib/pricing';
import { applyDeterministicChange }          from './lib/chatEngine';
import type { Screen, Pillar, InputMode, Hotel, PropertyStay,
              InterTransferState, UpgradeState, Itinerary,
              ItineraryCity, Currency, KBEntry, ChatMessage,
              BookingState, BookingIntent, BookingComponent,
              AvailResult, AltDate, EditionConfig,
              InclusionSource }  from './lib/types';
import { canTransition, VALID_TRANSITIONS }  from './lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// EDITION CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SAFARI_EDITION: EditionConfig = {
  id:              'safari',
  name:            'The Safari Edition',
  tagline:         'Sub-Saharan Africa · Curated',
  heroImage:       'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1400&q=80',
  primaryRegion:   'southern-africa',
  defaultCurrency: 'ZAR',
  margins: { flights: 1.08, hotels: 1.15, transfers: 1.20, activities: 1.18, intl: 1.08 },
  ai: {
    plannerModel:     'claude-sonnet-4-5',
    chatModel:        'claude-haiku-4-5-20251001',
    maxPlanTokens:    1200,
    maxChatTokens:    400,
    monthlyBudgetZAR: 5000,
  },
  payment: { gateways: ['payfast', 'stripe'], depositPercent: 30, balanceDaysBefore: 30 },
  support: { email: 'journeys@thesafariedition.com', whatsapp: '+27000000000' },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
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
  { id:'arabian',   name:'The Arabian Edition',   icon:'🌙', color:'#fbbf24', desc:'Jordan · Oman · UAE' },
  { id:'ski',       name:'The Ski Edition',       icon:'⛷',  color:'#a78bfa', desc:'Alps · Aspen · Hokkaido' },
  { id:'city',      name:'The City Edition',      icon:'🌆', color:'#fb923c', desc:'New York · Tokyo · Paris' },
];

// FIX 2 — Regions: multi-select capable, real Supabase slugs
const REGIONS = [
  { id: 'kruger',       label: 'Kruger / Sabi Sand',  icon: '🐆', slug: 'kruger-sabi-sand' },
  { id: 'okavango',     label: 'Okavango Delta',       icon: '🛶', slug: 'okavango-delta'   },
  { id: 'cape-town',    label: 'Cape Town',            icon: '🏔', slug: 'cape-town'        },
  { id: 'madikwe',      label: 'Madikwe',              icon: '🦏', slug: 'madikwe'          },
  { id: 'chobe',        label: 'Chobe / Vic Falls',    icon: '🌊', slug: 'chobe-vic-falls'  },
  { id: 'masai-mara',   label: 'Masai Mara',           icon: '🦒', slug: 'masai-mara'       },
  { id: 'inspire-me',   label: 'Inspire Me',           icon: '✨', slug: null               },
];

// Slug dictionary — deterministic city name → region_slug mapping
const CITY_TO_SLUG: Record<string, string> = {
  'kruger':                    'kruger-sabi-sand',
  'sabi sand':                 'kruger-sabi-sand',
  'kruger / sabi sand':        'kruger-sabi-sand',
  'kruger/sabi sand':          'kruger-sabi-sand',
  'sabi sands':                'kruger-sabi-sand',
  'okavango':                  'okavango-delta',
  'okavango delta':            'okavango-delta',
  'cape town':                 'cape-town',
  'madikwe':                   'madikwe',
  'chobe':                     'chobe-vic-falls',
  'victoria falls':            'chobe-vic-falls',
  'chobe / victoria falls':    'chobe-vic-falls',
  'chobe/victoria falls':      'chobe-vic-falls',
  'vic falls':                 'chobe-vic-falls',
  'victoria falls, zimbabwe':  'chobe-vic-falls',
  'masai mara':                'masai-mara',
  'masai mara, kenya':         'masai-mara',
  'the masai mara':            'masai-mara',
  'phinda':                    'phinda',
  'mozambique':                'mozambique',
  'bazaruto':                  'mozambique',
  'bwindi':                    'bwindi',
  'bwindi, uganda':            'bwindi',
  'kalahari':                  'kalahari',
};

const THEMES = [
  { id: 'safari',    label: 'Big Five Safari',  icon: '🦁' },
  { id: 'romance',   label: 'Romance',          icon: '💫' },
  { id: 'family',    label: 'Family',           icon: '👨‍👩‍👧' },
  { id: 'adventure', label: 'Adventure',        icon: '🧗' },
  { id: 'luxury',    label: 'Ultra-Luxury',     icon: '✨' },
  { id: 'beach',     label: 'Beach & Coast',    icon: '🏖️' },
  { id: 'culture',   label: 'Culture',          icon: '🎭' },
  { id: 'wellness',  label: 'Wellness',         icon: '🧘' },
];

const REGIONAL_ORIGINS = [
  { code: 'JNB', label: 'Johannesburg (O.R. Tambo)', flag: '🇿🇦' },
  { code: 'CPT', label: 'Cape Town',                 flag: '🇿🇦' },
  { code: 'DUR', label: 'Durban',                    flag: '🇿🇦' },
  { code: 'HRE', label: 'Harare',                    flag: '🇿🇼' },
  { code: 'GBE', label: 'Gaborone',                  flag: '🇧🇼' },
  { code: 'NBO', label: 'Nairobi',                   flag: '🇰🇪' },
];

const INTERNATIONAL_ORIGINS = [
  { code: 'LHR', label: 'London Heathrow',         flag: '🇬🇧' },
  { code: 'LGW', label: 'London Gatwick',          flag: '🇬🇧' },
  { code: 'MAN', label: 'Manchester',              flag: '🇬🇧' },
  { code: 'AMS', label: 'Amsterdam',               flag: '🇳🇱' },
  { code: 'FRA', label: 'Frankfurt',               flag: '🇩🇪' },
  { code: 'CDG', label: 'Paris CDG',               flag: '🇫🇷' },
  { code: 'JFK', label: 'New York (JFK)',           flag: '🇺🇸' },
  { code: 'EWR', label: 'New York (Newark)',        flag: '🇺🇸' },
  { code: 'LAX', label: 'Los Angeles',             flag: '🇺🇸' },
  { code: 'DXB', label: 'Dubai',                   flag: '🇦🇪' },
  { code: 'SYD', label: 'Sydney',                  flag: '🇦🇺' },
  { code: 'SIN', label: 'Singapore',               flag: '🇸🇬' },
];

const INTL_FLIGHTS = [
  { id: 'LHR-JNB', from: 'LHR', to: 'JNB', airline: 'British Airways',      duration: '11h 20m', netRate: 9800,  otaRate: 14200, image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80', upgrades: { classes: [{ label: 'Economy', extra: 0 }, { label: 'Premium Economy', extra: 8500 }, { label: 'Business Class', extra: 32000 }], baggage: [{ label: '23kg included', extra: 0 }, { label: 'Extra 23kg', extra: 650 }] } },
  { id: 'LHR-JNB-VA', from: 'LHR', to: 'JNB', airline: 'Virgin Atlantic',   duration: '11h 35m', netRate: 8900,  otaRate: 12800, image: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80', upgrades: { classes: [{ label: 'Economy', extra: 0 }, { label: 'Premium', extra: 7200 }, { label: 'Upper Class', extra: 38000 }], baggage: [{ label: '23kg included', extra: 0 }, { label: 'Extra 23kg', extra: 580 }] } },
  { id: 'AMS-JNB', from: 'AMS', to: 'JNB', airline: 'KLM',                  duration: '11h 05m', netRate: 8200,  otaRate: 11500, image: 'https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?w=800&q=80', upgrades: { classes: [{ label: 'Economy', extra: 0 }, { label: 'World Business', extra: 28000 }], baggage: [{ label: '23kg included', extra: 0 }, { label: 'Extra 23kg', extra: 600 }] } },
  { id: 'DXB-JNB', from: 'DXB', to: 'JNB', airline: 'Emirates',             duration: '8h 45m',  netRate: 7400,  otaRate: 10800, image: 'https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=800&q=80', upgrades: { classes: [{ label: 'Economy', extra: 0 }, { label: 'Business Class', extra: 24000 }], baggage: [{ label: '30kg included', extra: 0 }, { label: 'Extra 23kg', extra: 520 }] } },
  { id: 'JFK-JNB', from: 'JFK', to: 'JNB', airline: 'South African Airways', duration: '15h 30m', netRate: 11200, otaRate: 16500, image: 'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&q=80', upgrades: { classes: [{ label: 'Economy', extra: 0 }, { label: 'Business Class', extra: 38000 }], baggage: [{ label: '23kg included', extra: 0 }, { label: 'Extra 23kg', extra: 680 }] } },
  { id: 'SYD-JNB', from: 'SYD', to: 'JNB', airline: 'Qantas via DXB',       duration: '20h 10m', netRate: 13800, otaRate: 20500, image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80', upgrades: { classes: [{ label: 'Economy', extra: 0 }, { label: 'Business', extra: 42000 }], baggage: [{ label: '23kg included', extra: 0 }] } },
];

const FLIGHTS = [
  { id: 1, airline: 'Federal Airlines',          route: 'JNB → Skukuza',              trustScore: 94, netRate: 3800, otaRate: null,  image: 'https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?w=800&q=80', funFact: '55 minutes vs 5+ hours by road — the only sensible way in.',       upgrades: { classes: [{ label: 'Standard seat', extra: 0 }, { label: 'Forward seats', extra: 400 }], baggage: [{ label: '15kg included', extra: 0 }, { label: 'Extra 15kg', extra: 580 }] } },
  { id: 2, airline: 'FlySafair + Road Transfer', route: 'JNB → Nelspruit + transfer',  trustScore: 88, netRate: 2200, otaRate: 2650,  image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80', funFact: 'Budget option — scenic 2hr drive through the lowveld included.',    upgrades: { classes: [{ label: 'Economy', extra: 0 }, { label: 'Premium Economy', extra: 1200 }], baggage: [{ label: 'Hand luggage', extra: 0 }, { label: '20kg bag', extra: 380 }] } },
  { id: 3, airline: 'SAA + Airlink',             route: 'JNB → Hoedspruit',            trustScore: 85, netRate: 4200, otaRate: 5800,  image: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80', funFact: 'Direct Airlink connection into Hoedspruit.',                        upgrades: { classes: [{ label: 'Economy', extra: 0 }, { label: 'Business Class', extra: 6500 }], baggage: [{ label: '23kg included', extra: 0 }, { label: 'Extra 23kg', extra: 420 }] } },
  { id: 4, airline: 'Kenya Airways',             route: 'JNB → Nairobi (NBO)',         trustScore: 86, netRate: 7800, otaRate: 10200, image: 'https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=800&q=80', funFact: 'Direct to Nairobi — connect to any Mara camp in under 2 hours.',   upgrades: { classes: [{ label: 'Economy', extra: 0 }, { label: 'Business Class', extra: 8400 }], baggage: [{ label: '23kg included', extra: 0 }, { label: 'Extra 23kg', extra: 480 }] } },
  { id: 5, airline: 'LAM Mozambique',            route: 'JNB → Vilanculos',            trustScore: 82, netRate: 3200, otaRate: null,  image: 'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&q=80', funFact: 'Gateway to Bazaruto — speedboat 20 min from the airstrip.',        upgrades: { classes: [{ label: 'Economy', extra: 0 }], baggage: [{ label: '15kg included', extra: 0 }, { label: 'Extra 15kg', extra: 320 }] } },
];

const INTER_TRANSFERS = [
  { id: 'road-sa',       label: 'Road transfer',          icon: '🚗', netRate: 1800, otaRate: 2600,  duration: '2–4 hrs',   note: 'Private SUV with refreshments.', applicableRegions: [['southern-africa','southern-africa']] },
  { id: 'charter-sa-sa', label: 'Federal Air charter',    icon: '✈',  netRate: 6200, otaRate: null,  duration: '45–75 min', note: 'Fastest between reserves — aerial views.', applicableRegions: [['southern-africa','southern-africa']] },
  { id: 'charter-sa-ea', label: 'International charter',  icon: '✈',  netRate: 9800, otaRate: 13500, duration: '3–5 hrs',   note: 'SA ↔ East Africa — we handle all logistics.', applicableRegions: [['southern-africa','east-africa'],['east-africa','southern-africa']] },
  { id: 'charter-sa-io', label: 'Indian Ocean connection',icon: '🛥', netRate: 7400, otaRate: null,  duration: '2–3 hrs',   note: 'Light aircraft to Vilanculos, speedboat to island.', applicableRegions: [['southern-africa','indian-ocean'],['indian-ocean','southern-africa'],['east-africa','indian-ocean'],['indian-ocean','east-africa']] },
  { id: 'charter-ea-ea', label: 'East Africa charter',    icon: '✈',  netRate: 5800, otaRate: null,  duration: '30–90 min', note: 'Fly between camps — skip the roads.', applicableRegions: [['east-africa','east-africa']] },
];

const TRANSFERS = [
  { id: 2, type: 'Private Game Drive Transfer', vehicle: 'Private Land Cruiser + guide', trustScore: 96, netRate: 3200, otaRate: 4500, image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80', funFact: 'Your own vehicle — stop when you want.', upgrades: { vehicles: [{ label: 'Private Land Cruiser', extra: 0 }, { label: 'Specialist walking guide', extra: 1800 }], extras: [{ label: 'Standard', extra: 0 }, { label: 'Sundowner setup', extra: 650 }] } },
  { id: 3, type: 'Private Airport Transfer',     vehicle: 'Private SUV',               trustScore: 91, netRate: 980,  otaRate: 1350, image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80', funFact: 'Airstrip to lodge — game visible immediately.', upgrades: { vehicles: [{ label: 'Private SUV', extra: 0 }, { label: 'Luxury V-Class', extra: 900 }], extras: [{ label: 'Standard', extra: 0 }, { label: 'Meet & greet', extra: 180 }] } },
  { id: 4, type: 'Helicopter Transfer',          vehicle: 'Robinson R44 or similar',   trustScore: 96, netRate: 8500, otaRate: null, image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', funFact: 'Arrive in style — aerial views before you land.', upgrades: { vehicles: [{ label: 'Shared helicopter', extra: 0 }, { label: 'Private charter', extra: 6500 }], extras: [{ label: 'Standard', extra: 0 }, { label: 'Champagne on arrival', extra: 480 }] } },
];

const ACTIVITIES = [
  { id: 2, name: 'Bush Walk with Armed Ranger',    type: 'Adventure',    duration: '3 hours · dawn',            trustScore: 97, netRate: 1800, otaRate: 2600, image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80', funFact: 'Tracks, plants — the detail you miss from a vehicle.', upgrades: { options: [{ label: 'Group walk', extra: 0 }, { label: 'Private walk', extra: 2400 }], extras: [{ label: 'Standard', extra: 0 }, { label: 'Breakfast in the bush', extra: 680 }] } },
  { id: 3, name: 'Hot Air Balloon Safari',         type: 'Luxury',       duration: '3 hours · dawn',            trustScore: 94, netRate: 4800, otaRate: 7200, image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', funFact: 'The Mara from above — one of the great experiences on Earth.', upgrades: { options: [{ label: 'Shared basket', extra: 0 }, { label: 'Private basket', extra: 8500 }], extras: [{ label: 'Champagne breakfast', extra: 0 }, { label: 'Private bush breakfast', extra: 1200 }] } },
  { id: 4, name: 'Night Drive & Spotlight Safari', type: 'Wildlife',     duration: '2.5 hours · 20:00',         trustScore: 95, netRate: 1200, otaRate: 1800, image: 'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=800&q=80', funFact: 'Leopards, civets, honey badgers — the nocturnal world.', upgrades: { options: [{ label: 'Group drive', extra: 0 }, { label: 'Private drive', extra: 2800 }], extras: [{ label: 'Standard', extra: 0 }, { label: 'Add sundowners', extra: 480 }] } },
  { id: 5, name: 'Victoria Falls Helicopter',      type: 'Scenic',       duration: "15 min 'Flight of Angels'", trustScore: 96, netRate: 2800, otaRate: 4200, image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80', funFact: '108m high, 1.7km wide — the only way to grasp the scale.', upgrades: { options: [{ label: '15-minute flight', extra: 0 }, { label: '30-minute flight', extra: 2200 }], extras: [{ label: 'Standard', extra: 0 }, { label: 'Private helicopter', extra: 5800 }] } },
  { id: 6, name: 'Rhino Tracking on Foot',         type: 'Conservation', duration: 'Half day',                  trustScore: 93, netRate: 2200, otaRate: 3200, image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80', funFact: 'One of only a handful of places you can approach white rhino on foot.', upgrades: { options: [{ label: 'Group tracking', extra: 0 }, { label: 'Private with conservationist', extra: 3400 }], extras: [{ label: 'Standard', extra: 0 }, { label: 'Full conservation day', extra: 4800 }] } },
];

const SPECIALISTS = [
  { name: 'Sarah Mitchell', role: 'Senior Safari Specialist',          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80', tip: 'June–August is peak season — book 6 months ahead for Sabi Sand.',           instagram: '@sarahsafaris',  quote: 'Every great safari starts with the right lodge in the right season.', trips: 247 },
  { name: 'James Okonkwo',  role: 'East Africa Specialist',            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80', tip: 'The Great Migration crosses the Mara River July–October. Don\'t miss it.', instagram: '@jamesonsafari', quote: 'Kenya and Tanzania together is the ultimate safari combination.',     trips: 183 },
  { name: 'Priya Naidoo',   role: 'Indian Ocean & Islands Specialist', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80', tip: 'Combine 4 nights bush with 4 nights beach — the perfect balance.',          instagram: '@priyatravels',  quote: 'The best safaris end on an island.',                                trips: 156 },
];

const CURATED_JOURNEYS = [
  { id: 'sabi-classic',    name: 'The Sabi Sand Classic',        tagline: "South Africa's finest leopard territory",    nights: 5, pax: 2, image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80', badge: 'Most popular',   badgeColor: T.gold,    includes: ['Return Federal Air charter JNB→Skukuza','5 nights Singita Sabi Sand','All-inclusive','All game drives & walks','All transfers'],     priceFrom: 142000, otaEquivalent: 192000 },
  { id: 'grand-circuit',   name: 'The Grand Safari Circuit',     tagline: 'Two countries. Three ecosystems.',           nights: 9, pax: 2, image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80', badge: 'Signature',     badgeColor: '#a78bfa', includes: ['All charter flights','3n Singita Sabi Sand','3n Ngorongoro Crater Lodge','3n Mara Plains Camp','All-inclusive throughout'],          priceFrom: 298000, otaEquivalent: 412000 },
  { id: 'vic-falls-combo', name: 'Kruger & Victoria Falls',      tagline: 'Big Five then one of the Seven Wonders',     nights: 7, pax: 2, image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', badge: 'Classic combo', badgeColor: T.green,   includes: ['Return flights JNB','4n Royal Malewane','Charter to Vic Falls','3n Victoria Falls Hotel','All-inclusive at Malewane'],                  priceFrom: 198000, otaEquivalent: 272000 },
  { id: 'island-finish',   name: 'Safari & Indian Ocean Finale', tagline: 'Bush then beach — the perfect combination',  nights: 8, pax: 2, image: 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&q=80', badge: 'Our favourite', badgeColor: '#60a5fa', includes: ['All flights & transfers','4n AndBeyond Phinda','4n Azura Bazaruto','All-inclusive throughout','Speedboat transfers'],              priceFrom: 224000, otaEquivalent: 316000 },
];

const DEFAULT_KB: KBEntry[] = [
  { id: 'kb-region-kruger', edition_id: 'safari', type: 'regional', inclusion_source: 'KB', title: 'Kruger / Sabi Sand — Regional Guide', linkedTo: 'Kruger / Sabi Sand', active: true, structuredFields: { best_season: 'May–September. Dry season. Short grass, animals at waterholes.', malaria: 'Malaria area. Prophylactics recommended. Consult your GP 6 weeks before.', did_you_know: 'The Sabi Sand shares an unfenced boundary with Kruger — predators roam freely across 65,000 hectares.', why_visit: 'Highest leopard density in Africa. Private concessions mean no other vehicles at sightings.', best_sightings: 'Leopard year-round. Lion June–August. Wild dog May–July.', ideal_nights: '4 nights minimum. 3 nights feels rushed. 5–7 if budget allows.', visa: 'South Africa: 90-day visa on arrival for most nationalities.', flights: 'Federal Air JNB→Skukuza: 55 minutes vs 5+ hours by road.' }, specialistNotes: 'Lead with Singita Boulders or Londolozi for UK/US first-timers. Our rates are 20–27% below Booking.com.' },
  { id: 'kb-region-okavango', edition_id: 'safari', type: 'regional', inclusion_source: 'KB', title: 'Okavango Delta — Regional Guide', linkedTo: 'Okavango Delta', active: true, structuredFields: { best_season: 'June–October. Flood peaks July–August.', malaria: 'Malaria area. Prophylactics essential.', did_you_know: "The Okavango flows inland and disappears into the Kalahari — the world's largest inland delta.", why_visit: 'No roads. No fences. You arrive by light aircraft. Nothing else like it on Earth.', best_sightings: 'African wild dog (highest density in Africa). Lion and elephant year-round.', ideal_nights: '3 nights minimum. 4 optimal.', flights: 'All transfers by light aircraft from Maun. 20kg soft bag STRICTLY enforced.' }, specialistNotes: 'Mombo is the apex property. For honeymooners: Jao or Nxabega. For wild dog: DumaTau.' },
  { id: 'kb-region-cape', edition_id: 'safari', type: 'regional', inclusion_source: 'KB', title: 'Cape Town — Regional Guide', linkedTo: 'Cape Town', active: true, structuredFields: { best_season: 'November–April. Long warm days. Winelands at their best.', did_you_know: 'Table Mountain is one of the New Seven Wonders of Nature and is older than the Himalayas.', why_visit: 'The perfect start or end to any safari. World-class food, wine, and scenery within 45 minutes.', ideal_nights: '3–4 nights. Enough for city, mountain, and a winelands day trip.', no_malaria: 'Malaria-free. No prophylactics needed.' }, specialistNotes: 'Ellerman House for seclusion and views. The Silo for design and city access.' },
  { id: 'kb-prop-singita-boulders', edition_id: 'safari', type: 'property', inclusion_source: 'KB', title: 'Singita Boulders Lodge', linkedTo: 'Singita Boulders Lodge', active: true, structuredFields: { why_here: 'Six riverside suites built into the boulders above the Sand River. The benchmark luxury safari lodge.', best_room: 'Request Suite 3 (Boulders Suite) — north-facing, directly above the river bend, private plunge pool.', best_sightings: 'Leopard at the river most evenings. Lion crosses at dawn. Wild dog May–July.', ideal_nights: '4 nights. 3 feels rushed — you need two full drive cycles to hit your stride.' }, specialistNotes: 'Our rate is 27% below Booking.com. Groups 6+: 10% discount. Ask for Marcus or Sipho as guide.' },
  { id: 'kb-prop-mombo', edition_id: 'safari', type: 'property', inclusion_source: 'KB', title: 'Wilderness Mombo Camp', linkedTo: 'Wilderness Mombo Camp', active: true, structuredFields: { why_here: "Chief's Island — the largest island in the Delta — has the highest predator density in Botswana.", best_sightings: 'Wild dog almost guaranteed June–September. Lion year-round.', ideal_nights: '3–4 nights. Your best sighting is often the last morning.' }, specialistNotes: 'Request Little Mombo (6 tents) for honeymooners — more intimate. Same guiding team.' },
  { id: 'kb4', edition_id: 'safari', type: 'trade_tip', inclusion_source: 'KB', title: 'Charter Flights — Booking Tips', linkedTo: 'flights', active: true, structuredFields: { federal_air: 'Book minimum 6 weeks ahead high season. Weight limit: 20kg soft bag only.', baggage: 'ALL bush charter carriers: 20kg total soft bag. No exceptions. Advise guests firmly.', cancellation: 'Federal Air: 72hr cancellation policy. Full charge within 72hrs.' }, specialistNotes: 'Federal Air preferred for Skukuza, Eastgate, Hoedspruit. Never book LAM Mozambique without reconfirming 48hrs ahead.' },
];

const RESEARCH_STEPS = [
  'Reviewing seasonal conditions and migration patterns...',
  'Checking lodge availability across the region...',
  'Finding the best charter connections...',
  'Comparing lodge rates and margin opportunities...',
  'Optimising your itinerary sequence...',
  'Identifying time gaps for bonus experiences...',
  'Putting your personalised journey together...',
];

const SECTION_LABELS: Record<string, string> = {
  rooms: 'Room type', basis: 'Meal basis', flexibility: 'Cancellation',
  classes: 'Cabin class', baggage: 'Baggage', vehicles: 'Vehicle',
  extras: 'Add-ons', options: 'Option',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function track(event: string, editionId: string, properties: Record<string, any> = {}) {
  try {
    await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, edition_id: editionId, properties, ts: Date.now() }) });
  } catch { /* silent */ }
}

function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
}

const COUNTRY_REGION: Record<string, string> = {
  'South Africa': 'southern-africa', 'Botswana': 'southern-africa', 'Zimbabwe': 'southern-africa',
  'Zambia': 'southern-africa', 'Namibia': 'southern-africa', 'Kenya': 'east-africa',
  'Tanzania': 'east-africa', 'Uganda': 'east-africa', 'Rwanda': 'east-africa',
  'Mozambique': 'indian-ocean', 'Seychelles': 'indian-ocean', 'Maldives': 'indian-ocean', 'Mauritius': 'indian-ocean',
};

const REGION_LABEL: Record<string, string> = {
  'kruger-sabi-sand': 'Kruger / Sabi Sand', 'okavango-delta': 'Okavango Delta',
  'cape-town': 'Cape Town', 'madikwe': 'Madikwe', 'phinda': 'Phinda',
  'mozambique': 'Mozambique', 'chobe-vic-falls': 'Chobe / Victoria Falls',
  'masai-mara': 'Masai Mara', 'bwindi': 'Bwindi / Uganda', 'kalahari': 'Kalahari',
};

// FIX 1 — mapSupplierRow: robust image extraction including uploaded content
function mapSupplierRow(s: any): Hotel {
  const netRate = Number(s.net_rate_per_night) || 25000;
  const displayRate = Number(s.display_rate_per_night) || Math.round(netRate * 1.15);

  // Extract image — handle both JSONB array and plain string URL
  let imageUrl = 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80';
  try {
    if (typeof s.images === 'string' && s.images.startsWith('http')) {
      imageUrl = s.images;
    } else {
      const images: any[] = Array.isArray(s.images) ? s.images : (s.images ? JSON.parse(s.images) : []);
      const primary = images.find((img: any) => img.is_primary && img.status === 'approved')
        ?? images.find((img: any) => img.status === 'approved')
        ?? images.find((img: any) => img.url)
        ?? images[0];
      if (primary?.url) imageUrl = primary.url;
    }
  } catch { /* keep fallback */ }

  // Also check hero_image and cover_image fields that some CMS setups use
  if (imageUrl.includes('unsplash') && s.hero_image) imageUrl = s.hero_image;
  if (imageUrl.includes('unsplash') && s.cover_image) imageUrl = s.cover_image;
  if (imageUrl.includes('unsplash') && s.primary_image) imageUrl = s.primary_image;

  const destination = REGION_LABEL[s.region_slug] ?? s.destination ?? s.region_slug ?? '';

  return {
    id: s.id, edition_id: s.edition_id || 'safari',
    name: s.name,
    location: destination ? `${destination}, ${s.country}` : s.country ?? '',
    destination,
    subRegion: s.region_slug ?? '',
    region: COUNTRY_REGION[s.country] || 'southern-africa',
    country: s.country || '',
    stars: 5,
    trustScore: s.trust_score || 85,
    contentScore: s.content_score || 70,
    netRate,
    otaRate: s.ota_rate_per_night ? Number(s.ota_rate_per_night) : null,
    marginScore: displayRate > 0 ? Math.round((displayRate - netRate) / displayRate * 100) : 20,
    image: imageUrl,
    funFact: s.short_tagline ?? (s.description ? String(s.description).slice(0, 120) : null),
    malariaFree: s.malaria_status === 'malaria-free',
    tags: s.tags || [],
    upgrades: {
      rooms: [{ label: 'Standard Suite', extra: 0, tier: 0 }, { label: 'Premium Suite', extra: Math.round(netRate * 0.4), tier: 1 }],
      basis: [{ label: 'All-inclusive', extra: 0, tier: 0 }],
      flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: Math.round(netRate * 0.08), tier: 1 }],
    },
  };
}

function getInterTransfer(regionA: string, regionB: string) {
  return INTER_TRANSFERS.find(t => t.applicableRegions.some(([a, b]) => a === regionA && b === regionB)) ?? INTER_TRANSFERS[0];
}

function buildFallbackItinerary(nights: number, budget: number, mode: InputMode, selectedSlugs: string[]): Itinerary {
  // If specific regions selected, use those for fallback
  const firstSlug = selectedSlugs[0];
  const destMap: Record<string, { label: string; country: string; why: string; highlights: string[] }> = {
    'cape-town':        { label: 'Cape Town',             country: 'South Africa', why: 'World-class city, mountain, winelands — the perfect safari bookend.', highlights: ['Table Mountain', 'Winelands day trip', 'V&A Waterfront'] },
    'madikwe':          { label: 'Madikwe',               country: 'South Africa', why: 'Malaria-free Big Five. Excellent for families and first-timers.', highlights: ['Big Five game drives', 'Malaria-free', 'Excellent guiding'] },
    'kruger-sabi-sand': { label: 'Kruger / Sabi Sand',    country: 'South Africa', why: 'Highest leopard density in Africa. The benchmark safari experience.', highlights: ['Leopard tracking at dawn', 'Night drive', 'Sundowner in the bush'] },
    'okavango-delta':   { label: 'Okavango Delta',        country: 'Botswana',     why: "No roads. No fences. The world's finest wilderness safari.", highlights: ['Mokoro through papyrus', 'Walking safari', 'Helicopter over Delta'] },
    'chobe-vic-falls':  { label: 'Chobe / Victoria Falls',country: 'Zimbabwe',     why: 'One of the Seven Wonders of Nature. Incredible elephant herds on the Chobe.', highlights: ['Victoria Falls', 'Chobe River cruise', 'Elephant herds'] },
    'masai-mara':       { label: 'Masai Mara',            country: 'Kenya',        why: 'The greatest wildlife spectacle on Earth. Peak migration July–October.', highlights: ['Great Migration', 'Hot air balloon', 'Big cat sightings'] },
  };

  if (firstSlug && destMap[firstSlug]) {
    const dest = destMap[firstSlug];
    // If two regions selected, build two-city
    if (selectedSlugs.length >= 2 && destMap[selectedSlugs[1]]) {
      const dest2 = destMap[selectedSlugs[1]];
      const n1 = Math.ceil(nights * 0.55);
      const n2 = nights - n1;
      return {
        title: `${nights}-Night ${dest.label} & ${dest2.label}`,
        summary: `A perfectly sequenced journey combining ${dest.label} and ${dest2.label}.`,
        routing: `JNB → ${dest.label} (${n1}n) → ${dest2.label} (${n2}n) → JNB`,
        bestTiming: 'June–September: dry season, short grass, animals at water.',
        cities: [
          { city: dest.label, country: dest.country, nights: n1, why: dest.why, highlights: dest.highlights, estimatedCost: Math.round(budget * 0.52), hotelRate: 45000, flightCost: 7600, transferCost: 3800, activityCost: 0, arrivalGap: 'Arrive midday, first drive at 16:00', departureGap: 'Final morning drive before charter' },
          { city: dest2.label, country: dest2.country, nights: n2, why: dest2.why, highlights: dest2.highlights, estimatedCost: Math.round(budget * 0.40), hotelRate: 45000, flightCost: 8200, transferCost: 2400, activityCost: 0, arrivalGap: 'Land 12:00, settle in for evening drive', departureGap: 'Final morning before departure' },
        ],
        totalEstimate: Math.round(budget * 0.92),
        aiInsights: ['Our rates are 20–27% below booking direct'],
        warnings: [],
        inputMode: mode,
      };
    }
    return {
      title: `${nights}-Night ${dest.label}`,
      summary: `A focused ${nights}-night journey in ${dest.label}.`,
      routing: `JNB → ${dest.label} (${nights}n) → JNB`,
      bestTiming: 'June–September: dry season, short grass, animals at water.',
      cities: [{ city: dest.label, country: dest.country, nights, why: dest.why, highlights: dest.highlights, estimatedCost: Math.round(budget * 0.92), hotelRate: 45000, flightCost: 7600, transferCost: 3800, activityCost: 0, arrivalGap: 'Arrive midday, first drive at 16:00', departureGap: 'Final morning drive before departure' }],
      totalEstimate: Math.round(budget * 0.92),
      aiInsights: [`${nights} nights gives you ${nights * 2} game drives`, 'Our rates are 20–27% below booking direct'],
      warnings: [],
      inputMode: mode,
    };
  }

  // Default two-destination fallback
  return {
    title: `${nights}-Night Safari Journey`,
    summary: `A perfectly sequenced ${nights}-night journey across two of Africa's finest wilderness areas.`,
    routing: `JNB → Kruger / Sabi Sand (${Math.ceil(nights * 0.55)}n) → Okavango (${Math.floor(nights * 0.45)}n) → JNB`,
    bestTiming: 'June–September: dry season, short grass, animals at water.',
    cities: [
      { city: 'Kruger / Sabi Sand', country: 'South Africa', nights: Math.ceil(nights * 0.55), why: 'First destination while fresh. Highest leopard density in Africa.', highlights: ['Leopard tracking at dawn', 'Night drive', 'Sundowner in the bush'], estimatedCost: Math.round(budget * 0.52), hotelRate: 56000, flightCost: 7600, transferCost: 3800, activityCost: 0, arrivalGap: 'Land Skukuza 09:30, lodge 11:00', departureGap: 'Final morning drive 05:30–09:30 before charter' },
      { city: 'Okavango Delta',     country: 'Botswana',      nights: Math.floor(nights * 0.45), why: 'Contrast — water, mokoro, bird life after dry Lowveld.', highlights: ['Mokoro through papyrus', 'Walking safari', 'Helicopter over Delta'], estimatedCost: Math.round(budget * 0.42), hotelRate: 62000, flightCost: 9200, transferCost: 2400, activityCost: 1800, arrivalGap: 'Land 12:00, settle in for evening drive', departureGap: 'Final mokoro 07:00–10:00' },
    ],
    totalEstimate: Math.round(budget * 0.94),
    aiInsights: ['Federal Air JNB→Skukuza saves R8,000 vs road transfer', 'Our Singita rate is 27% below Booking.com'],
    warnings: budget < 100000 ? ['Budget tight for premium lodges — consider single destination'] : [],
    inputMode: mode,
  };
}

// FIX 6 — Filter patronising destination-type warnings
function filterWarnings(warnings: string[]): string[] {
  const patronising = [
    /not a (traditional )?safari destination/i,
    /no big.?5/i,
    /must be changed/i,
    /redirect.*to sabi/i,
    /redirect.*to kruger/i,
    /critical.*cape town/i,
  ];
  return (warnings ?? []).filter(w => w && !patronising.some(re => re.test(w)));
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN GATE
// ─────────────────────────────────────────────────────────────────────────────
function LoginGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const attempt = () => {
    if (code.trim().toLowerCase() === 'safari2026') { localStorage.setItem('tse_access', 'safari2026'); onUnlock(); }
    else { setError(true); setShaking(true); setTimeout(() => setShaking(false), 500); }
  };
  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ marginBottom:32, textAlign:'center' }}>
        <div style={{ fontSize:28, color:'#d4af37', fontFamily:"'Playfair Display',serif", fontWeight:700, marginBottom:8 }}>✦ The Safari Edition</div>
        <div style={{ fontSize:13, color:'rgba(245,240,232,0.4)', letterSpacing:'0.15em', textTransform:'uppercase' as const }}>Private Preview</div>
      </div>
      <div style={{ width:'100%', maxWidth:340, animation: shaking ? 'shake 0.4s ease' : 'none' }}>
        <input type="password" value={code} onChange={e => { setCode(e.target.value); setError(false); }} onKeyDown={e => e.key === 'Enter' && attempt()} placeholder="Enter access code" autoFocus style={{ width:'100%', padding:'14px 18px', background:'#1e1e1e', border:`1.5px solid ${error ? '#f87171' : 'rgba(212,175,55,0.3)'}`, borderRadius:12, color:'#f5f0e8', fontSize:15, outline:'none', fontFamily:'inherit', textAlign:'center' as const, letterSpacing:'0.1em', marginBottom:12, boxSizing:'border-box' as const }} />
        {error && <div style={{ fontSize:12, color:'#f87171', textAlign:'center' as const, marginBottom:10 }}>Incorrect code — try again</div>}
        <button onClick={attempt} style={{ width:'100%', padding:14, background:'linear-gradient(135deg,#d4af37,#f0c040)', border:'none', borderRadius:12, color:'#0a0a0a', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Enter →</button>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() { return <div className="spinner" />; }

function Nav({ edition, setScreen, currency, setCurrency, chatOpen, setChatOpen, totalZAR, fmt, hasPricedItems }: any) {
  const [editionOpen, setEditionOpen] = useState(false);
  return (
    <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(10,10,10,0.96)', backdropFilter:'blur(16px)', borderBottom:`0.5px solid ${T.border}`, padding:'0 20px' }}>
      <div style={{ maxWidth:900, margin:'0 auto', height:58, display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
        <div style={{ position:'relative' }}>
          <button onClick={() => setEditionOpen((x: boolean) => !x)} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:14, fontWeight:700, color:T.gold, letterSpacing:'0.05em' }}>✦ {edition.name}</span>
            <span style={{ fontSize:10, color:T.textDim, marginTop:1 }}>{editionOpen ? '▲' : '▼'}</span>
          </button>
          {editionOpen && (
            <div style={{ position:'absolute', top:'calc(100% + 8px)', left:0, background:'#111', border:`0.5px solid rgba(212,175,55,0.3)`, borderRadius:14, padding:10, minWidth:260, zIndex:200, boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
              <div style={{ padding:'8px 12px', marginBottom:6, background:'rgba(212,175,55,0.08)', borderRadius:10, border:`0.5px solid rgba(212,175,55,0.2)` }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.gold }}>✦ {edition.name}</div>
                <div style={{ fontSize:10, color:T.textDim, marginTop:1 }}>Sub-Saharan Africa · Active</div>
              </div>
              {OTHER_EDITIONS.map((e: any) => (
                <div key={e.id} style={{ padding:'8px 12px', borderRadius:10, display:'flex', alignItems:'center', gap:10, opacity:0.6 }}>
                  <span style={{ fontSize:18 }}>{e.icon}</span>
                  <div style={{ flex:1 }}><div style={{ fontSize:12, color:T.text, fontWeight:600 }}>{e.name}</div><div style={{ fontSize:10, color:T.textDim }}>{e.desc}</div></div>
                  <span style={{ fontSize:9, color:e.color, background:`${e.color}18`, border:`0.5px solid ${e.color}40`, borderRadius:20, padding:'2px 7px', fontWeight:700 }}>Soon</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {hasPricedItems && <div style={{ fontSize:13, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(totalZAR)}</div>}
          <select value={currency.code} onChange={(e: any) => setCurrency(CURRENCIES.find((c: any) => c.code === e.target.value)!)} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, borderRadius:8, padding:'5px 10px', fontSize:12, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
          <button onClick={() => setChatOpen((x: boolean) => !x)} style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, color:T.gold, borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{chatOpen ? '✕ Close' : '✦ Specialists'}</button>
          <a href="/admin" style={{ background:'rgba(255,255,255,0.06)', border:`0.5px solid rgba(255,255,255,0.14)`, color:T.textMid, borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textDecoration:'none' }}>Admin →</a>
        </div>
      </div>
      {editionOpen && <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={() => setEditionOpen(false)} />}
    </nav>
  );
}

function StickyPrice({ totalZAR, fmt }: any) {
  if (!totalZAR) return null;
  return (
    <div style={{ position:'sticky', top:58, zIndex:90, background:'rgba(10,10,10,0.96)', backdropFilter:'blur(12px)', borderBottom:`0.5px solid ${T.borderGold}`, padding:'8px 20px' }}>
      <div style={{ maxWidth:900, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, color:T.textDim }}>Package total</span>
        <span style={{ fontSize:20, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(totalZAR)}</span>
      </div>
    </div>
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
        {msgs.map((m: any, i: number) => (
          <div key={i} style={{ display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth:'88%', padding:'9px 13px', borderRadius: m.role === 'user' ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: m.role === 'user' ? 'rgba(212,175,55,0.13)' : 'rgba(255,255,255,0.06)', border:`0.5px solid ${m.role === 'user' ? 'rgba(212,175,55,0.28)' : 'rgba(255,255,255,0.07)'}`, fontSize:13, color:T.text, lineHeight:1.6 }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{ display:'flex', gap:4, padding:'8px 12px' }}>{[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:T.gold, animation:`pulse 1.2s ease ${i * 0.2}s infinite` }} />)}</div>}
        <div ref={endRef} />
      </div>
      <div style={{ padding:'10px 14px', borderTop:`0.5px solid rgba(255,255,255,0.07)`, display:'flex', gap:8 }}>
        <input value={input} onChange={(e: any) => setInput(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && send()} placeholder="Ask about lodges, timing, visas..." style={{ flex:1, background:'rgba(255,255,255,0.06)', border:`0.5px solid rgba(255,255,255,0.1)`, color:T.text, borderRadius:9, padding:'9px 13px', fontSize:13, outline:'none', fontFamily:'inherit' }} />
        <button onClick={send} style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', color:'#0a0a0a', borderRadius:9, padding:'9px 14px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>→</button>
      </div>
    </div>
  );
}

function SpecialistBanner({ specialist, screen: s }: any) {
  if (!['inspire-input','inspire-research','inspire-plan','builder','my-brief'].includes(s) || !specialist) return null;
  return (
    <div style={{ position:'fixed', bottom:16, left:16, zIndex:200, display:'flex', alignItems:'center', gap:10, background:'rgba(10,10,10,0.95)', backdropFilter:'blur(16px)', border:`0.5px solid ${T.borderGold}`, borderRadius:16, padding:'10px 16px 10px 10px', boxShadow:'0 8px 32px rgba(0,0,0,0.6)', maxWidth:280 }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <img src={specialist.avatar} alt={specialist.name} style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', border:`2px solid ${T.gold}` }} />
        <div style={{ position:'absolute', bottom:-2, right:-2, width:12, height:12, borderRadius:'50%', background:T.green, border:'2px solid #0a0a0a' }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#f0ede6' }}>{specialist.name}</div>
        <div style={{ fontSize:10, color:T.gold, marginBottom:2 }}>{specialist.role}</div>
        <div style={{ fontSize:10, color:'rgba(240,237,230,0.5)', lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>"{specialist.tip}"</div>
      </div>
    </div>
  );
}

function PillarCard({ item, displayRate, otaSaving, pillarColor, fmt, onPrev, onNext, isPrevDisabled, isNextDisabled, onCustomise, stackLabel }: any) {
  return (
    <div className="card">
      <div style={{ position:'relative', height:185, overflow:'hidden' }}>
        <img src={item.image} alt={item.name || item.type || item.airline} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 52%)' }} />
        <div style={{ position:'absolute', top:10, right:10, display:'inline-flex', alignItems:'center', gap:4, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.25)', borderRadius:20, padding:'3px 10px', fontSize:11, color:T.green, fontWeight:600 }}>★ {item.trustScore}/100</div>
        {otaSaving && otaSaving > 0
          ? <div style={{ position:'absolute', bottom:10, left:10, background:'rgba(74,222,128,0.1)', border:'0.5px solid rgba(74,222,128,0.22)', borderRadius:8, padding:'4px 10px', display:'flex', gap:8, alignItems:'center' }}><span style={{ fontSize:11, color:'rgba(245,240,232,0.45)', textDecoration:'line-through' }}>{fmt(item.otaRate || 0)}</span><span style={{ fontSize:11, color:T.green, fontWeight:700 }}>Save {fmt(otaSaving)}</span></div>
          : <div style={{ position:'absolute', bottom:10, left:10, background:'rgba(212,175,55,0.15)', border:'0.5px solid rgba(212,175,55,0.3)', borderRadius:8, padding:'4px 10px', fontSize:11, color:T.gold, fontWeight:600 }}>✦ Exclusive rate</div>
        }
      </div>
      <div style={{ padding:'13px 15px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Playfair Display',serif", color:'#f5f0e8' }}>{item.name || item.type || item.airline}</div>
            <div style={{ fontSize:12, color:'rgba(245,240,232,0.6)', marginTop:1 }}>{item.location || item.route || item.vehicle || item.duration}</div>
          </div>
        </div>
        {item.funFact && <div className="fun-fact">✦ {item.funFact}</div>}
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button onClick={onPrev} disabled={isPrevDisabled} style={{ flex:1, padding:10, borderRadius:9, border:`0.5px solid ${T.border}`, background:T.bg3, color:T.textMid, cursor: isPrevDisabled ? 'not-allowed' : 'pointer', opacity: isPrevDisabled ? 0.35 : 1, fontFamily:'inherit', fontSize:12 }}>← Prev</button>
          <button onClick={onCustomise} style={{ flex:2, padding:10, borderRadius:9, border:`1px solid ${T.borderGold}`, background:T.goldDim, color:T.gold, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>Customise →</button>
          <button onClick={onNext} disabled={isNextDisabled} style={{ flex:1, padding:10, borderRadius:9, border:`0.5px solid ${T.border}`, background:T.bg3, color:T.textMid, cursor: isNextDisabled ? 'not-allowed' : 'pointer', opacity: isNextDisabled ? 0.35 : 1, fontFamily:'inherit', fontSize:12 }}>Next →</button>
        </div>
        {stackLabel && <div style={{ textAlign:'center', fontSize:11, color:T.textDim, marginTop:6 }}>{stackLabel}</div>}
      </div>
    </div>
  );
}

function StepDot({ active }: { active: boolean }) {
  return <div style={{ width:8, height:8, borderRadius:'50%', background: active ? T.gold : 'rgba(255,255,255,0.15)', transition:'all 0.3s' }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOTELS FALLBACK — used only when Supabase fetch fails
// ─────────────────────────────────────────────────────────────────────────────
const HOTELS_FALLBACK: Hotel[] = [
  { id: 1, edition_id: 'safari', name: 'Singita Boulders Lodge',  location: 'Kruger / Sabi Sand, South Africa', destination: 'Kruger / Sabi Sand', subRegion: 'kruger-sabi-sand', region: 'southern-africa', country: 'South Africa', stars: 5, trustScore: 99, contentScore: 95, netRate: 56000, otaRate: 76000, marginScore: 27, malariaFree: false, tags: [], image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80', funFact: 'River-facing suites on the Sand River. Six guests per guide.', upgrades: { rooms: [{ label: 'Luxury Suite', extra: 0, tier: 0 }, { label: 'Private Villa', extra: 89000, tier: 1 }], basis: [{ label: 'All-inclusive', extra: 0, tier: 0 }], flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: 4200, tier: 1 }] } },
  { id: 2, edition_id: 'safari', name: 'Londolozi Tree Camp',      location: 'Kruger / Sabi Sand, South Africa', destination: 'Kruger / Sabi Sand', subRegion: 'kruger-sabi-sand', region: 'southern-africa', country: 'South Africa', stars: 5, trustScore: 97, contentScore: 90, netRate: 48000, otaRate: 67000, marginScore: 28, malariaFree: false, tags: [], image: 'https://images.unsplash.com/photo-1500491460312-c32fc2dbc751?w=800&q=80', funFact: 'Treehouse suites above the Sand River.', upgrades: { rooms: [{ label: 'Suite', extra: 0, tier: 0 }, { label: 'Private Treehouse', extra: 30000, tier: 1 }], basis: [{ label: 'All-inclusive', extra: 0, tier: 0 }], flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: 3800, tier: 1 }] } },
  { id: 3, edition_id: 'safari', name: 'Wilderness Mombo Camp',    location: 'Okavango Delta, Botswana',         destination: 'Okavango Delta',    subRegion: 'okavango-delta',  region: 'southern-africa', country: 'Botswana',      stars: 5, trustScore: 98, contentScore: 92, netRate: 62000, otaRate: 88000, marginScore: 30, malariaFree: false, tags: [], image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80', funFact: "Chief's Island — the highest predator density in the Delta.", upgrades: { rooms: [{ label: 'Luxury Tent', extra: 0, tier: 0 }, { label: 'Family Tent', extra: 18000, tier: 1 }], basis: [{ label: 'All-inclusive', extra: 0, tier: 0 }], flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: 3200, tier: 1 }] } },
  { id: 4, edition_id: 'safari', name: 'andBeyond Xaranna',        location: 'Okavango Delta, Botswana',         destination: 'Okavango Delta',    subRegion: 'okavango-delta',  region: 'southern-africa', country: 'Botswana',      stars: 5, trustScore: 95, contentScore: 88, netRate: 52000, otaRate: 74000, marginScore: 29, malariaFree: false, tags: [], image: 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&q=80', funFact: 'On a private island in the Delta.', upgrades: { rooms: [{ label: 'Luxury Tent', extra: 0, tier: 0 }, { label: 'Honeymoon Tent', extra: 12000, tier: 1 }], basis: [{ label: 'All-inclusive', extra: 0, tier: 0 }], flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: 3000, tier: 1 }] } },
  { id: 5, edition_id: 'safari', name: 'Matetsi Victoria Falls',   location: 'Chobe / Victoria Falls, Zimbabwe', destination: 'Chobe / Victoria Falls', subRegion: 'chobe-vic-falls', region: 'southern-africa', country: 'Zimbabwe', stars: 5, trustScore: 96, contentScore: 88, netRate: 38000, otaRate: 54000, marginScore: 30, malariaFree: false, tags: [], image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', funFact: 'Private 26km stretch of the Zambezi.', upgrades: { rooms: [{ label: 'River Suite', extra: 0, tier: 0 }, { label: 'Private Villa', extra: 45000, tier: 1 }], basis: [{ label: 'All-inclusive', extra: 0, tier: 0 }], flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: 3200, tier: 1 }] } },
  { id: 6, edition_id: 'safari', name: 'Ellerman House',           location: 'Cape Town, South Africa',          destination: 'Cape Town',         subRegion: 'cape-town',      region: 'southern-africa', country: 'South Africa', stars: 5, trustScore: 94, contentScore: 91, netRate: 28000, otaRate: null,  marginScore: 27, malariaFree: true,  tags: ['malaria-free'], image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80', funFact: 'Eleven suites overlooking the Atlantic.', upgrades: { rooms: [{ label: 'Classic Suite', extra: 0, tier: 0 }, { label: 'Villa Suite', extra: 18000, tier: 1 }], basis: [{ label: 'Breakfast included', extra: 0, tier: 0 }], flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: 2200, tier: 1 }] } },
  { id: 7, edition_id: 'safari', name: 'Jamala Madikwe',           location: 'Madikwe, South Africa',            destination: 'Madikwe',           subRegion: 'madikwe',        region: 'southern-africa', country: 'South Africa', stars: 5, trustScore: 93, contentScore: 85, netRate: 28000, otaRate: 38500, marginScore: 27, malariaFree: true,  tags: ['malaria-free','family-friendly'], image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80', funFact: 'Malaria-free Big Five.', upgrades: { rooms: [{ label: 'Classic Suite', extra: 0, tier: 0 }, { label: 'Royal Suite', extra: 15000, tier: 1 }], basis: [{ label: 'All-inclusive', extra: 0, tier: 0 }], flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: 2200, tier: 1 }] } },
  { id: 8, edition_id: 'safari', name: 'Mara Plains Camp',         location: 'Masai Mara, Kenya',                destination: 'Masai Mara',        subRegion: 'masai-mara',     region: 'east-africa',     country: 'Kenya',        stars: 5, trustScore: 96, contentScore: 91, netRate: 42000, otaRate: 58000, marginScore: 28, malariaFree: false, tags: [], image: 'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=800&q=80', funFact: 'Only 8 tents. Peak migration July–October.', upgrades: { rooms: [{ label: 'Classic Tent', extra: 0, tier: 0 }, { label: 'Family Tent', extra: 18000, tier: 1 }], basis: [{ label: 'All-inclusive', extra: 0, tier: 0 }], flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: 3200, tier: 1 }] } },
  { id: 9, edition_id: 'safari', name: 'Azura Bazaruto',           location: 'Mozambique',                       destination: 'Mozambique',        subRegion: 'mozambique',     region: 'indian-ocean',    country: 'Mozambique',   stars: 5, trustScore: 92, contentScore: 84, netRate: 22000, otaRate: 32000, marginScore: 31, malariaFree: false, tags: [], image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', funFact: 'Last viable dugong population in the Indian Ocean.', upgrades: { rooms: [{ label: 'Beach Villa', extra: 0, tier: 0 }, { label: 'Ocean Villa', extra: 14000, tier: 1 }], basis: [{ label: 'All-inclusive', extra: 0, tier: 0 }], flexibility: [{ label: 'Standard', extra: 0, tier: 0 }, { label: 'Flexible', extra: 2400, tier: 1 }] } },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SafariEdition({ edition = SAFARI_EDITION }: { edition?: EditionConfig }) {

  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('tse_access') === 'safari2026';
  });

  const [screen, setScreen]     = useState<Screen>('landing');
  const [inputMode, setInputMode] = useState<InputMode>('socratic');
  const [specialist] = useState(() => SPECIALISTS[Math.floor(Math.random() * SPECIALISTS.length)] ?? SPECIALISTS[0]);

  const [currency, setCurrency] = useState<Currency>(() => CURRENCIES.find(c => c.code === edition.defaultCurrency) ?? CURRENCIES[0]);
  const fmt = useMemo(() => makeFmt(currency.symbol, currency.rate), [currency]);

  const [nights,   setNights]   = useState(7);
  const [adults,   setAdults]   = useState(2);
  const [children, setChildren] = useState(0);
  const totalPax = Math.max(adults + children, 1);

  const [needsIntlFlight, setNeedsIntlFlight] = useState<boolean | null>(null);

  // FIX 2 — Multi-region: state is string[] not string|null
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const toggleRegion = (id: string) => {
    if (id === 'inspire-me') { setSelectedRegions([]); return; }
    setSelectedRegions(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev.filter(r => r !== 'inspire-me'), id]
    );
  };

  const [themes,       setThemes]       = useState<string[]>([]);
  const [budget,       setBudget]       = useState(120000);
  const [origin,       setOrigin]       = useState('JNB');
  const [intlOrigin,   setIntlOrigin]   = useState('LHR');
  const [researchStep, setResearchStep] = useState(0);
  const [itinerary,    setItinerary]    = useState<Itinerary | null>(null);
  const [cityHotelIdxs, setCityHotelIdxs] = useState([0, 1, 2, 3]);

  const [activePillars,  setActivePillars]  = useState<Pillar[]>([]);
  const [propertyStays,  setPropertyStays]  = useState<PropertyStay[]>([{ id: 1, hotelIdx: 0, nights: 7, prefs: { rooms: 0, basis: 0, flexibility: 0 } }]);
  const [interTransfers, setInterTransfers] = useState<InterTransferState[]>([]);
  const [checkinDate,    setCheckinDate]    = useState(() => todayPlusDays(30));
  const [flightIdx,      setFlightIdx]      = useState(0);
  const [intlFlightIdx,  setIntlFlightIdx]  = useState(0);
  const [transferIdx,    setTransferIdx]    = useState(0);
  const [activityIdx,    setActivityIdx]    = useState(0);
  const [includeIntlFlight, setIncludeIntlFlight] = useState(false);
  const [builderIntlOrigin, setBuilderIntlOrigin] = useState('LHR');
  const [upgrades, setUpgrades] = useState<UpgradeState>({
    flights:    { classes: { label: 'Standard seat', extra: 0 }, baggage: { label: '15kg included', extra: 0 } },
    intl:       { classes: { label: 'Economy',        extra: 0 }, baggage: { label: '23kg included', extra: 0 } },
    transfers:  { vehicles: { label: 'Included',      extra: 0 }, extras:  { label: 'Standard',     extra: 0 } },
    activities: { options:  { label: 'Included',      extra: 0 }, extras:  { label: 'Standard',     extra: 0 } },
  });
  const [customise, setCustomise] = useState<{ pillar: Pillar | 'intl'; stayId?: number; idx: number } | null>(null);

  const [availMap,   setAvailMap]   = useState<Map<string, AvailResult>>(new Map());
  const [altDates,   setAltDates]   = useState<Map<string, AltDate | null>>(new Map());
  const [preloading, setPreloading] = useState(false);

  const [kbEntries,  setKbEntries]  = useState<KBEntry[]>(DEFAULT_KB);
  const [kbSelected, setKbSelected] = useState(['kb-region-kruger','kb-region-okavango','kb-prop-singita-boulders','kb-prop-mombo','kb4']);

  // FIX 1 — Hotels: log fetch result so we can see what's happening
  const [hotels, setHotels] = useState<Hotel[]>(HOTELS_FALLBACK);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const hotelsByMargin = useMemo(() => [...hotels].sort((a, b) => b.marginScore - a.marginScore), [hotels]);

  // FIX 1 — Supabase fetch: more permissive query, better error logging
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.warn('[Suppliers] Missing Supabase env vars — using fallback');
      setSuppliersLoaded(true);
      return;
    }
    // Removed supplier_type filter in case column doesn't exist on all rows
    // Fetch all active lodges with a region_slug
    const query = `${url}/rest/v1/suppliers?select=*&is_active=eq.true&region_slug=not.is.null&order=trust_score.desc&limit=100`;
    fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
      .then(r => {
        if (!r.ok) throw new Error(`Supabase ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((rows: any[]) => {
        // Filter out operators (flight/transfer companies without lodge rates)
        const lodges = rows.filter(r =>
          r.country && r.name &&
          r.supplier_type !== 'operator' &&
          !['Federal Air','Fastjet South Africa','Mack Air Botswana','Wilderness Air Botswana','Cape Town Airport Transfers'].includes(r.name)
        );
        console.log(`[Suppliers] Fetched ${rows.length} rows, ${lodges.length} lodges after filter`);
        if (lodges.length > 0) {
          const mapped = lodges.map(mapSupplierRow);
          setHotels(mapped);
          console.log(`[Suppliers] Loaded ${mapped.length} properties from Supabase`);
        } else {
          console.warn('[Suppliers] No lodges returned — using fallback');
        }
        setSuppliersLoaded(true);
      })
      .catch(err => {
        console.error('[Suppliers] Fetch failed:', err);
        setSuppliersLoaded(true);
      });
  }, [edition.id]);

  useEffect(() => {
    setPropertyStays(prev => prev.length === 1 ? [{ ...prev[0], nights }] : prev);
  }, [nights]);

  useEffect(() => {
    if (screen !== 'builder') return;
    setPreloading(true); setAvailMap(new Map()); setAltDates(new Map());
    preloadHotels(hotelsByMargin, checkinDate, nights, totalPax, async (supplierId, result) => {
      setAvailMap(prev => { const m = new Map(prev); m.set(supplierId, result); return m; });
      if (!result.available) {
        const hotel = hotelsByMargin.find(h => String(h.id) === supplierId);
        if (hotel) {
          const alt = await findAlternativeDate(supplierId, checkinDate, nights, totalPax, hotel.netRate);
          setAltDates(prev => { const m = new Map(prev); m.set(supplierId, alt); return m; });
        }
      }
    }).finally(() => setPreloading(false));
  }, [screen, checkinDate, nights, adults, children]);

  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMsgs,    setChatMsgs]    = useState<ChatMessage[]>([{ role: 'assistant', text: `Welcome to ${edition.name}. How can our team help?` }]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [inspireMsgs,    setInspireMsgs]    = useState<ChatMessage[]>([{ role: 'assistant', text: "We've put together your journey. Want to adjust anything?" }]);
  const [inspireInput,   setInspireInput]   = useState('');
  const [inspireLoading, setInspireLoading] = useState(false);
  const inspireEndRef = useRef<HTMLDivElement>(null);
  const FACTUAL = /visa|weather|pack|when|best time|malaria|safe|flight time|how long|currency|season/i;

  useEffect(() => { if (inspireMsgs.length > 1) inspireEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [inspireMsgs]);

  const M = edition.margins;
  const relevantIntlFlights = INTL_FLIGHTS.filter(f => f.from === builderIntlOrigin);
  const currentIntlFlight   = relevantIntlFlights[intlFlightIdx % Math.max(relevantIntlFlights.length, 1)];
  const upgradeSum = (p: string) => Object.values(upgrades[p] ?? {}).reduce((s, v: any) => s + (v?.extra ?? 0), 0);

  const totalHotelNet = propertyStays.reduce((sum, stay) => {
    const hotel = hotelsByMargin[stay.hotelIdx] ?? hotelsByMargin[0];
    if (!hotel) return sum;
    const { resolved } = resolveHotelUpgrades(hotel, stay.prefs);
    const extra = Object.values(resolved).reduce((s: number, v: any) => s + (v?.extra ?? 0), 0);
    return sum + hotel.netRate * stay.nights + extra;
  }, 0);

  const flightNet   = activePillars.includes('flights')    ? (FLIGHTS[flightIdx]?.netRate ?? 0) * totalPax + upgradeSum('flights') : 0;
  const intlNet     = includeIntlFlight && currentIntlFlight ? currentIntlFlight.netRate * totalPax + upgradeSum('intl') : 0;
  const transferNet = activePillars.includes('transfers')  ? (TRANSFERS[transferIdx]?.netRate ?? 0) + upgradeSum('transfers') : 0;
  const activityNet = activePillars.includes('activities') ? (ACTIVITIES[activityIdx]?.netRate ?? 0) * totalPax + upgradeSum('activities') : 0;
  const totalZAR    = totalHotelNet * (activePillars.includes('hotels') ? M.hotels : 0)
    + flightNet * M.flights + intlNet * M.intl + transferNet * M.transfers + activityNet * M.activities;

  const availableHotelStack = hotelsByMargin.filter(h => {
    const r = availMap.get(String(h.id));
    return !r || r.available || altDates.get(String(h.id)) !== null;
  });

  const togglePillar = (p: Pillar) => setActivePillars(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]);

  const handleSelect = (pillar: string, key: string, opt: any, stayId?: number) => {
    if (pillar === 'hotels' && stayId !== undefined)
      setPropertyStays(prev => prev.map(s => s.id === stayId ? { ...s, prefs: { ...s.prefs, [key]: opt.tier } } : s));
    else
      setUpgrades(u => ({ ...u, [pillar]: { ...u[pillar], [key]: { label: opt.label, extra: opt.extra } } }));
  };

  const addPropertyStay = () => {
    if (propertyStays.length >= 3) return;
    const last = propertyStays[propertyStays.length - 1];
    const take = Math.min(3, last.nights - 1);
    if (take < 1) return;
    const usedIdxs = propertyStays.map(s => s.hotelIdx);
    let newIdx = 0;
    for (let i = 0; i < hotelsByMargin.length; i++) { if (!usedIdxs.includes(i)) { newIdx = i; break; } }
    const from = hotelsByMargin[last.hotelIdx] ?? hotelsByMargin[0];
    const to   = hotelsByMargin[newIdx]        ?? hotelsByMargin[0];
    const transfer = getInterTransfer(from.region, to.region);
    setPropertyStays(prev => [...prev.slice(0, -1), { ...last, nights: last.nights - take }, { id: Date.now(), hotelIdx: newIdx, nights: take, prefs: { rooms: 0, basis: 0, flexibility: 0 } }]);
    setInterTransfers(prev => [...prev, { transferId: transfer.id, expanded: false }]);
  };

  const removePropertyStay = (idx: number) => {
    if (propertyStays.length <= 1) return;
    const n = propertyStays[idx].nights;
    const tgt = idx === 0 ? 1 : idx - 1;
    const updated = propertyStays.filter((_, i) => i !== idx);
    updated[Math.min(tgt, updated.length - 1)].nights += n;
    setPropertyStays([...updated]);
    const nt = [...interTransfers]; nt.splice(idx === 0 ? 0 : idx - 1, 1); setInterTransfers(nt);
  };

  const updateStayNights = (stayIdx: number, delta: number) => {
    setPropertyStays(prev => {
      const stays = prev.map(s => ({ ...s }));
      const target = stays[stayIdx];
      if (target.nights + delta < 1) return prev;
      const adjIdx = stayIdx === stays.length - 1 ? stayIdx - 1 : stayIdx + 1;
      if (adjIdx >= 0 && adjIdx < stays.length) {
        if (delta > 0 && stays[adjIdx].nights <= 1) return prev;
        stays[adjIdx].nights -= delta;
        if (stays[adjIdx].nights < 1) return prev;
      }
      target.nights += delta;
      return stays;
    });
  };

  // FIX 3 — runEngine: spinner and AI call run in parallel
  const runEngine = async (promptBody: string, mode: InputMode) => {
    setInputMode(mode);
    setScreen('inspire-research');
    setResearchStep(0);
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Start AI call immediately — don't wait for spinner
    const kbCtx = buildKBContext(kbEntries, kbSelected, edition.id);
    const aiPromise = runPlannerEngine({ kbContext: kbCtx, promptBody, ai: edition.ai })
      .catch(() => null); // null = fallback

    // Run spinner animation concurrently
    for (let i = 0; i < RESEARCH_STEPS.length; i++) {
      setResearchStep(i);
      await new Promise(r => setTimeout(r, 600));
    }

    track('itinerary_viewed', edition.id, { mode, nights, adults, budget });

    // Await the AI result (may already be done)
    const result = await aiPromise;
    if (result) {
      result.inputMode = mode;
      setItinerary(result);
      setCityHotelIdxs([0, 1, 2, 3]);
      setInspireMsgs([{ role: 'assistant', text: `We've put together your journey. Want to adjust anything?` }]);
    } else {
      const selectedSlugs = selectedRegions.map(id => REGIONS.find(r => r.id === id)?.slug ?? '').filter(Boolean);
      const fallback = buildFallbackItinerary(nights, budget, mode, selectedSlugs);
      setItinerary(fallback);
      setInspireMsgs([{ role: 'assistant', text: `We've built your safari. Our rates save you ${fmt(fallback.totalEstimate * 0.27)} vs booking direct.` }]);
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
    setScreen('inspire-plan');
  };

  // FIX 2 + 4 — Socratic planner: multi-region support, builder region context
  const runSocraticPlanner = () => {
    const selectedRegionObjs = REGIONS.filter(r => selectedRegions.includes(r.id));
    const selectedSlugs = selectedRegionObjs.map(r => r.slug).filter(Boolean) as string[];
    const regionLabels = selectedRegionObjs.map(r => r.label);
    const themeLabels = themes.map(id => THEMES.find(t => t.id === id)?.label).join(', ') || 'safari';
    const intlNote = needsIntlFlight ? `Guest flying from ${intlOrigin} — include international flight.` : 'Guest handling own international flights.';

    // Build supplier list scoped to selected regions
    const regionSuppliers = selectedSlugs.length > 0
      ? hotels.filter(h => selectedSlugs.includes(h.subRegion)).map(h => `- ${h.name} (${h.destination}, ${h.country})`)
      : hotels.map(h => `- ${h.name} (${h.destination}, ${h.country})`);

    let regionConstraint: string;
    if (selectedSlugs.length === 0) {
      regionConstraint = `Choose the best 1–2 destinations from the supplier list for this brief.`;
    } else if (selectedSlugs.length === 1) {
      regionConstraint = `SINGLE DESTINATION ONLY: "${regionLabels[0]}". Do NOT add any other destination. All ${nights} nights must be in ${regionLabels[0]}. This is a hard constraint.`;
    } else {
      regionConstraint = `Use ONLY these destinations: ${regionLabels.join(' and ')}. Split the ${nights} nights between them. Do NOT add any other destination.`;
    }

    const promptBody = `You are a luxury safari journey designer at ${edition.name}. Plan an optimised itinerary.

GUEST INPUTS:
- Origin: ${origin}
- ${intlNote}
- Budget: R${budget.toLocaleString()}
- Trip: exactly ${nights} nights total
- Travellers: ${adults} adults${children > 0 ? `, ${children} children` : ''}
- Themes: ${themeLabels}

REGION CONSTRAINT: ${regionConstraint}

AVAILABLE SUPPLIERS (use these exact names only — do not invent properties):
${regionSuppliers.join('\n') || 'Use best available properties from the supplier list'}

HARD RULES:
1. Total nights across ALL cities must equal exactly ${nights}.
2. Use only property names from the supplier list above.
3. If a single destination is specified, ALL nights go to that destination. One city only.
4. Respond ONLY with valid JSON matching the Itinerary type. No preamble.`;

    track('socratic_complete', edition.id, { regions: selectedRegions, budget, nights });
    runEngine(promptBody, 'socratic');
  };

  const runBriefPlanner = (briefText: string) => {
    const nightsMatch = briefText.match(/(\d+)\s*night/i);
    const extractedNights = nightsMatch ? parseInt(nightsMatch[1]) : nights;

    const supplierContext = hotels
      .filter(h => h.name && h.destination)
      .map(h => `- ${h.name} (${h.destination}, ${h.country}) — trust ${h.trustScore}/100`)
      .join('\n');

    const promptBody = `You are a luxury safari journey designer at ${edition.name}.
A traveller has written their own brief. Read it carefully and plan an itinerary using ONLY suppliers from the list below.

TRAVELLER BRIEF: "${briefText}"

AVAILABLE SUPPLIERS (use these exact names and destinations — do not invent properties):
${supplierContext || '- Singita Boulders Lodge (Kruger / Sabi Sand, South Africa)\n- Wilderness Mombo Camp (Okavango Delta, Botswana)\n- Ellerman House (Cape Town, South Africa)'}

HARD CONSTRAINTS:
1. TOTAL NIGHTS: exactly ${extractedNights} nights across ALL cities combined.
2. Use only destinations and properties from the supplier list above.
3. Match the brief's intent — destination, theme, occasion, budget signals.
4. All city nights must sum to exactly ${extractedNights}.
5. Do not add destinations not mentioned or implied in the brief.
6. TRAVELLERS: ${adults} adults${children > 0 ? `, ${children} children` : ''}.

Respond ONLY with a valid JSON object matching the Itinerary type. No preamble, no explanation.`;

    track('brief_submit', edition.id, { briefLength: briefText.length, nights: extractedNights, adults });
    if (extractedNights !== nights) setNights(extractedNights);
    runEngine(promptBody, 'brief');
  };

  const sendInspireChat = async () => {
    if (!inspireInput.trim() || !itinerary) return;
    const msg = inspireInput.trim();
    setInspireInput('');
    setInspireMsgs(m => [...m, { role: 'user', text: msg }]);
    setInspireLoading(true);
    const prev = itinerary;
    track('chat_sent', edition.id, { screen: 'inspire-plan', msgLength: msg.length });
    try {
      const det = applyDeterministicChange(msg, itinerary, hotels);
      if (det) { setItinerary(det.itinerary); setInspireMsgs(m => [...m, { role: 'assistant', text: det.reply, revert: prev }]); setInspireLoading(false); return; }
      if (FACTUAL.test(msg)) { const answer = await answerFactual(msg, itinerary.cities[0]?.city ?? 'Southern Africa', edition.ai); setInspireMsgs(m => [...m, { role: 'assistant', text: answer }]); setInspireLoading(false); return; }
      const diff = await applyCreativeDiff({ message: msg, itinerary, budget, nights, ai: edition.ai });
      if (diff.cities?.length) {
        const updatedCities = itinerary.cities.map(existing => { const changed = diff.cities!.find((c: any) => c.city === existing.city); return changed ? { ...existing, ...changed } : existing; });
        diff.cities.forEach((c: any) => { if (!itinerary.cities.find(e => e.city === c.city)) updatedCities.push(c); });
        setItinerary({ ...itinerary, cities: updatedCities, totalEstimate: diff.totalEstimate ?? itinerary.totalEstimate });
      }
      setInspireMsgs(m => [...m, { role: 'assistant', text: diff.reply ?? 'Done.', revert: prev }]);
    } catch { setInspireMsgs(m => [...m, { role: 'assistant', text: 'Something went wrong. Please try again.', revert: prev }]); }
    setInspireLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim(); setChatInput('');
    setChatMsgs(m => [...m, { role: 'user', text: msg }]);
    setChatLoading(true);
    track('chat_sent', edition.id, { screen, msgLength: msg.length });
    try { const reply = await chatWithSpecialist(msg, edition.ai); setChatMsgs(m => [...m, { role: 'assistant', text: reply }]); }
    catch { setChatMsgs(m => [...m, { role: 'assistant', text: 'The dry season (June–Sept) is perfect — short grass, animals at water.' }]); }
    setChatLoading(false);
  };

  const [checkoutKey] = useState(() => generateIdempotencyKey());
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    track('payment_initiated', edition.id, { totalZAR, nights, adults });
    try {
      const stack = availableHotelStack.length > 0 ? availableHotelStack : hotelsByMargin;
      const components: BookingComponent[] = propertyStays.map(stay => {
        const h = stack[Math.min(stay.hotelIdx, stack.length - 1)] ?? stack[0];
        const { resolved } = resolveHotelUpgrades(h, stay.prefs);
        const extra = Object.values(resolved).reduce((s: number, v: any) => s + (v?.extra ?? 0), 0);
        return { pillar: 'hotel', name: h.name, location: h.location, nights: stay.nights, net_rate_zar: h.netRate * stay.nights + extra, display_rate_zar: Math.round((h.netRate * stay.nights + extra) * M.hotels), margin_pct: 15, inclusion_source: 'contract' as const };
      });
      const booking: BookingIntent = { edition_id: edition.id, idempotency_key: checkoutKey, state: 'quote', title: `${edition.name} Journey`, adults, children_count: children, nights, check_in: checkinDate, check_out: addDays(checkinDate, nights), total_display_zar: totalZAR, total_net_zar: Math.round(totalZAR / M.hotels), budget_zar: budget, components, input_mode: inputMode };
      const res  = await fetch('/api/itinerary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking) });
      const data = await res.json();
      if (data.success && data.id) { track('checkout_started', edition.id, { bookingId: data.id, totalZAR }); window.location.href = `/checkout?id=${data.id}`; }
      else { alert('Could not save booking: ' + (data.error ?? 'Unknown error')); }
    } catch (e: any) { alert('Connection error: ' + (e?.message ?? String(e))); }
    setCheckoutLoading(false);
  };

  const navProps = { edition, setScreen, currency, setCurrency, chatOpen, setChatOpen, totalZAR, fmt, hasPricedItems: activePillars.length > 0 || includeIntlFlight };

  if (!unlocked) return <LoginGate onUnlock={() => setUnlocked(true)} />;

  return (
    <>
      <style suppressHydrationWarning>{GLOBAL_CSS}</style>

      {/* ── LANDING ─────────────────────────────────────────────────────── */}
      {screen === 'landing' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div style={{ position:'relative', height:'82vh', minHeight:520, overflow:'hidden' }}>
            <img src={edition.heroImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 40%' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom,rgba(10,10,10,0.1) 0%,rgba(10,10,10,0.45) 55%,rgba(10,10,10,1) 100%)' }} />
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'0 24px 52px', maxWidth:900, margin:'0 auto' }}>
              <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.2em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:12 }}>{edition.name}</div>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(30px,5.5vw,56px)', fontWeight:700, lineHeight:1.1, marginBottom:16, color:T.text }}>Africa's finest wilderness,<br /><em style={{ color:T.gold }}>curated for you.</em></h1>
              <p style={{ fontSize:16, color:T.textMid, lineHeight:1.7, marginBottom:28, maxWidth:500 }}>Handpicked lodges, negotiated rates, perfectly sequenced journeys — built around you.</p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button onClick={() => setScreen('inspire-input')} className="btn-gold" style={{ padding:'14px 24px', fontSize:15 }}>✦ Plan My Journey →</button>
                <button onClick={() => { setActivePillars([]); setInputMode('builder'); setScreen('builder'); }} className="btn-ghost" style={{ padding:'14px 24px', fontSize:15 }}>Build Your Own →</button>
                <button onClick={() => setScreen('my-brief')} className="btn-ghost" style={{ padding:'14px 24px', fontSize:15 }}>Send Us Your Brief →</button>
              </div>
            </div>
          </div>
          <div style={{ maxWidth:900, margin:'0 auto', padding:'52px 20px 80px' }}>
            <div style={{ marginBottom:56 }}>
              <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:6 }}>Curated Journeys</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:24, flexWrap:'wrap', gap:8 }}>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:T.text }}>Ready to book — from price</h2>
                <span style={{ fontSize:12, color:T.textDim }}>All-inclusive · negotiated rates</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:18 }}>
                {CURATED_JOURNEYS.map(j => (
                  <div key={j.id} className="card" style={{ cursor:'pointer' }} onClick={() => { setActivePillars(['flights','hotels','transfers','activities']); setInputMode('builder'); setScreen('builder'); }}>
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
                        <div style={{ textAlign:'right' as const }}><div style={{ fontSize:10, color:T.textDim, marginBottom:2 }}>vs direct</div><div style={{ fontSize:13, color:T.green, fontWeight:600 }}>Save {fmt(j.otaEquivalent - j.priceFrom)}</div></div>
                      </div>
                      <div style={{ borderTop:`0.5px solid ${T.border}`, paddingTop:10 }}>{j.includes.slice(0,3).map((inc, i) => <div key={i} style={{ fontSize:11, color:T.textMid, display:'flex', gap:6, marginBottom:3 }}><span style={{ color:T.gold, flexShrink:0 }}>✓</span>{inc}</div>)}</div>
                      <button className="btn-gold" style={{ width:'100%', padding:11, fontSize:13, marginTop:12 }}>View & Customise →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12 }}>
              {[{ icon:'✦', title:'Negotiated rates', sub:"Contracted directly with Africa's finest lodges." }, { icon:'🛡', title:'Verified lodges', sub:'Every property vetted for service and reliability.' }, { icon:'📞', title:'Journey specialists', sub:'Real people, available before and during your trip.' }, { icon:'🔄', title:'Flexible booking', sub:'Our cancellation terms are the most generous available.' }].map(f => (
                <div key={f.title} style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:14, padding:'18px 16px' }}>
                  <div style={{ fontSize:20, marginBottom:8 }}>{f.icon}</div>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:5, color:T.text }}>{f.title}</div>
                  <div style={{ fontSize:12, color:T.textDim, lineHeight:1.65 }}>{f.sub}</div>
                </div>
              ))}
            </div>
          </div>
          {chatOpen && <ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={() => setChatOpen(false)} edition={edition} />}
        </div>
      )}

      {/* ── INSPIRE INPUT ────────────────────────────────────────────────── */}
      {screen === 'inspire-input' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div className="fade-up" style={{ maxWidth:660, margin:'0 auto', padding:'32px 20px 80px' }}>
            <button onClick={() => setScreen('landing')} style={{ background:'transparent', border:`0.5px solid ${T.border}`, color:T.textDim, borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:24 }}>← Back</button>
            <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:6 }}>Journey Planner</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, marginBottom:8, color:T.text }}>Tell us about your dream safari</h2>
            <p style={{ fontSize:14, color:T.textMid, marginBottom:28, lineHeight:1.65 }}>Five questions. Our AI builds a fully-priced, bookable itinerary in under 30 seconds.</p>

            <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:14, padding:'16px 18px', marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:12 }}>Do you need international flights included?</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom: needsIntlFlight === true ? 12 : 0 }}>
                {[{ val: true, label:"Yes — include from my home country", icon:'✈' }, { val: false, label:"No — I'll arrange my own flights", icon:'🏠' }].map(opt => (
                  <button key={String(opt.val)} onClick={() => setNeedsIntlFlight(opt.val)} style={{ padding:'12px 14px', borderRadius:10, border:`1.5px solid ${needsIntlFlight === opt.val ? T.gold : T.border}`, background: needsIntlFlight === opt.val ? T.goldDim : T.bg3, color: needsIntlFlight === opt.val ? T.gold : T.textMid, fontSize:13, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, display:'flex', alignItems:'flex-start', gap:8 }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{opt.icon}</span><span style={{ lineHeight:1.4 }}>{opt.label}</span>
                  </button>
                ))}
              </div>
              {needsIntlFlight === true && (
                <div>
                  <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.06em', fontWeight:600, marginBottom:6 }}>Flying from</div>
                  <select value={intlOrigin} onChange={e => setIntlOrigin(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.text, borderRadius:10, padding:'11px 13px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
                    {INTERNATIONAL_ORIGINS.map(o => <option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
                  </select>
                </div>
              )}
              {needsIntlFlight === false && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.06em', fontWeight:600, marginBottom:6 }}>Arriving into</div>
                  <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.text, borderRadius:10, padding:'11px 13px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
                    {REGIONAL_ORIGINS.map(o => <option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* FIX 2 — Multi-select region buttons */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:T.textDim, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:4 }}>Destination region</div>
              <div style={{ fontSize:11, color:T.textDim, marginBottom:8 }}>Select one or more — or tap Inspire Me for a surprise</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {REGIONS.map(r => {
                  const isActive = r.id === 'inspire-me' ? selectedRegions.length === 0 : selectedRegions.includes(r.id);
                  return (
                    <button key={r.id} onClick={() => toggleRegion(r.id)} style={{ padding:'12px 14px', borderRadius:10, border:`1.5px solid ${isActive ? T.gold : T.border}`, background: isActive ? T.goldDim : T.surface, color: isActive ? T.gold : T.textMid, fontSize:13, fontWeight: isActive ? 600 : 400, cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:'inherit', position:'relative' as const }}>
                      {isActive && r.id !== 'inspire-me' && <div style={{ position:'absolute', top:6, right:6, width:14, height:14, borderRadius:'50%', background:T.gold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#0a0a0a', fontWeight:800 }}>✓</div>}
                      <span>{r.icon}</span>{r.label}
                    </button>
                  );
                })}
              </div>
              {selectedRegions.length > 1 && (
                <div style={{ marginTop:8, fontSize:11, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, padding:'6px 12px' }}>
                  ✦ {selectedRegions.length} regions selected — we'll build a multi-destination journey
                </div>
              )}
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11, color:T.textDim, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>Total budget</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(budget)}</div>
              </div>
              <input type="range" min={20000} max={2000000} step={10000} value={budget} onChange={e => setBudget(+e.target.value)} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}><span style={{ fontSize:10, color:T.textDim }}>{fmt(20000)}</span><span style={{ fontSize:10, color:T.textDim }}>{fmt(2000000)}</span></div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11, color:T.textDim, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>Trip length</div>
                <div style={{ fontSize:14, fontWeight:600, color:T.text }}>{nights} nights</div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[5,7,10,12,14,21].map(n => (
                  <button key={n} onClick={() => setNights(n)} style={{ padding:'7px 14px', borderRadius:8, border:`1.5px solid ${nights === n ? T.gold : T.border}`, background: nights === n ? T.goldDim : 'transparent', color: nights === n ? T.gold : T.textMid, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{n}n</button>
                ))}
              </div>
            </div>

            <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'16px 18px', marginBottom:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {[{ label:'Adults', value:adults, set:setAdults, min:1 }, { label:'Children', value:children, set:setChildren, min:0 }].map(p => (
                <div key={p.label}>
                  <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600, marginBottom:8 }}>{p.label}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <button onClick={() => p.set(Math.max(p.min, p.value - 1))} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:28, height:28, borderRadius:7, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>−</button>
                    <span style={{ fontSize:16, fontWeight:700, color:T.text, minWidth:24, textAlign:'center' as const }}>{p.value}</span>
                    <button onClick={() => p.set(p.value + 1)} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:28, height:28, borderRadius:7, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-gold" style={{ width:'100%', padding:16, fontSize:15 }} onClick={runSocraticPlanner}>✦ Build My Itinerary →</button>
            <p style={{ textAlign:'center' as const, fontSize:12, color:T.textDim, marginTop:10 }}>Usually ready in under 30 seconds</p>
          </div>
          <SpecialistBanner specialist={specialist} screen={screen} />
          {chatOpen && <ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={() => setChatOpen(false)} edition={edition} />}
        </div>
      )}

      {/* ── INSPIRE RESEARCH ─────────────────────────────────────────────── */}
      {screen === 'inspire-research' && (
        <div style={{ minHeight:'100vh', background:T.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
          <div style={{ marginBottom:32, display:'flex', gap:6 }}>
            {RESEARCH_STEPS.map((_, i) => <StepDot key={i} active={i <= researchStep} />)}
          </div>
          <Spinner />
          <div style={{ fontSize:14, color:T.textMid, textAlign:'center' as const, marginTop:20, maxWidth:360 }}>{RESEARCH_STEPS[researchStep]}</div>
          <div style={{ fontSize:12, color:T.textDim, marginTop:8 }}>Searching live conditions · Checking lodge availability</div>
        </div>
      )}

      {/* ── INSPIRE PLAN ─────────────────────────────────────────────────── */}
      {screen === 'inspire-plan' && itinerary && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div className="fade-up" style={{ maxWidth:660, margin:'0 auto', padding:'28px 20px 80px' }}>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:6 }}>Your Journey</div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, marginBottom:8, color:T.text }}>{itinerary.title}</h2>
              <p style={{ fontSize:14, color:T.textMid, lineHeight:1.65 }}>{itinerary.summary}</p>
              {itinerary.briefInterpretation && <div style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:10, padding:'10px 14px', fontSize:12, color:T.gold, marginTop:10 }}>✦ {itinerary.briefInterpretation}</div>}
            </div>

            <div style={{ background:T.surface, border:`0.5px solid ${T.borderGold}`, borderRadius:14, padding:'16px 18px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div><div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', marginBottom:4 }}>Total estimate · {itinerary.cities.reduce((s, c) => s + c.nights, 0)} nights</div><div style={{ fontSize:28, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(itinerary.totalEstimate)}</div></div>
              <div style={{ textAlign:'right' as const }}><div style={{ fontSize:11, color:T.textDim, marginBottom:4 }}>Routing</div><div style={{ fontSize:12, color:T.textMid }}>{itinerary.routing}</div></div>
            </div>

            {/* FIX 5 — City cards: slug-first matching, carousel scoped to correct region */}
            {itinerary.cities.map((city, i) => {
              const cityName = city.city.toLowerCase().trim();
              const targetSlug = CITY_TO_SLUG[cityName] ?? CITY_TO_SLUG[city.city.toLowerCase()];

              // Build the stack for this specific city
              const destinationStack = targetSlug
                ? hotelsByMargin.filter(h => h.subRegion === targetSlug)
                : hotelsByMargin.filter(h => {
                    const dest = (h.destination ?? '').toLowerCase();
                    return dest.includes(cityName) || cityName.includes(dest);
                  });

              const cityRegion = COUNTRY_REGION[city.country] ?? 'southern-africa';
              const regionStack = hotelsByMargin.filter(h => h.region === cityRegion);
              const stack = destinationStack.length > 0 ? destinationStack : regionStack.length > 0 ? regionStack : hotelsByMargin;
              const stackSize = stack.length;

              // Reset idx if it exceeds the stack for this city
              const rawIdx = cityHotelIdxs[i] ?? 0;
              const hotelIdx = Math.min(rawIdx, stackSize - 1);
              const hotel = stack[hotelIdx] ?? hotelsByMargin[0];

              return (
                <div key={i} className="city-card" style={{ padding:0, overflow:'hidden', marginBottom:12 }}>
                  {hotel?.image && (
                    <div style={{ position:'relative', height:130, overflow:'hidden' }}>
                      <img src={hotel.image} alt={city.city} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 40%' }} />
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.78) 0%,transparent 55%)' }} />
                      <div style={{ position:'absolute', bottom:10, left:14, right:14, display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                        <div>
                          <div style={{ fontSize:18, fontWeight:700, fontFamily:"'Playfair Display',serif", color:'#fff' }}>{city.city}</div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)' }}>{city.country} · {city.nights} night{city.nights !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ textAlign:'right' as const }}>
                          <div style={{ fontSize:16, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(city.estimatedCost)}</div>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>est. total</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ padding:'12px 16px' }}>
                    {!hotel?.image && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Playfair Display',serif", color:T.text }}>{city.city}</div>
                          <div style={{ fontSize:12, color:T.textMid }}>{city.country} · {city.nights} night{city.nights !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ textAlign:'right' as const }}>
                          <div style={{ fontSize:17, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(city.estimatedCost)}</div>
                          <div style={{ fontSize:10, color:T.textDim }}>est. total</div>
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize:12, color:T.textMid, marginBottom:10, lineHeight:1.6 }}>{city.why}</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      {city.highlights.filter(Boolean).map((h: string, hi: number) => <span key={hi} style={{ fontSize:11, color:T.textDim, background:'rgba(255,255,255,0.04)', border:`0.5px solid ${T.border}`, borderRadius:20, padding:'3px 10px' }}>✦ {h}</span>)}
                    </div>
                    {hotel && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:`0.5px solid ${T.border}` }}>
                        <div style={{ fontSize:12, color:T.textMid }}>
                          Suggested: <span style={{ color:T.text, fontWeight:600 }}>{hotel.name}</span>
                          {stackSize > 1 && <span style={{ color:T.textDim, fontSize:11 }}> · {hotelIdx + 1}/{stackSize}</span>}
                        </div>
                        {stackSize > 1 && (
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => setCityHotelIdxs(prev => { const n=[...prev]; n[i]=Math.max(0,(n[i]??0)-1); return n; })} disabled={hotelIdx===0} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.textMid, width:24, height:24, borderRadius:6, cursor: hotelIdx===0?'not-allowed':'pointer', fontSize:12, fontFamily:'inherit', opacity:hotelIdx===0?0.35:1 }}>←</button>
                            <button onClick={() => setCityHotelIdxs(prev => { const n=[...prev]; n[i]=Math.min(stackSize-1,(n[i]??0)+1); return n; })} disabled={hotelIdx>=stackSize-1} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.textMid, width:24, height:24, borderRadius:6, cursor: hotelIdx>=stackSize-1?'not-allowed':'pointer', fontSize:12, fontFamily:'inherit', opacity:hotelIdx>=stackSize-1?0.35:1 }}>→</button>
                          </div>
                        )}
                      </div>
                    )}
                    {city.arrivalGap && <div style={{ fontSize:11, color:T.textDim, marginTop:6 }}>🕐 {city.arrivalGap}</div>}
                  </div>
                </div>
              );
            })}

            {itinerary.aiInsights?.filter(Boolean).length > 0 && (
              <div style={{ background:'rgba(212,175,55,0.05)', border:`0.5px solid ${T.borderGold}`, borderRadius:14, padding:'16px 18px', marginBottom:16 }}>
                <div style={{ fontSize:11, color:'rgba(212,175,55,0.7)', fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:10 }}>Rate insights</div>
                {itinerary.aiInsights.filter(Boolean).map((ins: string, i: number) => <div key={i} style={{ display:'flex', gap:8, marginBottom:6, fontSize:12, color:T.textMid, lineHeight:1.55 }}><span style={{ color:T.gold, flexShrink:0 }}>✦</span>{ins}</div>)}
              </div>
            )}

            {/* FIX 6 — Filter patronising warnings before display */}
            {filterWarnings(itinerary.warnings).length > 0 && (
              <div style={{ background:'rgba(251,146,60,0.07)', border:'0.5px solid rgba(251,146,60,0.22)', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
                {filterWarnings(itinerary.warnings).map((w: string, i: number) => <div key={i} style={{ fontSize:12, color:'rgba(251,146,60,0.9)', lineHeight:1.55 }}>⚠ {w}</div>)}
              </div>
            )}

            <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'12px 16px', marginBottom:20, fontSize:12, color:T.textMid, lineHeight:1.6 }}>
              🗓 <strong style={{ color:T.text }}>Best timing:</strong> {itinerary.bestTiming}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }}>
              <button className="btn-gold" style={{ padding:16, fontSize:15 }} onClick={() => {
                track('price_and_book_clicked', edition.id, { totalEstimate: itinerary.totalEstimate });
                if (itinerary.cities.length > 0) {
                  const newStays = itinerary.cities.map((city, i) => ({
                    id: i + 1,
                    // FIX 4 — use the hotel index from the inspire-plan carousel
                    hotelIdx: cityHotelIdxs[i] ?? i % hotelsByMargin.length,
                    nights: city.nights || 3,
                    prefs: { rooms: 0, basis: 0, flexibility: 0 },
                  }));
                  setPropertyStays(newStays);
                  setNights(newStays.reduce((s, s2) => s + s2.nights, 0));
                }
                setActivePillars(['flights','hotels','transfers','activities']);
                setInputMode('builder');
                setCustomise(null);
                setScreen('builder');
              }}>Price & Book This →</button>
              <button onClick={runSocraticPlanner} className="btn-ghost" style={{ padding:16, fontSize:14 }}>🔄 Rebuild itinerary</button>
            </div>

            <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:16, overflow:'hidden', marginBottom:24 }}>
              <div style={{ padding:'14px 18px', borderBottom:`0.5px solid ${T.border}`, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, display:'flex', alignItems:'center', justifyContent:'center' }}>✦</div>
                <div><div style={{ fontSize:13, fontWeight:600, color:T.text }}>Adjust your journey</div><div style={{ fontSize:11, color:T.textDim }}>The itinerary updates live</div></div>
              </div>
              <div style={{ padding:'8px 16px 0', borderBottom:`0.5px solid ${T.border}`, display:'flex', gap:6, flexWrap:'wrap', paddingBottom:10 }}>
                {['Make it cheaper','Extend by 2 nights','Add a beach stop','Fewer destinations','Best time to go?','What visas do I need?'].map(q => (
                  <button key={q} onClick={() => { setInspireInput(q); setTimeout(() => document.getElementById('inspire-send')?.click(), 50); }} style={{ fontSize:11, padding:'4px 10px', borderRadius:20, border:`0.5px solid ${T.border}`, background:'rgba(255,255,255,0.04)', color:T.textMid, cursor:'pointer', fontFamily:'inherit' }}>{q}</button>
                ))}
              </div>
              <div style={{ maxHeight:220, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                {inspireMsgs.map((m: any, i: number) => (
                  <div key={i} style={{ display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth:'88%', padding:'9px 13px', borderRadius: m.role === 'user' ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: m.role === 'user' ? 'rgba(212,175,55,0.1)' : T.surface, border:`0.5px solid ${m.role === 'user' ? T.borderGold : T.border}`, fontSize:13, color:T.text, lineHeight:1.6 }}>
                      {m.text}
                      {m.revert && <button onClick={() => { setItinerary(m.revert!); setInspireMsgs((msgs: any) => [...msgs, { role:'assistant', text:"Restored your previous itinerary." }]); }} style={{ display:'block', marginTop:8, background:'rgba(255,255,255,0.06)', border:`0.5px solid ${T.border}`, color:T.textDim, borderRadius:7, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>↩ Revert</button>}
                    </div>
                  </div>
                ))}
                {inspireLoading && <div style={{ display:'flex', gap:4, padding:'8px 12px' }}>{[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:T.gold, animation:`pulse 1.2s ease ${i * 0.2}s infinite` }} />)}</div>}
                <div ref={inspireEndRef} />
              </div>
              <div style={{ padding:'10px 14px', borderTop:`0.5px solid ${T.border}`, display:'flex', gap:8 }}>
                <input value={inspireInput} onChange={e => setInspireInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendInspireChat()} placeholder="e.g. Make it cheaper · Add gorilla trekking · Swap Sabi Sand for Okavango..." style={{ flex:1, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.text, borderRadius:9, padding:'9px 13px', fontSize:13, outline:'none', fontFamily:'inherit' }} />
                <button id="inspire-send" onClick={sendInspireChat} className="btn-gold" style={{ padding:'9px 14px', fontSize:13 }}>→</button>
              </div>
            </div>
          </div>
          <SpecialistBanner specialist={specialist} screen={screen} />
          {chatOpen && <ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={() => setChatOpen(false)} edition={edition} />}
        </div>
      )}

      {/* ── MY BRIEF ─────────────────────────────────────────────────────── */}
      {screen === 'my-brief' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <div style={{ maxWidth:660, margin:'0 auto', padding:'32px 20px 80px' }}>
            <button onClick={() => setScreen('landing')} style={{ background:'transparent', border:`0.5px solid ${T.border}`, color:T.textDim, borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:24 }}>← Back</button>
            <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.15em', textTransform:'uppercase' as const, fontWeight:600, marginBottom:6 }}>Your Brief</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, marginBottom:8, color:T.text }}>Tell us what you're dreaming of</h2>
            <p style={{ fontSize:14, color:T.textMid, marginBottom:24, lineHeight:1.65 }}>Write anything — we'll read it and build your journey around it.</p>
            <BriefScreen nights={nights} setNights={setNights} adults={adults} setAdults={setAdults} children={children} setChildren={setChildren} onBuild={(text: string) => { setScreen('inspire-research'); runBriefPlanner(text); }} />
          </div>
          <SpecialistBanner specialist={specialist} screen={screen} />
        </div>
      )}

      {/* ── BUILDER ──────────────────────────────────────────────────────── */}
      {screen === 'builder' && (
        <div style={{ minHeight:'100vh', background:T.bg }}>
          <Nav {...navProps} />
          <StickyPrice totalZAR={(activePillars.length > 0 || includeIntlFlight) ? totalZAR : 0} fmt={fmt} />
          <SpecialistBanner specialist={specialist} screen={screen} />
          <div style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px 80px' }}>

            <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:14, padding:'16px 18px', marginBottom:22 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, alignItems:'center' }}>
                {[{ label:'Nights', value:nights, dec:() => { const n=Math.max(1,nights-1); setNights(n); if(propertyStays.length===1) setPropertyStays([{...propertyStays[0],nights:n}]); }, inc:() => { const n=nights+1; setNights(n); if(propertyStays.length===1) setPropertyStays([{...propertyStays[0],nights:n}]); } }, { label:'Adults', value:adults, dec:()=>setAdults(a=>Math.max(1,a-1)), inc:()=>setAdults(a=>a+1) }, { label:'Children', value:children, dec:()=>setChildren(c=>Math.max(0,c-1)), inc:()=>setChildren(c=>c+1) }].map(p => (
                  <div key={p.label}>
                    <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600, marginBottom:6 }}>{p.label}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button onClick={p.dec} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:26, height:26, borderRadius:6, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>−</button>
                      <span style={{ fontSize:16, fontWeight:700, color:T.text, minWidth:28, textAlign:'center' as const }}>{p.value}</span>
                      <button onClick={p.inc} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:26, height:26, borderRadius:6, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>+</button>
                    </div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600, marginBottom:6 }}>Currency</div>
                  <select value={currency.code} onChange={e => setCurrency(CURRENCIES.find(c => c.code === e.target.value)!)} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, borderRadius:8, padding:'5px 10px', fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }}>
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:12, paddingTop:12, borderTop:`0.5px solid ${T.border}`, flexWrap:'wrap' }}>
                <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600 }}>Check-in</div>
                <input type="date" value={checkinDate} onChange={e => setCheckinDate(e.target.value || todayPlusDays(30))} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, borderRadius:8, padding:'5px 10px', fontSize:12, outline:'none', fontFamily:'inherit' }} />
                <button onClick={() => setIncludeIntlFlight(x => !x)} style={{ padding:'5px 12px', borderRadius:8, border:`1.5px solid ${includeIntlFlight ? T.gold : T.border}`, background: includeIntlFlight ? T.goldDim : T.bg3, color: includeIntlFlight ? T.gold : T.textMid, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{includeIntlFlight ? '✓ Intl flights' : '+ Add intl flights'}</button>
                {preloading && <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:T.textDim }}><Spinner /> Checking availability...</div>}
              </div>
              {includeIntlFlight && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:`0.5px solid ${T.border}` }}>
                  <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:600, marginBottom:6 }}>Flying from</div>
                  <select value={builderIntlOrigin} onChange={e => { setBuilderIntlOrigin(e.target.value); setIntlFlightIdx(0); }} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.text, borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
                    {INTERNATIONAL_ORIGINS.map(o => <option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, color:T.textDim, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:10 }}>Select components</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {([{ id:'flights', label:'Flights', icon:'✈', desc:'Charter & regional' }, { id:'hotels', label:'Lodges', icon:'🏕', desc:'Split across properties' }, { id:'transfers', label:'Transfers', icon:'🚗', desc:'Ground & game drives' }, { id:'activities', label:'Activities', icon:'🦁', desc:'Paid add-ons only' }] as const).map(p => (
                  <button key={p.id} onClick={() => togglePillar(p.id)} style={{ padding:'14px 8px', borderRadius:12, border:`1.5px solid ${activePillars.includes(p.id) ? T.gold : T.border}`, background: activePillars.includes(p.id) ? T.goldDim : T.surface, cursor:'pointer', fontFamily:'inherit', position:'relative', textAlign:'center' as const }}>
                    {activePillars.includes(p.id) && <div style={{ position:'absolute', top:6, right:6, width:14, height:14, borderRadius:'50%', background:T.gold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#0a0a0a', fontWeight:800 }}>✓</div>}
                    <div style={{ fontSize:20, marginBottom:4 }}>{p.icon}</div>
                    <div style={{ fontSize:12, fontWeight:600, color: activePillars.includes(p.id) ? T.gold : T.text }}>{p.label}</div>
                    <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {includeIntlFlight && relevantIntlFlights.length > 0 && (() => {
              const fl = relevantIntlFlights[intlFlightIdx % relevantIntlFlights.length];
              const display = Math.round((fl.netRate * totalPax + upgradeSum('intl')) * M.intl);
              const saving  = fl.otaRate ? Math.round(fl.otaRate * totalPax - display) : null;
              return (
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ fontSize:11, color:'#60a5fa', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>✈ International · {builderIntlOrigin} → JNB</div>
                    <div style={{ fontSize:11, color:T.textDim }}>{intlFlightIdx % relevantIntlFlights.length + 1}/{relevantIntlFlights.length}</div>
                  </div>
                  <PillarCard item={{ ...fl, location:`${fl.from} → ${fl.to}` }} displayRate={display} otaSaving={saving} pillarColor="#60a5fa" fmt={fmt} onPrev={() => setIntlFlightIdx(i => Math.max(0,i-1))} onNext={() => setIntlFlightIdx(i => Math.min(relevantIntlFlights.length-1,i+1))} isPrevDisabled={intlFlightIdx===0} isNextDisabled={intlFlightIdx>=relevantIntlFlights.length-1} onCustomise={() => setCustomise({ pillar:'intl', idx:intlFlightIdx })} stackLabel={null} />
                </div>
              );
            })()}

            {activePillars.includes('flights') && (() => {
              const fl = FLIGHTS[flightIdx];
              const display = Math.round((fl.netRate * totalPax + upgradeSum('flights')) * M.flights);
              const saving  = fl.otaRate ? Math.round(fl.otaRate * totalPax - display) : null;
              return (
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ fontSize:11, color:T.pillar.flights, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>✈ Flights</div>
                    <div style={{ fontSize:11, color:T.textDim }}>{flightIdx+1}/{FLIGHTS.length}</div>
                  </div>
                  <PillarCard item={fl} displayRate={display} otaSaving={saving} pillarColor={T.pillar.flights} fmt={fmt} onPrev={() => setFlightIdx(i => Math.max(0,i-1))} onNext={() => setFlightIdx(i => Math.min(FLIGHTS.length-1,i+1))} isPrevDisabled={flightIdx===0} isNextDisabled={flightIdx===FLIGHTS.length-1} onCustomise={() => setCustomise({ pillar:'flights', idx:flightIdx })} stackLabel={null} />
                </div>
              );
            })()}

            {activePillars.includes('hotels') && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:T.pillar.hotels, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:10 }}>🏕 Lodges · {propertyStays.length} propert{propertyStays.length===1?'y':'ies'}</div>
                {propertyStays.map((stay, stayIdx) => {
                  const stack = availableHotelStack.length > 0 ? availableHotelStack : hotelsByMargin;
                  const hotel = stack[Math.min(stay.hotelIdx, stack.length-1)] ?? stack[0];
                  if (!hotel) return null;
                  const { resolved, mismatches } = resolveHotelUpgrades(hotel, stay.prefs);
                  const upgradeExtra = Object.values(resolved).reduce((s: number, v: any) => s + (v?.extra ?? 0), 0);
                  const display = Math.round((hotel.netRate * stay.nights + upgradeExtra) * M.hotels);
                  const saving  = hotel.otaRate ? Math.round(hotel.otaRate * stay.nights - display) : null;
                  const avail   = availMap.get(String(hotel.id));
                  const altDate = altDates.get(String(hotel.id));
                  return (
                    <div key={stay.id} className="property-card" style={{ marginBottom:12 }}>
                      <div style={{ padding:'12px 14px', borderBottom:`0.5px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:T.gold }}>Property {stayIdx+1}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <button onClick={() => updateStayNights(stayIdx,-1)} disabled={stay.nights<=1} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:22, height:22, borderRadius:5, cursor:'pointer', fontSize:12, fontFamily:'inherit', opacity: stay.nights<=1 ? 0.35 : 1 }}>−</button>
                          <span style={{ fontSize:13, fontWeight:600, color:T.text, minWidth:54, textAlign:'center' as const }}>{stay.nights} night{stay.nights!==1?'s':''}</span>
                          <button onClick={() => updateStayNights(stayIdx,1)} style={{ background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, width:22, height:22, borderRadius:5, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>+</button>
                          {propertyStays.length>1 && <button onClick={() => removePropertyStay(stayIdx)} style={{ background:'rgba(248,113,113,0.08)', border:'0.5px solid rgba(248,113,113,0.2)', color:T.red, borderRadius:5, padding:'3px 8px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Remove</button>}
                        </div>
                      </div>
                      {avail && !avail.available && altDate && (
                        <div style={{ margin:'8px 14px 0', background:'rgba(251,146,60,0.08)', border:'0.5px solid rgba(251,146,60,0.22)', borderRadius:8, padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:12, color:'rgba(251,146,60,0.9)' }}>Not available — closest: {altDate.date} ({altDate.delta>0?'+':''}{altDate.delta} days)</span>
                          <button onClick={() => { setCheckinDate(altDate.date); const m=new Map(altDates); m.delete(String(hotel.id)); setAltDates(m); }} style={{ background:'rgba(251,146,60,0.15)', border:'0.5px solid rgba(251,146,60,0.3)', color:'rgba(251,146,60,0.9)', borderRadius:6, padding:'3px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Accept</button>
                        </div>
                      )}
                      {mismatches.length>0 && <div style={{ margin:'8px 14px 0', fontSize:11, color:T.amber }}>⚠ Your upgrade preference isn't available — showing closest match.</div>}
                      <PillarCard item={{ ...hotel }} displayRate={display} otaSaving={saving} pillarColor={T.pillar.hotels} fmt={fmt} onPrev={() => setPropertyStays(prev => { const s=prev.map(x=>({...x})); s[stayIdx].hotelIdx=Math.max(0,s[stayIdx].hotelIdx-1); return s; })} onNext={() => setPropertyStays(prev => { const s=prev.map(x=>({...x})); s[stayIdx].hotelIdx=Math.min(hotelsByMargin.length-1,s[stayIdx].hotelIdx+1); return s; })} isPrevDisabled={stay.hotelIdx===0} isNextDisabled={stay.hotelIdx>=hotelsByMargin.length-1} onCustomise={() => setCustomise({ pillar:'hotels', stayId:stay.id, idx:stay.hotelIdx })} stackLabel={`${stay.hotelIdx+1}/${hotelsByMargin.length} properties`} />
                      {stayIdx < propertyStays.length-1 && interTransfers[stayIdx] && (() => {
                        const nextHotel = hotelsByMargin[propertyStays[stayIdx+1].hotelIdx] ?? hotelsByMargin[0];
                        const xfer = getInterTransfer(hotel.region, nextHotel.region);
                        return (
                          <div className="inter-transfer" onClick={() => setInterTransfers(prev => prev.map((t,i) => i===stayIdx ? {...t,expanded:!t.expanded} : t))} style={{ margin:'8px 14px 14px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <div style={{ fontSize:12, color:'#60a5fa', fontWeight:600 }}>{xfer.icon} {xfer.label}</div>
                              <div style={{ fontSize:12, color:T.textMid }}>{fmt(xfer.netRate * M.transfers)} · {xfer.duration}</div>
                            </div>
                            {interTransfers[stayIdx].expanded && <div style={{ fontSize:12, color:T.textDim, marginTop:6 }}>{xfer.note}</div>}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                {propertyStays.length < 3 && (
                  <button onClick={addPropertyStay} style={{ width:'100%', padding:13, borderRadius:12, border:`1.5px dashed ${T.borderGold}`, background:'transparent', color:T.gold, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, marginTop:8 }} onMouseEnter={e => (e.currentTarget.style.background=T.goldDim)} onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    + Add property ({propertyStays.length}/3)
                  </button>
                )}
              </div>
            )}

            {activePillars.includes('transfers') && (() => {
              const item = TRANSFERS[transferIdx];
              const display = Math.round((item.netRate + upgradeSum('transfers')) * M.transfers);
              const saving  = item.otaRate ? Math.round(item.otaRate - display) : null;
              return (
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ fontSize:11, color:T.pillar.transfers, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>🚗 Transfers</div>
                    <div style={{ fontSize:11, color:T.textDim }}>{transferIdx+1}/{TRANSFERS.length}</div>
                  </div>
                  <PillarCard item={item} displayRate={display} otaSaving={saving} pillarColor={T.pillar.transfers} fmt={fmt} onPrev={() => setTransferIdx(i => Math.max(0,i-1))} onNext={() => setTransferIdx(i => Math.min(TRANSFERS.length-1,i+1))} isPrevDisabled={transferIdx===0} isNextDisabled={transferIdx===TRANSFERS.length-1} onCustomise={() => setCustomise({ pillar:'transfers', idx:transferIdx })} stackLabel={null} />
                </div>
              );
            })()}

            {activePillars.includes('activities') && (() => {
              const item = ACTIVITIES[activityIdx];
              const display = Math.round((item.netRate * totalPax + upgradeSum('activities')) * M.activities);
              const saving  = item.otaRate ? Math.round(item.otaRate * totalPax - display) : null;
              return (
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ fontSize:11, color:T.pillar.activities, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>🦁 Activities (paid add-ons)</div>
                    <div style={{ fontSize:11, color:T.textDim }}>{activityIdx+1}/{ACTIVITIES.length}</div>
                  </div>
                  <PillarCard item={item} displayRate={display} otaSaving={saving} pillarColor={T.pillar.activities} fmt={fmt} onPrev={() => setActivityIdx(i => Math.max(0,i-1))} onNext={() => setActivityIdx(i => Math.min(ACTIVITIES.length-1,i+1))} isPrevDisabled={activityIdx===0} isNextDisabled={activityIdx===ACTIVITIES.length-1} onCustomise={() => setCustomise({ pillar:'activities', idx:activityIdx })} stackLabel={null} />
                </div>
              );
            })()}

            {(activePillars.length > 0 || includeIntlFlight) && (
              <div style={{ background:T.surface, border:`0.5px solid ${T.borderGold}`, borderRadius:16, padding:20, marginTop:8 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:14, color:T.text }}>Package summary</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
                  {propertyStays.map((stay,i) => { const h=(availableHotelStack.length>0?availableHotelStack:hotelsByMargin)[Math.min(stay.hotelIdx,hotelsByMargin.length-1)]??hotelsByMargin[0]; return h ? <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.textMid }}><span style={{ color:T.gold, flexShrink:0 }}>✦</span>{h.name} · {stay.nights} night{stay.nights!==1?'s':''}</div> : null; })}
                  {activePillars.includes('flights') && <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.textMid }}><span style={{ color:T.gold, flexShrink:0 }}>✦</span>{FLIGHTS[flightIdx].airline} · {FLIGHTS[flightIdx].route}</div>}
                  {includeIntlFlight && currentIntlFlight && <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.textMid }}><span style={{ color:T.gold, flexShrink:0 }}>✦</span>{currentIntlFlight.airline} · {builderIntlOrigin} → JNB</div>}
                  {activePillars.includes('transfers') && <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.textMid }}><span style={{ color:T.gold, flexShrink:0 }}>✦</span>{TRANSFERS[transferIdx].type}</div>}
                  {activePillars.includes('activities') && <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.textMid }}><span style={{ color:T.gold, flexShrink:0 }}>✦</span>{ACTIVITIES[activityIdx].name}</div>}
                </div>
                <div style={{ borderTop:`0.5px solid ${T.borderGold}`, paddingTop:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                    <div><div style={{ fontSize:13, fontWeight:700, color:T.text }}>Total package</div><div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>All flights, lodges & transfers</div></div>
                    <span style={{ fontSize:26, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif" }}>{fmt(totalZAR)}</span>
                  </div>
                </div>
                <button className="btn-gold" style={{ width:'100%', padding:15, fontSize:15, marginTop:16 }} onClick={handleCheckout} disabled={checkoutLoading}>
                  {checkoutLoading ? 'Saving...' : 'Confirm & Proceed to Payment →'}
                </button>
                <div style={{ textAlign:'center' as const, fontSize:11, color:T.textDim, marginTop:8 }}>PayFast (ZAR) · Stripe (international) · Free cancellation on selected rates</div>
              </div>
            )}
          </div>

          {customise && (() => {
            const { pillar, stayId, idx } = customise;
            const pColor = pillar === 'intl' ? '#60a5fa' : (T.pillar as any)[pillar] ?? T.gold;
            let item: any, sections: any[], currentResolved: any, stayPrefs: any = {};
            if (pillar === 'hotels' && stayId !== undefined) {
              const stay = propertyStays.find(s => s.id === stayId)!;
              item = hotelsByMargin[stay.hotelIdx] ?? hotelsByMargin[0];
              const { resolved } = resolveHotelUpgrades(item, stay.prefs);
              currentResolved = resolved; stayPrefs = stay.prefs;
            } else if (pillar === 'flights') { item = FLIGHTS[idx]; currentResolved = upgrades.flights; }
            else if (pillar === 'intl') { item = relevantIntlFlights[idx % relevantIntlFlights.length]; currentResolved = upgrades.intl; }
            else if (pillar === 'transfers') { item = TRANSFERS[idx]; currentResolved = upgrades.transfers; }
            else { item = ACTIVITIES[idx]; currentResolved = upgrades.activities; }
            sections = Object.entries(item?.upgrades ?? {});
            return (
              <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setCustomise(null); }}>
                <div style={{ background:'#141414', border:`0.5px solid ${T.border}`, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:600, maxHeight:'88vh', overflowY:'auto', padding:'24px 20px 40px', animation:'slideUp 0.3s ease' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                    <div><div style={{ fontSize:17, fontWeight:700, color:T.text }}>Customise</div><div style={{ fontSize:13, color:T.textMid, marginTop:2 }}>{item?.name || item?.airline || item?.type}</div></div>
                    <button onClick={() => setCustomise(null)} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:T.textMid, width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>×</button>
                  </div>
                  {sections.map(([key, options]: any) => (
                    <div key={key} style={{ marginBottom:20 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:T.textDim, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:10 }}>{SECTION_LABELS[key] ?? key}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                        {options.map((opt: any) => {
                          const sel = pillar === 'hotels' ? opt.tier !== undefined && opt.tier === stayPrefs[key] : currentResolved[key]?.label === opt.label;
                          return (
                            <button key={opt.label} onClick={() => handleSelect(pillar, key, opt, stayId)} style={{ background: sel ? `${pColor}14` : 'rgba(255,255,255,0.04)', border:`1.5px solid ${sel ? pColor : T.border}`, borderRadius:11, padding:'11px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'inherit', textAlign:'left' as const }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${sel ? pColor : 'rgba(255,255,255,0.22)'}`, background: sel ? pColor : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:10, color:'#0a0a0a', fontWeight:800 }}>{sel ? '✓' : ''}</div>
                                <div style={{ fontSize:13, fontWeight: sel ? 600 : 400, color: sel ? T.text : T.textMid }}>{opt.label}</div>
                              </div>
                              <div style={{ fontSize:13, fontWeight:600, color: opt.extra === 0 ? T.textDim : opt.extra < 0 ? T.green : pColor, whiteSpace:'nowrap', marginLeft:8 }}>{opt.extra === 0 ? 'Included' : opt.extra < 0 ? `Save ${fmt(Math.abs(opt.extra))}` : `+${fmt(opt.extra)}`}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <button className="btn-gold" style={{ width:'100%', padding:14, fontSize:15, marginTop:8 }} onClick={() => setCustomise(null)}>Confirm selections →</button>
                </div>
              </div>
            );
          })()}

          {chatOpen && <ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={() => setChatOpen(false)} edition={edition} />}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIEF SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function BriefScreen({ nights, setNights, adults, setAdults, children, setChildren, onBuild }: any) {
  const [brief, setBrief] = useState('');
  const maxLen = 1000;
  const ready = brief.trim().length >= 30;
  const hasDestination = /sabi|kruger|okavango|botswana|kenya|tanzania|zimbabwe|zambia|south africa|victoria falls|mara|serengeti|rwanda|uganda|madikwe|cape town/i.test(brief);
  const hasTheme       = /honeymoon|anniversary|family|romantic|adventure|wildlife|beach|gorilla|balloon|dive/i.test(brief);
  const hasDate        = /january|february|march|april|may|june|july|august|september|october|november|december|summer|winter|christmas|school holiday/i.test(brief);
  const hasBudget      = /R\s?\d|budget|afford|spend|cost/i.test(brief);
  const PROMPTS = [
    "I'd love a honeymoon in the Okavango — very private, great food, not up at 5am every day.",
    "10-day family safari with kids aged 8 and 12. Malaria-free preferred. Budget around R250,000.",
    "We've done Kenya twice. Want to explore southern Africa — Zimbabwe, Zambia, maybe Botswana.",
    "First safari. Two of us. No idea where to go but we want the Big Five and a wow moment.",
  ];
  return (
    <div>
      <div style={{ position:'relative', marginBottom:16 }}>
        <textarea value={brief} onChange={e => setBrief(e.target.value.slice(0,maxLen))} placeholder="e.g. We're celebrating our 20th anniversary. We've always wanted to see the Okavango from the air and spend time somewhere very private..." rows={8} style={{ width:'100%', background:T.surface, border:`1.5px solid ${brief.length>0?T.borderGold:T.border}`, borderRadius:14, padding:'18px 20px', fontSize:14, color:T.text, outline:'none', fontFamily:"'DM Sans', sans-serif", lineHeight:1.7, resize:'vertical' as const }} />
        <div style={{ position:'absolute', bottom:10, right:14, fontSize:11, color:T.textDim }}>{brief.length}/{maxLen}</div>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {[{ label:'Destination', detected:hasDestination, hint:'Where in Africa?' }, { label:'Occasion / theme', detected:hasTheme, hint:'What kind of trip?' }, { label:'Travel dates', detected:hasDate, hint:'When are you thinking?' }, { label:'Budget', detected:hasBudget, hint:"What's your budget?" }].map(tag => (
          <div key={tag.label} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, border:`0.5px solid ${tag.detected?T.borderGold:T.border}`, background: tag.detected?T.goldDim:'transparent', fontSize:12, color: tag.detected?T.gold:T.textDim }}>
            <span>{tag.detected?'✓':'·'}</span>{tag.detected?tag.label:tag.hint}
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        {[{ label:'Nights', value:nights, options:[5,7,10,12,14,21], onChange:setNights, suffix:'n' }, { label:'Adults', value:adults, options:[1,2,3,4,6], onChange:setAdults, suffix:'' }, { label:'Children', value:children, options:[0,1,2,3,4], onChange:setChildren, suffix:'' }].map(p => (
          <div key={p.label} style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:10, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:8 }}>{p.label}</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {p.options.map(o => (
                <button key={o} onClick={() => p.onChange(o)} style={{ padding:'5px 10px', borderRadius:8, border:`0.5px solid ${p.value===o?T.borderGold:T.border}`, background: p.value===o?T.goldDim:'transparent', color: p.value===o?T.gold:T.textDim, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{o}{p.suffix}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {brief.length < 10 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, color:T.textDim, textTransform:'uppercase' as const, letterSpacing:'0.1em', marginBottom:10 }}>Examples — tap to use</div>
          {PROMPTS.map((p,i) => (
            <button key={i} onClick={() => setBrief(p)} style={{ display:'block', width:'100%', textAlign:'left' as const, padding:'12px 16px', background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:10, color:T.textMid, fontSize:13, cursor:'pointer', fontFamily:'inherit', lineHeight:1.5, marginBottom:8 }}>"{p}"</button>
          ))}
        </div>
      )}
      <button onClick={() => { if (ready) onBuild(brief + (nights>0?` Trip length: ${nights} nights.`:'') + (adults>0?` Travellers: ${adults} adults${children>0?`, ${children} children`:''}.`:'')); }} disabled={!ready} style={{ width:'100%', padding:18, background: ready?`linear-gradient(135deg,${T.gold},${T.goldLight})`:'rgba(255,255,255,0.06)', border:'none', borderRadius:12, color: ready?'#0a0a0a':T.textDim, fontSize:16, fontWeight:700, cursor: ready?'pointer':'not-allowed', fontFamily:'inherit' }}>
        {ready ? '✦ Build My Journey →' : `Write at least ${30-brief.trim().length} more characters to continue`}
      </button>
    </div>
  );
}
