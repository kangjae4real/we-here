import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CheckIcon, LoaderIcon, SearchIcon } from "lucide-react";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "./trace";

const meta = {
  title: "UI/Trace",
  component: Trace,
  render: (args) => (
    <Trace {...args} className="w-80">
      <TraceLine>
        <TraceIcon>
          <CheckIcon />
        </TraceIcon>
        <TraceTitle>Read 3 files</TraceTitle>
        <TraceDescription>1.2s</TraceDescription>
      </TraceLine>
      <TraceLine status="running">
        <TraceIcon>
          <LoaderIcon />
        </TraceIcon>
        <TraceTitle>Searching the web</TraceTitle>
      </TraceLine>
      <TraceLine status="pending">
        <TraceIcon>
          <SearchIcon />
        </TraceIcon>
        <TraceTitle>Summarizing</TraceTitle>
      </TraceLine>
      <TraceLine status="error">
        <TraceIcon>
          <SearchIcon />
        </TraceIcon>
        <TraceTitle>Request failed</TraceTitle>
      </TraceLine>
    </Trace>
  ),
} satisfies Meta<typeof Trace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Collapsible: Story = {
  render: () => (
    <Trace className="w-80">
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceTitle>Thought for 4s</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          Compared both options and picked the simpler one.
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  ),
};
