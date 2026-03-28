"use client";
import { useState } from "react";
import { X } from "lucide-react";

export type Answer = {
  id: number;
  text: string;
  isCorrect: boolean;
};

export type Question = {
  id: number;
  text: string;
  type: "quiz";
  timeLimit: number;
  answers: Answer[];
};

interface Props {
  question: Question | null;
  onSave: (q: Question) => void;
  onClose: () => void;
}

export default function QuestionModal({ question, onSave, onClose }: Props) {
  const [text, setText] = useState(question?.text || "");
  const [answers, setAnswers] = useState<Answer[]>(
    question?.answers || [
      { id: 1, text: "", isCorrect: true },
      { id: 2, text: "", isCorrect: false },
      { id: 3, text: "", isCorrect: false },
      { id: 4, text: "", isCorrect: false },
    ]
  );
  const [timeLimit, setTimeLimit] = useState(question?.timeLimit || 20);

  const handleAnswerChange = (id: number, value: string) => {
    setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, text: value } : a)));
  };

  const handleCorrect = (id: number) => {
    setAnswers((prev) => prev.map((a) => ({ ...a, isCorrect: a.id === id })));
  };

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({
      id: question?.id || Date.now(),
      text,
      type: "quiz",
      timeLimit,
      answers,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {question ? "Edit Question" : "Add Question"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Question text */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Question Text <span className="text-red-400">*</span>
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="e.g. Rebecca is eighteen months old. She _____ walk now."
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          />
        </div>

        {/* Answers */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Answers (select the correct one)
          </label>
          <div className="space-y-2">
            {answers.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2">
                <button
                  onClick={() => handleCorrect(a.id)}
                  className={`w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all ${
                    a.isCorrect
                      ? "bg-teal-500 border-teal-500"
                      : "border-slate-300 hover:border-teal-400"
                  }`}
                >
                  {a.isCorrect && (
                    <span className="text-white text-xs font-bold leading-none flex items-center justify-center w-full h-full">
                      ✓
                    </span>
                  )}
                </button>
                <input
                  type="text"
                  value={a.text}
                  onChange={(e) => handleAnswerChange(a.id, e.target.value)}
                  placeholder={`Answer ${i + 1}`}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Time Limit */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Time Limit (seconds)
          </label>
          <select
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {[10, 15, 20, 30, 45, 60, 90, 120].map((t) => (
              <option key={t} value={t}>{t}s</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
          >
            Save Question
          </button>
        </div>
      </div>
    </div>
  );
}