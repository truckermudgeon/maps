import type { SingleValue } from 'react-select';
import Select from 'react-select';

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
  onSelect: (option: SingleValue<GameOption>) => void;
}

export const MapSelect = ({ map, onSelect }: MapSelectProps) => {
  return (
    <div
      style={{
        width: 90,
        margin: 10,
        display: 'inline-block',
      }}
    >
      <Select<GameOption, false>
        options={options}
        isSearchable={false}
        value={options.find(o => o.value === map)}
        onChange={onSelect}
      />
    </div>
  );
};
