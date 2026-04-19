import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import type { IosShortcutBearerPanelProps } from './IosShortcutBearerPanel';
import { IosShortcutBearerPanel } from './IosShortcutBearerPanel';

const noop = fn();

const defaultProps: IosShortcutBearerPanelProps = {
  bearerCreatedAt: null,
  justGeneratedBearer: null,
  generating: false,
  error: null,
  onGenerate: noop,
};

const meta: Meta<typeof IosShortcutBearerPanel> = {
  title: 'Components/IosShortcutBearerPanel',
  component: IosShortcutBearerPanel,
};

export default meta;
type Story = StoryObj<typeof IosShortcutBearerPanel>;

export const NoBearer: Story = {
  args: { ...defaultProps },
};

export const JustGenerated: Story = {
  args: {
    ...defaultProps,
    justGeneratedBearer: 'test-uid:aBcDeFgHiJkLmNoPqRsTuVwXyZ012345678901234',
  },
};

export const PreviouslyGenerated: Story = {
  args: {
    ...defaultProps,
    bearerCreatedAt: '1/15/2026, 10:30:00 AM',
  },
};

export const Generating: Story = {
  args: {
    ...defaultProps,
    generating: true,
  },
};

export const Error: Story = {
  args: {
    ...defaultProps,
    error: 'Failed to generate bearer token.',
  },
};
