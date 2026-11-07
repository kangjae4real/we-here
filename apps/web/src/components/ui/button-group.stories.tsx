import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "./button-group";

const meta = {
  title: "UI/ButtonGroup",
  component: ButtonGroup,
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
  },
  render: (args) => (
    <ButtonGroup {...args} aria-label="Actions">
      <Button variant="outline">One</Button>
      <Button variant="outline">Two</Button>
      <Button variant="outline">Three</Button>
    </ButtonGroup>
  ),
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = {
  args: { orientation: "vertical" },
};

export const WithTextAndSeparator: Story = {
  render: (args) => (
    <ButtonGroup {...args} aria-label="Filter">
      <ButtonGroupText>Sort by</ButtonGroupText>
      <Button variant="outline">Name</Button>
      <ButtonGroupSeparator />
      <Button variant="outline">Date</Button>
    </ButtonGroup>
  ),
};
