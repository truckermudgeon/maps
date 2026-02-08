import { Button, Card, Stack, Typography } from '@mui/joy';

export interface ChooseOnMapPageProps {
  onUseThisPointClick: () => void;
}

export const ChooseOnMapPage = (props: ChooseOnMapPageProps) => {
  return (
    <Stack direction={'column'} gap={2} flexGrow={1}>
      <Card size={'lg'} variant={'soft'}>
        <Typography level={'body-md'} fontSize={'lg'}>
          Pan and zoom to adjust
        </Typography>
        <Button size={'lg'} onClick={props.onUseThisPointClick}>
          Done
        </Button>
      </Card>
    </Stack>
  );
};
