import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { TimeOfDayConditionEditor } from './TimeOfDayConditionEditor';

const meta: Meta<typeof TimeOfDayConditionEditor> = {
  title: 'ConditionEditor/TimeOfDayConditionEditor',
  component: TimeOfDayConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof TimeOfDayConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'timeOfDay', value: 'night' },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'timeOfDay', value: 'day' },
  },
};
