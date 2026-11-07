import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bubble, BubbleContent } from "./bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "./message";

const meta = {
  title: "UI/Message",
  component: Message,
  argTypes: { align: { control: "select", options: ["start", "end"] } },
  render: (args) => (
    <div className="w-96">
      <Message {...args}>
        <MessageAvatar className="size-8 text-xs">AI</MessageAvatar>
        <MessageContent>
          <MessageHeader>Assistant</MessageHeader>
          <Bubble variant="muted">
            <BubbleContent>Here is a short reply.</BubbleContent>
          </Bubble>
          <MessageFooter>10:24</MessageFooter>
        </MessageContent>
      </Message>
    </div>
  ),
} satisfies Meta<typeof Message>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Group: Story = {
  render: () => (
    <div className="w-96">
      <MessageGroup>
        <Message>
          <MessageContent>
            <Bubble variant="muted">
              <BubbleContent>Hi there</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
        <Message align="end">
          <MessageContent>
            <Bubble>
              <BubbleContent>Hello!</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      </MessageGroup>
    </div>
  ),
};
