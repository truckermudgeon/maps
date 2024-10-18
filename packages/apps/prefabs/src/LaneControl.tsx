import { List, ListItem, ListSubheader, Stack } from '@mui/joy';
import { calculateLaneInfo } from '@truckermudgeon/map/prefabs';
import type { PrefabDescription } from '@truckermudgeon/map/types';

export const LaneControl = ({ prefab }: { prefab: PrefabDescription }) => {
  const lanes = calculateLaneInfo(prefab);
  return (
    <Stack m={1} sx={{ position: 'absolute' }}>
      <List variant={'outlined'} size={'sm'} sx={{ borderRadius: 'sm' }}>
        {lanes
          .entries()
          .toArray()
          .map(([nodeIndex, lanes]) => {
            if (lanes.length === 0) {
              return null;
            }
            return (
              <ListItem nested>
                <ListSubheader>Node {nodeIndex}</ListSubheader>
                <List>
                  {lanes.map((lane, laneIndex) => {
                    return (
                      <ListItem>
                        <div>Lane {laneIndex}</div>
                        {lane.branches.map((branch, _branchIndex) => {
                          return (
                            <Stack>
                              <div>To Node {branch.targetNodeIndex}</div>
                            </Stack>
                          );
                        })}
                      </ListItem>
                    );
                  })}
                </List>
              </ListItem>
            );
          })}
      </List>
    </Stack>
  );
};
