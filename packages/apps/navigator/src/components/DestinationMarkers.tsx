import { Button } from '@mui/joy';
import type { SearchResult } from '@truckermudgeon/navigation/types';
import { Marker } from 'react-map-gl/maplibre';

export const DestinationMarkers = (props: {
  destinations: SearchResult[];
  selectedDestinationNodeUid: string | undefined;
  forceDisplay: boolean | undefined;
  onDestinationClick: (dest: SearchResult) => void;
}) => {
  console.log('render destination markers', {
    highlighted: props.selectedDestinationNodeUid,
    dests: props.destinations,
  });
  return (
    <>
      {props.destinations.map((dest, index) => (
        <Marker
          key={dest.nodeUid}
          longitude={dest.lonLat[0]}
          latitude={dest.lonLat[1]}
          style={{
            zIndex:
              props.selectedDestinationNodeUid === dest.nodeUid
                ? props.destinations.length
                : 'auto',
          }}
        >
          <Button
            size={
              // can't do referential checks, because of proxies created by mobx.
              // so check IDs, instead.
              props.selectedDestinationNodeUid === dest.nodeUid ? 'lg' : 'md'
            }
            onClick={() => props.onDestinationClick(dest)}
            sx={{
              width: '1em',
              height: '1em',
              border: 1,
              backgroundColor:
                props.selectedDestinationNodeUid == null
                  ? 'primary'
                  : props.selectedDestinationNodeUid === dest.nodeUid
                    ? 'primary'
                    : '#aaa',
              display:
                props.forceDisplay === true ||
                props.selectedDestinationNodeUid === dest.nodeUid
                  ? undefined
                  : 'none',
            }}
          >
            {index + 1}
          </Button>
        </Marker>
      ))}
    </>
  );
};
