import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

type Sprites = Record<
  string,
  {
    x: number;
    y: number;
    width: number;
    height: number;
  }
>;

const SpriteContext = createContext<Sprites | null>(null);

export const SpriteProvider = ({ children }: { children: ReactNode }) => {
  const [sprites, setSprites] = useState<Sprites | null>(null);

  useEffect(() => {
    fetch('/sprites@2x.json')
      .then(res => res.json() as unknown as Sprites)
      .then(setSprites)
      .catch(console.error);
  }, []);

  return (
    <SpriteContext.Provider value={sprites}>{children}</SpriteContext.Provider>
  );
};

export const useSprites = () => useContext(SpriteContext);
