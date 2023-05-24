export interface QuizState {
  categories: Category[];
  currentQuestion: string | null;
  currentCategory: string | null;
}

export interface Category {
  name: string;
  probability: number;
}