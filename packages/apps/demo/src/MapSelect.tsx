import { Option, Select } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';

export type GameOption =
  | {
      label: 'ATS';
      value: 'usa';
    }
  | {
      label: 'ETS2';
      value: 'europe';
    };

const options: GameOption[] = [
  { label: 'ATS', value: 'usa' },
  { label: 'ETS2', value: 'europe' },
];

interface MapSelectProps {
  map: 'usa' | 'europe';
  onSelect: (option: GameOption) => void;
}

export const MapSelect = ({ map, onSelect }: MapSelectProps) => {
  return (
    <Select
      sx={{ paddingBlock: 0, minWidth: 'fit-content' }}
      value={map}
      onChange={(_, v) =>
        onSelect(assertExists(options.find(o => o.value === v)))
      }
    >
      {options.map(o => (
        <Option key={o.value} value={o.value}>
          {o.label}
        </Option>
      ))}
    </Select>
  );
};
