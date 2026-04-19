import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { NearCityConditionEditor } from './NearCityConditionEditor';

const meta: Meta<typeof NearCityConditionEditor> = {
  title: 'ConditionEditor/NearCityConditionEditor',
  component: NearCityConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof NearCityConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'nearCity', minPopulation: 500000, maxDistanceKm: 25 },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'nearCity', minPopulation: 100000, maxDistanceKm: 10 },
  },
};
