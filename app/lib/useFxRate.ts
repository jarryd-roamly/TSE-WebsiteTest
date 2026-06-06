'use client';

import { useState, useEffect } from 'react';
import type { FxRates } from '@/app/lib/fx';
import { FX_FALLBACK }  from '@/app/lib/fx';

export function useFxRate() {
  const [rates,   setRates]   = useState<FxRates>(FX_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/fx')
      .then(r => r.json())
      .then(data => { setRates(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { rates, loading };
}
