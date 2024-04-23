import { UnreachableError } from '@truckermudgeon/base/precon';
import type { AtsSelectableDlc } from '@truckermudgeon/map/constants';
import { AtsDlc } from '@truckermudgeon/map/constants';
import { StateCode } from '@truckermudgeon/ui';

export function toStateCodes(atsDlcs: Set<AtsSelectableDlc>) {
  return new Set<StateCode>([...atsDlcs].map(toStateCode).concat(StateCode.CA));
}

function toStateCode(atsDlc: AtsSelectableDlc): StateCode {
  switch (atsDlc) {
    case AtsDlc.Arizona:
      return StateCode.AZ;
    case AtsDlc.Colorado:
      return StateCode.CO;
    case AtsDlc.Idaho:
      return StateCode.ID;
    case AtsDlc.Kansas:
      return StateCode.KS;
    case AtsDlc.Montana:
      return StateCode.MT;
    case AtsDlc.Nevada:
      return StateCode.NV;
    case AtsDlc.NewMexico:
      return StateCode.NM;
    case AtsDlc.Oklahoma:
      return StateCode.OK;
    case AtsDlc.Oregon:
      return StateCode.OR;
    case AtsDlc.Texas:
      return StateCode.TX;
    case AtsDlc.Utah:
      return StateCode.UT;
    case AtsDlc.Washington:
      return StateCode.WA;
    case AtsDlc.Wyoming:
      return StateCode.WY;
    default:
      throw new UnreachableError(atsDlc);
  }
}
