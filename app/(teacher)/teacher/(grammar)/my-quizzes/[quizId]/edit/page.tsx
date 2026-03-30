"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getTeacherQuiz, updateTeacherQuiz } from "@/lib/quizService";
import TeacherLayout from "@/components/TeacherLayout";
import QuestionSetEditor from "@/components/teacher/QuestionSetEditor";
import { Toaster } from "sonner";

export default function EditQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const router = useRouter();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/"); return; }
      try {
        const data = await getTeacherQuiz(quizId);
        setQuiz(data);
      } catch (err) {
        console.error("Failed to load quiz:", err);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [quizId, router]);

  const handleSave = async ({
    title,
    privacy,
    questions,
  }: {
    title: string;
    privacy: "public" | "private";
    questions: any[];
  }) => {
    await updateTeacherQuiz(quizId, { title, privacy, questions });
  };

  if (loading) {
    return (
      <TeacherLayout title="Edit Quiz">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </TeacherLayout>
    );
  }

  if (!quiz) {
    return (
      <TeacherLayout title="Edit Quiz">
        <p className="text-center text-slate-500 mt-10">Quiz not found.</p>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title="Edit Quiz">
      <Toaster position="top-center" richColors />
      <QuestionSetEditor
        quizId={quizId}
        initialTitle={quiz.title || ""}
        initialPrivacy={quiz.privacy || "public"}
        initialQuestions={quiz.questions || []}
        onSave={handleSave}
      />
    </TeacherLayout>
  );
}