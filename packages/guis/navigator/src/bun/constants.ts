import { navigatorUrl } from '@truckermudgeon/navigator-client/constants';
import type { BrowserPage } from './types';

export const BrowserPageUrls: Record<BrowserPage, string> = {
  'github-maps-releases': 'https://github.com/truckermudgeon/maps/releases',
  'github-maps-repo': 'https://github.com/truckermudgeon/maps',
  'github-rencloud-scs-sdk-plugin-repo':
    'https://github.com/RenCloud/scs-sdk-plugin',
  'github-truckermudgeon-scs-sdk-plugin-repo':
    'https://github.com/truckermudgeon/scs-sdk-plugin',
  navigator: navigatorUrl,
};
