import CodeIcon from '@mui/icons-material/Code';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import { Alert, Stack, Typography } from '@mui/joy';
import type { ReactNode } from 'react';
import type { BrowserPage } from '../bun/types';
import { Link } from './Link';

export interface HelpProps {
  onLinkClick: (page: BrowserPage) => void;
}

export const Help = (props: HelpProps) => {
  const _Link = ({
    page,
    children,
  }: {
    page: BrowserPage;
    children: string;
  }) => (
    <Link page={page} onClick={props.onLinkClick}>
      {children}
    </Link>
  );

  return (
    <div
      style={{
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <div className="electrobun-webkit-app-region-drag">
        <Typography level={'h4'} textAlign={'center'} lineHeight={1}>
          TruckSim Navigator
        </Typography>
      </div>
      <Typography level={'body-sm'} textAlign={'center'} color={'neutral'}>
        GUI client version 0.2.0
      </Typography>
      <Stack my={2} gap={2}>
        <Alert
          color={'warning'}
          startDecorator={<WarningIcon />}
          sx={{
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div>This client app is under heavy development</div>
            <UL>
              <li>
                <Typography level="body-sm" color={'warning'}>
                  Expect to find bugs and unfinished features.
                </Typography>
              </li>
              <li>
                <Typography level="body-sm" color={'warning'}>
                  Check the{' '}
                  <_Link page={'github-maps-releases'}>
                    GitHub Releases page
                  </_Link>{' '}
                  for updates.
                </Typography>
              </li>
            </UL>
          </div>
        </Alert>
        <Alert
          startDecorator={<InfoIcon />}
          sx={{
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div>A telemetry plugin is required</div>
            <Typography
              level="body-sm"
              color={'neutral'}
              sx={{ marginTop: 1, marginRight: '2em' }}
            >
              If you haven't already, download and install either:
            </Typography>
            <UL>
              <li>
                <Typography level="body-sm" color={'warning'}>
                  <_Link page={'github-rencloud-scs-sdk-plugin-repo'}>
                    RenCloud's scs-sdk-plugin
                  </_Link>{' '}
                  if you're on Windows, or{' '}
                </Typography>
              </li>
              <li>
                <Typography level="body-sm" color={'warning'}>
                  <_Link page={'github-truckermudgeon-scs-sdk-plugin-repo'}>
                    my cross-platform fork
                  </_Link>{' '}
                  if you're on macOS or Linux.
                </Typography>
              </li>
            </UL>
          </div>
        </Alert>
        <Alert
          startDecorator={<CodeIcon />}
          sx={{
            alignItems: 'flex-start',
          }}
          color={'primary'}
        >
          <div>
            <div>TruckSim Navigator is open source</div>
            <Typography
              level="body-sm"
              color={'neutral'}
              sx={{ marginTop: 1, marginRight: '2em' }}
            >
              View the code, contribute, or report issues on{' '}
              <_Link page={'github-maps-repo'}>GitHub</_Link>.
            </Typography>
          </div>
        </Alert>
      </Stack>
    </div>
  );
};

const UL = (props: { children: ReactNode }) => (
  <ul
    style={{
      margin: 8,
      marginLeft: 0,
      marginBottom: 0,
    }}
  >
    {props.children}
  </ul>
);
