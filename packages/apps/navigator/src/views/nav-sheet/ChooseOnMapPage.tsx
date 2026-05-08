import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { ChooseOnMapPage as ChooseOnMapPageComponent } from '../../components/ChooseOnMapPage';
import { withLoading } from '../../components/WithLoading';
import {
  useAppController,
  useNavSheetController,
} from '../../services/context';
import { useNavSheetStore } from '../../stores/hooks/use-nav-sheet';

const ChooseOnMapPageWithLoading = withLoading(ChooseOnMapPageComponent);

export const ChooseOnMapPage = observer(() => {
  const navSheetStore = useNavSheetStore();
  const appController = useAppController();
  const navSheetController = useNavSheetController();
  return (
    <ChooseOnMapPageWithLoading
      isLoading={navSheetStore.isLoading}
      onUseThisPointClick={action(() => {
        navSheetStore.isLoading = true;
        appController.synthesizeSearchResult().then(
          action(searchResult => {
            navSheetController.onDestinationRoutesClick(searchResult);
          }),
          error => console.log('error trying to synthesize result', error),
        );
      })}
    />
  );
});
