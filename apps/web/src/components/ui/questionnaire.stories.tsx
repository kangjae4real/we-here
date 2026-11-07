import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "./questionnaire";

const meta = {
  title: "UI/Questionnaire",
  component: Questionnaire,
  render: (args) => (
    <Questionnaire {...args} className="w-96">
      <QuestionnaireProgress />
      <QuestionnaireItem name="framework">
        <QuestionnaireTitle>Pick a framework</QuestionnaireTitle>
        <QuestionnaireDescription>Choose one option.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="next">
            Next.js
            <QuestionnaireChoiceDescription>
              React framework
            </QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="remix">Remix</QuestionnaireChoice>
        </QuestionnaireChoices>
      </QuestionnaireItem>
      <QuestionnaireItem name="notes">
        <QuestionnaireTitle>Anything else?</QuestionnaireTitle>
        <QuestionnaireInput placeholder="Type here" />
      </QuestionnaireItem>
      <QuestionnaireActions>
        <QuestionnairePrevious />
        <QuestionnaireSkip />
        <QuestionnaireNext />
        <QuestionnaireSubmit />
      </QuestionnaireActions>
    </Questionnaire>
  ),
} satisfies Meta<typeof Questionnaire>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      {
        name: "framework",
        choices: [{ value: "next" }, { value: "remix" }],
      },
      { name: "notes" },
    ],
  },
};
