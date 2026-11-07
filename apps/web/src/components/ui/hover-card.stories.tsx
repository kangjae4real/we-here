import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

const meta = {
  title: "UI/HoverCard",
  component: HoverCard,
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger render={<Button variant="link" />}>
        @we-here
      </HoverCardTrigger>
      <HoverCardContent>
        <p className="text-sm">A short preview shown on hover.</p>
      </HoverCardContent>
    </HoverCard>
  ),
};
