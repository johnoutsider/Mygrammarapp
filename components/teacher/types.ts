export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  colorClass: string;
}

export interface Question {
  id: number;
  text: string;
  options: QuestionOption[];
  timeLimit?: number;
}
