import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { Slider } from "./slider";

const meta = {
  title: "UI/Slider",
  component: Slider,
  // aria-label on the root never reaches the thumb inputs; aria-labelledby does
  args: { defaultValue: [50], "aria-labelledby": "slider-label" },
  decorators: [
    (Story) => (
      <div className="grid w-64 gap-3">
        <Label id="slider-label">Volume</Label>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Range: Story = {
  args: { defaultValue: [20, 80] },
};

export const Disabled: Story = {
  args: { disabled: true },
};
