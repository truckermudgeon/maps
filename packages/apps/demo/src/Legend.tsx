import { useState } from 'react';

type Icon =
  | 'viewpoint'
  | 'photo_sight_captured'
  | 'parking_ico'
  | 'gas_ico'
  | 'service_ico'
  | 'weigh_station_ico' // also: weigh_ico
  | 'dealer_ico'
  | 'garage_large_ico'
  | 'recruitment_ico'
  | 'agri_check'
  | 'border_ico'
  | 'toll_ico'
  | 'port_overlay'
  | 'train_ico';
type IconVisibility =
  | {
      type: 'auto';
    }
  | { type: 'manual'; visible: Set<Icon> };
export const Legend = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [iconVisibility, setIconVisibility] = useState<IconVisibility>({
    type: 'auto',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        margin: 10,
      }}
    ></div>
  );
};
