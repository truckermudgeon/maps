import {
  Brightness6,
  BrightnessAuto,
  BrightnessHigh,
  BrightnessLow,
} from '@mui/icons-material';
import {
  Dropdown,
  IconButton,
  ListItem,
  ListItemDecorator,
  Menu,
  MenuButton,
  MenuItem,
  Typography,
  useColorScheme,
} from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { useRef } from 'react';
import { useControl } from 'react-map-gl/maplibre';

export const ModeControl = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { mode = 'light', setMode } = useColorScheme();

  useControl(() => ({
    onAdd: () => assertExists(ref.current),
    onRemove: () => assertExists(ref.current).remove(),
  }));

  return (
    <div ref={ref} className={'maplibregl-ctrl maplibregl-ctrl-group'}>
      <Dropdown>
        <MenuButton
          slots={{ root: IconButton }}
          sx={{
            minWidth: 0,
            minHeight: 0,
            borderRadius: 0,
          }}
          title={'Set map theme'}
        >
          <Brightness6 />
        </MenuButton>
        <Menu placement={'left'}>
          <ListItem sticky>
            <Typography
              m={1}
              level="body-xs"
              textTransform="uppercase"
              fontWeight="lg"
            >
              Map theme
            </Typography>
          </ListItem>
          <MenuItem
            onClick={() => setMode('light')}
            selected={mode === 'light'}
          >
            <ListItemDecorator>
              <BrightnessHigh />
            </ListItemDecorator>{' '}
            Light
          </MenuItem>
          <MenuItem onClick={() => setMode('dark')} selected={mode === 'dark'}>
            <ListItemDecorator>
              <BrightnessLow />
            </ListItemDecorator>{' '}
            Dark
          </MenuItem>
          <MenuItem
            onClick={() => setMode('system')}
            selected={mode === 'system'}
          >
            <ListItemDecorator>
              <BrightnessAuto />
            </ListItemDecorator>{' '}
            Auto
          </MenuItem>
        </Menu>
      </Dropdown>
    </div>
  );
};
