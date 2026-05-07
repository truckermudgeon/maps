import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { NavSheet as NavSheetComponent } from '../components/NavSheet';
import { TitleControls } from '../components/TitleControls';
import { useHideNavSheet, useNavSheetController } from '../services/context';
import { useNavSheetStore } from '../stores/hooks/use-nav-sheet';
import { CurrentNavPage } from './CurrentNavPage';

const NavSheetTitleControls = observer(() => {
  const navSheetStore = useNavSheetStore();
  const navSheetController = useNavSheetController();
  const hideNavSheet = useHideNavSheet();
  return (
    <TitleControls
      showBackButton={navSheetStore.showBackButton}
      title={navSheetStore.title}
      onBackClick={action(() => navSheetController.onBackClick())}
      onCloseClick={hideNavSheet}
    />
  );
});

export const NavSheet = () => (
  <NavSheetComponent
    TitleControls={NavSheetTitleControls}
    CurrentPage={CurrentNavPage}
  />
);
