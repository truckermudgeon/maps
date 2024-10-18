import { Grid } from '@mui/joy';
import { useState } from 'react';
import { Details } from './Details';
import { LaneControl } from './LaneControl';
import type { PrefabOption } from './PrefabSelect';
import { PrefabSelect } from './PrefabSelect';
import { Preview } from './Preview';

const App = () => {
  const [active, setActive] = useState<PrefabOption | undefined>();
  const onChange = (p: PrefabOption | undefined) => setActive(p);

  return (
    <Grid
      container
      padding={2}
      spacing={2}
      sx={{ flexGrow: 1, maxHeight: '100vh', overflow: 'hidden' }}
    >
      <Grid xs={12}>
        <PrefabSelect onChange={onChange} />
      </Grid>
      <Grid xs={8} sx={{ height: 'calc(100vh - 80px)' }}>
        {active && (
          <>
            <LaneControl prefab={active.value.prefabDesc} />
            <Preview prefab={active.value.prefabDesc} />
          </>
        )}
      </Grid>
      <Grid xs={4} sx={{ height: 'calc(100vh - 80px)', overflowY: 'scroll' }}>
        {active && (
          <Details
            prefab={active.value.prefabDesc}
            locations={active.value.locations}
          />
        )}
      </Grid>
    </Grid>
  );
};

export default App;
