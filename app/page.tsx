'use client';
import { useState, useRef, useEffect, useCallback } from "react";

// ─── SUPABASE CLIENT ──────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function supabaseFetch(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

// Map a Supabase supplier row to the Hotel shape the UI expects
function mapSupplier(s: any) {
  const countryToRegion: Record<string, string> = {
    'South Africa': 'southern-africa',
    'Botswana': 'southern-africa',
    'South Africa / Botswana': 'southern-africa',
    'Zimbabwe': 'southern-africa',
    'Zambia': 'southern-africa',
    'Namibia': 'southern-africa',
    'Kenya': 'east-africa',
    'Tanzania': 'east-africa',
    'Uganda': 'east-africa',
    'Rwanda': 'east-africa',
    'Mozambique': 'indian-ocean',
    'Seychelles': 'indian-ocean',
    'Maldives': 'indian-ocean',
    'Mauritius': 'indian-ocean',
  };
  const region = countryToRegion[s.country] || 'southern-africa';
  const netRate = Number(s.net_rate_per_night) || 25000;
  const displayRate = Number(s.display_rate_per_night) || Math.round(netRate * 1.15);
  const otaRate = s.ota_rate_per_night ? Number(s.ota_rate_per_night) : null;
  const marginScore = displayRate > 0 ? Math.round((displayRate - netRate) / displayRate * 100) : 20;
  return {
    id: s.id,
    name: s.name,
    // location shown in UI: use region column for specificity (e.g. "Sabi Sand Game Reserve, South Africa")
    location: s.region ? `${s.region}, ${s.country}` : `${s.destination || ''}, ${s.country}`.replace(/^, /, ''),
    // destination used for AI matching — exactly as stored in DB
    destination: s.destination || '',
    // region column (e.g. "Sabi Sand Game Reserve") used for sub-destination matching
    subRegion: s.region || '',
    region,
    country: s.country || '',
    stars: 5,
    trustScore: s.trust_score || 85,
    netRate,
    otaRate,
    marginScore,
    image: `https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80`,
    funFact: s.description ? s.description.slice(0, 120) : null,
    malariaFree: s.malaria_status === 'malaria-free',
    tags: s.tags || [],
    upgrades: {
      rooms: [{label:'Standard Suite',extra:0,tier:0},{label:'Premium Suite',extra:Math.round(netRate*0.4),tier:1}],
      basis: [{label:'All-inclusive',extra:0,tier:0}],
      flexibility: [{label:'Standard',extra:0,tier:0},{label:'Flexible',extra:Math.round(netRate*0.08),tier:1}],
    },
  };
}

// ─── DESTINATION MATCHER ─────────────────────────────────────
// Maps AI-generated city names to Supabase destination values
function matchDestination(cityName: string, country: string): (h: any) => boolean {
  const city = cityName.toLowerCase();
  const ctry = country.toLowerCase();

  // Explicit destination keyword map
  const destinationMap: Record<string, string> = {
    'sabi sand': 'Kruger / Sabi Sand',
    'singita sabi': 'Kruger / Sabi Sand',
    'kruger': 'Kruger / Sabi Sand',
    'sabi sands': 'Kruger / Sabi Sand',
    'londolozi': 'Kruger / Sabi Sand',
    'okavango': 'Okavango Delta',
    'okavango delta': 'Okavango Delta',
    'delta': 'Okavango Delta',
    'cape town': 'Cape Town',
    'cape': 'Cape Town',
    'madikwe': 'Madikwe',
    'victoria falls': 'Victoria Falls',
    'vic falls': 'Victoria Falls',
    'masai mara': 'Masai Mara',
    'mara': 'Masai Mara',
    'serengeti': 'Serengeti',
    'ngorongoro': 'Ngorongoro',
    'zanzibar': 'Zanzibar',
  };

  // Find matching destination string
  let targetDestination: string | null = null;
  for (const [keyword, dest] of Object.entries(destinationMap)) {
    if (city.includes(keyword)) { targetDestination = dest; break; }
  }

  return (h: any) => {
    // If we have a destination match, use it
    if (targetDestination) {
      const destMatch = h.destination?.toLowerCase() === targetDestination.toLowerCase();
      // For Botswana specifically, also filter by country to avoid SA/Botswana crossover
      if (targetDestination === 'Okavango Delta' && ctry.includes('botswana')) {
        return destMatch && h.country?.toLowerCase().includes('botswana');
      }
      return destMatch;
    }
    // Fallback: country match
    return h.country?.toLowerCase() === ctry;
  };
}

// ─── AVAILABILITY SYSTEM ──────────────────────────────────────────────────────
interface AvailOption{label:string;available:boolean;capacity_remaining?:number;rate_zar:number;display_rate_zar:number;meal_basis?:string;addons?:{label:string;extra_zar:number}[];external_ref?:string;}
interface AvailResult{supplier_id:string;check_in:string;available:boolean;options:AvailOption[];source:string;response_ms:number;}
interface AltDate{date:string;delta:number;}

const _cache=new Map<string,{r:AvailResult;ts:number}>();
function _cacheKey(id:string,date:string,nights:number,pax:number){return`${id}:${date}:${nights}:${pax}`;}
function _cached(id:string,date:string,nights:number,pax:number):AvailResult|null{
  const c=_cache.get(_cacheKey(id,date,nights,pax));
  return(c&&Date.now()-c.ts<300000)?c.r:null;
}
function _store(id:string,date:string,nights:number,pax:number,r:AvailResult){
  _cache.set(_cacheKey(id,date,nights,pax),{r,ts:Date.now()});
}
function addDays(iso:string,n:number):string{
  const d=new Date(iso);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);
}
async function fetchAvail(supplierId:string,checkIn:string,nights:number,pax:number,hotelNetRate:number):Promise<AvailResult>{
  const hit=_cached(supplierId,checkIn,nights,pax);if(hit)return hit;
  try{
    const resp=await fetch('/api/availability',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({supplier_id:supplierId,pillar:'hotel',check_in:checkIn,nights,pax_count:pax}),
      signal:AbortSignal.timeout(6000)});
    if(resp.ok){const d=await resp.json();if(d.success){_store(supplierId,checkIn,nights,pax,d.result);return d.result;}}
  }catch{}
  const seed=parseInt(supplierId.replace(/[^0-9]/g,'').slice(-2)||'50',10);
  const dayNum=new Date(checkIn).getDate();
  const available=(seed+dayNum)%5!==0;
  const r:AvailResult={
    supplier_id:supplierId,check_in:checkIn,available,
    options:available?[
      {label:'Standard Room',available:true,capacity_remaining:Math.floor((seed%3)+1),rate_zar:hotelNetRate,display_rate_zar:Math.round(hotelNetRate*1.15),meal_basis:'All-inclusive',addons:[{label:'Early check-in',extra_zar:1800}],external_ref:'DEMO_A'},
    ]:[],
    source:'demo',response_ms:120+seed*3,
  };
  _store(supplierId,checkIn,nights,pax,r);return r;
}
async function findAltDate(supplierId:string,checkIn:string,nights:number,pax:number,hotelNetRate:number):Promise<AltDate|null>{
  const offsets=[-1,1,-2,2,-3,3];
  for(const delta of offsets){
    const altDate=addDays(checkIn,delta);
    const r=await fetchAvail(supplierId,altDate,nights,pax,hotelNetRate);
    if(r.available)return{date:altDate,delta};
  }
  return null;
}
async function preloadAllHotels(hotels:any[],checkIn:string,nights:number,pax:number,onResult:(supplierId:string,r:AvailResult)=>void){
  const BATCH=4;
  for(let i=0;i<hotels.length;i+=BATCH){
    const batch=hotels.slice(i,i+BATCH);
    await Promise.allSettled(batch.map(async h=>{
      const r=await fetchAvail(String(h.id),checkIn,nights,pax,h.netRate);
      onResult(String(h.id),r);
    }));
  }
}

// ─── DESIGN TOKENS ────────────────────────────────────────────
const T = {
  bg:"#0a0a0a", bg2:"#111111", bg3:"#181818", surface:"#1e1e1e",
  border:"rgba(255,255,255,0.08)", borderGold:"rgba(212,175,55,0.3)",
  gold:"#d4af37", goldLight:"#f0c040", goldDim:"rgba(212,175,55,0.15)",
  text:"#f5f0e8", textMid:"rgba(245,240,232,0.6)", textDim:"rgba(245,240,232,0.35)",
  green:"#4ade80", red:"#f87171", amber:"#fb923c",
};

const BRAND = { name:"The Safari Edition", tagline:"Sub-Saharan Africa · Curated", showThemes:false };

const CURRENCIES = [
  {code:"ZAR",symbol:"R ",rate:1},{code:"USD",symbol:"$",rate:18.62},
  {code:"EUR",symbol:"€",rate:20.14},{code:"GBP",symbol:"£",rate:23.48},
];

const REGIONS = [
  {id:"southern-africa",label:"Southern Africa",icon:"🌍"},
  {id:"east-africa",label:"East Africa",icon:"🦒"},
  {id:"indian-ocean",label:"Indian Ocean",icon:"🌊"},
  {id:"inspire-me",label:"Inspire Me",icon:"✨"},
];

const THEMES = [
  {id:"safari",label:"Big Five Safari",icon:"🦁"},{id:"beach",label:"Beach & Coast",icon:"🏖️"},
  {id:"adventure",label:"Adventure",icon:"🧗"},{id:"romance",label:"Romance",icon:"💫"},
  {id:"family",label:"Family",icon:"👨‍👩‍👧"},{id:"culture",label:"Culture",icon:"🎭"},
  {id:"wellness",label:"Wellness",icon:"🧘"},{id:"luxury",label:"Ultra-Luxury",icon:"✨"},
];

const REGIONAL_ORIGINS = [
  {code:"JNB",label:"Johannesburg (O.R. Tambo)",flag:"🇿🇦"},
  {code:"CPT",label:"Cape Town",flag:"🇿🇦"},
  {code:"DUR",label:"Durban",flag:"🇿🇦"},
  {code:"HRE",label:"Harare",flag:"🇿🇼"},
  {code:"GBE",label:"Gaborone",flag:"🇧🇼"},
  {code:"NBO",label:"Nairobi",flag:"🇰🇪"},
];

const INTERNATIONAL_ORIGINS = [
  {code:"LHR",label:"London Heathrow",flag:"🇬🇧"},
  {code:"LGW",label:"London Gatwick",flag:"🇬🇧"},
  {code:"MAN",label:"Manchester",flag:"🇬🇧"},
  {code:"AMS",label:"Amsterdam",flag:"🇳🇱"},
  {code:"FRA",label:"Frankfurt",flag:"🇩🇪"},
  {code:"CDG",label:"Paris Charles de Gaulle",flag:"🇫🇷"},
  {code:"ZRH",label:"Zurich",flag:"🇨🇭"},
  {code:"DXB",label:"Dubai",flag:"🇦🇪"},
  {code:"DOH",label:"Doha",flag:"🇶🇦"},
  {code:"JFK",label:"New York (JFK)",flag:"🇺🇸"},
  {code:"EWR",label:"New York (Newark)",flag:"🇺🇸"},
  {code:"LAX",label:"Los Angeles",flag:"🇺🇸"},
  {code:"ORD",label:"Chicago O'Hare",flag:"🇺🇸"},
  {code:"SYD",label:"Sydney",flag:"🇦🇺"},
  {code:"MEL",label:"Melbourne",flag:"🇦🇺"},
  {code:"SIN",label:"Singapore",flag:"🇸🇬"},
  {code:"HKG",label:"Hong Kong",flag:"🇭🇰"},
  {code:"MUM",label:"Mumbai",flag:"🇮🇳"},
];

const INTL_FLIGHTS = [
  {id:"LHR-JNB",from:"LHR",to:"JNB",airline:"British Airways",duration:"11h 20m",netRate:9800,otaRate:14200,image:"https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80",upgrades:{classes:[{label:"Economy",extra:0},{label:"Premium Economy",extra:8500},{label:"Business Class",extra:32000}],baggage:[{label:"23kg included",extra:0},{label:"Extra 23kg",extra:650}]}},
  {id:"LHR-JNB-VA",from:"LHR",to:"JNB",airline:"Virgin Atlantic",duration:"11h 35m",netRate:8900,otaRate:12800,image:"https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80",upgrades:{classes:[{label:"Economy",extra:0},{label:"Premium",extra:7200},{label:"Upper Class",extra:38000}],baggage:[{label:"23kg included",extra:0},{label:"Extra 23kg",extra:580}]}},
  {id:"AMS-JNB",from:"AMS",to:"JNB",airline:"KLM",duration:"11h 05m",netRate:8200,otaRate:11500,image:"https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?w=800&q=80",upgrades:{classes:[{label:"Economy",extra:0},{label:"World Business",extra:28000}],baggage:[{label:"23kg included",extra:0},{label:"Extra 23kg",extra:600}]}},
  {id:"DXB-JNB",from:"DXB",to:"JNB",airline:"Emirates",duration:"8h 45m",netRate:7400,otaRate:10800,image:"https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=800&q=80",upgrades:{classes:[{label:"Economy",extra:0},{label:"Business Class",extra:24000}],baggage:[{label:"30kg included",extra:0},{label:"Extra 23kg",extra:520}]}},
  {id:"JFK-JNB",from:"JFK",to:"JNB",airline:"South African Airways",duration:"15h 30m",netRate:11200,otaRate:16500,image:"https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&q=80",upgrades:{classes:[{label:"Economy",extra:0},{label:"Business Class",extra:38000}],baggage:[{label:"23kg included",extra:0},{label:"Extra 23kg",extra:680}]}},
  {id:"SYD-JNB",from:"SYD",to:"JNB",airline:"Qantas via DXB",duration:"20h 10m",netRate:13800,otaRate:20500,image:"https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80",upgrades:{classes:[{label:"Economy",extra:0},{label:"Business",extra:42000}],baggage:[{label:"23kg included",extra:0}]}},
];

const FLIGHTS = [
  {id:1,airline:"Federal Airlines",code:"FA",route:"JNB → Skukuza",departure:"07:30",arrival:"08:25",duration:"55 min",type:"charter",trustScore:94,netRate:3800,otaRate:null,image:"https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?w=800&q=80",funFact:"55 minutes vs 5+ hours by road — the only sensible way in.",upgrades:{classes:[{label:"Standard seat",extra:0},{label:"Forward seats",extra:400}],baggage:[{label:"15kg included",extra:0},{label:"Extra 15kg",extra:580}]}},
  {id:2,airline:"FlySafair + Road Transfer",code:"FS",route:"JNB → Nelspruit + transfer",departure:"06:00",arrival:"10:30",duration:"4h 30m",type:"commercial",trustScore:88,netRate:2200,otaRate:2650,image:"https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80",funFact:"Budget option — scenic 2hr drive through the lowveld included.",upgrades:{classes:[{label:"Economy",extra:0},{label:"Premium Economy",extra:1200}],baggage:[{label:"Hand luggage only",extra:0},{label:"20kg checked bag",extra:380}]}},
  {id:3,airline:"SAA + Airlink",code:"SA",route:"JNB → Hoedspruit",departure:"09:00",arrival:"11:30",duration:"2h 30m",type:"commercial",trustScore:85,netRate:4200,otaRate:5800,image:"https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80",funFact:"Direct Airlink connection into Hoedspruit.",upgrades:{classes:[{label:"Economy",extra:0},{label:"Business Class",extra:6500}],baggage:[{label:"23kg included",extra:0},{label:"Extra 23kg",extra:420}]}},
  {id:4,airline:"Kenya Airways",code:"KQ",route:"JNB → Nairobi (NBO)",departure:"08:45",arrival:"13:15",duration:"4h 30m",type:"commercial",trustScore:86,netRate:7800,otaRate:10200,image:"https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=800&q=80",funFact:"Direct to Nairobi — connect to any Mara camp in under 2 hours.",upgrades:{classes:[{label:"Economy",extra:0},{label:"Business Class",extra:8400}],baggage:[{label:"23kg included",extra:0},{label:"Extra 23kg",extra:480}]}},
  {id:5,airline:"LAM Mozambique",code:"TM",route:"JNB → Vilanculos",departure:"10:00",arrival:"11:45",duration:"1h 45m",type:"commercial",trustScore:82,netRate:3200,otaRate:null,image:"https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&q=80",funFact:"Vilanculos is the gateway to Bazaruto — speedboat 20 min from the airstrip.",upgrades:{classes:[{label:"Economy",extra:0}],baggage:[{label:"15kg included",extra:0},{label:"Extra 15kg",extra:320}]}},
];

const MARGINS={flights:1.08,hotels:1.15,transfers:1.20,activities:1.18,intl:1.08};
const SECTION_LABELS:Record<string,string>={rooms:"Room type",basis:"Meal basis",flexibility:"Cancellation",classes:"Cabin class",baggage:"Baggage",vehicles:"Vehicle",extras:"Add-ons",options:"Option"};

// ─── FALLBACK HOTELS (used if Supabase unavailable) ──────────
const HOTELS_FALLBACK = [
  {id:1,name:"Singita Sabi Sand",location:"Sabi Sand Game Reserve, South Africa",region:"southern-africa",country:"South Africa",destination:"Sabi Sand",stars:5,trustScore:99,netRate:56000,otaRate:76000,marginScore:27,malariaFree:false,tags:[],image:"https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80",funFact:"Singita means 'place of miracles' — highest leopard density in Africa.",upgrades:{rooms:[{label:"Luxury Suite",extra:0,tier:0},{label:"Private Villa",extra:89000,tier:1}],basis:[{label:"All-inclusive",extra:0,tier:0}],flexibility:[{label:"Standard",extra:0,tier:0},{label:"Flexible (+14 days)",extra:4200,tier:1}]}},
  {id:2,name:"Royal Malewane",location:"Greater Kruger, South Africa",region:"southern-africa",country:"South Africa",destination:"Kruger",stars:5,trustScore:97,netRate:48000,otaRate:67000,marginScore:28,malariaFree:false,tags:[],image:"https://images.unsplash.com/photo-1500491460312-c32fc2dbc751?w=800&q=80",funFact:"Two of the world's top-rated safari rangers call Royal Malewane home.",upgrades:{rooms:[{label:"Suite",extra:0,tier:0},{label:"Africa House",extra:120000,tier:1}],basis:[{label:"All-inclusive",extra:0,tier:0}],flexibility:[{label:"Standard",extra:0,tier:0},{label:"Flexible",extra:3800,tier:1}]}},
  {id:3,name:"Wilderness Mombo",location:"Okavango Delta, Botswana",region:"southern-africa",country:"Botswana",destination:"Okavango",stars:5,trustScore:98,netRate:62000,otaRate:88000,marginScore:30,malariaFree:false,tags:[],image:"https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80",funFact:"Mombo is known as the place of plenty — the highest predator density in the Delta.",upgrades:{rooms:[{label:"Luxury Tent",extra:0,tier:0},{label:"Family Tent",extra:18000,tier:1}],basis:[{label:"All-inclusive",extra:0,tier:0}],flexibility:[{label:"Standard",extra:0,tier:0},{label:"Flexible",extra:3200,tier:1}]}},
  {id:4,name:"Matetsi Victoria Falls",location:"Victoria Falls, Zimbabwe",region:"southern-africa",country:"Zimbabwe",destination:"Victoria Falls",stars:5,trustScore:96,netRate:38000,otaRate:54000,marginScore:30,malariaFree:false,tags:[],image:"https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",funFact:"Private 26km stretch of the Zambezi — no other camps in sight.",upgrades:{rooms:[{label:"River Suite",extra:0,tier:0},{label:"Private Villa",extra:45000,tier:1}],basis:[{label:"All-inclusive",extra:0,tier:0}],flexibility:[{label:"Standard",extra:0,tier:0},{label:"Flexible",extra:3200,tier:1}]}},
  {id:5,name:"Madikwe Safari Lodge",location:"Madikwe Game Reserve, South Africa",region:"southern-africa",country:"South Africa",destination:"Madikwe",stars:5,trustScore:93,netRate:28000,otaRate:38500,marginScore:27,malariaFree:true,tags:["malaria-free","family-friendly"],image:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80",funFact:"Madikwe is SA's fourth-largest reserve — malaria-free, 3 hours from Johannesburg.",upgrades:{rooms:[{label:"Classic Suite",extra:0,tier:0},{label:"Private Suite",extra:12000,tier:1}],basis:[{label:"All-inclusive",extra:0,tier:0}],flexibility:[{label:"Standard",extra:0,tier:0},{label:"Flexible",extra:2200,tier:1}]}},
  {id:6,name:"Mara Plains Camp",location:"Olare Motorogi Conservancy, Kenya",region:"east-africa",country:"Kenya",destination:"Masai Mara",stars:5,trustScore:96,netRate:42000,otaRate:58000,marginScore:28,malariaFree:false,tags:[],image:"https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=800&q=80",funFact:"Only 8 tents — the Mara at its most intimate. Peak migration July–October.",upgrades:{rooms:[{label:"Classic Tent",extra:0,tier:0},{label:"Family Tent",extra:18000,tier:1}],basis:[{label:"All-inclusive",extra:0,tier:0}],flexibility:[{label:"Standard",extra:0,tier:0},{label:"Flexible",extra:3200,tier:1}]}},
  {id:7,name:"Ngorongoro Crater Lodge",location:"Ngorongoro Crater, Tanzania",region:"east-africa",country:"Tanzania",destination:"Ngorongoro",stars:5,trustScore:94,netRate:38000,otaRate:54000,marginScore:30,malariaFree:false,tags:[],image:"https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&q=80",funFact:"The world's largest intact volcanic caldera — 25,000 animals.",upgrades:{rooms:[{label:"Forest Suite",extra:0,tier:0},{label:"Tree Suite",extra:22000,tier:1}],basis:[{label:"All-inclusive",extra:0,tier:0}],flexibility:[{label:"Standard",extra:0,tier:0},{label:"Flexible",extra:3400,tier:1}]}},
  {id:8,name:"Azura Bazaruto",location:"Bazaruto Archipelago, Mozambique",region:"indian-ocean",country:"Mozambique",destination:"Bazaruto",stars:5,trustScore:92,netRate:22000,otaRate:32000,marginScore:31,malariaFree:false,tags:[],image:"https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&q=80",funFact:"Bazaruto is home to the last viable population of dugongs in the Indian Ocean.",upgrades:{rooms:[{label:"Beach Villa",extra:0,tier:0},{label:"Ocean Villa",extra:14000,tier:1}],basis:[{label:"All-inclusive",extra:0,tier:0}],flexibility:[{label:"Standard",extra:0,tier:0},{label:"Flexible",extra:2400,tier:1}]}},
];
// HOTELS and HOTELS_BY_MARGIN are set dynamically — see useEffect in main component
let HOTELS = [...HOTELS_FALLBACK];
let HOTELS_BY_MARGIN = [...HOTELS].sort((a,b)=>b.marginScore-a.marginScore);

const INTER_TRANSFERS=[
  {id:"road-sa",label:"Road transfer",icon:"🚗",desc:"Private vehicle between SA properties",applicableRegions:[["southern-africa","southern-africa"]],netRate:1800,otaRate:2600,duration:"2–4 hrs",note:"Comfortable private SUV with refreshments en route."},
  {id:"charter-sa-sa",label:"Federal Air charter",icon:"✈",desc:"Bush charter between SA reserves",applicableRegions:[["southern-africa","southern-africa"]],netRate:6200,otaRate:null,duration:"45–75 min",note:"Fastest way between reserves — spectacular aerial views."},
  {id:"charter-sa-ea",label:"International charter",icon:"✈",desc:"SA ↔ East Africa connection",applicableRegions:[["southern-africa","east-africa"],["east-africa","southern-africa"]],netRate:9800,otaRate:13500,duration:"3–5 hrs",note:"Seamless connection — we handle all logistics."},
  {id:"charter-sa-io",label:"Indian Ocean connection",icon:"🛥",desc:"Flight + boat to island destinations",applicableRegions:[["southern-africa","indian-ocean"],["indian-ocean","southern-africa"],["east-africa","indian-ocean"],["indian-ocean","east-africa"]],netRate:7400,otaRate:null,duration:"2–3 hrs",note:"Light aircraft to Vilanculos, then speedboat to the island."},
  {id:"charter-ea-ea",label:"East Africa charter",icon:"✈",desc:"Bush charter within East Africa",applicableRegions:[["east-africa","east-africa"]],netRate:5800,otaRate:null,duration:"30–90 min",note:"Fly between camps — skip the roads entirely."},
];
function getInterTransfer(regionA:string,regionB:string){return INTER_TRANSFERS.find(t=>t.applicableRegions.some(([a,b])=>a===regionA&&b===regionB))||INTER_TRANSFERS[0];}

const TRANSFERS=[
  {id:2,type:"Private Game Drive Transfer",vehicle:"Private Land Cruiser + guide",capacity:"Private",duration:"Per request",trustScore:96,netRate:3200,otaRate:4500,image:"https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",funFact:"Your own vehicle — stop when you want, stay as long as you like.",upgrades:{vehicles:[{label:"Private Land Cruiser",extra:0},{label:"Specialist walking guide",extra:1800}],extras:[{label:"Standard",extra:0},{label:"Sundowner setup",extra:650}]}},
  {id:3,type:"Private Airport Transfer",vehicle:"Private SUV",capacity:"1–5 pax",duration:"45–90 min",trustScore:91,netRate:980,otaRate:1350,image:"https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",funFact:"Airstrip to lodge — game visible immediately.",upgrades:{vehicles:[{label:"Private SUV",extra:0},{label:"Luxury V-Class",extra:900}],extras:[{label:"Standard",extra:0},{label:"Meet & greet",extra:180}]}},
  {id:4,type:"Helicopter Transfer",vehicle:"Robinson R44 or similar",capacity:"1–3 pax",duration:"20–45 min",trustScore:96,netRate:8500,otaRate:null,image:"https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",funFact:"Arrive in style — aerial views of the bush before you even land.",upgrades:{vehicles:[{label:"Shared helicopter",extra:0},{label:"Private charter",extra:6500}],extras:[{label:"Standard",extra:0},{label:"Champagne on arrival",extra:480}]}},
];

const ACTIVITIES=[
  {id:1,name:"Full-Day Big Five Game Drive",type:"Safari",duration:"Full day · 05:30–19:00",trustScore:99,netRate:0,otaRate:null,image:"https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80",funFact:"Dawn and dusk — when predators are most active.",upgrades:{options:[{label:"Included in lodge rate",extra:0}],extras:[{label:"Standard",extra:0},{label:"Private vehicle",extra:4200}]}},
  {id:2,name:"Bush Walk with Armed Ranger",type:"Adventure",duration:"3 hours · dawn",trustScore:97,netRate:1800,otaRate:2600,image:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80",funFact:"See the bush at ground level — tracks, plants, the detail you miss from a vehicle.",upgrades:{options:[{label:"Group walk",extra:0},{label:"Private walk",extra:2400}],extras:[{label:"Standard",extra:0},{label:"Breakfast in the bush",extra:680}]}},
  {id:3,name:"Hot Air Balloon Safari",type:"Luxury",duration:"3 hours · dawn",trustScore:94,netRate:4800,otaRate:7200,image:"https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",funFact:"The Mara from above during the Great Migration — one of the great experiences on Earth.",upgrades:{options:[{label:"Shared basket",extra:0},{label:"Private basket",extra:8500}],extras:[{label:"Champagne breakfast",extra:0},{label:"Private bush breakfast",extra:1200}]}},
  {id:4,name:"Night Drive & Spotlight Safari",type:"Wildlife",duration:"2.5 hours · 20:00",trustScore:95,netRate:1200,otaRate:1800,image:"https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=800&q=80",funFact:"Leopards, civets, honey badgers — the nocturnal world is entirely different.",upgrades:{options:[{label:"Group drive",extra:0},{label:"Private drive",extra:2800}],extras:[{label:"Standard",extra:0},{label:"Add sundowners",extra:480}]}},
  {id:5,name:"Victoria Falls Helicopter",type:"Scenic",duration:"15 min 'Flight of Angels'",trustScore:96,netRate:2800,otaRate:4200,image:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80",funFact:"The only way to truly comprehend the scale — 108m high, 1.7km wide.",upgrades:{options:[{label:"15-minute flight",extra:0},{label:"30-minute flight",extra:2200}],extras:[{label:"Standard",extra:0},{label:"Private helicopter",extra:5800}]}},
  {id:6,name:"Rhino Tracking on Foot",type:"Conservation",duration:"Half day",trustScore:93,netRate:2200,otaRate:3200,image:"https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80",funFact:"One of only a handful of experiences where you can approach white rhino on foot.",upgrades:{options:[{label:"Group tracking",extra:0},{label:"Private with conservationist",extra:3400}],extras:[{label:"Standard",extra:0},{label:"Full conservation day",extra:4800}]}},
];

type KBEntry={id:string;type:"regional"|"property"|"trade_tip";title:string;linkedTo:string;structuredFields:Record<string,string>;specialistNotes:string;active:boolean;};
const DEFAULT_KB:KBEntry[]=[
  {id:"kb1",type:"regional",title:"South Africa — Safari Specialist Notes",linkedTo:"southern-africa",structuredFields:{best_season:"June–October (dry season) for Big Five. Avoid Dec–Feb heat. September is optimal.",malaria_zones:"Sabi Sand and Kruger are malaria areas. Use prophylactics. Madikwe and Phinda are malaria-free.",visa_requirements:"Most nationalities get 90-day visa on arrival. Exceptions: apply in advance.",flight_connections:"Federal Airlines is the preferred carrier into Skukuza. Book at least 6 weeks ahead in peak season.",currency_tips:"ZAR. USD/EUR accepted at most lodges. Tipping: R50–R100/day/guest to ranger/tracker.",packing_essentials:"Neutral colours only. Layers for cold mornings. No white or bright colours."},specialistNotes:"Singita Sabi Sand and Royal Malewane are our top-margin properties in this region. Always lead with these. Guests from UK/EU almost always fly via JNB — build in one night JNB if arriving on an overnight flight. Federal Air Skukuza slots fill fast July/August — confirm before finalising.",active:true},
  {id:"kb2",type:"property",title:"Singita Sabi Sand — Booking Notes",linkedTo:"Singita Sabi Sand",structuredFields:{check_in:"14:00 standard. 11:00 early check-in available at R1,800/room.",check_out:"10:00 standard. Late checkout 14:00 at R1,800/room.",minimum_stay:"3 nights minimum. Peak season (Jul–Sep): 4 nights.",children_policy:"Children 10+ welcome in main camp. Under 10 in family suites only.",dietary:"Excellent dietary accommodation — advise at booking.",game_drives:"Two per day included: 05:30 and 15:30. Night drives available on request.",unique_feature:"Leopard viewing is exceptional — property records among highest leopard sightings in Africa."},specialistNotes:"Always request Boulders suite for honeymoon/romance guests — private deck, plunge pool, best views. Our negotiated rate is 27% below Booking.com. Group bookings of 6+ qualify for 10% group discount. Federal Air morning charter (07:30 JNB) connects perfectly with check-in.",active:true},
  {id:"kb3",type:"property",title:"Madikwe Safari Lodge — Booking Notes",linkedTo:"Madikwe Safari Lodge",structuredFields:{check_in:"12:00 (early arrival, game drive from airport).",check_out:"10:00.",minimum_stay:"2 nights minimum.",children_policy:"Malaria-free — excellent for families. Children 6+ on game drives.",road_access:"3.5 hours from Johannesburg on good tarred road.",unique_feature:"Wild dog sightings — Madikwe has one of the largest wild dog populations in SA."},specialistNotes:"Best-value entry point for budget-conscious guests wanting Big Five without malaria risk. Wild dog is the USP — mention this to guests who have done standard Big Five before.",active:true},
  {id:"kb4",type:"trade_tip",title:"Charter Flights — General Booking Tips",linkedTo:"flights",structuredFields:{federal_air:"Book Federal Air minimum 6 weeks ahead in high season (Jul–Sep). Weight limit 20kg soft bag only.",baggage_rules:"ALL bush charter carriers: 20kg total in a soft bag. No exceptions. Advise guests firmly.",booking_process:"We book directly with Federal Air via our trade account. Confirm 72hrs before departure.",cancellation:"Federal Air: 72hr cancellation policy. Full charge within 72hrs."},specialistNotes:"Federal Air is our preferred partner for Skukuza, Eastgate, and Hoedspruit. Never book guests on LAM Mozambique domestic without reconfirming slot 48hrs ahead — they have a cancellation pattern.",active:true},
];

const CURATED_JOURNEYS=[
  {id:"sabi-classic",name:"The Sabi Sand Classic",tagline:"South Africa's finest leopard territory",nights:5,pax:2,image:"https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80",badge:"Most popular",badgeColor:T.gold,includes:["Return Federal Air charter JNB→Skukuza","5 nights Singita Sabi Sand","All-inclusive","All game drives & walks","All transfers"],priceFrom:142000,otaEquivalent:192000},
  {id:"grand-circuit",name:"The Grand Safari Circuit",tagline:"Two countries. Three ecosystems.",nights:9,pax:2,image:"https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80",badge:"Signature journey",badgeColor:"#a78bfa",includes:["All charter flights","3n Singita Sabi Sand","3n Ngorongoro Crater Lodge","3n Mara Plains Camp","All-inclusive throughout"],priceFrom:298000,otaEquivalent:412000},
  {id:"vic-falls-combo",name:"Kruger & Victoria Falls",tagline:"Big Five then one of the Seven Wonders",nights:7,pax:2,image:"https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",badge:"Classic combo",badgeColor:"#4ade80",includes:["Return flights JNB","4n Royal Malewane","Charter to Vic Falls","3n Victoria Falls Hotel","All-inclusive at Malewane"],priceFrom:198000,otaEquivalent:272000},
  {id:"island-finish",name:"Safari & Indian Ocean Finale",tagline:"Bush then beach — the perfect combination",nights:8,pax:2,image:"https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&q=80",badge:"Our favourite",badgeColor:"#60a5fa",includes:["All flights & transfers","4n AndBeyond Phinda","4n Azura Bazaruto","All-inclusive throughout","Speedboat transfers"],priceFrom:224000,otaEquivalent:316000},
];

const SPECIALISTS=[
  {name:"Sarah Mitchell",role:"Senior Safari Specialist",avatar:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80",tip:"June–August is peak season — book 6 months ahead for Sabi Sand.",instagram:"@sarahsafaris",quote:"Every great safari starts with the right lodge in the right season.",trips:247},
  {name:"James Okonkwo",role:"East Africa Specialist",avatar:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80",tip:"The Great Migration crosses the Mara River July–October. Don't miss it.",instagram:"@jamesonsafari",quote:"Kenya and Tanzania together is the ultimate safari combination.",trips:183},
  {name:"Priya Naidoo",role:"Indian Ocean & Islands Specialist",avatar:"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80",tip:"Combine 4 nights bush with 4 nights beach — the perfect balance.",instagram:"@priyatravels",quote:"The best safaris end on an island.",trips:156},
];

type Pillar="flights"|"hotels"|"transfers"|"activities";
type Screen="landing"|"inspire-input"|"inspire-research"|"inspire-plan"|"builder"|"knowledge-base"|"curated"|"my-brief";
type PropertyStay={id:number;hotelIdx:number;nights:number;prefs:Record<string,number>;};
type InterTransferState={transferId:string;expanded:boolean;};

const RESEARCH_STEPS=["Reviewing seasonal conditions and migration patterns...","Checking lodge availability across the region...","Finding the best charter connections...","Comparing lodge rates and margin opportunities...","Optimising your itinerary sequence...","Identifying time gaps for bonus experiences...","Putting your personalised journey together..."];

// ─── MY BRIEF SCREEN ─────────────────────────────────────────
function MsBriefScreen({nights,setNights,adults,setAdults,children,setChildren,currency,onBack,onBuild}:{
  nights:number;setNights:(n:number)=>void;
  adults:number;setAdults:(n:number)=>void;
  children:number;setChildren:(n:number)=>void;
  currency:any;onBack:()=>void;
  onBuild:(briefText:string)=>void;
}){
  const [brief,setBrief]=useState("");
  const [budget,setBudget]=useState(0);
  const [showBudget,setShowBudget]=useState(false);
  const maxLen=1000;
  const T2={bg:"#0a0a0a",surface:"#1e1e1e",gold:"#d4af37",goldDim:"rgba(212,175,55,0.15)",borderGold:"rgba(212,175,55,0.3)",text:"#f5f0e8",textMid:"rgba(245,240,232,0.6)",textDim:"rgba(245,240,232,0.35)",border:"rgba(255,255,255,0.08)",green:"#4ade80"};
  const ready=brief.trim().length>=30;
  const hasBudget=/R\s?\d|budget|afford|spend|cost/i.test(brief);
  const hasDestination=/sabi|kruger|okavango|botswana|kenya|tanzania|zimbabwe|zambia|south africa|victoria falls|mara|serengeti|rwanda|uganda/i.test(brief);
  const hasTheme=/honeymoon|anniversary|family|romantic|adventure|conserv|wildlife|beach|culture|gorilla|balloon|dive|snorkel/i.test(brief);
  const hasDate=/january|february|march|april|may|june|july|august|september|october|november|december|summer|winter|christmas|easter|school holiday/i.test(brief);
  const PROMPTS=[
    "I'd love a honeymoon in the Okavango — something very private, not a group experience. We like great food and don't need to be up at 5am every day.",
    "Looking for a 10-day family safari with kids aged 8 and 12. Malaria-free preferred. Budget around R250,000.",
    "We've done Kenya twice. Want to explore southern Africa — Zimbabwe, Zambia, maybe Botswana. Something that feels off the beaten track.",
    "First safari. Two of us. No idea where to go but we want the Big Five and a wow moment. Happy to spend what it takes.",
  ];
  return(
    <div style={{minHeight:"100vh",background:T2.bg,fontFamily:"Arial,sans-serif",color:T2.text}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet"/>
      <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(10,10,10,0.96)",backdropFilter:"blur(16px)",borderBottom:`0.5px solid ${T2.border}`,padding:"0 20px"}}>
        <div style={{maxWidth:760,margin:"0 auto",height:58,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={onBack} style={{background:"transparent",border:`0.5px solid ${T2.border}`,color:T2.textDim,borderRadius:8,padding:"7px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:T2.gold,fontWeight:700,letterSpacing:"0.08em"}}>✦ The Safari Edition</div>
          <div style={{width:80}}/>
        </div>
      </nav>
      <div style={{maxWidth:760,margin:"0 auto",padding:"48px 20px"}}>
        <div style={{marginBottom:36,textAlign:"center"}}>
          <div style={{fontSize:10,color:T2.gold,letterSpacing:"0.2em",textTransform:"uppercase",fontWeight:600,marginBottom:10}}>Your Inspiration</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(26px,4vw,40px)",fontWeight:700,color:T2.text,margin:"0 0 14px"}}>Give us your inspiration.</h1>
          <p style={{fontSize:15,color:T2.textMid,lineHeight:1.7,maxWidth:520,margin:"0 auto"}}>Write freely — a dream destination, a mood, a special occasion, must-haves, even things to avoid. Our AI reads between the lines and builds around you.</p>
        </div>
        <div style={{position:"relative",marginBottom:16}}>
          <textarea value={brief} onChange={e=>setBrief(e.target.value.slice(0,maxLen))} placeholder="e.g. We're celebrating our 20th anniversary. We've always wanted to see the Okavango from the air and spend time somewhere very private — not a big camp. We don't need five-star food, just the wilderness. Two of us. Happy to travel in June or July..." rows={9} style={{width:"100%",background:T2.surface,border:`1.5px solid ${brief.length>0?T2.borderGold:T2.border}`,borderRadius:14,padding:"18px 20px",fontSize:14,color:T2.text,resize:"vertical",outline:"none",fontFamily:"'DM Sans',Arial,sans-serif",lineHeight:1.7,boxSizing:"border-box"}}/>
          <div style={{position:"absolute",bottom:12,right:16,fontSize:11,color:T2.textDim}}>{brief.length}/{maxLen}</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
          {[{label:"Destination",detected:hasDestination,hint:"Where in Africa?"},{label:"Theme / occasion",detected:hasTheme,hint:"What kind of trip?"},{label:"Travel dates",detected:hasDate,hint:"When are you travelling?"},{label:"Budget",detected:hasBudget||showBudget,hint:"What's your budget?"}].map(tag=>(
            <div key={tag.label} onClick={()=>{if(tag.label==="Budget")setShowBudget(s=>!s);}} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,border:`0.5px solid ${tag.detected?T2.borderGold:T2.border}`,background:tag.detected?T2.goldDim:"transparent",cursor:tag.label==="Budget"?"pointer":"default",fontSize:12,color:tag.detected?T2.gold:T2.textDim}}>
              <span>{tag.detected?"✓":"·"}</span>{tag.detected?tag.label:tag.hint}
            </div>
          ))}
        </div>
        {(showBudget||hasBudget)&&!hasBudget&&(
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,padding:"14px 18px",background:T2.surface,borderRadius:12,border:`0.5px solid ${T2.border}`}}>
            <div style={{fontSize:12,color:T2.textMid,flexShrink:0}}>Approximate budget (ZAR)</div>
            <input type="number" value={budget||""} onChange={e=>setBudget(Number(e.target.value))} placeholder="e.g. 200000" style={{flex:1,background:"transparent",border:`0.5px solid ${T2.border}`,borderRadius:8,padding:"8px 12px",color:T2.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:28}}>
          {[{label:"Nights",value:nights,options:[5,7,10,12,14,21],onChange:(v:number)=>setNights(v)},{label:"Adults",value:adults,options:[1,2,3,4,6,8],onChange:(v:number)=>setAdults(v)},{label:"Children",value:children,options:[0,1,2,3,4],onChange:(v:number)=>setChildren(v)}].map(p=>(
            <div key={p.label} style={{background:T2.surface,border:`0.5px solid ${T2.border}`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:10,color:T2.textDim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{p.label}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {p.options.map(o=>(
                  <button key={o} onClick={()=>p.onChange(o)} style={{padding:"5px 10px",borderRadius:8,border:`0.5px solid ${p.value===o?T2.borderGold:T2.border}`,background:p.value===o?T2.goldDim:"transparent",color:p.value===o?T2.gold:T2.textDim,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    {o}{p.label==="Nights"?"n":p.label==="Children"&&o===0?"none":""}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {brief.length<10&&(
          <div style={{marginBottom:28}}>
            <div style={{fontSize:11,color:T2.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Examples — tap to use</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {PROMPTS.map((p,i)=>(
                <button key={i} onClick={()=>setBrief(p)} style={{textAlign:"left",padding:"12px 16px",background:T2.surface,border:`0.5px solid ${T2.border}`,borderRadius:10,color:T2.textMid,fontSize:13,cursor:"pointer",fontFamily:"inherit",lineHeight:1.5}}>"{p}"</button>
              ))}
            </div>
          </div>
        )}
        <button onClick={()=>{if(ready)onBuild(brief+(budget>0&&!hasBudget?`. Budget: R${budget.toLocaleString()}.`:"")+(nights>0?` Trip length: ${nights} nights.`:"")+(adults>0?` Travellers: ${adults} adults${children>0?`, ${children} children`:""}. `:""));}} disabled={!ready} style={{width:"100%",padding:"18px",background:ready?`linear-gradient(135deg,${T2.gold},#f0c040)`:"rgba(255,255,255,0.06)",border:"none",borderRadius:12,color:ready?"#0a0a0a":T2.textDim,fontSize:16,fontWeight:700,cursor:ready?"pointer":"not-allowed",fontFamily:"inherit"}}>
          {ready?"✦ Build My Journey →":`Write at least ${30-brief.trim().length} more characters to continue`}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
export default function SafariEdition(){
  const [screen,setScreen]=useState<Screen>("landing");
  const [showEditions,setShowEditions]=useState(false);
  // Fixed per session — not re-randomised on every render
  const [specialist]=useState(()=>SPECIALISTS[Math.floor(Math.random()*SPECIALISTS.length)]||SPECIALISTS[0]);
  const [currency,setCurrency]=useState(CURRENCIES[0]);
  const [chatOpen,setChatOpen]=useState(false);
  const [nights,setNights]=useState(7);
  const [travelDate,setTravelDate]=useState('');
  const [flexDays,setFlexDays]=useState(3);
  const [adults,setAdults]=useState(2);
  const [children,setChildren]=useState(0);
  const [inspiresAnswers,setInspiresAnswers]=useState<Record<string,string>>({});
  const [origin,setOrigin]=useState("JNB");
  const [intlOrigin,setIntlOrigin]=useState("LHR");
  const [needsIntlFlight,setNeedsIntlFlight]=useState<boolean|null>(null);
  const [region,setRegion]=useState<string|null>(null);
  const [themes,setThemes]=useState<string[]>([]);
  const [budget,setBudget]=useState(120000);
  const [researchStep,setResearchStep]=useState(0);
  const [itinerary,setItinerary]=useState<any>(null);
  const [inspireChatMsgs,setInspireChatMsgs]=useState<{role:string,text:string,revert?:any}[]>([]);
  const [inspireChatInput,setInspireChatInput]=useState("");
  const [inspireChatLoading,setInspireChatLoading]=useState(false);
  const [cityHotelIdxs,setCityHotelIdxs]=useState<number[]>([0,1,2]);
  const [cityTransferIdxs,setCityTransferIdxs]=useState<number[]>([0,0,0,0]);
  const [kbEntries,setKbEntries]=useState<KBEntry[]>(DEFAULT_KB);
  const [kbSelected,setKbSelected]=useState<string[]>(["kb1","kb2","kb4"]);
  const [kbShowSelector,setKbShowSelector]=useState(false);
  const [kbEditEntry,setKbEditEntry]=useState<KBEntry|null>(null);
  const [kbNewEntry,setKbNewEntry]=useState(false);
  const [activePillars,setActivePillars]=useState<Pillar[]>([]);
  const [propertyStays,setPropertyStays]=useState<PropertyStay[]>([{id:1,hotelIdx:0,nights:7,prefs:{rooms:0,basis:0,flexibility:0}}]);
  const [interTransfers,setInterTransfers]=useState<InterTransferState[]>([]);
  const [flightIdx,setFlightIdx]=useState(0);
  const [intlFlightIdx,setIntlFlightIdx]=useState(0);
  const [transferIdx,setTransferIdx]=useState(0);
  const [activityIdx,setActivityIdx]=useState(0);
  const [includeIntlFlight,setIncludeIntlFlight]=useState(false);
  const [builderIntlOrigin,setBuilderIntlOrigin]=useState("LHR");
  const [upgrades,setUpgrades]=useState<Record<string,any>>({
    flights:{classes:{label:"Standard seat",extra:0},baggage:{label:"15kg included",extra:0}},
    intl:{classes:{label:"Economy",extra:0},baggage:{label:"23kg included",extra:0}},
    transfers:{vehicles:{label:"Included in lodge rate",extra:0},extras:{label:"Standard",extra:0}},
    activities:{options:{label:"Included in lodge rate",extra:0},extras:{label:"Standard",extra:0}},
  });
  const [customise,setCustomise]=useState<{pillar:Pillar|"intl";stayId?:number;idx:number}|null>(null);
  const [availMap,setAvailMap]=useState<Map<string,AvailResult>>(new Map());
  const [altDates,setAltDates]=useState<Map<string,AltDate|null>>(new Map());
  const [preloading,setPreloading]=useState(false);
  const [checkinDate,setCheckinDate]=useState<string>(()=>addDays(new Date().toISOString().slice(0,10),30));
  const availableHotelStack=HOTELS_BY_MARGIN.filter(h=>{
    const r=availMap.get(String(h.id));
    if(!r)return true;
    if(r.available)return true;
    return altDates.get(String(h.id))!==null;
  });
  const [chatMsgs,setChatMsgs]=useState<{role:string,text:string}[]>([{role:"assistant",text:"Welcome to The Safari Edition. How can our team help? We're here for questions about destinations, lodges, timing, or to help build your perfect journey."}]);
  const [chatInput,setChatInput]=useState("");
  const [chatLoading,setChatLoading]=useState(false);
  const chatEndRef=useRef<HTMLDivElement>(null);
  const inspireChatEndRef=useRef<HTMLDivElement>(null);

  const [suppliersLoaded,setSuppliersLoaded]=useState(false);

  // ─── FETCH SUPPLIERS FROM SUPABASE ───────────────────────────
  useEffect(()=>{
    supabaseFetch('suppliers?select=*&is_active=eq.true&order=trust_score.desc&limit=100')
      .then((rows:any[])=>{
        if(!rows||rows.length===0)return;
        const mapped=rows
          .filter((r:any)=>r.country&&r.name&&r.net_rate_per_night)
          .map(mapSupplier);
        if(mapped.length>0){
          HOTELS=mapped;
          HOTELS_BY_MARGIN=[...mapped].sort((a:any,b:any)=>b.marginScore-a.marginScore);
          setSuppliersLoaded(true);
        }
      })
      .catch(()=>{
        // Silently fall back to hardcoded HOTELS_FALLBACK
        setSuppliersLoaded(true);
      });
  },[]);
  useEffect(()=>{if(inspireChatMsgs.length>1)inspireChatEndRef.current?.scrollIntoView({behavior:"smooth"});},[inspireChatMsgs]);
  useEffect(()=>{setPropertyStays(stays=>{if(stays.length===1)return [{...stays[0],nights}];return stays;});},[nights]);

  useEffect(()=>{
    if(screen!=='builder')return;
    setPreloading(true);setAvailMap(new Map());setAltDates(new Map());
    preloadAllHotels(HOTELS_BY_MARGIN,checkinDate,nights,totalPax,async(supplierId,r)=>{
      setAvailMap(prev=>{const m=new Map(prev);m.set(supplierId,r);return m;});
      if(!r.available){
        const hotel=HOTELS_BY_MARGIN.find(h=>String(h.id)===supplierId);
        if(hotel){
          const alt=await findAltDate(supplierId,checkinDate,nights,totalPax,hotel.netRate);
          setAltDates(prev=>{const m=new Map(prev);m.set(supplierId,alt);return m;});
        }else{
          setAltDates(prev=>{const m=new Map(prev);m.set(supplierId,null);return m;});
        }
      }
    }).finally(()=>setPreloading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[screen,checkinDate,nights,adults,children]);

  const acceptAltDate=(stayIdx:number,newCheckIn:string,delta:number)=>{
    setPropertyStays(prev=>prev.map((stay,i)=>{if(i<stayIdx)return stay;return{...stay};}));
    setCheckinDate(prev=>addDays(prev,delta));
    const hotel=HOTELS_BY_MARGIN[propertyStays[stayIdx]?.hotelIdx||0];
    if(hotel){
      setAltDates(prev=>{const m=new Map(prev);m.delete(String(hotel.id));return m;});
      setAvailMap(prev=>{const m=new Map(prev);const existing=m.get(String(hotel.id));if(existing)m.set(String(hotel.id),Object.assign({},existing,{available:true,check_in:newCheckIn}));return m;});
    }
  };

  const fmt=(zar:number)=>`${currency.symbol}${Math.round(zar/currency.rate).toLocaleString()}`;
  const totalPax=Math.max(adults+children,1);
  const totalPropertyNights=propertyStays.reduce((s,p)=>s+p.nights,0);
  const nightsBalanced=totalPropertyNights===nights;

  const resolveHotelUpgrades=(hotel:typeof HOTELS[0],prefs:Record<string,number>)=>{
    const resolved:Record<string,any>={};const mismatches:string[]=[];
    Object.entries(prefs).forEach(([key,prefTier])=>{
      const opts=(hotel.upgrades as any)[key];if(!opts)return;
      const exact=opts.find((o:any)=>o.tier===prefTier);
      const below=[...opts].reverse().find((o:any)=>o.tier<=prefTier);
      const match=exact||below||opts[0];resolved[key]=match;
      if(!exact&&prefTier>0)mismatches.push(key);
    });
    return{resolved,mismatches};
  };

  const totalHotelNet=propertyStays.reduce((sum,stay)=>{
    const hotel=HOTELS_BY_MARGIN[stay.hotelIdx]||HOTELS[0];
    const{resolved}=resolveHotelUpgrades(hotel,stay.prefs);
    const upgradeExtra=Object.values(resolved).reduce((s:number,v:any)=>s+(v?.extra||0),0);
    return sum+(hotel.netRate*stay.nights+upgradeExtra);
  },0);
  const totalInterTransferNet=interTransfers.reduce((sum,it)=>{const t=INTER_TRANSFERS.find(x=>x.id===it.transferId);return sum+(t?.netRate||0);},0);
  const flightUpgrade=Object.values(upgrades.flights).reduce((s:number,v:any)=>s+(v?.extra||0),0);
  const intlFlightUpgrade=Object.values(upgrades.intl||{}).reduce((s:number,v:any)=>s+(v?.extra||0),0);
  const transferUpgrade=Object.values(upgrades.transfers).reduce((s:number,v:any)=>s+(v?.extra||0),0);
  const activityUpgrade=Object.values(upgrades.activities).reduce((s:number,v:any)=>s+(v?.extra||0),0);
  const relevantIntlFlights=INTL_FLIGHTS.filter(f=>f.from===builderIntlOrigin);
  const currentIntlFlight=relevantIntlFlights[intlFlightIdx%Math.max(relevantIntlFlights.length,1)];
  const flightNet=activePillars.includes("flights")?(FLIGHTS[flightIdx]?.netRate||0)*totalPax+(flightUpgrade as number):0;
  const intlFlightNet=(includeIntlFlight&&currentIntlFlight)?((currentIntlFlight.netRate||0)*totalPax+(intlFlightUpgrade as number)):0;
  const transferNet=activePillars.includes("transfers")?(TRANSFERS[transferIdx]?.netRate||0)+(transferUpgrade as number)+(totalInterTransferNet as number):0;
  const activityNet=activePillars.includes("activities")?(ACTIVITIES[activityIdx]?.netRate||0)*totalPax+(activityUpgrade as number):0;
  const hotelDisplay=activePillars.includes("hotels")?totalHotelNet*MARGINS.hotels:0;
  const totalZAR=flightNet*MARGINS.flights+intlFlightNet*MARGINS.intl+hotelDisplay+(transferNet*MARGINS.transfers)+activityNet*MARGINS.activities;

  const togglePillar=(p:Pillar)=>setActivePillars(ps=>ps.includes(p)?ps.filter(x=>x!==p):[...ps,p]);
  const toggleTheme=(id:string)=>setThemes(ts=>ts.includes(id)?ts.filter(x=>x!==id):[...ts,id]);

  const refreshStayAvailability=async(stayIdx:number)=>{
    const stay=propertyStays[stayIdx];if(!stay)return;
    const hotel=HOTELS_BY_MARGIN[stay.hotelIdx]||HOTELS[0];
    const supplierId=String(hotel.id);
    _cache.delete(_cacheKey(supplierId,checkinDate,stay.nights,totalPax));
    const r=await fetchAvail(supplierId,checkinDate,stay.nights,totalPax,hotel.netRate);
    setAvailMap(prev=>{const m=new Map(prev);m.set(supplierId,r);return m;});
    if(!r.available){
      const alt=await findAltDate(supplierId,checkinDate,stay.nights,totalPax,hotel.netRate);
      setAltDates(prev=>{const m=new Map(prev);m.set(supplierId,alt);return m;});
    }else{
      setAltDates(prev=>{const m=new Map(prev);m.delete(supplierId);return m;});
    }
  };

  const buildKBContext=()=>{
    const selected=kbEntries.filter(e=>kbSelected.includes(e.id)&&e.active);
    if(selected.length===0)return"";
    let ctx="=== PRIORITY KNOWLEDGE BASE — USE THIS IN PREFERENCE TO GENERAL INFORMATION ===\n\n";
    ctx+="The following has been verified by our safari specialists. Prioritise this over web search results.\n\n";
    selected.forEach(entry=>{
      ctx+=`--- ${entry.title.toUpperCase()} ---\n`;
      Object.entries(entry.structuredFields).forEach(([k,v])=>{ctx+=`${k.replace(/_/g," ").toUpperCase()}: ${v}\n`;});
      if(entry.specialistNotes){ctx+=`SPECIALIST NOTES: ${entry.specialistNotes}\n`;}
      ctx+="\n";
    });
    ctx+="=== END PRIORITY KNOWLEDGE BASE ===\n\n";
    return ctx;
  };

  const runPlanner=async()=>{
    setScreen("inspire-research");setResearchStep(0);window.scrollTo({top:0,behavior:"instant"});
    for(let i=0;i<RESEARCH_STEPS.length;i++){setResearchStep(i);await new Promise(r=>setTimeout(r,900));}
    const kbContext=buildKBContext();
    const regionLabel=region?REGIONS.find(r=>r.id===region)?.label:"Sub-Saharan Africa";
    const themeLabels=themes.map(id=>THEMES.find(t=>t.id===id)?.label).join(", ")||"safari";
    const intlNote=needsIntlFlight===true?`Guest flying from ${intlOrigin} — include international flight segment in plan.`:"Guest handling their own international flights.";
    try{
      const prompt=`${kbContext}You are a luxury safari journey designer at The Safari Edition. Plan an optimised safari itinerary.

GUEST INPUTS: Origin gateway: ${origin}, ${intlNote}, Region: ${regionLabel}, Budget: R${budget.toLocaleString()}, Trip: ${nights} nights, Travellers: ${adults} adults${children>0?`, ${children} children`:""}, Themes: ${themeLabels}

${kbContext?"Use the Priority Knowledge Base above as your primary source.":"Use web search to research current conditions, lodge availability and recommendations."}

Respond ONLY in this JSON (no markdown, no backticks):
{"title":"","summary":"","routing":"","bestTiming":"","cities":[{"city":"","country":"","nights":0,"why":"","highlights":["","",""],"estimatedCost":0,"hotelRate":0,"flightCost":0,"transferCost":0,"activityCost":0,"arrivalGap":"","departureGap":""}],"totalEstimate":0,"aiInsights":[""],"warnings":[""]}`;
      const resp=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,tools:[{type:"web_search_20250305",name:"web_search"}],messages:[{role:"user",content:prompt}]})});
      const data=await resp.json();
      const text=data.content?.filter((b:any)=>b.type==="text")?.map((b:any)=>b.text)?.join("")||"";
      const match=text.match(/\{[\s\S]*\}/);
      if(match){setItinerary(JSON.parse(match[0]));setCityHotelIdxs([0,1,2,3]);setInspireChatMsgs([{role:"assistant",text:`We've put together your journey. Want to adjust anything?`}]);window.scrollTo({top:0,behavior:"instant"});}
      else throw new Error();
    }catch{
      const mock={title:`${nights}-Night Ultimate Safari`,summary:`A perfectly sequenced ${nights}-night journey across two of Africa's finest wilderness areas.`,routing:`${origin}→Sabi Sand(${Math.ceil(nights*0.55)}n)→Okavango(${Math.floor(nights*0.45)}n)→${origin}`,bestTiming:"June–September: dry season, short grass, animals at water.",cities:[{city:"Singita Sabi Sand",country:"South Africa",nights:Math.ceil(nights*0.55),why:"First destination while fresh. Highest leopard density in Africa.",highlights:["Leopard tracking at dawn","Night drive","Sundowner in the bush"],estimatedCost:Math.round(budget*0.52),hotelRate:56000,flightCost:7600,transferCost:3800,activityCost:0,arrivalGap:"Land Skukuza 09:30, lodge 11:00",departureGap:"Final morning drive 05:30–09:30 before charter"},{city:"Okavango Delta",country:"Botswana",nights:Math.floor(nights*0.45),why:"Contrast — water, mokoro, bird life after dry Lowveld.",highlights:["Mokoro through papyrus","Walking safari","Helicopter over Delta"],estimatedCost:Math.round(budget*0.42),hotelRate:62000,flightCost:9200,transferCost:2400,activityCost:1800,arrivalGap:"Land 12:00, settle in for evening drive",departureGap:"Final mokoro 07:00–10:00"}],totalEstimate:Math.round(budget*0.94),aiInsights:["Federal Air JNB→Skukuza saves R8,000 vs road transfer","Our Singita rate is 27% below Booking.com","Mid-week arrival saves R2,800/night"],warnings:budget<100000?["Budget tight for premium lodges — consider single destination"]:[]};
      setItinerary(mock);setInspireChatMsgs([{role:"assistant",text:`We've drafted your safari. Our rates save you ${fmt(mock.totalEstimate*0.27)} vs booking direct. Want to adjust?`}]);
    }
    window.scrollTo({top:0,behavior:"instant"});setScreen("inspire-plan");
  };

  const runPlannerFromBrief=async(briefText:string)=>{
    const kbContext=buildKBContext();
    try{
      const prompt=`${kbContext}You are a luxury safari journey designer at The Safari Edition.
A traveller has written their own brief in free text. Extract their intent and plan an optimised safari itinerary.

TRAVELLER BRIEF: "${briefText}"
KNOWN PARAMETERS: Nights: ${nights}, Adults: ${adults}, Children: ${children}

Respond ONLY in this JSON (no markdown, no backticks):
{"title":"","summary":"","routing":"","bestTiming":"","briefInterpretation":"one sentence explaining how you interpreted the brief","cities":[{"city":"","country":"","nights":0,"why":"","highlights":["","",""],"estimatedCost":0,"hotelRate":0,"flightCost":0,"transferCost":0,"activityCost":0,"arrivalGap":"","departureGap":""}],"totalEstimate":0,"aiInsights":[""],"warnings":[""]}`;
      const resp=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,tools:[{type:"web_search_20250305",name:"web_search"}],messages:[{role:"user",content:prompt}]})});
      const data=await resp.json();
      const text=data.content?.filter((b:any)=>b.type==="text")?.map((b:any)=>b.text)?.join("")||"";
      const match=text.match(/\{[\s\S]*\}/);
      if(match){
        const parsed=JSON.parse(match[0]);
        setItinerary(parsed);setCityHotelIdxs([0,1,2,3]);
        setInspireChatMsgs([{role:"assistant",text:parsed.briefInterpretation?`Based on your brief: ${parsed.briefInterpretation} Let me know if you'd like to adjust anything.`:`We've built your journey from your brief. Want to change anything?`}]);
      }else throw new Error();
    }catch{
      const mock={title:`${nights}-Night Safari from Your Brief`,summary:`A perfectly sequenced safari built around your brief.`,routing:`Custom routing based on your requirements`,bestTiming:"June–September: dry season, optimal game viewing.",briefInterpretation:"We've interpreted your brief and built a suggested itinerary.",cities:[{city:"Singita Sabi Sand",country:"South Africa",nights:Math.ceil(nights*0.55),why:"First destination while fresh — highest leopard density in Africa.",highlights:["Leopard tracking at dawn","Night drive","Sundowner in the bush"],estimatedCost:Math.round(180000*0.52),hotelRate:56000,flightCost:7600,transferCost:3800,activityCost:0,arrivalGap:"Land Skukuza 09:30",departureGap:"Final morning drive before charter"},{city:"Okavango Delta",country:"Botswana",nights:Math.floor(nights*0.45),why:"Water and air contrast after dry Lowveld.",highlights:["Mokoro through papyrus","Walking safari","Helicopter over Delta"],estimatedCost:Math.round(180000*0.42),hotelRate:62000,flightCost:9200,transferCost:2400,activityCost:1800,arrivalGap:"Land 12:00, settle in for evening drive",departureGap:"Final mokoro 07:00–10:00"}],totalEstimate:180000,aiInsights:["Built from your brief — customise any element below"],warnings:[]};
      setItinerary(mock);
      setInspireChatMsgs([{role:"assistant",text:"We've built a suggested journey from your brief. Every element is adjustable — just ask."}]);
    }
    window.scrollTo({top:0,behavior:"instant"});setScreen("inspire-plan");
  };

  // ─── FIXED: sendInspireChat ───────────────────────────────────
  // The previous version embedded the itinerary as a literal inside the
  // JSON format spec, so Claude saw it as a fixed template not a target to modify.
  // This version passes the itinerary as labelled context and gives explicit
  // instructions per request type with math requirements.
  const sendInspireChat=async()=>{
    if(!inspireChatInput.trim())return;
    const msg=inspireChatInput.trim();
    setInspireChatInput("");
    setInspireChatMsgs(m=>[...m,{role:"user",text:msg}]);
    setInspireChatLoading(true);
    const previousItinerary=itinerary;

    try{
      const isQuestion=/visa|weather|pack|when|best time|malaria|safe|flight time|how long|currency/i.test(msg);

      if(isQuestion){
        const resp=await fetch("/api/claude",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:400,
            messages:[{
              role:"user",
              content:`You are a luxury safari specialist. Answer this question warmly in 2-3 sentences: "${msg}". Context: destination ${itinerary?.cities?.[0]?.city||"Southern Africa"}, ${nights} nights.`
            }]
          })
        });
        const data=await resp.json();
        const text=data.content?.filter((b:any)=>b.type==="text")?.map((b:any)=>b.text)?.join("")||"";
        setInspireChatMsgs(m=>[...m,{role:"assistant",text:text||"Happy to help with that."}]);

      }else{
        // ── ITINERARY MODIFICATION ──────────────────────────────
        const currentItinerary=JSON.stringify(itinerary);

        const resp=await fetch("/api/claude",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:2000,
            messages:[{
              role:"user",
              content:`You are a luxury safari specialist making changes to a traveller's itinerary.

CURRENT ITINERARY (JSON):
${currentItinerary}

GUEST REQUEST: "${msg}"

CONSTRAINTS:
- Budget: R${Math.round(budget||120000).toLocaleString()} ZAR
- Nights: ${nights}
- Adults: ${adults}
- Currency shown to guest: ${currency.code}

INSTRUCTIONS — apply the relevant one:
1. "make it cheaper" or similar: reduce hotelRate values to more affordable properties (e.g. from R56,000/night to R28,000/night), recalculate every estimatedCost as (hotelRate * nights + flightCost + transferCost + activityCost), update totalEstimate to the sum of all city estimatedCost values.
2. "add [experience]": add it to highlights array of the relevant city, increase that city's estimatedCost by a reasonable amount, update totalEstimate.
3. "extend by X nights": increase nights in the most logical city, recalculate that city's estimatedCost, update totalEstimate.
4. "remove [destination]": remove that city from the cities array, recalculate totalEstimate as sum of remaining cities.
5. "swap [x] for [y]": replace the named city with the requested alternative, update costs accordingly.
6. Any other request: apply it decisively and update all affected cost fields.

CRITICAL MATH RULE: totalEstimate must always equal the sum of all city estimatedCost values. Recalculate every time.

DO NOT ask clarifying questions. Make the change now.

RESPOND WITH ONLY THIS JSON — no markdown, no backticks, no preamble:
{"reply":"1-2 sentence warm explanation of exactly what changed","itinerary":MODIFIED_ITINERARY_OBJECT_HERE}`
            }]
          })
        });

        const data=await resp.json();
        const rawText=data.content?.filter((b:any)=>b.type==="text")?.map((b:any)=>b.text)?.join("")||"";

        // Strip markdown fences if present
        const cleaned=rawText.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
        const match=cleaned.match(/\{[\s\S]*\}/);

        if(match){
          try{
            const parsed=JSON.parse(match[0]);
            if(parsed.itinerary&&parsed.itinerary.cities){
              setItinerary(parsed.itinerary);
            }
            setInspireChatMsgs(m=>[...m,{
              role:"assistant",
              text:parsed.reply||"Done — I've updated your journey.",
              revert:previousItinerary
            }]);
          }catch{
            // JSON parse failed — show raw text
            setInspireChatMsgs(m=>[...m,{
              role:"assistant",
              text:rawText||"I've updated your journey.",
              revert:previousItinerary
            }]);
          }
        }else{
          // No JSON found — Claude returned plain text
          setInspireChatMsgs(m=>[...m,{
            role:"assistant",
            text:rawText||"I've updated your journey. Let me know if you'd like further changes.",
            revert:previousItinerary
          }]);
        }
      }
    }catch(e){
      setInspireChatMsgs(m=>[...m,{
        role:"assistant",
        text:"Something went wrong updating your journey. Please try again.",
        revert:previousItinerary
      }]);
    }
    setInspireChatLoading(false);
  };

  const sendChat=async()=>{
    if(!chatInput.trim())return;
    const msg=chatInput.trim();setChatInput("");setChatMsgs(m=>[...m,{role:"user",text:msg}]);setChatLoading(true);
    try{
      const resp=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:`You are a luxury safari specialist at The Safari Edition. Be warm, knowledgeable, concise. Question: ${msg}`}]})});
      const data=await resp.json();
      setChatMsgs(m=>[...m,{role:"assistant",text:data.content?.[0]?.text||"Happy to help."}]);
    }catch{
      const fb=["The dry season (June–Sept) is perfect — short grass, animals at water.","Federal Airlines into Skukuza: 55 minutes from Johannesburg, in the bush before breakfast.","Singita's all-inclusive covers everything — game drives, walks, meals, premium spirits.","For first-timers, Sabi Sand is our top pick — Big Five density unmatched anywhere."];
      setChatMsgs(m=>[...m,{role:"assistant",text:fb[Math.floor(Math.random()*fb.length)]}]);
    }
    setChatLoading(false);
  };

  const handleSelect=(pillar:string,key:string,opt:any,stayId?:number)=>{
    if(pillar==="hotels"&&stayId!==undefined)setPropertyStays(prev=>prev.map(s=>s.id===stayId?{...s,prefs:{...s.prefs,[key]:opt.tier}}:s));
    else setUpgrades(u=>({...u,[pillar]:{...u[pillar],[key]:{label:opt.label,extra:opt.extra}}}));
  };

  const addPropertyStay=()=>{
    if(propertyStays.length>=3)return;
    const last=propertyStays[propertyStays.length-1];
    const take=Math.min(3,last.nights-1);if(take<1)return;
    const stack=availableHotelStack.length>0?availableHotelStack:HOTELS_BY_MARGIN;
    const usedIdxs=propertyStays.map(s=>s.hotelIdx);
    let newIdx=0;for(let i=0;i<stack.length;i++){if(!usedIdxs.includes(i)){newIdx=i;break;}}
    const from=stack[Math.min(last.hotelIdx,stack.length-1)]||HOTELS[0];
    const to=stack[newIdx]||HOTELS[0];
    const transfer=getInterTransfer(from.region,to.region);
    setPropertyStays(prev=>[...prev.slice(0,-1),{...last,nights:last.nights-take},{id:Date.now(),hotelIdx:newIdx,nights:take,prefs:{rooms:0,basis:0,flexibility:0}}]);
    setInterTransfers(prev=>[...prev,{transferId:transfer.id,expanded:false}]);
  };

  const removePropertyStay=(idx:number)=>{
    if(propertyStays.length<=1)return;
    const n=propertyStays[idx].nights;
    const tgt=idx===0?1:idx-1;
    const updated=propertyStays.filter((_,i)=>i!==idx);
    updated[Math.min(tgt,updated.length-1)].nights+=n;
    setPropertyStays([...updated]);
    const nt=[...interTransfers];nt.splice(idx===0?0:idx-1,1);setInterTransfers(nt);
  };

  const updateStayNights=(stayIdx:number,delta:number)=>{
    setPropertyStays(prev=>{
      const stays=prev.map(s=>({...s}));const target=stays[stayIdx];
      if(target.nights+delta<1)return prev;
      const adjIdx=stayIdx===stays.length-1?stayIdx-1:stayIdx+1;
      if(adjIdx>=0&&adjIdx<stays.length){if(delta>0&&stays[adjIdx].nights<=1)return prev;stays[adjIdx].nights-=delta;if(stays[adjIdx].nights<1)return prev;}
      target.nights+=delta;return stays;
    });
  };

  const updateStayHotel=(stayIdx:number,delta:number)=>{
    setPropertyStays(prev=>{const stays=prev.map(s=>({...s}));stays[stayIdx].hotelIdx=Math.max(0,Math.min(HOTELS_BY_MARGIN.length-1,stays[stayIdx].hotelIdx+delta));return stays;});
  };

  const toggleInterTransfer=(idx:number)=>setInterTransfers(prev=>prev.map((t,i)=>i===idx?{...t,expanded:!t.expanded}:t));

  // ─── CSS ────────────────────────────────────────────────────
  const css=`
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${T.bg};color:${T.text};font-family:'DM Sans','Segoe UI',sans-serif}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.3);border-radius:2px}
    input[type=range]{-webkit-appearance:none;width:100%;height:2px;border-radius:1px;background:rgba(255,255,255,0.12);outline:none}
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:${T.gold};cursor:pointer;border:2px solid ${T.bg}}
    textarea{resize:vertical}select option{background:#1e1e1e}
    @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
    @keyframes shimmer{0%,100%{opacity:.7}50%{opacity:1}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
    .fade-up{animation:fadeUp 0.45s ease forwards}
    .spinner{width:20px;height:20px;border-radius:50%;border:2px solid rgba(212,175,55,0.12);border-top-color:${T.gold};animation:spin 0.75s linear infinite;display:inline-block}
    .btn-gold{background:linear-gradient(135deg,${T.gold},${T.goldLight});border:none;color:#0a0a0a;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.2s}
    .btn-gold:hover{opacity:.88;transform:translateY(-1px)}
    .btn-ghost{background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.14);color:${T.text};border-radius:10px;padding:12px 22px;font-size:14px;cursor:pointer;font-family:inherit;transition:all 0.15s}
    .btn-ghost:hover{background:rgba(255,255,255,0.1)}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:400;display:flex;align-items:flex-end;justify-content:center}
    @media(min-width:600px){.overlay{align-items:center}}
    .card{background:${T.surface};border:0.5px solid ${T.border};border-radius:16px;overflow:hidden;transition:border-color 0.2s}
    .card:hover{border-color:rgba(212,175,55,0.18)}
    .trust-pill{display:inline-flex;align-items:center;gap:4px;background:rgba(74,222,128,0.08);border:0.5px solid rgba(74,222,128,0.25);border-radius:20px;padding:3px 10px;font-size:11px;color:${T.green};font-weight:600}
    .city-card{background:${T.surface};border:0.5px solid ${T.border};border-radius:14px;padding:16px;margin-bottom:12px}
    .fun-fact{background:rgba(212,175,55,0.07);border:0.5px solid rgba(212,175,55,0.16);border-radius:10px;padding:10px 14px;font-size:12px;color:rgba(212,175,55,0.85);line-height:1.55;margin-top:10px}
    .inter-transfer{background:rgba(96,165,250,0.06);border:0.5px solid rgba(96,165,250,0.2);border-radius:10px;padding:10px 14px;margin:8px 0;cursor:pointer;transition:all 0.15s}
    .inter-transfer:hover{background:rgba(96,165,250,0.1)}
    .property-card{background:${T.surface};border:0.5px solid ${T.border};border-radius:16px;overflow:hidden;margin-bottom:4px}
    .kb-tag-regional{background:rgba(96,165,250,0.1);border:0.5px solid rgba(96,165,250,0.3);color:#60a5fa;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
    .kb-tag-property{background:rgba(212,175,55,0.1);border:0.5px solid rgba(212,175,55,0.3);color:${T.gold};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
    .kb-tag-trade_tip{background:rgba(74,222,128,0.1);border:0.5px solid rgba(74,222,128,0.3);color:${T.green};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
  `;

  // ─── NAV ────────────────────────────────────────────────────
  const Nav=()=>(
    <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(10,10,10,0.96)",backdropFilter:"blur(16px)",borderBottom:`0.5px solid ${T.border}`,padding:"0 20px"}}>
      <div style={{maxWidth:900,margin:"0 auto",height:58,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${T.gold},${T.goldLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#0a0a0a",fontSize:15,cursor:"pointer",flexShrink:0}} onClick={()=>setScreen("landing")}>✦</div>
          <div style={{position:"relative",cursor:"pointer"}} onClick={()=>setShowEditions(v=>!v)}>
            <div style={{fontSize:14,fontWeight:700,fontFamily:"'Playfair Display',serif",background:`linear-gradient(90deg,${T.gold},${T.goldLight})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"0.05em",display:"flex",alignItems:"center",gap:5}}>
              THE SAFARI EDITION <span style={{fontSize:10,WebkitTextFillColor:T.gold,opacity:0.6}}>▾</span>
            </div>
            <div style={{fontSize:9,color:T.textDim,letterSpacing:"0.12em",textTransform:"uppercase",marginTop:-1}}>Sub-Saharan Africa · Curated</div>
            {showEditions&&(
              <div style={{position:"absolute",top:"calc(100% + 12px)",left:0,zIndex:300,background:"rgba(10,10,10,0.98)",backdropFilter:"blur(20px)",border:`0.5px solid ${T.borderGold}`,borderRadius:14,padding:"8px",minWidth:240,boxShadow:"0 16px 48px rgba(0,0,0,0.8)"}}>
                <div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.12em",padding:"6px 10px 4px"}}>Other Editions</div>
                {[
                  {name:"The Island Edition",tag:"Maldives · Seychelles · Mauritius",icon:"🏝",color:"#60a5fa"},
                  {name:"The Sports Edition",tag:"F1 · Golf · Rugby · Cricket",icon:"🏆",color:"#f59e0b"},
                  {name:"The Local Edition",tag:"South Africa · Hidden Gems",icon:"🌿",color:"#4ade80"},
                  {name:"The Adventure Edition",tag:"Trekking · Diving · Expeditions",icon:"🧗",color:"#f87171"},
                  {name:"The Arabian Edition",tag:"UAE · Saudi · Oman · Jordan",icon:"🕌",color:"#a78bfa"},
                  {name:"The Japan Edition",tag:"Tokyo · Kyoto · Ryokan · Ski",icon:"⛩",color:"#f472b6"},
                  {name:"The City Edition",tag:"London · New York · Paris · Dubai",icon:"🏙",color:"#22d3ee"},
                ].map(e=>(
                  <div key={e.name} onClick={ev=>{ev.stopPropagation();setShowEditions(false);}}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:9,cursor:"pointer"}}
                    onMouseEnter={ev=>(ev.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.06)"}
                    onMouseLeave={ev=>(ev.currentTarget as HTMLElement).style.background="transparent"}>
                    <span style={{fontSize:18,width:24,textAlign:"center"}}>{e.icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:e.color,fontFamily:"'Playfair Display',serif"}}>{e.name}</div>
                      <div style={{fontSize:10,color:T.textDim}}>{e.tag}</div>
                    </div>
                    <div style={{marginLeft:"auto",fontSize:10,color:T.textDim,padding:"2px 7px",borderRadius:20,background:"rgba(255,255,255,0.05)"}}>Soon</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <select value={currency.code} onChange={e=>setCurrency(CURRENCIES.find(c=>c.code===e.target.value)!)} style={{background:"rgba(255,255,255,0.07)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:8,padding:"5px 10px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}</select>
          <a href="/admin" style={{padding:"6px 14px",fontSize:12,color:T.textDim,border:`0.5px solid ${T.border}`,borderRadius:8,textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:10}}>⚙</span> Admin
          </a>
        </div>
      </div>
    </nav>
  );

  const StickyBanner=()=>{
    if(screen!=="builder"||activePillars.length===0)return null;
    return(
      <div style={{position:"sticky",top:58,zIndex:99,background:"rgba(10,10,10,0.98)",backdropFilter:"blur(20px)",borderBottom:`1.5px solid rgba(212,175,55,0.32)`,padding:"10px 20px",boxShadow:"0 4px 24px rgba(0,0,0,0.5)"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:1}}>Live package · {nights} night{nights!==1?"s":""} · {totalPax} traveller{totalPax!==1?"s":""}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:10}}>
              <span style={{fontSize:26,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif"}}>{fmt(totalZAR)}</span>
              <span style={{fontSize:12,color:T.textDim}}>{activePillars.length} components · {propertyStays.length} lodge{propertyStays.length!==1?"s":""}</span>
            </div>
          </div>
          <button className="btn-gold" style={{padding:"10px 20px",fontSize:14}} onClick={()=>{const el=document.getElementById('confirm-payment-btn');if(el)el.scrollIntoView({behavior:'smooth',block:'center'});}}>View Summary →</button>
        </div>
      </div>
    );
  };

  // ─── KNOWLEDGE BASE SCREEN ──────────────────────────────────
  if(screen==="knowledge-base")return(
    <div style={{minHeight:"100vh",background:T.bg}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet"/>
      <style>{css}</style>
      <Nav/>
      <div className="fade-up" style={{maxWidth:900,margin:"0 auto",padding:"28px 20px 80px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:11,color:T.gold,letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>Admin</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:T.text,marginBottom:6}}>Knowledge Base</h2>
            <p style={{fontSize:13,color:T.textMid,lineHeight:1.65,maxWidth:560}}>Feed the system with curated expert knowledge. Selected entries are injected into every itinerary build as priority context.</p>
          </div>
          <button className="btn-gold" onClick={()=>{setKbNewEntry(true);setKbEditEntry({id:`kb${Date.now()}`,type:"property",title:"",linkedTo:"",structuredFields:{},specialistNotes:"",active:true});}} style={{padding:"10px 18px",fontSize:13}}>+ Add Entry</button>
        </div>
        <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:14,padding:"16px 18px",marginBottom:24}}>
          <div style={{fontSize:12,fontWeight:600,color:T.gold,marginBottom:10}}>✦ Entries injected into next itinerary build ({kbSelected.length} of {kbEntries.length} selected)</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {kbEntries.map(entry=>(
              <button key={entry.id} onClick={()=>setKbSelected(s=>s.includes(entry.id)?s.filter(x=>x!==entry.id):[...s,entry.id])} style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${kbSelected.includes(entry.id)?T.gold:T.border}`,background:kbSelected.includes(entry.id)?T.goldDim:"transparent",color:kbSelected.includes(entry.id)?T.gold:T.textMid,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                {kbSelected.includes(entry.id)&&<span style={{fontSize:10,marginRight:4}}>✓</span>}{entry.title}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {kbEntries.map(entry=>(
            <div key={entry.id} style={{background:T.surface,border:`0.5px solid ${kbSelected.includes(entry.id)?T.borderGold:T.border}`,borderRadius:14,padding:"16px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span className={`kb-tag-${entry.type}`}>{entry.type==="regional"?"🌍 Regional":entry.type==="property"?"🏕 Property":"💡 Trade tip"}</span>
                  <span style={{fontSize:15,fontWeight:700,color:T.text,fontFamily:"'Playfair Display',serif"}}>{entry.title}</span>
                  {entry.linkedTo&&<span style={{fontSize:11,color:T.textDim}}>→ {entry.linkedTo}</span>}
                </div>
                <div style={{display:"flex",gap:8,flexShrink:0}}>
                  <button onClick={()=>{setKbEditEntry({...entry});setKbNewEntry(false);}} style={{background:"rgba(255,255,255,0.06)",border:`0.5px solid ${T.border}`,color:T.textMid,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                  <button onClick={()=>setKbEntries(e=>e.filter(x=>x.id!==entry.id))} style={{background:"rgba(248,113,113,0.08)",border:"0.5px solid rgba(248,113,113,0.2)",color:T.red,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8,marginBottom:entry.specialistNotes?12:0}}>
                {Object.entries(entry.structuredFields).slice(0,4).map(([k,v])=>(
                  <div key={k} style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>{k.replace(/_/g," ")}</div>
                    <div style={{fontSize:12,color:T.textMid,lineHeight:1.5}}>{String(v).length>80?String(v).slice(0,80)+"…":String(v)}</div>
                  </div>
                ))}
              </div>
              {entry.specialistNotes&&(
                <div style={{background:"rgba(212,175,55,0.06)",border:`0.5px solid ${T.borderGold}`,borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:10,color:T.gold,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:4}}>Specialist notes</div>
                  <div style={{fontSize:12,color:T.textMid,lineHeight:1.6}}>{entry.specialistNotes.length>200?entry.specialistNotes.slice(0,200)+"…":entry.specialistNotes}</div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{marginTop:24,display:"flex",gap:10}}>
          <button className="btn-gold" onClick={()=>setScreen("inspire-input")} style={{padding:"12px 20px",fontSize:14}}>→ Build Itinerary with this Knowledge</button>
          <button className="btn-ghost" onClick={()=>setScreen("landing")} style={{padding:"12px 20px",fontSize:14}}>← Back to Home</button>
        </div>
      </div>
      {kbEditEntry&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget){setKbEditEntry(null);setKbNewEntry(false);}}}>
          <div style={{background:"#141414",border:`0.5px solid ${T.border}`,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:660,maxHeight:"92vh",overflowY:"auto",padding:"24px 20px 40px",animation:"slideUp 0.3s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontSize:16,fontWeight:700,color:T.text}}>{kbNewEntry?"New Knowledge Entry":"Edit Entry"}</div>
              <button onClick={()=>{setKbEditEntry(null);setKbNewEntry(false);}} style={{background:"rgba(255,255,255,0.08)",border:"none",color:T.textMid,width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>×</button>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:8}}>Entry type</div>
              <div style={{display:"flex",gap:8}}>
                {(["regional","property","trade_tip"] as const).map(t=>(
                  <button key={t} onClick={()=>setKbEditEntry(e=>e?{...e,type:t}:null)} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${kbEditEntry.type===t?T.gold:T.border}`,background:kbEditEntry.type===t?T.goldDim:"transparent",color:kbEditEntry.type===t?T.gold:T.textMid,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    {t==="regional"?"🌍 Regional":t==="property"?"🏕 Property":"💡 Trade tip"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:6}}>Title</div>
              <input value={kbEditEntry.title} onChange={e=>setKbEditEntry(x=>x?{...x,title:e.target.value}:null)} placeholder="e.g. Singita Sabi Sand — Booking Notes" style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:9,padding:"10px 13px",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:6}}>Linked to</div>
              <input value={kbEditEntry.linkedTo} onChange={e=>setKbEditEntry(x=>x?{...x,linkedTo:e.target.value}:null)} placeholder="e.g. Singita Sabi Sand / southern-africa / flights" style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:9,padding:"10px 13px",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:8}}>Structured fields</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {Object.entries(kbEditEntry.structuredFields).map(([k,v],i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 2fr auto",gap:8,alignItems:"center"}}>
                    <input value={k} onChange={e=>{const fields={...kbEditEntry.structuredFields};const val=fields[k];delete fields[k];fields[e.target.value]=val;setKbEditEntry(x=>x?{...x,structuredFields:fields}:null);}} placeholder="field name" style={{background:"rgba(255,255,255,0.05)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:8,padding:"8px 10px",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                    <input value={v} onChange={e=>setKbEditEntry(x=>x?{...x,structuredFields:{...x.structuredFields,[k]:e.target.value}}:null)} placeholder="value" style={{background:"rgba(255,255,255,0.05)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:8,padding:"8px 10px",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                    <button onClick={()=>{const fields={...kbEditEntry.structuredFields};delete fields[k];setKbEditEntry(x=>x?{...x,structuredFields:fields}:null);}} style={{background:"rgba(248,113,113,0.08)",border:"0.5px solid rgba(248,113,113,0.2)",color:T.red,borderRadius:8,padding:"8px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>×</button>
                  </div>
                ))}
                <button onClick={()=>setKbEditEntry(x=>x?{...x,structuredFields:{...x.structuredFields,[`field_${Object.keys(x.structuredFields).length+1}`]:""}}:null)} style={{padding:"8px 14px",borderRadius:8,border:`1px dashed ${T.border}`,background:"transparent",color:T.textDim,fontSize:12,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>+ Add field</button>
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:6}}>Specialist notes</div>
              <textarea value={kbEditEntry.specialistNotes} onChange={e=>setKbEditEntry(x=>x?{...x,specialistNotes:e.target.value}:null)} placeholder="Add trade tips, booking warnings, best rooms, seasonal notes..." style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:9,padding:"10px 13px",fontSize:13,outline:"none",fontFamily:"inherit",minHeight:120,lineHeight:1.6}}/>
            </div>
            <button className="btn-gold" style={{width:"100%",padding:"14px",fontSize:15}} onClick={()=>{
              if(kbNewEntry)setKbEntries(e=>[...e,kbEditEntry]);
              else setKbEntries(e=>e.map(x=>x.id===kbEditEntry.id?kbEditEntry:x));
              setKbEditEntry(null);setKbNewEntry(false);
            }}>Save entry →</button>
          </div>
        </div>
      )}
      {chatOpen&&<ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={()=>setChatOpen(false)}/>}
    </div>
  );

  // ─── LANDING ────────────────────────────────────────────────
  if(screen==="landing")return(
    <div style={{minHeight:"100vh",background:T.bg}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet"/>
      <style>{css}</style>
      <Nav/>
      <div style={{position:"relative",height:"82vh",minHeight:520,overflow:"hidden"}}>
        <img src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1400&q=80" alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 40%"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(10,10,10,0.1) 0%,rgba(10,10,10,0.45) 55%,rgba(10,10,10,1) 100%)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 24px 52px",maxWidth:900,margin:"0 auto"}}>
          <div style={{fontSize:11,color:T.gold,letterSpacing:"0.2em",textTransform:"uppercase",fontWeight:600,marginBottom:12}}>The Safari Edition</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(30px,5.5vw,56px)",fontWeight:700,lineHeight:1.1,marginBottom:16,color:T.text}}>Africa's finest wilderness,<br/><em style={{color:T.gold}}>curated for you.</em></h1>
          <p style={{fontSize:16,color:T.textMid,lineHeight:1.7,marginBottom:28,maxWidth:500}}>Handpicked lodges, negotiated rates, perfectly sequenced journeys — built around you.</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={()=>setScreen("inspire-input")} className="btn-gold" style={{padding:"14px 24px",fontSize:15}}>✦ Plan My Journey →</button>
            <button onClick={()=>{setActivePillars([]);setScreen("builder");}} className="btn-gold" style={{padding:"14px 24px",fontSize:15}}>Pull a Journey Together →</button>
            <button onClick={()=>setScreen("my-brief")} className="btn-gold" style={{padding:"14px 24px",fontSize:15}}>Give Me Your Inspiration →</button>
          </div>
        </div>
      </div>
      <div style={{maxWidth:900,margin:"0 auto",padding:"52px 20px 20px"}}>
        <div style={{marginBottom:56}}>
          <div style={{fontSize:11,color:T.gold,letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:600,marginBottom:6}}>Curated Journeys</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:24,flexWrap:"wrap",gap:8}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:T.text}}>Ready to book — from price</h2>
            <span style={{fontSize:12,color:T.textDim}}>All-inclusive · negotiated rates</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:18}}>
            {CURATED_JOURNEYS.map(j=>(
              <div key={j.id} className="card" style={{cursor:"pointer"}} onClick={()=>{setActivePillars(["flights","hotels","transfers","activities"]);setScreen("builder");}}>
                <div style={{position:"relative",height:195,overflow:"hidden"}}>
                  <img src={j.image} alt={j.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.68) 0%,transparent 52%)"}}/>
                  <div style={{position:"absolute",top:10,left:10,background:j.badgeColor,color:"#0a0a0a",fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20}}>{j.badge}</div>
                  <div style={{position:"absolute",bottom:10,left:12,right:12}}>
                    <div style={{fontSize:15,fontWeight:700,fontFamily:"'Playfair Display',serif",color:"#fff"}}>{j.name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:1}}>{j.tagline}</div>
                  </div>
                </div>
                <div style={{padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                    <div><div style={{fontSize:11,color:T.textDim,marginBottom:2}}>{j.nights} nights · {j.pax} people</div><div style={{fontSize:22,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif"}}>{fmt(j.priceFrom)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:10,color:T.textDim,marginBottom:2}}>vs booking direct</div><div style={{fontSize:13,color:T.green,fontWeight:600}}>Save {fmt(j.otaEquivalent-j.priceFrom)}</div></div>
                  </div>
                  <div style={{borderTop:`0.5px solid ${T.border}`,paddingTop:10}}>{j.includes.slice(0,3).map((inc,i)=><div key={i} style={{fontSize:11,color:T.textMid,display:"flex",gap:6,marginBottom:3}}><span style={{color:T.gold,flexShrink:0}}>✓</span>{inc}</div>)}</div>
                  <button className="btn-gold" style={{width:"100%",padding:"11px",fontSize:13,marginTop:12}}>View & Customise →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12,marginBottom:56}}>
          {[{icon:"✦",title:"Negotiated rates",sub:"Contracted directly with Africa's finest lodges."},{icon:"🛡",title:"Verified lodges",sub:"Every property vetted for service and reliability."},{icon:"📞",title:"Journey specialists",sub:"Real people, available before and during your trip."},{icon:"🔄",title:"Flexible booking",sub:"Our cancellation terms are the most generous available."}].map(f=>(
            <div key={f.title} style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:14,padding:"18px 16px"}}><div style={{fontSize:20,marginBottom:8}}>{f.icon}</div><div style={{fontSize:14,fontWeight:600,marginBottom:5,color:T.text}}>{f.title}</div><div style={{fontSize:12,color:T.textDim,lineHeight:1.65}}>{f.sub}</div></div>
          ))}
        </div>
      </div>
      {chatOpen&&<ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={()=>setChatOpen(false)}/>}
    </div>
  );

  // ─── INSPIRE INPUT ──────────────────────────────────────────
  if(screen==="inspire-input")return(
    <div style={{minHeight:"100vh",background:T.bg}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet"/>
      <style>{css}</style>
      <Nav/>
      <div className="fade-up" style={{maxWidth:660,margin:"0 auto",padding:"32px 20px 80px"}}>
        <div style={{fontSize:11,color:T.gold,letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:600,marginBottom:6}}>Journey Planner</div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,marginBottom:8,color:T.text}}>Tell us about your dream safari</h2>
        <p style={{fontSize:14,color:T.textMid,marginBottom:28,lineHeight:1.65}}>Our specialists will put together a perfectly sequenced itinerary around your preferences.</p>
        <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:14,padding:"16px 18px",marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>Do you need international flights included?</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:needsIntlFlight===true?12:0}}>
            {[{val:true,label:"Yes — include from my home country",icon:"✈"},{val:false,label:"No — I'll arrange my own flights",icon:"🏠"}].map(opt=>(
              <button key={String(opt.val)} onClick={()=>setNeedsIntlFlight(opt.val)} style={{padding:"12px 14px",borderRadius:10,border:`1.5px solid ${needsIntlFlight===opt.val?T.gold:T.border}`,background:needsIntlFlight===opt.val?T.goldDim:T.bg3,color:needsIntlFlight===opt.val?T.gold:T.textMid,fontSize:13,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"flex-start",gap:8}}>
                <span style={{fontSize:16,flexShrink:0}}>{opt.icon}</span><span style={{lineHeight:1.4}}>{opt.label}</span>
              </button>
            ))}
          </div>
          {needsIntlFlight===true&&(
            <div>
              <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:6}}>Flying from</div>
              <select value={intlOrigin} onChange={e=>setIntlOrigin(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:10,padding:"11px 13px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
                <optgroup label="International">{INTERNATIONAL_ORIGINS.map(o=><option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}</optgroup>
              </select>
            </div>
          )}
          {needsIntlFlight===false&&(
            <div style={{marginTop:12}}>
              <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:6}}>Arriving into (SA gateway)</div>
              <select value={origin} onChange={e=>setOrigin(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:10,padding:"11px 13px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
                {REGIONAL_ORIGINS.map(o=><option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:T.textDim,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8}}>Destination region</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {REGIONS.map(r=>(
              <button key={r.id} onClick={()=>setRegion(region===r.id?null:r.id)} style={{padding:"12px 14px",borderRadius:10,border:`1.5px solid ${region===r.id?T.gold:T.border}`,background:region===r.id?T.goldDim:T.surface,color:region===r.id?T.gold:T.textMid,fontSize:13,fontWeight:region===r.id?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit"}}>
                <span>{r.icon}</span>{r.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:11,color:T.textDim,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Total budget</div>
            <div style={{fontSize:15,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif"}}>{fmt(budget)}</div>
          </div>
          <input type="range" min={20000} max={2000000} step={10000} value={budget} onChange={e=>setBudget(+e.target.value)}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontSize:10,color:T.textDim}}>{fmt(20000)}</span><span style={{fontSize:10,color:T.textDim}}>{fmt(2000000)}</span></div>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:11,color:T.textDim,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Trip length</div>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>{nights} nights</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <button onClick={()=>{const n=Math.max(1,nights-1);setNights(n);setPropertyStays([{id:1,hotelIdx:0,nights:n,prefs:{rooms:0,basis:0,flexibility:0}}]);setInterTransfers([]);}} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:18,fontFamily:"inherit",flexShrink:0}}>−</button>
            <input type="range" min={1} max={365} step={1} value={nights} onChange={e=>{const n=+e.target.value;setNights(n);setPropertyStays([{id:1,hotelIdx:0,nights:n,prefs:{rooms:0,basis:0,flexibility:0}}]);setInterTransfers([]);}} style={{flex:1}}/>
            <button onClick={()=>{const n=nights+1;setNights(n);setPropertyStays([{id:1,hotelIdx:0,nights:n,prefs:{rooms:0,basis:0,flexibility:0}}]);setInterTransfers([]);}} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:18,fontFamily:"inherit",flexShrink:0}}>+</button>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[4,5,7,10,14,21,28].map(n=>(
              <button key={n} onClick={()=>{setNights(n);setPropertyStays([{id:1,hotelIdx:0,nights:n,prefs:{rooms:0,basis:0,flexibility:0}}]);setInterTransfers([]);}} style={{padding:"4px 12px",borderRadius:20,border:`0.5px solid ${nights===n?T.gold:T.border}`,background:nights===n?T.goldDim:"transparent",color:nights===n?T.gold:T.textDim,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{n}n</button>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:26}}>
          {[{label:"Adults",val:adults,set:setAdults,min:1,max:50},{label:"Children",val:children,set:setChildren,min:0,max:20}].map(f=>(
            <div key={f.label} style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:T.textDim,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>{f.label}</div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button onClick={()=>f.set((v:number)=>Math.max(f.min,v-1))} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:16,fontFamily:"inherit"}}>−</button>
                <span style={{fontSize:18,fontWeight:700,color:T.text,minWidth:20,textAlign:"center"}}>{f.val}</span>
                <button onClick={()=>f.set((v:number)=>v+1)} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:16,fontFamily:"inherit"}}>+</button>
              </div>
            </div>
          ))}
        </div>
        {region&&<div style={{background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:10,padding:"10px 14px",marginBottom:20,fontSize:12,color:T.gold}}>✦ {nights} nights · {REGIONS.find(r=>r.id===region)?.label} · {adults} adult{adults!==1?"s":""} · {fmt(budget)}</div>}
        <button onClick={runPlanner} className="btn-gold" style={{width:"100%",padding:"17px",fontSize:16}}>✦ Build My Itinerary →</button>
        <div style={{textAlign:"center",fontSize:11,color:T.textDim,marginTop:8}}>We confirm every element within 2 hours — most journeys confirmed instantly</div>
      </div>
      {chatOpen&&<ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={()=>setChatOpen(false)}/>}
    </div>
  );

  // ─── RESEARCH ───────────────────────────────────────────────
  if(screen==="inspire-research")return(
    <div style={{minHeight:"100vh",background:T.bg}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet"/>
      <style>{css}</style><Nav/>
      <div className="fade-up" style={{maxWidth:540,margin:"0 auto",padding:"64px 20px",textAlign:"center"}}>
        <div style={{fontSize:44,marginBottom:20,animation:"shimmer 2s ease infinite"}}>✦</div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,marginBottom:8,color:T.text}}>Building your journey</h2>
        <p style={{color:T.textMid,fontSize:14,marginBottom:44,lineHeight:1.6}}>{kbSelected.length>0?`Using ${kbSelected.length} specialist knowledge entries as priority context`:"Reviewing rates, availability, and the perfect sequence"}</p>
        <div style={{textAlign:"left"}}>
          {RESEARCH_STEPS.map((step,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"11px 0",borderBottom:`0.5px solid ${T.border}`,opacity:i<=researchStep?1:0.2,transition:"opacity 0.5s"}}>
              <div style={{width:22,height:22,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {i<researchStep&&<div style={{width:22,height:22,borderRadius:"50%",background:"rgba(74,222,128,0.12)",border:"1.5px solid #4ade80",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:T.green}}>✓</div>}
                {i===researchStep&&<div className="spinner"/>}
                {i>researchStep&&<div style={{width:22,height:22,borderRadius:"50%",background:T.surface,border:`0.5px solid ${T.border}`}}/>}
              </div>
              <span style={{fontSize:13,color:i<=researchStep?T.text:T.textDim}}>{i===0&&kbSelected.length>0?"Applying specialist knowledge base as priority context…":step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── INSPIRE PLAN ───────────────────────────────────────────
  if(screen==="inspire-plan"&&itinerary){
    const CC=[T.gold,"#4ade80","#60a5fa","#a78bfa"];
    const dynamicTotal=itinerary.cities?.reduce((sum:number,city:any)=>sum+(city.estimatedCost||0),0)||itinerary.totalEstimate;
    const dynamicPct=Math.round((dynamicTotal/budget)*100);
    const dynamicNights=itinerary.cities?.reduce((s:number,c:any)=>s+c.nights,0)||nights;
    return(
      <div style={{minHeight:"100vh",background:T.bg}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet"/>
        <style>{css}</style><Nav/>
        <SpecialistBanner specialist={specialist} screen={screen}/>
        <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(8,8,24,0.96)",backdropFilter:"blur(12px)",borderBottom:`0.5px solid ${T.borderGold}`,padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:1}}>Journey estimate</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:T.gold}}>{fmt(dynamicTotal)}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:11,color:T.textDim,textAlign:"right"}}>
              <div>{dynamicNights}n · {itinerary.cities?.length||0} destinations</div>
              <div style={{color:dynamicPct<=100?T.green:T.gold,marginTop:1}}>{dynamicPct<=100?`${fmt(budget-dynamicTotal)} under budget`:`${fmt(dynamicTotal-budget)} over budget`}</div>
            </div>
            <button className="btn-gold" style={{padding:"9px 16px",fontSize:13}} onClick={()=>{
              if(itinerary?.cities?.length>0){
                const stack=HOTELS_BY_MARGIN;
                const newStays=itinerary.cities.map((city:any,i:number)=>{
                  const match=stack.findIndex(h=>h.country?.toLowerCase()===city.country?.toLowerCase()||h.location?.toLowerCase().includes(city.city?.split(' ')[0]?.toLowerCase()||''));
                  return{id:i+1,hotelIdx:match>=0?match:i%stack.length,nights:city.nights||3,prefs:{rooms:0,basis:0,flexibility:0}};
                });
                setPropertyStays(newStays);
                setNights(newStays.reduce((s:number,s2:any)=>s+s2.nights,0));
              }
              setActivePillars(["flights","hotels","transfers","activities"]);
              setScreen("builder");
            }}>Price & Book →</button>
          </div>
        </div>
        <div className="fade-up" style={{maxWidth:700,margin:"0 auto",padding:"28px 20px 80px"}}>
          <div style={{marginBottom:22}}>
            <div style={{fontSize:11,color:T.gold,letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:600,marginBottom:6}}>Your Itinerary</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:27,fontWeight:700,marginBottom:8,color:T.text}}>{itinerary.title}</h2>
            <p style={{fontSize:14,color:T.textMid,lineHeight:1.65,marginBottom:12}}>{itinerary.summary}</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:12,background:T.surface,border:`0.5px solid ${T.border}`,padding:"4px 11px",borderRadius:20,color:T.textMid}}>✈ {itinerary.routing}</span>
              <span style={{fontSize:12,background:T.surface,border:`0.5px solid ${T.border}`,padding:"4px 11px",borderRadius:20,color:T.textMid}}>🗓 {dynamicNights}n · {itinerary.cities.length} dest.</span>
              {kbSelected.length>0&&<span style={{fontSize:12,background:"rgba(212,175,55,0.08)",border:`0.5px solid ${T.borderGold}`,padding:"4px 11px",borderRadius:20,color:T.gold}}>📚 Specialist-informed</span>}
            </div>
          </div>

          <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:"14px 16px",marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
              <span style={{fontSize:12,color:T.textMid}}>Total estimate</span>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:23,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif",transition:"all 0.3s"}}>{fmt(dynamicTotal)}</span>
                <span style={{fontSize:12,color:T.textDim}}>of {fmt(budget)}</span>
              </div>
            </div>
            <div style={{height:3,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(dynamicPct,100)}%`,background:dynamicPct>100?T.amber:T.green,borderRadius:2,transition:"width 0.5s ease"}}/></div>
            <div style={{fontSize:11,color:T.textDim,marginTop:5}}>{dynamicPct<=100?`${fmt(budget-dynamicTotal)} remaining`:`${fmt(dynamicTotal-budget)} over estimate`}</div>
          </div>

          {itinerary.cities.map((city:any,idx:number)=>{
            const c=CC[idx%CC.length];
            return(
              <div key={idx}>
                <div className="city-card" style={{borderLeft:`3px solid ${c}28`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:34,height:34,borderRadius:8,background:`${c}18`,border:`1px solid ${c}38`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:c}}>{idx+1}</div>
                      <div><div style={{fontSize:17,fontWeight:700,fontFamily:"'Playfair Display',serif",color:T.text}}>{city.city}</div><div style={{fontSize:12,color:T.textMid}}>{city.country}</div></div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"4px 10px"}}>
                        <button onClick={()=>{const cs=[...itinerary.cities];cs[idx]={...cs[idx],nights:Math.max(1,cs[idx].nights-1),estimatedCost:Math.round(cs[idx].estimatedCost*(Math.max(1,cs[idx].nights-1)/cs[idx].nights))};setItinerary({...itinerary,cities:cs});}} style={{background:"none",border:"none",color:T.textMid,cursor:"pointer",fontSize:15,padding:0,fontFamily:"inherit"}}>−</button>
                        <span style={{fontSize:13,fontWeight:600,minWidth:36,textAlign:"center",color:T.text}}>{city.nights}n</span>
                        <button onClick={()=>{const cs=[...itinerary.cities];cs[idx]={...cs[idx],nights:cs[idx].nights+1,estimatedCost:Math.round(cs[idx].estimatedCost*((cs[idx].nights+1)/cs[idx].nights))};setItinerary({...itinerary,cities:cs});}} style={{background:"none",border:"none",color:T.textMid,cursor:"pointer",fontSize:15,padding:0,fontFamily:"inherit"}}>+</button>
                      </div>
                      {itinerary.cities.length>1&&<button onClick={()=>setItinerary({...itinerary,cities:itinerary.cities.filter((_:any,i:number)=>i!==idx)})} style={{background:"rgba(248,113,113,0.08)",border:"0.5px solid rgba(248,113,113,0.2)",borderRadius:8,padding:"4px 10px",fontSize:11,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>}
                    </div>
                  </div>
                  <div style={{fontSize:12,color:T.textDim,lineHeight:1.55,marginBottom:10,fontStyle:"italic"}}>"{city.why}"</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>{(city.highlights||[]).map((h:string,i:number)=><span key={i} style={{fontSize:11,background:"rgba(255,255,255,0.05)",color:T.textMid,padding:"3px 9px",borderRadius:6}}>✦ {h}</span>)}</div>
                  <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:11,color:T.textDim}}>✦ All-inclusive · flights, lodge, transfers & activities</div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:18,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif",transition:"all 0.3s"}}>{fmt(city.estimatedCost)}</div>
                      <div style={{fontSize:10,color:T.textDim}}>{city.nights} nights · all in</div>
                    </div>
                  </div>
                  {(city.arrivalGap||city.departureGap)&&<div style={{borderTop:`0.5px solid ${T.border}`,paddingTop:8}}>
                    {city.arrivalGap&&<div style={{fontSize:11,color:"rgba(212,175,55,0.7)",marginBottom:3,lineHeight:1.5}}>🛬 <strong style={{color:T.gold}}>On arrival:</strong> {city.arrivalGap}</div>}
                    {city.departureGap&&<div style={{fontSize:11,color:"rgba(96,165,250,0.7)",lineHeight:1.5}}>🛫 <strong style={{color:"#60a5fa"}}>Before departure:</strong> {city.departureGap}</div>}
                  </div>}

                  {/* Lodge swipe — destination matched via matchDestination() */}
                  {(()=>{
                    const matcher=matchDestination(city.city,city.country);
                    const matched=HOTELS_BY_MARGIN.filter(matcher);
                    const countryFallback=HOTELS_BY_MARGIN.filter(h=>h.country?.toLowerCase()===city.country?.toLowerCase());
                    const safeStack=matched.length>0?matched:countryFallback.length>0?countryFallback:HOTELS_BY_MARGIN;
                    const rawIdx=cityHotelIdxs[idx]??0;
                    const currentIdx=rawIdx%safeStack.length;
                    const hotel=safeStack[currentIdx]||safeStack[0];
                    return(
                      <div style={{borderTop:`0.5px solid ${T.border}`,paddingTop:12,marginTop:10}}>
                        <div style={{fontSize:10,color:T.gold,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,marginBottom:8}}>
                          Selected lodge · {hotel.destination||city.city} <span style={{color:T.textDim,fontWeight:400,fontSize:9}}>({safeStack.length} option{safeStack.length!==1?'s':''})</span>
                        </div>
                        <div style={{background:T.bg,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                          <div style={{fontSize:14,fontWeight:700,color:T.text,fontFamily:"'Playfair Display',serif",marginBottom:2}}>{hotel.name}</div>
                          <div style={{fontSize:11,color:T.textDim}}>{hotel.location}</div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>setCityHotelIdxs(prev=>{const n=[...prev];n[idx]=Math.max(0,(n[idx]??0)-1);return n;})} disabled={(cityHotelIdxs[idx]??0)===0} style={{flex:1,padding:"8px",borderRadius:9,border:`0.5px solid ${T.border}`,background:T.surface,color:T.textMid,cursor:(cityHotelIdxs[idx]??0)===0?"not-allowed":"pointer",opacity:(cityHotelIdxs[idx]??0)===0?0.35:1,fontFamily:"inherit",fontSize:12}}>← Prev</button>
                          <div style={{flex:1,textAlign:"center",fontSize:11,color:T.textDim,display:"flex",alignItems:"center",justifyContent:"center"}}>{currentIdx+1} of {safeStack.length}</div>
                          <button onClick={()=>setCityHotelIdxs(prev=>{const n=[...prev];n[idx]=Math.min(safeStack.length-1,(n[idx]??0)+1);return n;})} disabled={(cityHotelIdxs[idx]??0)>=safeStack.length-1} style={{flex:1,padding:"8px",borderRadius:9,border:`0.5px solid ${T.border}`,background:T.surface,color:T.textMid,cursor:(cityHotelIdxs[idx]??0)>=safeStack.length-1?"not-allowed":"pointer",opacity:(cityHotelIdxs[idx]??0)>=safeStack.length-1?0.35:1,fontFamily:"inherit",fontSize:12}}>Next →</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Transfer spool */}
                {idx<itinerary.cities.length-1&&(()=>{
                  const nextCity=itinerary.cities[idx+1];
                  const isSameCountry=city.country===nextCity.country;
                  const opts=isSameCountry
                    ?[{icon:'✈',label:'Bush charter',time:'45–90 min',price:'R 8,200',recommended:true},{icon:'🚗',label:'Private road transfer',time:'2–4 hours',price:'R 3,800',recommended:false}]
                    :[{icon:'✈',label:'Regional flight',time:'2–5 hrs',price:'R 14,500',recommended:true},{icon:'🚌',label:'Charter + road',time:'4–6 hrs',price:'R 9,200',recommended:false}];
                  const selIdx2=cityTransferIdxs[idx]??0;
                  const sel2=opts[Math.min(selIdx2,opts.length-1)]||opts[0];
                  return(
                    <div style={{margin:'12px 0',background:'rgba(96,165,250,0.05)',border:'0.5px solid rgba(96,165,250,0.2)',borderRadius:12,padding:'12px 16px'}}>
                      <div style={{fontSize:10,color:'#60a5fa',textTransform:'uppercase' as const,letterSpacing:'0.1em',fontWeight:700,marginBottom:8}}>{sel2.icon} Transfer · {city.city.split(' ')[0]} → {nextCity.city.split(' ')[0]}</div>
                      <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap' as const}}>
                        {opts.map((t,ti)=>(
                          <button key={ti} onClick={()=>setCityTransferIdxs(prev=>{const n=[...prev];n[idx]=ti;return n;})} style={{padding:'5px 12px',borderRadius:20,border:`0.5px solid ${selIdx2===ti?'#60a5fa':T.border}`,background:selIdx2===ti?'rgba(96,165,250,0.12)':'transparent',color:selIdx2===ti?'#60a5fa':T.textDim,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                            {t.icon} {t.label}{t.recommended?' ✦':''}
                          </button>
                        ))}
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{fontSize:11,color:T.textDim}}>⏱ {sel2.time}</div>
                        <div style={{fontSize:13,fontWeight:700,color:'#60a5fa'}}>{sel2.price}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}

          <button onClick={async()=>{
            setInspireChatInput(`Suggest the best destination to add after ${itinerary.cities[itinerary.cities.length-1]?.city}. Consider budget R${Math.round(budget||120000).toLocaleString()}, ${nights} nights total. Give me a specific lodge recommendation.`);
            setTimeout(()=>document.getElementById('inspire-send-btn')?.click(),50);
          }} style={{width:"100%",padding:"12px",borderRadius:12,border:`1px dashed ${T.borderGold}`,background:"rgba(212,175,55,0.04)",color:T.gold,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:18}}>+</span> Add another destination
          </button>

          {itinerary.aiInsights?.length>0&&<div style={{background:"rgba(212,175,55,0.05)",border:`0.5px solid ${T.borderGold}`,borderRadius:14,padding:"16px 18px",marginBottom:16}}>
            <div style={{fontSize:11,color:"rgba(212,175,55,0.7)",fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:10}}>Rate insights</div>
            {itinerary.aiInsights.map((ins:string,i:number)=><div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:12,color:T.textMid,lineHeight:1.55}}><span style={{color:T.gold,flexShrink:0}}>✦</span>{ins}</div>)}
          </div>}
          {itinerary.warnings?.length>0&&itinerary.warnings[0]&&<div style={{background:"rgba(251,146,60,0.07)",border:"0.5px solid rgba(251,146,60,0.22)",borderRadius:12,padding:"12px 16px",marginBottom:16}}>{itinerary.warnings.map((w:string,i:number)=><div key={i} style={{fontSize:12,color:"rgba(251,146,60,0.9)",lineHeight:1.55}}>⚠ {w}</div>)}</div>}
          <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:"12px 16px",marginBottom:20,fontSize:12,color:T.textMid,lineHeight:1.6}}>🗓 <strong style={{color:T.text}}>Best timing:</strong> {itinerary.bestTiming}</div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
            <button className="btn-gold" style={{padding:"16px",fontSize:15}} onClick={()=>{
              if(itinerary?.cities?.length>0){
                const stack=HOTELS_BY_MARGIN;
                const newStays=itinerary.cities.map((city:any,i:number)=>{
                  const hotelIdx=cityHotelIdxs[i]??i%stack.length;
                  return{id:i+1,hotelIdx,nights:city.nights||3,prefs:{rooms:0,basis:0,flexibility:0}};
                });
                setPropertyStays(newStays);
                setNights(newStays.reduce((s:number,s2:any)=>s+s2.nights,0));
              }
              setActivePillars(["flights","hotels","transfers","activities"]);
              setScreen("builder");
            }}>Price & Book This →</button>
            <button onClick={runPlanner} className="btn-ghost" style={{padding:"16px",fontSize:14}}>🔄 Rebuild itinerary</button>
          </div>

          {/* ── CHAT — now with fixed sendInspireChat ── */}
          <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:16,overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:30,height:30,borderRadius:8,background:T.goldDim,border:`0.5px solid ${T.borderGold}`,display:"flex",alignItems:"center",justifyContent:"center"}}>✦</div>
              <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>Enhance my recommendation</div><div style={{fontSize:11,color:T.textDim}}>Tell us what to adjust — the itinerary updates live</div></div>
            </div>
            <div style={{padding:"10px 16px",borderBottom:`0.5px solid ${T.border}`,display:"flex",gap:6,flexWrap:"wrap"}}>
              {["Make it cheaper","Extend by 2 nights","Add a beach stop","Fewer destinations","What visas do I need?","Best time to go?"].map(q=>(
                <button key={q} onClick={()=>{
                  if(q==='Fewer destinations'&&itinerary?.cities?.length>1){
                    const cheapest=itinerary.cities.reduce((min:any,city:any)=>city.estimatedCost<min.estimatedCost?city:min,itinerary.cities[0]);
                    const updated={...itinerary,cities:itinerary.cities.filter((city:any)=>city!==cheapest)};
                    setItinerary(updated);
                    setInspireChatMsgs(m=>[...m,{role:'user',text:q},{role:'assistant',text:`I've removed ${cheapest.city} from your itinerary — it had the lowest value relative to your budget. Your journey is now ${updated.cities.length} destinations.`}]);
                    return;
                  }
                  setInspireChatInput(q);
                  setTimeout(()=>document.getElementById('inspire-send-btn')?.click(),50);
                }} style={{fontSize:11,padding:"4px 10px",borderRadius:20,border:`0.5px solid ${T.border}`,background:"rgba(255,255,255,0.04)",color:T.textMid,cursor:"pointer",fontFamily:"inherit"}}>{q}</button>
              ))}
            </div>
            <div style={{maxHeight:220,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              {inspireChatMsgs.map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                  <div style={{maxWidth:"88%",padding:"9px 13px",borderRadius:m.role==="user"?"13px 13px 3px 13px":"13px 13px 13px 3px",background:m.role==="user"?"rgba(212,175,55,0.1)":T.surface,border:`0.5px solid ${m.role==="user"?T.borderGold:T.border}`,fontSize:13,color:T.text,lineHeight:1.6}}>
                    {m.text}
                    {m.revert&&<button onClick={()=>{setItinerary(m.revert);setInspireChatMsgs(msgs=>[...msgs,{role:"assistant",text:"No problem — I've restored your previous itinerary."}]);}} style={{display:"block",marginTop:8,background:"rgba(255,255,255,0.06)",border:`0.5px solid ${T.border}`,color:T.textDim,borderRadius:7,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>↩ Revert to previous</button>}
                  </div>
                </div>
              ))}
              {inspireChatLoading&&<div style={{display:"flex",gap:4,padding:"8px 12px"}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.gold,animation:`pulse 1.2s ease ${i*0.2}s infinite`}}/>)}</div>}
              <div ref={inspireChatEndRef}/>
            </div>
            <div style={{padding:"10px 14px",borderTop:`0.5px solid ${T.border}`,display:"flex",gap:8}}>
              <input value={inspireChatInput} onChange={e=>setInspireChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendInspireChat()} placeholder="e.g. Make it cheaper · Add gorilla trekking · Swap Sabi Sand for Okavango..." style={{flex:1,background:"rgba(255,255,255,0.05)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:9,padding:"9px 13px",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
              <button id="inspire-send-btn" onClick={sendInspireChat} className="btn-gold" style={{padding:"9px 14px",fontSize:13}}>→</button>
            </div>
          </div>
        </div>
        {chatOpen&&<ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={()=>setChatOpen(false)}/>}
      </div>
    );
  }

  // ─── MY BRIEF ───────────────────────────────────────────────
  if(screen==="my-brief")return(
    <MsBriefScreen nights={nights} setNights={setNights} adults={adults} setAdults={setAdults} children={children} setChildren={setChildren} currency={currency} onBack={()=>setScreen("landing")} onBuild={(briefText:string)=>{
      setInspiresAnswers({"brief":briefText,"adults":String(adults),"children":String(children),"nights":String(nights)});
      setScreen("inspire-research");setResearchStep(0);
      setTimeout(()=>runPlannerFromBrief(briefText),400);
    }}/>
  );

  // ─── BUILDER ────────────────────────────────────────────────
  if(screen==="builder"){
    const pc=(p:Pillar)=>({flights:T.gold,hotels:"#4ade80",transfers:"#60a5fa",activities:"#a78bfa"}[p]);
    return(
      <div style={{minHeight:"100vh",background:T.bg}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet"/>
        <style>{css}</style><Nav/><StickyBanner/><SpecialistBanner specialist={specialist} screen={screen}/>
        <div style={{maxWidth:900,margin:"0 auto",padding:"28px 20px 80px"}}>
          {/* Trip controls */}
          <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:14,padding:"16px 18px",marginBottom:22}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,alignItems:"center"}}>
              <div>
                <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600,marginBottom:6}}>Nights</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={()=>{const n=Math.max(1,nights-1);setNights(n);if(propertyStays.length===1)setPropertyStays([{...propertyStays[0],nights:n}]);}} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,width:26,height:26,borderRadius:6,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>−</button>
                  <span style={{fontSize:16,fontWeight:700,color:T.text,minWidth:28,textAlign:"center"}}>{nights}</span>
                  <button onClick={()=>{const n=nights+1;setNights(n);if(propertyStays.length===1)setPropertyStays([{...propertyStays[0],nights:n}]);}} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,width:26,height:26,borderRadius:6,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>+</button>
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600,marginBottom:6}}>Adults</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={()=>setAdults(a=>Math.max(1,a-1))} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,width:26,height:26,borderRadius:6,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>−</button>
                  <span style={{fontSize:16,fontWeight:700,color:T.text,minWidth:28,textAlign:"center"}}>{adults}</span>
                  <button onClick={()=>setAdults(a=>a+1)} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,width:26,height:26,borderRadius:6,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>+</button>
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600,marginBottom:6}}>Currency</div>
                <select value={currency.code} onChange={e=>setCurrency(CURRENCIES.find(c=>c.code===e.target.value)!)} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,borderRadius:8,padding:"5px 10px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer",width:"100%"}}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}</select>
              </div>
              <div>
                <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600,marginBottom:6}}>Intl flights</div>
                <button onClick={()=>setIncludeIntlFlight(x=>!x)} style={{width:"100%",padding:"5px 8px",borderRadius:8,border:`1.5px solid ${includeIntlFlight?T.gold:T.border}`,background:includeIntlFlight?T.goldDim:T.bg3,color:includeIntlFlight?T.gold:T.textMid,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{includeIntlFlight?"✓ Included":"+ Add"}</button>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginTop:12,paddingTop:12,borderTop:`0.5px solid ${T.border}`,flexWrap:"wrap"}}>
              <div style={{fontSize:10,color:T.gold,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600}}>Ideal travel dates</div>
              <input type="date" value={travelDate} onChange={e=>setTravelDate(e.target.value)} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,borderRadius:8,padding:"5px 10px",fontSize:12,outline:"none",fontFamily:"inherit",cursor:"pointer"}}/>
              <select value={flexDays} onChange={e=>setFlexDays(Number(e.target.value))} style={{background:T.bg3,border:`0.5px solid ${T.border}`,color:T.text,borderRadius:8,padding:"5px 8px",fontSize:12,outline:"none",fontFamily:"inherit"}}>
                {[0,3,7,14].map(d=><option key={d} value={d}>{d===0?"Exact dates":`±${d} days`}</option>)}
              </select>
            </div>
            {includeIntlFlight&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:`0.5px solid ${T.border}`}}>
                <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600,marginBottom:6}}>Flying from</div>
                <select value={builderIntlOrigin} onChange={e=>{setBuilderIntlOrigin(e.target.value);setIntlFlightIdx(0);}} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
                  {INTERNATIONAL_ORIGINS.map(o=><option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Pillar selector */}
          <div style={{marginBottom:24}}>
            <div style={{fontSize:11,color:T.textDim,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>Select components</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {[{id:"flights" as Pillar,label:"Flights",icon:"✈",desc:"Charter & regional"},{id:"hotels" as Pillar,label:"Lodges",icon:"🏕",desc:"Split across properties"},{id:"transfers" as Pillar,label:"Transfers",icon:"🚗",desc:"Ground & game drives"},{id:"activities" as Pillar,label:"Activities",icon:"🦁",desc:"Experiences & extras"}].map(p=>(
                <button key={p.id} onClick={()=>togglePillar(p.id)} style={{padding:"14px 8px",borderRadius:12,border:`1.5px solid ${activePillars.includes(p.id)?T.gold:T.border}`,background:activePillars.includes(p.id)?T.goldDim:T.surface,cursor:"pointer",fontFamily:"inherit",position:"relative",textAlign:"center"}}>
                  {activePillars.includes(p.id)&&<div style={{position:"absolute",top:6,right:6,width:14,height:14,borderRadius:"50%",background:T.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#0a0a0a",fontWeight:800}}>✓</div>}
                  <div style={{fontSize:20,marginBottom:4}}>{p.icon}</div>
                  <div style={{fontSize:12,fontWeight:600,color:activePillars.includes(p.id)?T.gold:T.text}}>{p.label}</div>
                  <div style={{fontSize:10,color:T.textDim,marginTop:2}}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* International flight */}
          {includeIntlFlight&&relevantIntlFlights.length>0&&(()=>{
            const fl=relevantIntlFlights[intlFlightIdx%relevantIntlFlights.length];
            const display=Math.round((fl.netRate*totalPax+(intlFlightUpgrade as number))*MARGINS.intl);
            const saving=fl.otaRate?Math.round(fl.otaRate*totalPax-display):null;
            return(
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontSize:11,color:"#60a5fa",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>✈ International flight · {builderIntlOrigin} → JNB</div>
                  <div style={{fontSize:11,color:T.textDim}}>{intlFlightIdx%relevantIntlFlights.length+1}/{relevantIntlFlights.length}</div>
                </div>
                <div className="card">
                  <div style={{position:"relative",height:160,overflow:"hidden"}}>
                    <img src={fl.image} alt={fl.airline} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 50%)"}}/>
                    {saving&&saving>0&&<div style={{position:"absolute",bottom:10,left:10,background:"rgba(74,222,128,0.1)",border:"0.5px solid rgba(74,222,128,0.22)",borderRadius:8,padding:"4px 10px",display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:11,color:T.textDim,textDecoration:"line-through"}}>{fmt(fl.otaRate!*totalPax)}</span><span style={{fontSize:11,color:T.green,fontWeight:700}}>Save {fmt(saving)}</span></div>}
                  </div>
                  <div style={{padding:"13px 15px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div><div style={{fontSize:16,fontWeight:700,fontFamily:"'Playfair Display',serif",color:T.text}}>{fl.airline}</div><div style={{fontSize:12,color:T.textMid}}>{builderIntlOrigin} → JNB · {fl.duration}</div></div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setIntlFlightIdx(i=>Math.max(0,i-1))} disabled={intlFlightIdx===0} style={{flex:1,padding:"9px",borderRadius:9,border:`0.5px solid ${T.border}`,background:T.bg3,color:T.textMid,cursor:intlFlightIdx===0?"not-allowed":"pointer",opacity:intlFlightIdx===0?0.35:1,fontFamily:"inherit",fontSize:12}}>← Prev</button>
                      <button onClick={()=>setCustomise({pillar:"intl" as any,idx:intlFlightIdx})} style={{flex:2,padding:"9px",borderRadius:9,border:`1px solid ${T.borderGold}`,background:T.goldDim,color:T.gold,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600}}>Customise →</button>
                      <button onClick={()=>setIntlFlightIdx(i=>Math.min(relevantIntlFlights.length-1,i+1))} disabled={intlFlightIdx>=relevantIntlFlights.length-1} style={{flex:1,padding:"9px",borderRadius:9,border:`0.5px solid ${T.border}`,background:T.bg3,color:T.textMid,cursor:intlFlightIdx>=relevantIntlFlights.length-1?"not-allowed":"pointer",opacity:intlFlightIdx>=relevantIntlFlights.length-1?0.35:1,fontFamily:"inherit",fontSize:12}}>Next →</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Regional flights */}
          {activePillars.includes("flights")&&(()=>{
            const item=FLIGHTS[flightIdx];
            const display=Math.round((item.netRate*totalPax+(flightUpgrade as number))*MARGINS.flights);
            const saving=item.otaRate?Math.round(item.otaRate*totalPax-display):null;
            return(<div style={{marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:11,color:T.gold,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>✈ Regional / charter flights</div><div style={{fontSize:11,color:T.textDim}}>{flightIdx+1}/{FLIGHTS.length}</div></div><PillarCard item={item} displayRate={display} otaSaving={saving} totalPax={totalPax} nights={nights} pillar="flights" pillarColor={T.gold} fmt={fmt} T={T} upgrades={upgrades.flights} hotelResolved={{}} hotelMismatches={[]} onPrev={()=>setFlightIdx(i=>Math.max(0,i-1))} onNext={()=>setFlightIdx(i=>Math.min(FLIGHTS.length-1,i+1))} isPrevDisabled={flightIdx===0} isNextDisabled={flightIdx===FLIGHTS.length-1} onCustomise={()=>setCustomise({pillar:"flights",idx:flightIdx})}/></div>);
          })()}

          {/* Lodges */}
          {activePillars.includes("hotels")&&(
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:11,color:"#4ade80",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>🏕 Lodges</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{fontSize:11,color:nightsBalanced?T.textDim:T.amber}}>{totalPropertyNights}/{nights}n {nightsBalanced?"✓":"⚠"}</div>
                  {preloading&&<div style={{fontSize:10,color:T.textDim,display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",border:"1.5px solid rgba(74,222,128,0.4)",borderTopColor:"#4ade80",animation:"spin 0.75s linear infinite"}}/>checking…</div>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:10,padding:"10px 14px"}}>
                <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>Check-in</div>
                <input type="date" value={checkinDate} onChange={e=>setCheckinDate(e.target.value)} style={{background:"transparent",border:`0.5px solid ${T.border}`,color:T.text,borderRadius:8,padding:"5px 10px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"}}/>
                <div style={{fontSize:12,color:T.textMid}}>· check-out <strong style={{color:T.text}}>{addDays(checkinDate,nights)}</strong></div>
              </div>
              {propertyStays.map((stay,stayIdx)=>{
                const stack=availableHotelStack.length>0?availableHotelStack:HOTELS_BY_MARGIN;
                const clampedIdx=Math.min(stay.hotelIdx,stack.length-1);
                const hotel=stack[clampedIdx]||HOTELS[0];
                const{resolved,mismatches}=resolveHotelUpgrades(hotel,stay.prefs);
                const upgradeExtra=Object.values(resolved).reduce((s:number,v:any)=>s+(v?.extra||0),0);
                const net=hotel.netRate*stay.nights+upgradeExtra;
                const display=Math.round(net*MARGINS.hotels);
                const saving=hotel.otaRate?Math.round(hotel.otaRate*stay.nights-display):null;
                const sc=["#4ade80","#d4af37","#a78bfa"][stayIdx%3];
                return(
                  <div key={stay.id}>
                    {stayIdx>0&&interTransfers[stayIdx-1]&&(()=>{
                      const it=interTransfers[stayIdx-1];
                      const tr=INTER_TRANSFERS.find(t=>t.id===it.transferId)||INTER_TRANSFERS[0];
                      const fh=stack[Math.min(propertyStays[stayIdx-1].hotelIdx,stack.length-1)]||HOTELS[0];
                      const th=stack[Math.min(stay.hotelIdx,stack.length-1)]||HOTELS[0];
                      return(
                        <div className="inter-transfer" onClick={()=>toggleInterTransfer(stayIdx-1)}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(96,165,250,0.12)",border:"0.5px solid rgba(96,165,250,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{tr.icon}</div>
                              <div><div style={{fontSize:12,fontWeight:600,color:"#60a5fa"}}>{tr.label}</div><div style={{fontSize:11,color:T.textDim}}>{fh.location.split(",")[0]} → {th.location.split(",")[0]} · {tr.duration}</div></div>
                            </div>
                            <span style={{fontSize:13,fontWeight:600,color:"#60a5fa"}}>{fmt(Math.round(tr.netRate*MARGINS.transfers))}</span>
                          </div>
                          {it.expanded&&(
                            <div style={{marginTop:10,paddingTop:10,borderTop:"0.5px solid rgba(96,165,250,0.15)"}}>
                              <div style={{fontSize:12,color:T.textMid,lineHeight:1.6,marginBottom:8}}>{tr.note}</div>
                              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                {INTER_TRANSFERS.filter(t=>t.applicableRegions.some(([a,b])=>a===fh.region&&b===th.region)).map(t=>(
                                  <button key={t.id} onClick={e=>{e.stopPropagation();setInterTransfers(prev=>prev.map((it2,i)=>i===stayIdx-1?{...it2,transferId:t.id}:it2));}} style={{fontSize:11,padding:"4px 10px",borderRadius:20,border:`0.5px solid ${it.transferId===t.id?"#60a5fa":T.border}`,background:it.transferId===t.id?"rgba(96,165,250,0.12)":"transparent",color:it.transferId===t.id?"#60a5fa":T.textMid,cursor:"pointer",fontFamily:"inherit"}}>
                                    {t.icon} {t.label} · {fmt(Math.round(t.netRate*MARGINS.transfers))}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="property-card" style={{borderLeft:`3px solid ${sc}30`,marginBottom:4}}>
                      <div style={{padding:"12px 14px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:22,height:22,borderRadius:6,background:`${sc}20`,border:`1px solid ${sc}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:sc}}>{stayIdx+1}</div>
                          <span style={{fontSize:11,color:sc,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>Property {stayIdx+1}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"3px 8px"}}>
                            <button onClick={()=>updateStayNights(stayIdx,-1)} style={{background:"none",border:"none",color:T.textMid,cursor:"pointer",fontSize:14,padding:0,fontFamily:"inherit"}}>−</button>
                            <span style={{fontSize:13,fontWeight:600,color:T.text,minWidth:32,textAlign:"center"}}>{stay.nights}n</span>
                            <button onClick={()=>updateStayNights(stayIdx,1)} style={{background:"none",border:"none",color:T.textMid,cursor:"pointer",fontSize:14,padding:0,fontFamily:"inherit"}}>+</button>
                          </div>
                          {propertyStays.length>1&&<button onClick={()=>removePropertyStay(stayIdx)} style={{background:"rgba(248,113,113,0.08)",border:"0.5px solid rgba(248,113,113,0.18)",borderRadius:8,padding:"3px 8px",fontSize:11,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>}
                        </div>
                      </div>
                      <div style={{position:"relative",height:170,margin:"10px 0 0",overflow:"hidden"}}>
                        <img src={hotel.image} alt={hotel.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 50%)"}}/>
                        <div style={{position:"absolute",top:8,right:8}} className="trust-pill"><span>★</span>{hotel.trustScore}/100</div>
                        {saving&&saving>0?<div style={{position:"absolute",bottom:8,left:8,background:"rgba(74,222,128,0.1)",border:"0.5px solid rgba(74,222,128,0.22)",borderRadius:8,padding:"3px 9px",display:"flex",gap:7,alignItems:"center"}}><span style={{fontSize:11,color:T.textDim,textDecoration:"line-through"}}>{fmt(hotel.otaRate||0)}/n</span><span style={{fontSize:11,color:T.green,fontWeight:700}}>Save {fmt(saving)}</span></div>:<div style={{position:"absolute",bottom:8,left:8,background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:8,padding:"3px 9px",fontSize:11,color:T.gold,fontWeight:600}}>✦ Exclusive rate</div>}
                      </div>
                      <div style={{padding:"12px 14px 14px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <div><div style={{fontSize:16,fontWeight:700,fontFamily:"'Playfair Display',serif",color:T.text}}>{hotel.name}</div><div style={{fontSize:12,color:T.textMid,marginTop:1}}>{hotel.location}</div></div>
                        </div>
                        {hotel.funFact&&<div className="fun-fact">✦ {hotel.funFact}</div>}

                        {/* Availability */}
                        {(()=>{
                          const supplierId=String(hotel.id);
                          const r=availMap.get(supplierId);
                          const alt=altDates.get(supplierId);
                          const isChecking=preloading&&!r;
                          const isAvail=r?.available===true;
                          const bestOption=r?.options?.[0];
                          return(
                            <div style={{marginTop:10}}>
                              {isChecking&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:"rgba(255,255,255,0.04)",borderRadius:8,fontSize:11,color:T.textDim}}><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",border:"1.5px solid rgba(74,222,128,0.3)",borderTopColor:"#4ade80",animation:"spin 0.75s linear infinite"}}/>Confirming availability…</div>}
                              {isAvail&&bestOption&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(74,222,128,0.06)",border:"0.5px solid rgba(74,222,128,0.2)",borderRadius:8}}><div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",flexShrink:0}}/><span style={{fontSize:11,color:"#4ade80",fontWeight:600}}>Available · {bestOption.label}</span></div>}
                              {r&&!r.available&&alt&&<div style={{background:"rgba(212,175,55,0.06)",border:`0.5px solid ${T.borderGold}`,borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:11,color:T.gold,fontWeight:600,marginBottom:6}}>Not available {checkinDate} — but we found a slot</div><div style={{fontSize:12,color:T.textMid,marginBottom:10}}><strong style={{color:T.text}}>{hotel.name}</strong> available from <strong style={{color:T.gold}}>{alt.date}</strong> ({alt.delta>0?`+${alt.delta}`:`${alt.delta}`} days)</div><div style={{display:"flex",gap:8}}><button onClick={()=>acceptAltDate(stayIdx,alt.date,alt.delta)} className="btn-gold" style={{flex:2,padding:"9px 14px",fontSize:12}}>Shift to {alt.date} →</button><button onClick={()=>updateStayHotel(stayIdx,1)} className="btn-ghost" style={{flex:1,padding:"9px",fontSize:11}}>Next lodge</button></div></div>}
                              {r&&!r.available&&alt===null&&<div style={{padding:"8px 12px",background:"rgba(255,255,255,0.03)",border:`0.5px solid ${T.border}`,borderRadius:8,fontSize:11,color:T.textDim}}>No availability ±3 days — swipe to another property</div>}
                              {r&&<button onClick={()=>refreshStayAvailability(stayIdx)} style={{marginTop:6,background:"none",border:"none",color:T.textDim,fontSize:10,cursor:"pointer",fontFamily:"inherit",padding:0,textDecoration:"underline"}}>↻ Refresh</button>}
                            </div>
                          );
                        })()}

                        <div style={{display:"flex",gap:8,marginTop:12}}>
                          <button onClick={()=>updateStayHotel(stayIdx,-1)} disabled={stay.hotelIdx===0} style={{flex:1,padding:"9px",borderRadius:9,border:`0.5px solid ${T.border}`,background:T.bg3,color:T.textMid,cursor:stay.hotelIdx===0?"not-allowed":"pointer",opacity:stay.hotelIdx===0?0.35:1,fontFamily:"inherit",fontSize:12}}>← Prev</button>
                          <button onClick={()=>setCustomise({pillar:"hotels",stayId:stay.id,idx:stayIdx})} style={{flex:2,padding:"9px",borderRadius:9,border:`1px solid ${T.borderGold}`,background:T.goldDim,color:T.gold,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600}}>Customise →</button>
                          <button onClick={()=>updateStayHotel(stayIdx,1)} disabled={stay.hotelIdx>=stack.length-1} style={{flex:1,padding:"9px",borderRadius:9,border:`0.5px solid ${T.border}`,background:T.bg3,color:T.textMid,cursor:stay.hotelIdx>=stack.length-1?"not-allowed":"pointer",opacity:stay.hotelIdx>=stack.length-1?0.35:1,fontFamily:"inherit",fontSize:12}}>Next →</button>
                        </div>
                        <div style={{display:"flex",justifyContent:"center",gap:5,marginTop:10}}>
                          {stack.map((_,i)=><div key={i} onClick={()=>setPropertyStays(prev=>prev.map((s,si)=>si===stayIdx?{...s,hotelIdx:i}:s))} style={{width:i===clampedIdx?16:6,height:6,borderRadius:3,background:i===clampedIdx?"#4ade80":"rgba(255,255,255,0.14)",cursor:"pointer",transition:"all 0.25s"}}/>)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {propertyStays.length<3&&<button onClick={addPropertyStay} style={{width:"100%",padding:"13px",borderRadius:12,border:`1.5px dashed ${T.borderGold}`,background:"transparent",color:T.gold,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8}} onMouseEnter={e=>(e.currentTarget.style.background=T.goldDim)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                <span style={{fontSize:16,fontWeight:300}}>+</span> Add property ({propertyStays.length}/3)
              </button>}
            </div>
          )}

          {/* Transfers */}
          {activePillars.includes("transfers")&&(()=>{
            const item=TRANSFERS[transferIdx];
            const display=Math.round(((item.netRate as number)+(transferUpgrade as number))*MARGINS.transfers);
            const saving=item.otaRate?Math.round(item.otaRate-display):null;
            return(<div style={{marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:11,color:"#60a5fa",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>🚗 Transfers</div><div style={{fontSize:11,color:T.textDim}}>{transferIdx+1}/{TRANSFERS.length}</div></div><PillarCard item={item} displayRate={display} otaSaving={saving} totalPax={totalPax} nights={nights} pillar="transfers" pillarColor="#60a5fa" fmt={fmt} T={T} upgrades={upgrades.transfers} hotelResolved={{}} hotelMismatches={[]} onPrev={()=>setTransferIdx(i=>Math.max(0,i-1))} onNext={()=>setTransferIdx(i=>Math.min(TRANSFERS.length-1,i+1))} isPrevDisabled={transferIdx===0} isNextDisabled={transferIdx===TRANSFERS.length-1} onCustomise={()=>setCustomise({pillar:"transfers",idx:transferIdx})}/></div>);
          })()}

          {/* Activities */}
          {activePillars.includes("activities")&&(()=>{
            const item=ACTIVITIES[activityIdx];
            const display=Math.round((item.netRate*totalPax+(activityUpgrade as number))*MARGINS.activities);
            const saving=item.otaRate?Math.round(item.otaRate*totalPax-display):null;
            return(<div style={{marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:11,color:"#a78bfa",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>🦁 Activities</div><div style={{fontSize:11,color:T.textDim}}>{activityIdx+1}/{ACTIVITIES.length}</div></div><PillarCard item={item} displayRate={display} otaSaving={saving} totalPax={totalPax} nights={nights} pillar="activities" pillarColor="#a78bfa" fmt={fmt} T={T} upgrades={upgrades.activities} hotelResolved={{}} hotelMismatches={[]} onPrev={()=>setActivityIdx(i=>Math.max(0,i-1))} onNext={()=>setActivityIdx(i=>Math.min(ACTIVITIES.length-1,i+1))} isPrevDisabled={activityIdx===0} isNextDisabled={activityIdx===ACTIVITIES.length-1} onCustomise={()=>setCustomise({pillar:"activities",idx:activityIdx})}/></div>);
          })()}

          {/* Summary */}
          {(activePillars.length>0||includeIntlFlight)&&(
            <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:16,padding:"20px",marginTop:8}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:14,color:T.text}}>Package summary</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {propertyStays.map((stay,i)=>{const stack2=availableHotelStack.length>0?availableHotelStack:HOTELS_BY_MARGIN;const h=stack2[Math.min(stay.hotelIdx,stack2.length-1)]||HOTELS[0];return<div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.textMid}}><span style={{color:T.gold,flexShrink:0}}>✦</span>{h.name} · {stay.nights} night{stay.nights!==1?"s":""}</div>;})}
                {activePillars.includes("flights")&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.textMid}}><span style={{color:T.gold,flexShrink:0}}>✦</span>{FLIGHTS[flightIdx].airline} · {FLIGHTS[flightIdx].route}</div>}
                {includeIntlFlight&&currentIntlFlight&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.textMid}}><span style={{color:T.gold,flexShrink:0}}>✦</span>{currentIntlFlight.airline} · {builderIntlOrigin} → JNB</div>}
                {activePillars.includes("transfers")&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.textMid}}><span style={{color:T.gold,flexShrink:0}}>✦</span>{TRANSFERS[transferIdx].type}</div>}
                {activePillars.includes("activities")&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.textMid}}><span style={{color:T.gold,flexShrink:0}}>✦</span>{ACTIVITIES[activityIdx].name}{ACTIVITIES[activityIdx].netRate===0&&<span style={{color:T.green,fontSize:11,marginLeft:4}}>· Included</span>}</div>}
              </div>
              <div style={{borderTop:`0.5px solid ${T.borderGold}`,paddingTop:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:T.text}}>Total package</div><div style={{fontSize:11,color:T.textDim,marginTop:2}}>All flights, lodges & transfers included</div></div>
                  <span style={{fontSize:26,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif"}}>{fmt(totalZAR)}</span>
                </div>
              </div>
              <button id="confirm-payment-btn" className="btn-gold" style={{width:"100%",padding:"15px",fontSize:15,marginTop:16}} onClick={async()=>{
                try{
                  const stack2=availableHotelStack.length>0?availableHotelStack:HOTELS_BY_MARGIN;
                  const components=propertyStays.map(stay=>{
                    const h=stack2[Math.min(stay.hotelIdx,stack2.length-1)]||HOTELS[0];
                    const{resolved}=resolveHotelUpgrades(h,stay.prefs);
                    const upgradeExtra=Object.values(resolved).reduce((s:number,v:any)=>s+(v?.extra||0),0);
                    return{pillar:'hotel',name:h.name,location:h.location,nights:stay.nights,net_rate_zar:h.netRate*stay.nights+upgradeExtra,display_rate_zar:Math.round((h.netRate*stay.nights+upgradeExtra)*MARGINS.hotels),margin_pct:15};
                  });
                  const res=await fetch('/api/itinerary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:`Safari Journey`,adults,children_ages:[],infants:0,nights,check_in:checkinDate,check_out:addDays(checkinDate,nights),total_display_zar:totalZAR,total_net_zar:Math.round(totalZAR/1.15),budget_zar:budget,components})});
                  const data=await res.json();
                  if(data.success&&data.id){window.location.href=`/checkout?id=${data.id}`;}
                  else{alert('Could not save: '+(data.error||'Unknown error'));}
                }catch(e:any){alert('Connection error: '+(e?.message||String(e)));}
              }}>Confirm & Proceed to Payment →</button>
              <div style={{textAlign:"center",fontSize:11,color:T.textDim,marginTop:8}}>PayFast (ZAR) · Stripe (international) · Free cancellation on selected rates</div>
            </div>
          )}
        </div>

        {/* Customise overlay */}
        {customise&&(()=>{
          const{pillar,stayId,idx}=customise;
          const pColor=pillar==="intl"?"#60a5fa":pc(pillar as Pillar);
          let item:any,sections:any[],currentResolved:any,stayPrefs:any={};
          if(pillar==="hotels"&&stayId!==undefined){const stay=propertyStays.find(s=>s.id===stayId)!;item=HOTELS_BY_MARGIN[stay.hotelIdx]||HOTELS[0];const{resolved}=resolveHotelUpgrades(item,stay.prefs);currentResolved=resolved;stayPrefs=stay.prefs;}
          else if(pillar==="flights"){item=FLIGHTS[idx];currentResolved=upgrades.flights;}
          else if(pillar==="intl"){item=relevantIntlFlights[idx%relevantIntlFlights.length];currentResolved=upgrades.intl;}
          else if(pillar==="transfers"){item=TRANSFERS[idx];currentResolved=upgrades.transfers;}
          else{item=ACTIVITIES[idx];currentResolved=upgrades.activities;}
          sections=Object.entries(item.upgrades||{});
          return(
            <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setCustomise(null);}}>
              <div style={{background:"#141414",border:`0.5px solid ${T.border}`,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,maxHeight:"88vh",overflowY:"auto",padding:"24px 20px 40px",animation:"slideUp 0.3s ease"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <div><div style={{fontSize:17,fontWeight:700,color:T.text}}>Customise</div><div style={{fontSize:13,color:T.textMid,marginTop:2}}>{item.name||item.airline||item.type}</div></div>
                  <button onClick={()=>setCustomise(null)} style={{background:"rgba(255,255,255,0.08)",border:"none",color:T.textMid,width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>×</button>
                </div>
                {sections.map(([key,options]:any)=>(
                  <div key={key} style={{marginBottom:20}}>
                    <div style={{fontSize:11,fontWeight:600,color:T.textDim,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:10}}>{SECTION_LABELS[key]||key}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                      {options.map((opt:any)=>{
                        const sel=pillar==="hotels"?(opt.tier!==undefined?opt.tier===stayPrefs[key]:false):currentResolved[key]?.label===opt.label;
                        return(
                          <button key={opt.label} onClick={()=>handleSelect(pillar,key,opt,stayId)} style={{background:sel?`${pColor}14`:"rgba(255,255,255,0.04)",border:`1.5px solid ${sel?pColor:T.border}`,borderRadius:11,padding:"11px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:"inherit",textAlign:"left"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${sel?pColor:"rgba(255,255,255,0.22)"}`,background:sel?pColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,color:"#0a0a0a",fontWeight:800}}>{sel?"✓":""}</div>
                              <div style={{fontSize:13,fontWeight:sel?600:400,color:sel?T.text:T.textMid}}>{opt.label}</div>
                            </div>
                            <div style={{fontSize:13,fontWeight:600,color:opt.extra===0?T.textDim:opt.extra<0?T.green:pColor,whiteSpace:"nowrap",marginLeft:8}}>{opt.extra===0?"Included":opt.extra<0?`Save ${fmt(Math.abs(opt.extra))}`:`+${fmt(opt.extra)}`}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button className="btn-gold" style={{width:"100%",padding:"14px",fontSize:15,marginTop:8}} onClick={()=>setCustomise(null)}>Confirm selections →</button>
              </div>
            </div>
          );
        })()}

        {chatOpen&&<ChatDrawer msgs={chatMsgs} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} endRef={chatEndRef} onClose={()=>setChatOpen(false)}/>}
      </div>
    );
  }
  return null;
}

function PillarCard({item,displayRate,otaSaving,totalPax,nights,pillar,pillarColor,fmt,T,upgrades,hotelResolved,hotelMismatches,onPrev,onNext,isPrevDisabled,isNextDisabled,onCustomise}:any){
  return(
    <div className="card">
      <div style={{position:"relative",height:185,overflow:"hidden"}}>
        <img src={item.image} alt={item.name||item.type||item.airline} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 52%)"}}/>
        <div style={{position:"absolute",top:10,right:10,display:"inline-flex",alignItems:"center",gap:4,background:"rgba(74,222,128,0.08)",border:"0.5px solid rgba(74,222,128,0.25)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#4ade80",fontWeight:600}}><span>★</span>{item.trustScore}/100</div>
        {otaSaving&&otaSaving>0?<div style={{position:"absolute",bottom:10,left:10,background:"rgba(74,222,128,0.1)",border:"0.5px solid rgba(74,222,128,0.22)",borderRadius:8,padding:"4px 10px",display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:11,color:"rgba(245,240,232,0.45)",textDecoration:"line-through"}}>{fmt(item.otaRate||0)}</span><span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>Save {fmt(otaSaving)}</span></div>:<div style={{position:"absolute",bottom:10,left:10,background:"rgba(212,175,55,0.15)",border:"0.5px solid rgba(212,175,55,0.3)",borderRadius:8,padding:"4px 10px",fontSize:11,color:"#d4af37",fontWeight:600}}>✦ Exclusive rate</div>}
      </div>
      <div style={{padding:"13px 15px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,fontFamily:"'Playfair Display',serif",color:"#f5f0e8"}}>{item.name||item.type||item.airline}</div><div style={{fontSize:12,color:"rgba(245,240,232,0.6)",marginTop:1}}>{item.location||item.route||item.vehicle||item.duration}</div></div>
          {item.netRate===0&&<div style={{fontSize:12,color:"#4ade80",fontWeight:600,flexShrink:0}}>Included</div>}
        </div>
        {item.funFact&&<div style={{background:"rgba(212,175,55,0.07)",border:"0.5px solid rgba(212,175,55,0.16)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"rgba(212,175,55,0.85)",lineHeight:1.55,marginBottom:10}}>✦ {item.funFact}</div>}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={onPrev} disabled={isPrevDisabled} style={{flex:1,padding:"10px",borderRadius:9,border:"0.5px solid rgba(255,255,255,0.08)",background:"#181818",color:"rgba(245,240,232,0.6)",cursor:isPrevDisabled?"not-allowed":"pointer",opacity:isPrevDisabled?0.35:1,fontFamily:"inherit",fontSize:12}}>← Prev</button>
          <button onClick={onCustomise} style={{flex:2,padding:"10px",borderRadius:9,border:"1px solid rgba(212,175,55,0.3)",background:"rgba(212,175,55,0.15)",color:"#d4af37",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600}}>Customise →</button>
          <button onClick={onNext} disabled={isNextDisabled} style={{flex:1,padding:"10px",borderRadius:9,border:"0.5px solid rgba(255,255,255,0.08)",background:"#181818",color:"rgba(245,240,232,0.6)",cursor:isNextDisabled?"not-allowed":"pointer",opacity:isNextDisabled?0.35:1,fontFamily:"inherit",fontSize:12}}>Next →</button>
        </div>
      </div>
    </div>
  );
}

function SpecialistBanner({specialist,screen}:{specialist:any,screen:string}){
  const showOn=['inspire-input','inspire-research','inspire-plan','builder','my-brief'];
  if(!showOn.includes(screen)||!specialist)return null;
  return(
    <div style={{position:'fixed',bottom:16,left:16,zIndex:200,display:'flex',alignItems:'center',gap:10,background:'rgba(10,10,10,0.95)',backdropFilter:'blur(16px)',border:'0.5px solid rgba(212,175,55,0.3)',borderRadius:16,padding:'10px 16px 10px 10px',boxShadow:'0 8px 32px rgba(0,0,0,0.6)',maxWidth:280}}>
      <div style={{position:'relative',flexShrink:0}}>
        <img src={specialist.avatar} alt={specialist.name} style={{width:40,height:40,borderRadius:'50%',objectFit:'cover',border:'2px solid #d4af37'}}/>
        <div style={{position:'absolute',bottom:-2,right:-2,width:12,height:12,borderRadius:'50%',background:'#4ade80',border:'2px solid #0a0a0a'}}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:700,color:'#f0ede6'}}>{specialist.name}</div>
        <div style={{fontSize:10,color:'#d4af37',marginBottom:2}}>{specialist.role}</div>
        <div style={{fontSize:10,color:'rgba(240,237,230,0.5)',lineHeight:1.4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as const}}>"{specialist.tip}"</div>
        <div style={{fontSize:9,color:'rgba(240,237,230,0.3)',marginTop:3}}>{specialist.instagram} · {specialist.trips} trips</div>
      </div>
    </div>
  );
}

function SummaryRow({label,value,T}:any){
  return(<div style={{display:"flex",justifyContent:"space-between",paddingBottom:8,marginBottom:8,borderBottom:`0.5px solid ${T.border}`,fontSize:13}}><span style={{color:T.textMid}}>{label}</span><span style={{color:T.text,fontWeight:600}}>{value}</span></div>);
}

function ChatDrawer({msgs,input,setInput,send,loading,endRef,onClose}:any){
  return(
    <div style={{position:"fixed",bottom:0,right:16,width:340,height:460,background:"rgba(14,14,14,0.98)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:"16px 16px 0 0",backdropFilter:"blur(20px)",display:"flex",flexDirection:"column",zIndex:200,boxShadow:"0 -4px 40px rgba(0,0,0,0.6)"}}>
      <div style={{padding:"14px 18px",borderBottom:"0.5px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:14,fontWeight:600,color:"#f5f0e8"}}>Journey Specialists</div><div style={{fontSize:11,color:"rgba(212,175,55,0.75)",marginTop:1}}>✦ The Safari Edition</div></div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:"none",color:"rgba(255,255,255,0.5)",width:26,height:26,borderRadius:"50%",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>×</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map((m:any,i:number)=><div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}><div style={{maxWidth:"88%",padding:"9px 13px",borderRadius:m.role==="user"?"13px 13px 3px 13px":"13px 13px 13px 3px",background:m.role==="user"?"rgba(212,175,55,0.13)":"rgba(255,255,255,0.06)",border:`0.5px solid ${m.role==="user"?"rgba(212,175,55,0.28)":"rgba(255,255,255,0.07)"}`,fontSize:13,color:"#f5f0e8",lineHeight:1.6}}>{m.text}</div></div>)}
        {loading&&<div style={{display:"flex",gap:4,padding:"8px 12px"}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#d4af37",animation:`pulse 1.2s ease ${i*0.2}s infinite`}}/>)}</div>}
        <div ref={endRef}/>
      </div>
      <div style={{padding:"10px 14px",borderTop:"0.5px solid rgba(255,255,255,0.07)",display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask about lodges, timing, visas, what to pack..." style={{flex:1,background:"rgba(255,255,255,0.06)",border:"0.5px solid rgba(255,255,255,0.1)",color:"#f5f0e8",borderRadius:9,padding:"9px 13px",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
        <button onClick={send} style={{background:"linear-gradient(135deg,#d4af37,#f0c040)",border:"none",color:"#0a0a0a",borderRadius:9,padding:"9px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>→</button>
      </div>
    </div>
  );
}
