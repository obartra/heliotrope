import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CountryConditionEditor } from './CountryConditionEditor';

const meta: Meta<typeof CountryConditionEditor> = {
  title: 'ConditionEditor/CountryConditionEditor',
  component: CountryConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof CountryConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'country', codes: ['US', 'CA', 'MX'] },
  },
};

export const Empty: Story = {
  args: {
    // @ts-expect-error empty codes array for default state demo
    value: { type: 'country', codes: [] },
  },
};

export const Invalid: Story = {
  args: {
    // @ts-expect-error empty codes array for invalid state demo
    value: { type: 'country', codes: [] },
  },
};
