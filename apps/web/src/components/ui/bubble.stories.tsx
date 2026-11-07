import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "./bubble";

const meta = {
  title: "UI/Bubble",
  component: Bubble,
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "muted",
        "tinted",
        "outline",
        "ghost",
        "destructive",
      ],
    },
    align: { control: "select", options: ["start", "end"] },
  },
  render: (args) => (
    <div className="flex w-96 flex-col">
      <Bubble {...args}>
        <BubbleContent>Hello, how can I help?</BubbleContent>
      </Bubble>
    </div>
  ),
} satisfies Meta<typeof Bubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Group: Story = {
  render: () => (
    <div className="w-96">
      <BubbleGroup>
        <Bubble variant="muted">
          <BubbleContent>Is the build green?</BubbleContent>
        </Bubble>
        <Bubble variant="default" align="end">
          <BubbleContent>Yes, all checks passed.</BubbleContent>
        </Bubble>
      </BubbleGroup>
    </div>
  ),
};

export const WithReactions: Story = {
  render: () => (
    <div className="w-96 pb-4">
      <Bubble variant="secondary">
        <BubbleContent>Nice work!</BubbleContent>
        <BubbleReactions>👍 2</BubbleReactions>
      </Bubble>
    </div>
  ),
};
