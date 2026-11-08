import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFooter,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "./code-block";

const code = 'const greeting = "hello";\nconsole.log(greeting);\n';

const meta = {
  title: "UI/CodeBlock",
  component: CodeBlock,
  argTypes: {
    variant: { control: "select", options: ["default", "destructive"] },
    size: { control: "select", options: ["default", "sm"] },
  },
  render: (args) => (
    <div className="w-96">
      <CodeBlock {...args}>
        <CodeBlockHeader>
          <CodeBlockTitle>hello.ts</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value={code} />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent>{code}</CodeBlockContent>
      </CodeBlock>
    </div>
  ),
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LineNumbers: Story = {
  render: (args) => (
    <div className="w-96">
      <CodeBlock {...args}>
        <CodeBlockContent lineNumbers>{code}</CodeBlockContent>
        <CodeBlockFooter>2 lines</CodeBlockFooter>
      </CodeBlock>
    </div>
  ),
};

export const Diff: Story = {
  render: (args) => (
    <div className="w-96">
      <CodeBlock {...args}>
        <CodeBlockContent>
          <CodeBlockLine variant="removed">const a = 1;</CodeBlockLine>
          <CodeBlockLine variant="added">const a = 2;</CodeBlockLine>
          <CodeBlockLine>{"export { a };"}</CodeBlockLine>
        </CodeBlockContent>
      </CodeBlock>
    </div>
  ),
};
