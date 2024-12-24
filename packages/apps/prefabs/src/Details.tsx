import { Tab, TabList, TabPanel, Tabs } from '@mui/joy';
import { toRoadStringsAndPolygons } from '@truckermudgeon/map/prefabs';
import { JSONTree } from './JSONTree';
import type { PrefabDescription } from './PrefabSelect';

interface DetailsProps {
  prefab: PrefabDescription;
  locations: { lng: number; lat: number; hidden: boolean }[];
}

export const Details = ({ prefab, locations }: DetailsProps) => {
  const hiddenLatLng: string[] = [];
  const visibleLatLng: string[] = [];
  for (const { lat, lng, hidden } of locations) {
    const latlng = `${lat.toFixed(3)}/${lng.toFixed(3)}`;
    if (hidden) {
      hiddenLatLng.push(latlng);
    } else {
      visibleLatLng.push(latlng);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { token, path, ...prefabRest } = prefab;
  return (
    <Tabs defaultValue={0}>
      <TabList tabFlex={1} sx={{ borderRadius: 0 }}>
        <Tab>PPD</Tab>
        <Tab>Processed</Tab>
        <Tab>Locations ({locations.length})</Tab>
      </TabList>
      <TabPanel value={0}>
        <JSONTree data={prefabRest} />
      </TabPanel>
      <TabPanel value={1}>
        <JSONTree data={toRoadStringsAndPolygons(prefab)} />
      </TabPanel>
      <TabPanel value={2}>
        {visibleLatLng.map((ll, i) => (
          <Link latlng={ll} key={`vis-${i}`} />
        ))}
        {hiddenLatLng.length ? (
          <h4 style={{ marginBottom: '0.25em' }}>Hidden</h4>
        ) : null}
        {hiddenLatLng.map((ll, i) => (
          <Link latlng={ll} key={`hid-${i}`} />
        ))}
      </TabPanel>
    </Tabs>
  );
};

const Link = ({ latlng }: { latlng: string }) => (
  <a
    style={{ display: 'block' }}
    target={'tm-prefab-link'}
    href={`https://truckermudgeon.github.io/#13/${latlng}`}
  >{`#13/${latlng}`}</a>
);
