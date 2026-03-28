export interface Answer {
  id: number;
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface Question {
  id: number;
  text: string;
  type: 'quiz' | 'true_or_false';
  timeLimit: number;
  answers: Answer[];
}

// UI-only type for rendering colored answer cards in QuestionModal
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  colorClass: string;
  explanation: string;
}

export const OPTION_COLORS = [
  'bg-[#f89b29]',
  'bg-[#3b82f6]',
  'bg-[#00c0a3]',
  'bg-[#ef4444]',
];

export function answersToOptions(answers: Answer[]): QuestionOption[] {
  return answers.map((a, i) => ({
    id: String(a.id),
    text: a.text,
    isCorrect: a.isCorrect,
    colorClass: OPTION_COLORS[i] || OPTION_COLORS[0],
    explanation: a.explanation || '',
  }));
}

export function optionsToAnswers(options: QuestionOption[]): Answer[] {
  return options.map((o, i) => ({
    id: i + 1,
    text: o.text,
    isCorrect: o.isCorrect,
    explanation: o.explanation || '',
  }));
}
