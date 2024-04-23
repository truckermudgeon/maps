import { ListAlt } from '@mui/icons-material';
import {
  Checkbox,
  checkboxClasses,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ModalClose,
  Sheet,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Tooltip,
} from '@mui/joy';
import type { AtsSelectableDlc } from '@truckermudgeon/map/constants';
import { AtsDlcInfo } from '@truckermudgeon/map/constants';
import { MapIcon } from '@truckermudgeon/ui';
import type { ReactElement } from 'react';
import { memo, useState } from 'react';

const mapIconInfo: Record<MapIcon, { label: string; iconName: string }> = {
  [MapIcon.FuelStation]: { iconName: 'gas_ico', label: 'Fuel station' },
  [MapIcon.Toll]: { iconName: 'toll_ico', label: 'Toll gate' },
  [MapIcon.Parking]: { iconName: 'parking_ico', label: 'Rest stop' },
  [MapIcon.RecruitmentAgency]: {
    iconName: 'recruitment_ico',
    label: 'Recruitment agency',
  },
  [MapIcon.Service]: { iconName: 'service_ico', label: 'Service' },
  [MapIcon.TruckDealer]: { iconName: 'dealer_ico', label: 'Truck dealer' },
  [MapIcon.Port]: { iconName: 'port_overlay', label: 'Port' },
  [MapIcon.Train]: { iconName: 'train_ico', label: 'Train' },
  [MapIcon.Viewpoint]: { iconName: 'viewpoint', label: 'Viewpoint' },
  [MapIcon.PhotoSight]: {
    iconName: 'photo_sight_captured',
    label: 'Photo trophy',
  },
  [MapIcon.AgricultureCheck]: {
    iconName: 'agri_check',
    label: 'Agricultural inspection',
  },
  [MapIcon.BorderCheck]: { iconName: 'border_ico', label: 'Border inspection' },
  [MapIcon.Garage]: { iconName: 'garage_large_ico', label: 'Garage' },
  [MapIcon.WeighStation]: {
    iconName: 'weigh_station_ico',
    label: 'Weigh station',
  },
  [MapIcon.CityNames]: { iconName: 'city_names_ico', label: 'City names' },
  [MapIcon.Company]: { iconName: 'companies_ico', label: 'Companies' },
  [MapIcon.RoadNumber]: { iconName: 'road_numbers_ico', label: 'Road numbers' },
};
const mapIcons = new Map<MapIcon, string>(
  Object.entries(mapIconInfo).map(([k, v]) => [Number(k), v.label]),
);

const atsDlcs = new Map<AtsSelectableDlc, string>(
  Object.entries(AtsDlcInfo).map(([k, v]) => [Number(k), v]),
);

export interface ListProps<T> {
  selectedItems: Set<T>;
  onSelectAllToggle: (newValue: boolean) => void;
  onItemToggle: (item: T, newValue: boolean) => void;
}
export function createListProps<T>(
  selectedItems: Set<T>,
  setSelectedItems: (value: React.SetStateAction<Set<T>>) => void,
  allItems: ReadonlySet<T>,
) {
  return {
    selectedItems,
    onSelectAllToggle: (all: boolean) =>
      setSelectedItems(new Set(all ? allItems : [])),
    onItemToggle: (item: T, newValue: boolean) => {
      setSelectedItems((prevState: Set<T>) => {
        const newState = new Set(prevState);
        if (newValue) {
          newState.add(item);
        } else {
          newState.delete(item);
        }
        return newState;
      });
    },
  };
}

export interface LegendProps {
  icons: ListProps<MapIcon> & {
    enableAutoHiding: boolean;
    onAutoHidingToggle: (newValue: boolean) => void;
  };
  atsDlcs: ListProps<AtsSelectableDlc>;
}
export const Legend = (props: LegendProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  return (
    <>
      <Tooltip title={'Map Options'}>
        <IconButton
          variant={'outlined'}
          sx={{
            backgroundColor: 'background.body',
            position: 'absolute',
            left: 0,
            bottom: 0,
            m: 2,
          }}
          onClick={() => setIsOpen(true)}
        >
          <ListAlt />
        </IconButton>
      </Tooltip>
      <Drawer
        open={isOpen}
        onClose={() => setIsOpen(false)}
        variant={'plain'}
        hideBackdrop={true}
        slotProps={{
          root: {
            sx: {
              pointerEvents: 'none',
            },
          },
          content: {
            sx: {
              pointerEvents: 'auto',
              bgcolor: 'transparent',
              p: 2,
              boxShadow: 'none',
              justifyContent: 'end',
            },
          },
        }}
      >
        <Sheet
          variant={'outlined'}
          sx={{
            borderRadius: 'md',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            height: '80%',
            overflow: 'auto',
          }}
        >
          <DialogTitle>Map Options</DialogTitle>
          <ModalClose />
          <Tabs onChange={(_, value) => setActiveTab(Number(value))}>
            <TabList tabFlex={1} sx={{ borderRadius: 0 }}>
              <Tab>Icons</Tab>
              <Tab>ATS DLC</Tab>
            </TabList>
          </Tabs>
          <DialogContent sx={{ overflowX: 'hidden' }}>
            <Tabs value={activeTab}>
              <TabPanel sx={{ p: 0 }} value={0}>
                <CheckList
                  items={mapIcons}
                  selectedItems={props.icons.selectedItems}
                  onItemToggle={props.icons.onItemToggle}
                  icon={icon => (
                    <img
                      // icons have 3px of transparent padding around the actual content.
                      style={{ marginLeft: -3 }}
                      width={32}
                      height={32}
                      src={`map-icons/${mapIconInfo[icon].iconName}.png`}
                    />
                  )}
                />
              </TabPanel>
              <TabPanel sx={{ p: 0 }} value={1}>
                <CheckList
                  items={atsDlcs}
                  selectedItems={props.atsDlcs.selectedItems}
                  onItemToggle={props.atsDlcs.onItemToggle}
                />
              </TabPanel>
            </Tabs>
          </DialogContent>
          <Divider />
          {activeTab === 0 && (
            <IconFooter
              enableAutoHiding={props.icons.enableAutoHiding}
              enableSelectAll={props.icons.selectedItems.size === mapIcons.size}
              onAutoHidingToggle={props.icons.onAutoHidingToggle}
              onSelectAllToggle={props.icons.onSelectAllToggle}
            />
          )}
          {activeTab === 1 && (
            <DlcFooter
              enableSelectAll={
                props.atsDlcs.selectedItems.size === atsDlcs.size
              }
              onSelectAllToggle={props.atsDlcs.onSelectAllToggle}
            />
          )}
        </Sheet>
      </Drawer>
    </>
  );
};

interface IconFooterProps {
  enableAutoHiding: boolean;
  enableSelectAll: boolean;
  onAutoHidingToggle: (newValue: boolean) => void;
  onSelectAllToggle: (newValue: boolean) => void;
}
const IconFooter = memo((props: IconFooterProps) => (
  <Stack direction={'row'} justifyContent={'space-between'} gap={1} mx={2}>
    <Tooltip
      enterDelay={500}
      title={
        'Enable to hide icons based on zoom and nearby icons. Disable to always show icons.'
      }
    >
      <Checkbox
        label={'Enable icon hiding'}
        checked={props.enableAutoHiding}
        onChange={e => props.onAutoHidingToggle?.(e.target.checked)}
      />
    </Tooltip>
    <Checkbox
      sx={{
        flexDirection: 'row-reverse',
        flexShrink: 0,
      }}
      label={'Select all'}
      checked={props.enableSelectAll}
      onChange={e => props.onSelectAllToggle?.(e.target.checked)}
    />
  </Stack>
));

interface CheckListProps<T> {
  items: Map<T, string>;
  selectedItems: Set<T>;
  onItemToggle: (item: T, newValue: boolean) => void;
  icon?: (k: T) => ReactElement;
}
const _CheckList = <T,>(props: CheckListProps<T>) => (
  <List
    size={'lg'}
    sx={{
      p: 0,
      [`& .${checkboxClasses.root}`]: {
        flexGrow: 1,
        alignItems: 'center',
        flexDirection: 'row-reverse',
      },
    }}
  >
    {[...props.items.entries()].map(([key, label]) => (
      <ListItem key={String(key)}>
        {props.icon?.(key)}
        <Checkbox
          overlay
          label={label}
          checked={props.selectedItems.has(key)}
          onChange={e => props.onItemToggle(key, e.target.checked)}
        />
      </ListItem>
    ))}
  </List>
);
// Casting because React.memo doesn't support generics.
const CheckList = memo(_CheckList) as typeof _CheckList;

interface DlcFooterProps {
  enableSelectAll: boolean;
  onSelectAllToggle: (newValue: boolean) => void;
}
const DlcFooter = memo((props: DlcFooterProps) => (
  <Stack direction={'row'} justifyContent={'end'} gap={1} mx={2}>
    <Checkbox
      sx={{
        flexDirection: 'row-reverse',
        flexShrink: 0,
      }}
      label={'Select all'}
      checked={props.enableSelectAll}
      onChange={e => props.onSelectAllToggle?.(e.target.checked)}
    />
  </Stack>
));
