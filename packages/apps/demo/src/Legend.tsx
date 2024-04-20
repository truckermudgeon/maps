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
import { MapIcon } from '@truckermudgeon/ui';
import { memo, useState } from 'react';

const MapIcons: Record<MapIcon, { label: string; iconName: string }> = {
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
const numIcons = Object.keys(MapIcons).length;

export interface LegendProps {
  visibleIcons: Set<MapIcon>;
  enableAutoHiding: boolean;
  onAutoHidingToggle: (newValue: boolean) => void;
  onSelectAllIconsToggle: (newValue: boolean) => void;
  onVisibleIconsToggle: (icon: MapIcon, newValue: boolean) => void;
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
            <TabList tabFlex={1}>
              <Tab>Icons</Tab>
              <Tab>ATS DLC</Tab>
              <Tab>ETS DLC</Tab>
            </TabList>
          </Tabs>
          <DialogContent sx={{ overflowX: 'hidden' }}>
            <Tabs value={activeTab}>
              <TabPanel sx={{ p: 0 }} value={0}>
                <IconList
                  visibleIcons={props.visibleIcons}
                  onVisibleIconsToggle={props.onVisibleIconsToggle}
                />
              </TabPanel>
              <TabPanel value={1}></TabPanel>
              <TabPanel value={2}>Coming Soon</TabPanel>
            </Tabs>
          </DialogContent>
          <Divider />
          {activeTab === 0 && (
            <IconFooter
              enableAutoHiding={props.enableAutoHiding}
              enableSelectAll={props.visibleIcons.size === numIcons}
              onAutoHidingToggle={props.onAutoHidingToggle}
              onSelectAllToggle={props.onSelectAllIconsToggle}
            />
          )}
          {activeTab === 1 && (
            <IconFooter
              enableAutoHiding={props.enableAutoHiding}
              enableSelectAll={props.visibleIcons.size === numIcons}
              onAutoHidingToggle={props.onAutoHidingToggle}
              onSelectAllToggle={props.onSelectAllIconsToggle}
            />
          )}
        </Sheet>
      </Drawer>
    </>
  );
};

interface IconListProps {
  visibleIcons: Set<MapIcon>;
  onVisibleIconsToggle: (icon: MapIcon, newValue: boolean) => void;
}
const IconList = memo((props: IconListProps) => (
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
    {Object.entries(MapIcons).map(([key, icon]) => (
      <ListItem key={key}>
        <img width={32} height={32} src={`map-icons/${icon.iconName}.png`} />
        <Checkbox
          overlay
          label={icon.label}
          checked={props.visibleIcons.has(Number(key))}
          onChange={e =>
            props.onVisibleIconsToggle(Number(key), e.target.checked)
          }
        />
      </ListItem>
    ))}
  </List>
));

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
