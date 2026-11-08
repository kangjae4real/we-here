import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CalendarIcon } from "lucide-react";
import { Marker, MarkerContent, MarkerIcon } from "./marker";

const meta = {
  title: "UI/Marker",
  component: Marker,
  argTypes: {
    variant: { control: "select", options: ["default", "separator", "border"] },
  },
  render: (args) => (
    <div className="w-96">
      <Marker {...args}>
        <MarkerIcon>
          <CalendarIcon />
        </MarkerIcon>
        <MarkerContent>Today</MarkerContent>
      </Marker>
    </div>
  ),
} satisfies Meta<typeof Marker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Separator: Story = { args: { variant: "separator" } };

export const Border: Story = { args: { variant: "border" } };
