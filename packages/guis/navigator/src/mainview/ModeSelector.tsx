import QrCodeIcon from '@mui/icons-material/QrCode';
import TimelineIcon from '@mui/icons-material/Timeline';
import { Box, Radio, RadioGroup, Tooltip } from '@mui/joy';
import { useState } from 'react';

export type Mode = 'code' | 'timeline';
export interface ModeSelectorProps {
  onSetMode: (mode: Mode) => void;
}

export const ModeSelector = (props: ModeSelectorProps) => {
  const [mode, setMode] = useState<Mode>('code');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <RadioGroup
        orientation="horizontal"
        value={mode}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const mode = event.target.value as Mode;
          setMode(mode);
          props.onSetMode(mode);
        }}
        sx={{
          padding: '4px',
          borderRadius: '12px',
          bgcolor: 'neutral.softBg',
          '--RadioGroup-gap': '4px',
          '--Radio-actionRadius': '8px',
        }}
      >
        {['code', 'timeline'].map(item => (
          <Tooltip
            title={
              item === 'code' ? 'View pairing code' : 'View connection stats'
            }
            key={item}
          >
            <Radio
              key={item}
              color="neutral"
              value={item}
              disableIcon
              label={
                {
                  code: <QrCodeIcon />,
                  timeline: <TimelineIcon />,
                }[item]
              }
              variant="plain"
              sx={{ pt: 0.5, px: 2, alignItems: 'center' }}
              slotProps={{
                action: ({ checked }) => ({
                  sx: {
                    ...(checked && {
                      bgcolor: 'background.surface',
                      boxShadow: 'sm',
                      '&:hover': {
                        bgcolor: 'background.surface',
                      },
                    }),
                  },
                }),
              }}
            />
          </Tooltip>
        ))}
      </RadioGroup>
    </Box>
  );
};
