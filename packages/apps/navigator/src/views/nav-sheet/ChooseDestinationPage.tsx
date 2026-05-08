import { debounce } from '@truckermudgeon/base/debounce';
import type { SearchResult } from '@truckermudgeon/navigation/types';
import { action } from 'mobx';
import { useCallback, useMemo, useState } from 'react';
import { ChooseDestinationPage as ChooseDestinationPageComponent } from '../../components/ChooseDestinationPage';
import { useNavSheetController } from '../../services/context';
import { useNavSheetStore } from '../../stores/hooks/use-nav-sheet';

export const ChooseDestinationPage = (props: {
  mode: 'chooseDestination' | 'searchAlong';
}) => {
  const navSheetStore = useNavSheetStore();
  const navSheetController = useNavSheetController();
  const [options, setOptions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const onInput = useCallback(
    (value: string) => {
      if (value.trim().length === 0) {
        setOptions([]);
        return;
      }
      if (loading) {
        return;
      }
      setLoading(true);
      navSheetController
        .search(value)
        .then(
          results => setOptions(results),
          error => console.log('search failed:', error),
        )
        .finally(() => setLoading(false));
    },
    [loading, navSheetController],
  );
  const debouncedOnInput = useMemo(() => debounce(onInput, 250), [onInput]);
  return (
    <ChooseDestinationPageComponent
      mode={props.mode}
      showSearchLoading={loading}
      onSelect={action(stringOrResult =>
        navSheetController.onSearchSelect(stringOrResult),
      )}
      onInputChange={debouncedOnInput}
      onDestinationTypeClick={action((type, label) =>
        navSheetController.onDestinationTypeClick(type, label),
      )}
      onChooseOnMapClick={action(() => navSheetStore.openChooseOnMap())}
      options={options}
    />
  );
};
