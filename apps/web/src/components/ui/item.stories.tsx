import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Inbox } from "lucide-react";
import { Button } from "./button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "./item";

const meta = {
  title: "UI/Item",
  component: Item,
  args: {
    children: (
      <>
        <ItemMedia variant="icon">
          <Inbox />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Item title</ItemTitle>
          <ItemDescription>Item description.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="sm" variant="outline">
            Open
          </Button>
        </ItemActions>
      </>
    ),
  },
  argTypes: {
    variant: { control: "select", options: ["default", "outline", "muted"] },
    size: { control: "select", options: ["default", "sm", "xs"] },
  },
} satisfies Meta<typeof Item>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const Muted: Story = {
  args: { variant: "muted" },
};
