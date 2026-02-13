import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { ChooseDestinationPage } from './ChooseDestinationPage';
import { aSearchResultWith } from './story-builders';

const meta = {
  title: 'Search/ChooseDestinationPage',
  component: ChooseDestinationPage,
} satisfies Meta<typeof ChooseDestinationPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ChooseDestination: Story = {
  args: {
    mode: 'chooseDestination',
    showSearchLoading: false,
    onDestinationTypeClick: fn(),
    onSelect: fn(),
    onInputChange: fn(),
    onChooseOnMapClick: fn(),
    options: Array.from({ length: 2 }, (_, i) =>
      aSearchResultWith({ label: `Search Result ${i + 1}` }),
    ).concat([
      aSearchResultWith({
        label: 'Driverse',
        type: 'company',
        sprite: 'dri_oil_gst',
      }),
      aSearchResultWith({
        label: 'Driverse',
        type: 'serviceArea',
        sprite: 'dri_oil_gst',
        facilityUrls: ['/icons/gas_ico.png', 'icons/parking_ico.png'],
      }),
      // TODO dealers, and their facility counterparts.
    ]),
  },
};

export const SearchAlong: Story = {
  args: {
    ...ChooseDestination.args,
    mode: 'searchAlong',
  },
};
