import type {
  DragEndEvent,
  DraggableAttributes,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CloseIcon from '@mui/icons-material/Close';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import PlaceIcon from '@mui/icons-material/FmdGood';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  Stack,
  Typography,
} from '@mui/joy';
import type { CSSProperties } from 'react';
import { forwardRef, useState } from 'react';
import { toDuration } from './text';

interface Waypoint {
  id: string;
  description: string;
  nodeUid: bigint;
}

export interface ManageStopsPageProps {
  summary: {
    minutes: number;
    distanceMeters: number;
  };
  waypoints: Waypoint[];
  onDoneClick: () => void;
  onWaypointReorder: (op: { oldIndex: number; newIndex: number }) => void;
  onWaypointDelete: (index: number) => void;
}

const listItemContentSxProps = {
  backgroundColor: 'background.body',
  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'var(--joy-radius-sm)',
  padding: 1,
} as const;

export const ManageStopsPage = (props: ManageStopsPageProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 50,
        tolerance: 5,
      },
    }),
  );
  const duration = toDuration(props.summary.minutes * 60);

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      props.onWaypointReorder({
        oldIndex: props.waypoints.findIndex(wp => wp.id === active.id),
        newIndex: props.waypoints.findIndex(wp => wp.id === over?.id),
      });
    }
    setActiveId(null);
  }

  const activeWaypoint = props.waypoints.find(wp => wp.id === activeId);

  return (
    <Stack direction={'column'} gap={2} flexGrow={1}>
      <List size={'lg'}>
        <ListItem>
          <StartItemDecorator
            hide={activeId != null}
            index={-1}
            totalItems={props.waypoints.length}
          />
          <ListItemContent sx={{ border: '1px solid transparent', padding: 1 }}>
            <Typography>Your location</Typography>
          </ListItemContent>
        </ListItem>
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={props.waypoints}
            strategy={verticalListSortingStrategy}
          >
            {props.waypoints.map((waypoint, index) => (
              <SortableItem
                onDeleteClick={() => props.onWaypointDelete(index)}
                invisible={waypoint.id === activeId}
                isDragOpActive={activeId != null}
                key={waypoint.id}
                index={index}
                totalItems={props.waypoints.length}
                waypoint={waypoint}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeWaypoint ? (
              <Item
                index={props.waypoints.indexOf(activeWaypoint)}
                waypoint={activeWaypoint}
                totalItems={props.waypoints.length}
                shadow={true}
                hideDecorators={true}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </List>
      <Stack
        direction={'row'}
        gap={2}
        px={2}
        justifyContent={'space-between'}
        alignItems={'center'}
      >
        <Typography level={'title-lg'}>
          Total trip: {duration.string}
        </Typography>
        <Button size={'lg'} onClick={props.onDoneClick}>
          Done
        </Button>
      </Stack>
    </Stack>
  );
};

const SortableItem = (props: {
  invisible: boolean;
  isDragOpActive: boolean;
  index: number;
  totalItems: number;
  waypoint: Waypoint;
  onDeleteClick: () => void;
}) => {
  const {
    invisible,
    isDragOpActive,
    index,
    totalItems,
    waypoint,
    onDeleteClick,
  } = props;
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
  } = useSortable({ id: waypoint.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: invisible ? 0 : undefined,
  };

  return (
    <Item
      ref={setNodeRef}
      hideDecorators={isDragOpActive}
      style={style}
      attributes={attributes}
      listeners={listeners}
      index={index}
      totalItems={totalItems}
      waypoint={waypoint}
      onDeleteClick={onDeleteClick}
      setActivatorNodeRef={setActivatorNodeRef}
    />
  );
};

const Item = forwardRef(
  (
    props: {
      index: number;
      totalItems: number;
      waypoint: Waypoint;
      hideDecorators?: boolean;
      onDeleteClick?: () => void;
      style?: CSSProperties;
      shadow?: boolean;
      attributes?: DraggableAttributes;
      listeners?: SyntheticListenerMap;
      setActivatorNodeRef?: (element: HTMLElement | null) => void;
    },
    ref: React.ForwardedRef<HTMLLIElement>,
  ) => {
    const {
      index,
      totalItems,
      waypoint,
      hideDecorators = false,
      style,
      attributes,
      listeners,
    } = props;
    const border = totalItems > 1 ? listItemContentSxProps.border : undefined;
    return (
      <ListItem ref={ref} style={style} {...attributes}>
        <StartItemDecorator
          hide={hideDecorators}
          index={index}
          totalItems={totalItems}
        />
        <ListItemContent
          sx={{
            ...listItemContentSxProps,
            border,
            boxShadow: props.shadow
              ? // TODO dark mode shadows
                '0px 0px 10px 3px rgba(0.5,0.5,0.5,0.15)'
              : undefined,
          }}
        >
          <Stack
            direction={'row'}
            justifyContent={'space-between'}
            alignItems={'center'}
          >
            <Typography>{waypoint.description}</Typography>
            {totalItems > 1 && (
              <Box
                ref={props.setActivatorNodeRef}
                {...listeners}
                sx={{
                  display: 'flex',
                  cursor: 'grab',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '2em',
                  height: '2em',
                }}
              >
                <DragHandleIcon />
              </Box>
            )}
          </Stack>
        </ListItemContent>
        {totalItems > 1 && (
          <ListItemDecorator>
            <IconButton
              onClick={props.onDeleteClick}
              sx={{
                opacity: 1,
                transition: 'opacity 200ms',
              }}
              style={{ opacity: hideDecorators ? 0 : undefined }}
            >
              <CloseIcon />
            </IconButton>
          </ListItemDecorator>
        )}
      </ListItem>
    );
  },
);

const StartItemDecorator = (props: {
  index: number;
  totalItems: number;
  hide: boolean;
}) => {
  const { index, totalItems, hide } = props;
  if (index === -1) {
    // blue dot
    return (
      <ListItemDecorator>
        <Box
          sx={{
            border: '0.15em solid',
            borderColor: 'white',
            boxShadow: '0px 0px 1px 1px rgba(0,0,0,0.25)',
            borderRadius: '50%',
            width: '1em',
            height: '1em',
            backgroundColor: 'hsl(204,100%,50%)',
            opacity: 1,
            transition: 'opacity 200ms',
          }}
          style={{
            opacity: hide ? 0 : undefined,
          }}
        />
      </ListItemDecorator>
    );
  } else if (index === totalItems - 1) {
    // red pin
    return (
      <ListItemDecorator>
        <PlaceIcon
          sx={{
            marginLeft: '-0.1em',
            stroke: 'rgba(0.5,0.5,0.5,.25)',
            fill: 'red',
            opacity: 1,
            transition: 'opacity 200ms',
          }}
          style={{
            opacity: hide ? 0 : undefined,
          }}
        />
      </ListItemDecorator>
    );
  } else {
    // waypoint marker
    return (
      <ListItemDecorator>
        <Box
          sx={{
            fontSize: '0.625em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bolder',
            borderRadius: '50%',
            width: '1.6em',
            height: '1.6em',
            border: '0.15em solid',
            backgroundColor: 'background.surface',
            opacity: 1,
            transition: 'opacity 200ms',
          }}
          style={{
            opacity: hide ? 0 : undefined,
          }}
        >
          {index + 1}
        </Box>
      </ListItemDecorator>
    );
  }
};
