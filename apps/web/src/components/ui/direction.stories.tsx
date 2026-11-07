import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DirectionProvider, useDirection } from "./direction";

function Current() {
  const direction = useDirection();
  return <p className="text-sm">Direction: {direction}</p>;
}

const meta = {
  title: "UI/Direction",
  component: DirectionProvider,
  args: { direction: "rtl", children: <Current /> },
  argTypes: { direction: { control: "inline-radio", options: ["ltr", "rtl"] } },
} satisfies Meta<typeof DirectionProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LeftToRight: Story = { args: { direction: "ltr" } };
