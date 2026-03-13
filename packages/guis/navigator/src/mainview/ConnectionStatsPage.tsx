import { Divider, Stack, Typography } from '@mui/joy';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { Delta } from '../bun/types';

export interface ConnectionStatsPageProps {
  connectedAt: number | undefined;
  lifetimeDeltas: number;
  deltas: Delta[];
}
export const ConnectionStatsPage = (props: ConnectionStatsPageProps) => {
  const { connectedAt, lifetimeDeltas, deltas } = props;
  const averageLatency =
    deltas.length === 0
      ? '--'
      : Math.round(
          deltas.reduce((acc, d) => acc + d.deltaMs, 0) / deltas.length,
        );
  const connectedAtString = new Intl.DateTimeFormat('en-US', {
    timeStyle: 'short',
  }).format(connectedAt);

  const { hours, minutes, seconds } = convertMilliseconds(connectedAt);

  return (
    <Stack direction={'row'} flex={1} gap={2} height={'100%'}>
      <Stack gap={2} width={'8.5em'}>
        <Typography color={'neutral'} level={'title-md'}>
          Connection Stats
        </Typography>
        <Stack>
          <Typography color={'neutral'} level={'title-sm'}>
            Avg. Latency
          </Typography>
          <Typography>
            <Typography level={'h1'}>{averageLatency}</Typography>
            {averageLatency === '--' ? '' : ' ms'}
          </Typography>
        </Stack>
        <Stack>
          <Typography color={'neutral'} level={'title-sm'}>
            Samples Sent
          </Typography>
          <Typography level={'h1'}>
            {lifetimeDeltas ? lifetimeDeltas.toLocaleString() : '--'}
          </Typography>
        </Stack>
        <Stack>
          <Typography color={'neutral'} level={'title-sm'}>
            Session Lifetime
          </Typography>
          <Typography level={'h1'}>
            {seconds === '--' ? '--' : `${hours}:${minutes}:${seconds}`}
          </Typography>
          {connectedAt && (
            <Typography color={'neutral'} level={'body-xs'}>
              Active since {connectedAtString}
            </Typography>
          )}
        </Stack>
      </Stack>
      <Divider orientation={'vertical'} />
      <Stack flex={1} gap={2}>
        <Typography color={'neutral'} level={'title-md'}>
          Latency History
        </Typography>
        <Graph deltas={deltas} />
      </Stack>
    </Stack>
  );
};

const xTickCount = 5;

const Graph = (props: { deltas: Delta[] }) => {
  const now = Date.now();
  return (
    <LineChart
      style={{
        width: '100%',
        height: '100%',
        paddingRight: '1em',
        pointerEvents: 'none',
      }}
      data={props.deltas}
    >
      <CartesianGrid syncWithTicks={true} />
      <Line isAnimationActive={false} dataKey="deltaMs" dot={false} />
      <XAxis
        type="number"
        dataKey="timestamp"
        domain={[now - 60_000, now]}
        allowDataOverflow={true}
        fontSize={'12px'}
        tickCount={xTickCount}
        tickMargin={10}
        tickLine={false}
        tickFormatter={(_, i) => {
          if (i === xTickCount - 1) {
            return 'Now';
          } else {
            const spans = xTickCount - 1;
            const spanDuration = 60 / spans;
            return i * spanDuration - 60 + 's';
          }
        }}
      />
      <YAxis
        dataKey="deltaMs"
        domain={[
          dataMin => Math.floor(dataMin / 50) * 50,
          dataMax => Math.ceil(dataMax / 50) * 50,
        ]}
        unit="ms"
        width={50}
        tickMargin={10}
        tickLine={false}
        fontSize={'12px'}
      />
    </LineChart>
  );
};

function convertMilliseconds(connectedAtMs: number | undefined): {
  hours: string;
  minutes: string;
  seconds: string;
} {
  if (connectedAtMs == null) {
    return {
      hours: '--',
      minutes: '--',
      seconds: '--',
    };
  }

  let ms = Date.now() - connectedAtMs;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  ms %= 1000 * 60 * 60;
  const minutes = Math.floor(ms / (1000 * 60));
  ms %= 1000 * 60;
  const seconds = Math.floor(ms / 1000);

  return {
    hours: hours.toString().padStart(1, '0'),
    minutes: minutes.toString().padStart(2, '0'),
    seconds: seconds.toString().padStart(2, '0'),
  };
}
