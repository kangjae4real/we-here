import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./combobox";

const fruits = ["Apple", "Banana", "Cherry", "Grape", "Mango", "Orange"];

const meta = {
  title: "UI/Combobox",
  component: Combobox,
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Combobox {...args} items={fruits}>
      <ComboboxInput placeholder="Select a fruit" className="w-64" />
      <ComboboxContent>
        <ComboboxEmpty>No fruit found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

export const WithClear: Story = {
  render: (args) => (
    <Combobox {...args} items={fruits} defaultValue="Apple">
      <ComboboxInput showClear placeholder="Select a fruit" className="w-64" />
      <ComboboxContent>
        <ComboboxEmpty>No fruit found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};
