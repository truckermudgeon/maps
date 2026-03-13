import SpeedIcon from '@mui/icons-material/Speed';
import { Stack, Tooltip, Typography } from '@mui/joy';

export interface LatencyStatusProps {
  fiveSecondMs: number | undefined;
  sixtySecondMs: number | undefined;
}

export const LatencyStatus = (props: LatencyStatusProps) => {
  const { fiveSecondMs, sixtySecondMs } = props;
  if (fiveSecondMs == null && sixtySecondMs == null) {
    return null;
  }

  return (
    <Tooltip
      title={
        <LatencyTooltip
          fiveSecondMs={fiveSecondMs}
          sixtySecondMs={sixtySecondMs}
        />
      }
    >
      <Stack direction={'row'} alignItems={'center'} gap={1}>
        <SpeedIcon sx={{ transform: 'scale(1.2)' }} />
        <Typography level={'body-sm'} fontWeight={600} color={'neutral'}>
          {fiveSecondMs}ms
        </Typography>
      </Stack>
    </Tooltip>
  );
};

interface LatencyTooltipProps {
  fiveSecondMs: number | undefined;
  sixtySecondMs: number | undefined;
}
const LatencyTooltip = (props: LatencyTooltipProps) => {
  const { fiveSecondMs, sixtySecondMs } = props;
  return (
    <Stack p={0.5}>
      <Typography sx={{ color: 'neutral.50' }}>Average latency</Typography>
      <table>
        <tbody>
          {fiveSecondMs != null && (
            <tr>
              <td align={'right'} style={{ paddingRight: '0.5em' }}>
                <Typography
                  level={'body-sm'}
                  sx={{
                    color: 'neutral.50',
                  }}
                >
                  5s:
                </Typography>
              </td>
              <td>
                <Typography
                  level={'body-sm'}
                  sx={{
                    color: 'neutral.50',
                  }}
                >
                  {fiveSecondMs}ms
                </Typography>
              </td>
            </tr>
          )}
          {sixtySecondMs != null && (
            <tr>
              <td align={'right'} style={{ paddingRight: '0.5em' }}>
                <Typography
                  level={'body-sm'}
                  sx={{
                    color: 'neutral.50',
                  }}
                >
                  60s:
                </Typography>
              </td>
              <td>
                <Typography
                  level={'body-sm'}
                  sx={{
                    color: 'neutral.50',
                  }}
                >
                  {sixtySecondMs}ms
                </Typography>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Stack>
  );
};
