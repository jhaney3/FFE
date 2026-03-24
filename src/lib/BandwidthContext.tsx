'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface BandwidthContextValue {
  lowBandwidth: boolean;
  toggle: () => void;
}

const BandwidthContext = createContext<BandwidthContextValue>({
  lowBandwidth: false,
  toggle: () => {},
});

export function BandwidthProvider({ children }: { children: React.ReactNode }) {
  const [lowBandwidth, setLowBandwidth] = useState(false);

  // Sync from localStorage after mount to avoid SSR/client mismatch
  useEffect(() => {
    setLowBandwidth(localStorage.getItem('ffe-low-bandwidth') === 'true');
  }, []);

  const toggle = () => {
    setLowBandwidth(v => {
      const next = !v;
      localStorage.setItem('ffe-low-bandwidth', String(next));
      return next;
    });
  };

  return (
    <BandwidthContext.Provider value={{ lowBandwidth, toggle }}>
      {children}
    </BandwidthContext.Provider>
  );
}

export const useLowBandwidth = () => useContext(BandwidthContext);
