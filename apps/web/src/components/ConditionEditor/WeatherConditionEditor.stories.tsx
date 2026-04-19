import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { WeatherConditionEditor } from './WeatherConditionEditor';

const meta: Meta<typeof WeatherConditionEditor> = {
  title: 'ConditionEditor/WeatherConditionEditor',
  component: WeatherConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof WeatherConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'weather', field: 'temperatureC', op: '>=', value: 30 },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'weather', field: 'temperatureC', op: '>=', value: 0 },
  },
};
