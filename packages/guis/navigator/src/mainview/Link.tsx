import { Link as JoyLink, Tooltip } from '@mui/joy';
import { BrowserPageUrls } from '../bun/constants';
import type { BrowserPage } from '../bun/types';

export const Link = (props: {
  children: string;
  page: BrowserPage;
  onClick: (page: BrowserPage) => void;
}) => {
  const { children, page, onClick } = props;
  return (
    <Tooltip title={BrowserPageUrls[page]}>
      <JoyLink onClick={() => onClick(page)}>{children}</JoyLink>
    </Tooltip>
  );
};
