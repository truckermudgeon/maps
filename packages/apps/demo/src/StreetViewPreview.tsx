import { normalizeRadians } from '@truckermudgeon/base/geom';
import type { PanoramaMeta } from './StreetView';

export interface PanoramaPreviewProps {
  panorama: PanoramaMeta;
  pixelRootUrl: string;
}

const panoPixelWidth = 8192;
const tileSize = 512;
const pixelsPerDegree = panoPixelWidth / 360;
const numXTiles = panoPixelWidth / tileSize;
const previewSize = 100;

export const PanoramaPreview = (props: PanoramaPreviewProps) => {
  const { pixelRootUrl, panorama } = props;

  // CW, (0, 360], with 180 as north.
  const yawDegrees =
    (normalizeRadians(panorama.yaw ?? 0) * 180) / Math.PI + 180;

  // find 2 tiles that `yawDegrees` is centered on.
  const pixelX = Math.floor(pixelsPerDegree * yawDegrees);
  let leftTileIndex;
  let rightTileIndex;
  if (pixelX % tileSize < tileSize / 2) {
    // yaw centers on left part of tile. grab this tile and tile to the left.
    rightTileIndex = Math.floor(pixelX / tileSize);
    leftTileIndex = rightTileIndex === 0 ? numXTiles - 1 : rightTileIndex - 1;
  } else {
    // yaw centers on right part of tile. grab this tile and tile to the right.
    leftTileIndex = Math.floor(pixelX / tileSize);
    rightTileIndex = leftTileIndex === numXTiles - 1 ? 0 : leftTileIndex + 1;
  }

  return (
    <div
      style={{
        overflow: 'hidden',
        width: previewSize,
      }}
    >
      <div
        style={{
          display: 'flex',
          position: 'relative',
          left: (-yawDegrees * previewSize) / tileSize,
        }}
      >
        <img
          width={previewSize}
          height={previewSize}
          src={`${pixelRootUrl}/${panorama.id}_${leftTileIndex}_3.jpg`}
        />
        <img
          width={previewSize}
          height={previewSize}
          src={`${pixelRootUrl}/${panorama.id}_${rightTileIndex}_3.jpg`}
        />
      </div>
    </div>
  );
};
