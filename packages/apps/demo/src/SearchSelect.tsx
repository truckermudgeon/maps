import { EmojiEvents, LocationCity } from '@mui/icons-material';
import { List, ListItem, Option, Select, Stack, Typography } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';

export type SearchOption = Readonly<
  {
    label: string;
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
      {Object.entries(Object.groupBy(options, ({ label }) => label)).map(
        ([label, value]) => {
          return (
            <List key={label}>
              <ListItem>
                <Typography level={'body-xs'} fontWeight={'lg'}>
                  {label}
                </Typography>
              </ListItem>
              {value?.map(option => {
                return (
                  <Option
                    key={option.value.search}
                    value={option.value}
                    sx={{ px: '1em', textTransform: 'capitalize' }}
                  >
                    <Decoration search={option.value.search} />
                    {option.value.search}
                  </Option>
                );
              })}
            </List>
          );
        },
      )}
    </Select>
  );
};

const Decoration = ({
  search,
}: {
  search: SearchOption['value']['search'];
}) => {
  switch (search) {
    case 'cities':
      return <LocationCity />;
    case 'achievements':
      return <EmojiEvents />;
    default:
      throw new UnreachableError(search);
  }
};
