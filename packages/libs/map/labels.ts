import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';

export function toDealerLabel(prefabPath: string): string {
  Preconditions.checkArgument(prefabPath.includes('/truck_dealer/'));
  const dealerRegex = /\/truck_dealer\/(?:truck_dealer_([^.]+).ppd$|([^/]+)\/)/;
  const matches = assertExists(dealerRegex.exec(prefabPath));
  const dealer = assertExists(matches[1] ?? matches[2]);

  switch (dealer) {
    case 'mb':
      return 'Mercedes-Benz';
    case 'westernstar':
      return 'Western Star';
    case 'daf':
    case 'man':
      return dealer.toUpperCase();
    case 'freightliner':
    case 'international':
    case 'iveco':
    case 'kenworth':
    case 'mack':
    case 'peterbilt':
    case 'renault':
    case 'scania':
    case 'volvo':
      return dealer.charAt(0).toUpperCase() + dealer.slice(1);
    default:
      throw new Error('unknown dealer: ' + dealer);
  }
}
