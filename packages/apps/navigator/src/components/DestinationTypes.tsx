import {
  Build,
  Hotel,
  LocalGasStation,
  LocalShipping,
  PersonSearch,
  Unarchive,
} from '@mui/icons-material';
import { Box, IconButton, Typography } from '@mui/joy';
import type { SvgIcon } from '@mui/material';
import { PoiType } from '@truckermudgeon/navigation/constants';

interface Destination {
  Icon: typeof SvgIcon;
  label: string;
  color: string;
}

const destinations: Record<PoiType, Destination> = {
  [PoiType.COMPANY]: {
    Icon: Unarchive,
    label: 'Companies',
    color: 'orange',
  },
  [PoiType.FUEL]: {
    Icon: LocalGasStation,
    label: 'Fuel Stations',
    color: '#008234',
  },
  [PoiType.REST]: {
    Icon: Hotel,
    label: 'Rest Stops',
    color: '#1f6eb7',
  },
  [PoiType.SERVICE]: {
    Icon: Build,
    label: 'Service Centers',
    color: '#8e0d0d',
  },
  [PoiType.DEALER]: {
    Icon: LocalShipping,
    label: 'Dealerships',
    color: '#7c2391',
  },
  [PoiType.RECRUITING]: {
    Icon: PersonSearch,
    label: 'Recruitment Agencies',
    color: '#918d00',
  },
};

export const DestinationTypes = (props: {
  onClick: (dest: PoiType, label: string) => void;
}) => (
  <Box display={'grid'} gridTemplateColumns={'repeat(3, 1fr)'} gap={2}>
    {Object.entries(destinations).map(([key, { Icon, label, color }]) => (
      <DestinationButton
        key={key}
        Icon={Icon}
        color={color}
        label={label}
        onClick={() => props.onClick(Number(key), label)}
      />
    ))}
  </Box>
);

const DestinationButton = ({
  Icon,
  color,
  label,
  onClick,
}: {
  Icon: typeof SvgIcon;
  color: string;
  label: string;
  onClick: () => void;
}) => (
  <>
    <Box
      display={'flex'}
      flexDirection={'column'}
      alignItems={'center'}
      textAlign={'center'}
      gap={1}
    >
      <IconButton
        size={'lg'}
        variant={'solid'}
        sx={{
          borderRadius: '50%',
          p: 2.5,
          backgroundColor: color,
        }}
        onClick={onClick}
      >
        <Icon sx={{ transform: 'scale(1.25)' }} />
      </IconButton>
      <Typography>{label}</Typography>
    </Box>
  </>
);
