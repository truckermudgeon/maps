import { useSprites } from './SpriteProvider';

export interface SpriteImageProps {
  spriteName: string;
  includeMargin?: true;
  scale?: number;
}

export const SpriteImage = (props: SpriteImageProps) => {
  const sprites = useSprites();
  if (!sprites) {
    return null;
  }

  let { spriteName } = props;
  const { includeMargin = false, scale = 0.8 } = props;
  const maybeSprite = /^\/?icons\/([^/]+)\.png$/.exec(spriteName)?.[1];
  if (maybeSprite) {
    spriteName = maybeSprite;
  }

  const sprite = sprites[spriteName];
  if (!sprite) {
    return null;
  }

  const { width, height, x, y } = sprite;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <img
        src={'/sprites@2x.png'}
        style={{
          width,
          height,
          display: 'block',
          objectPosition: `${-x}px ${-y}px`,
          objectFit: 'none',

          marginRight: includeMargin ? '1em' : undefined,
          ...(scale === 1
            ? {}
            : {
                transformOrigin: 'center',
                transform: 'scale(0.8)',
              }),
        }}
      />
    </div>
  );
};
