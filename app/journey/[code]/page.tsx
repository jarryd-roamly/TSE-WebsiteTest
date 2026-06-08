// app/journey/[code]/page.tsx
// The journey URL. Renders the right surface from the ONE source.
// Works immediately with demo data. Switch surfaces by URL while you demo:
//   /journey/KR7P2MX4                         → companion · quote
//   /journey/KR7P2MX4?mode=confirmed          → companion · confirmed (1st login)
//   /journey/KR7P2MX4?mode=confirmed&visit=2  → companion · immersive (returning)
//   /journey/KR7P2MX4?view=review             → cream review timeline
//   /journey/KR7P2MX4?view=ops                → staff sequencing portal
//
// When you wire Supabase: replace the `mode/visit` query reads with the real
// booking status and the server-side visit counter (see IMPLEMENTATION guide).

import { getJourney } from '@/app/lib/journey';
import JourneyTimeline from '@/components/JourneyTimeline';
import JourneyMiniSite from '@/components/JourneyMinisite';
import OpsValidation from '@/components/OpsValidation';

export default async function JourneyPage({
  params, searchParams,
}: {
  params: { code: string };
  searchParams: { view?: string; mode?: string; visit?: string };
}) {
  const journey = await getJourney(params.code);

  if (searchParams.view === 'review') return <JourneyTimeline journey={journey} />;
  if (searchParams.view === 'ops')    return <OpsValidation journey={journey} />;

  const mode = searchParams.mode === 'confirmed' ? 'confirmed' : 'quote';
  const visit = Number(searchParams.visit || 1);
  return <JourneyMiniSite journey={journey} mode={mode} visitCount={visit} />;
}
