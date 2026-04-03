import { UnreachableError } from '@truckermudgeon/base/precon';
import type { GameContext } from '../../domain/game-context';
import type { LookupData, LookupService } from '../../domain/lookup-data';

export class LookupServiceImpl implements LookupService {
  constructor(
    private readonly atsLookups: LookupData,
    private readonly ets2Lookups: LookupData,
  ) {}

  getData(context: GameContext): LookupData {
    switch (context.map) {
      case 'usa':
        return this.atsLookups;
      case 'europe':
        return this.ets2Lookups;
      default:
        throw new UnreachableError(context.map);
    }
  }
}
