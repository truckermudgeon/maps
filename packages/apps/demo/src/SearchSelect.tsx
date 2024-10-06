import { EmojiEvents, LocationCity } from '@mui/icons-material';
import { List, ListItem, Option, Select, Stack, Typography } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';

export type SearchOption = Readonly<
  {
    label: string; // this is unused.
    value: {
      map: 'usa' | 'europe';
      search: 'cities' | 'achievements';
    };
  } & { __brand: never }
>;

const options: readonly SearchOption[] = [
  {
    label: 'ATS',
    value: { map: 'usa', search: 'cities' },
  },
  {
    label: 'ATS',
    value: { map: 'usa', search: 'achievements' },
  },
  {
    label: 'ETS2',
    value: { map: 'europe', search: 'cities' },
  },
  {
    label: 'ETS2',
    value: { map: 'europe', search: 'achievements' },
  },
] as SearchOption[];

export const getSearchOption = (
  map: 'usa' | 'europe',
  search: 'cities' | 'achievements',
): SearchOption =>
  Preconditions.checkExists(
    options.find(
      option => option.value.map === map && option.value.search === search,
    ),
  );

interface SearchSelectProps {
  selected: { map: 'usa' | 'europe'; search: 'cities' | 'achievements' };
  onSelect: (option: SearchOption) => void;
}

export const SearchSelect = ({ selected, onSelect }: SearchSelectProps) => {
  console.log('rendering search select component', selected);
  return (
    <Select
      sx={{ paddingBlock: 0, minWidth: 'fit-content' }}
      variant={'plain'}
      size={'sm'}
      slotProps={{
        listbox: { placement: 'bottom-start' },
      }}
      value={selected}
      onChange={(event, v) => {
        if (event != null) {
          onSelect(assertExists(options.find(o => o.value === v)));
        }
      }}
      renderValue={selected => {
        if (!selected) {
          return;
        }
        return (
          <Stack direction={'row'} gap={1} sx={{ alignItems: 'center' }}>
            <Typography level={'body-xs'} fontWeight={'lg'}>
              {selected.value.map === 'usa' ? 'ATS' : 'ETS2'}
            </Typography>
            {selected.value.search === 'cities' ? (
              <LocationCity />
            ) : (
              <EmojiEvents />
            )}
          </Stack>
        );
      }}
    >
      <List>
        <ListItem>
          <Typography level={'body-xs'} fontWeight={'lg'}>
            ATS
          </Typography>
        </ListItem>
        <Option
          value={options[0].value}
          sx={{ px: '1em', textTransform: 'capitalize' }}
        >
          <LocationCity />
          {options[0].value.search}
        </Option>
        <Option
          value={options[1].value}
          sx={{ px: '1em', textTransform: 'capitalize' }}
        >
          <EmojiEvents />
          {options[1].value.search}
        </Option>
      </List>
      <List>
        <ListItem>
          <Typography level={'body-xs'} fontWeight={'lg'}>
            ETS2
          </Typography>
        </ListItem>
        <Option
          value={options[2].value}
          sx={{ px: '1em', textTransform: 'capitalize' }}
        >
          <LocationCity />
          {options[2].value.search}
        </Option>
        {/*
        <Option
          value={options[3].value}
          sx={{ px: '1em', textTransform: 'capitalize' }}
        >
          <EmojiEvents />
          {options[3].value.search}
        </Option>
        */}
      </List>
    </Select>
  );
};
