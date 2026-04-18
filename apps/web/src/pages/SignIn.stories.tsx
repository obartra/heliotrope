import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { SignIn } from './SignIn';

const meta: Meta<typeof SignIn> = {
  title: 'Pages/SignIn',
  component: SignIn,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SignIn>;

export const Default: Story = {};
