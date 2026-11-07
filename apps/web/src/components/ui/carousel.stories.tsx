import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./carousel";

const meta = {
  title: "UI/Carousel",
  component: Carousel,
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
  },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

const slides = ["1", "2", "3", "4", "5"];

export const Default: Story = {
  render: (args) => (
    <Carousel {...args} className="mx-auto w-full max-w-xs">
      <CarouselContent>
        {slides.map((n) => (
          <CarouselItem key={n}>
            <div className="flex aspect-square items-center justify-center rounded-lg border text-4xl font-semibold">
              {n}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <Carousel {...args} className="mx-auto w-full max-w-xs">
      <CarouselContent className="h-64">
        {slides.map((n) => (
          <CarouselItem key={n}>
            <div className="flex h-full items-center justify-center rounded-lg border text-4xl font-semibold">
              {n}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
