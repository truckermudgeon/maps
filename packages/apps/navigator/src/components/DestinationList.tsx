import { List } from '@mui/joy';
import type {
  SearchResult,
  SearchResultWithRelativeTruckInfo,
} from '@truckermudgeon/navigation/types';
import type { ReactElement } from 'react';
import { DestinationItem } from './DestinationItem';

export const DestinationList = (props: {
  destinations: SearchResultWithRelativeTruckInfo[];
  onDestinationHighlight: (dest: SearchResult) => void;
  CollapsibleButtonBar: (props: { destination: SearchResult }) => ReactElement;
}) => {
  console.log('render dest list');

  return (
    <List size={'lg'}>
      {props.destinations.map((dest, index) => (
        <DestinationItem
          key={dest.nodeUid}
          destination={dest}
          index={index}
          onDestinationHighlight={() => props.onDestinationHighlight(dest)}
          CollapsibleButtonBar={() => (
            <props.CollapsibleButtonBar destination={dest} />
          )}
        />
      ))}
    </List>
  );
};
