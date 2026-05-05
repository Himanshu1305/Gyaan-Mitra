export interface Teacher {
  id: string;
  name: string;
  email: string;
  school: string;
  subject: string;
  grade_level: string;
  created_at: string;
}

export interface LessonPlan {
  id: string;
  teacher_id: string;
  title: string;
  subject: string;
  grade: string;
  content: string;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}
