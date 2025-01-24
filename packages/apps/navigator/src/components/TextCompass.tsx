import { Sheet } from '@mui/joy';

type CompassPoint = 'N' | 'S' | 'E' | 'W' | `${'N' | 'S'}${'E' | 'W'}`;

export const TextCompass = (props: { direction: CompassPoint }) => (
  <Sheet
    variant={'solid'}
    sx={{
      p: 0.5,
      px: 2,
      borderRadius: 8,
      fontWeight: 'bold',
    }}
  >
    {props.direction}
  </Sheet>
);
