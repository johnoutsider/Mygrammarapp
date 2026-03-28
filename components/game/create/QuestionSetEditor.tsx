"use client";
import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Plus,
  FileSpreadsheet,
  Eye,
  Save,
  Clock,
  Info,
  Lock,
  Globe,
} from "lucide-react";
import QuestionModal, { Question } from "./QuestionModal";
import { toast } from "sonner";

interface Props {
  quizId: string;
  initialTitle: string;
  initialPrivacy: "public" | "private";
  initialQuestions: Question[];
  onSave: (data: {
    title: string;
    privacy: "public" | "private";
    questions: Question[];
  }) => Promise<void>;
}

export default function QuestionSetEditor({
  quizId,
  initialTitle,
  initialPrivacy,
  initialQuestions,
  onSave,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [privacy, setPrivacy] = useState<"public" | "private">(initialPrivacy);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [saving, setSaving] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null | "new">(null);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showTimeLimit, setShowTimeLimit] = useState(false);
  const [globalTimeLimit, setGlobalTimeLimit] = useState(20);

  // ── Move question up/down ───────────────────────────────────────
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newQ = [...questions];
    [newQ[index - 1], newQ[index]] = [newQ[index], newQ[index - 1]];
    setQuestions(newQ);
  };

  const moveDown = (index: number) => {
    if (index === questions.length - 1) return;
    const newQ = [...questions];
    [newQ[index], newQ[index + 1]] = [newQ[index + 1], newQ[index]];
    setQuestions(newQ);
  };

  // ── Save question from modal ────────────────────────────────────
  const handleSaveQuestion = (q: Question) => {
    if (editingQuestion === "new") {
      setQuestions((prev) => [...prev, q]);
    } else {
      setQuestions((prev) => prev.map((existing) => (existing.id === q.id ? q : existing)));
    }
    setEditingQuestion(null);
    toast.success("Question saved!");
  };

  // ── Excel Import (CSV) ──────────────────────────────────────────
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const parsed: Question[] = lines.slice(1).map((line, i) => {
        const cols = line.split(",").map((c) => c.trim());
        const correctIndex = parseInt(cols[5]) - 1;
        return {
          id: Date.now() + i,
          text: cols[0] || "",
          type: "quiz" as const,
          timeLimit: globalTimeLimit,
          answers: [
            { id: 1, text: cols[1] || "", isCorrect: correctIndex === 0 },
            { id: 2, text: cols[2] || "", isCorrect: correctIndex === 1 },
            { id: 3, text: cols[3] || "", isCorrect: correctIndex === 2 },
            { id: 4, text: cols[4] || "", isCorrect: correctIndex === 3 },
          ],
        };
      }).filter((q) => q.text);
      setQuestions((prev) => [...prev, ...parsed]);
      toast.success(`${parsed.length} questions imported!`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Save to Firestore ───────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { toast.error("Please add a title!"); return; }
    setSaving(true);
    try {
      await onSave({ title, privacy, questions });
      toast.success("Quiz saved successfully!");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* ── Quiz Title ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quiz Title..."
          className="w-full text-2xl font-bold text-slate-800 border-none outline-none bg-transparent placeholder:text-slate-300"
        />
        {/* Privacy badge */}
        <button
          onClick={() => setPrivacy(privacy === "public" ? "private" : "public")}
          className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-600 transition-colors"
        >
          {privacy === "public" ? <Globe size={14} /> : <Lock size={14} />}
          <span className="font-semibold capitalize">{privacy}</span>
        </button>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50 shadow-sm"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save"}
        </button>

        {/* Edit Info & Time Limit */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowEditInfo(!showEditInfo)}
            className="flex items-center justify-center gap-2 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-all"
          >
            <Info size={14} /> Edit Info
          </button>
          <button
            onClick={() => setShowTimeLimit(!showTimeLimit)}
            className="flex items-center justify-center gap-2 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-all"
          >
            <Clock size={14} /> Time Limit
          </button>
        </div>

        {/* Edit Info panel */}
        {showEditInfo && (
          <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Privacy</p>
            <div className="flex gap-2">
              {(["public", "private"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPrivacy(p)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${
                    privacy === p
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {p === "public" ? "🌐" : "🔒"} {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Time Limit panel */}
        {showTimeLimit && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Default Time Per Question
            </p>
            <div className="flex flex-wrap gap-2">
              {[10, 15, 20, 30, 45, 60, 90, 120].map((t) => (
                <button
                  key={t}
                  onClick={() => setGlobalTimeLimit(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    globalTimeLimit === t
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Action Buttons ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setEditingQuestion("new")}
          className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-sm"
        >
          <Plus size={16} /> Add Question
        </button>
        <label className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-sm cursor-pointer">
          <FileSpreadsheet size={16} /> Excel Import
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleExcelImport}
          />
        </label>
      </div>

      {/* ── Show Answers Toggle ── */}
      <button
        onClick={() => setShowAnswers(!showAnswers)}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
          showAnswers
            ? "border-teal-500 bg-teal-50 text-teal-700"
            : "border-slate-200 text-slate-600 hover:border-slate-300"
        }`}
      >
        <Eye size={16} />
        {showAnswers ? "Hide Answers" : "Show Answers"}
      </button>

      {/* ── Questions List ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-bold text-slate-700">
            {questions.length} Question{questions.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setEditingQuestion("new")}
            className="flex items-center gap-1 text-sm font-semibold text-purple-600 hover:text-purple-700"
          >
            <Plus size={14} /> Add Question
          </button>
        </div>

        {questions.length === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
            <p className="text-slate-400 text-sm font-medium">No questions yet.</p>
            <p className="text-slate-300 text-xs mt-1">
              Click &quot;Add Question&quot; or import from Excel/CSV.
            </p>
          </div>
        )}

        {questions.map((q, index) => (
          <div
            key={q.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-start gap-3"
          >
            {/* Reorder buttons */}
            <div className="flex flex-col gap-1 mt-0.5">
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronUp size={16} />
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === questions.length - 1}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Question content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                Question {index + 1}
              </p>
              <p className="text-sm text-slate-800 font-medium line-clamp-2">{q.text}</p>

              {/* Show answers if toggled */}
              {showAnswers && (
                <div className="mt-2 space-y-1">
                  {q.answers.map((a) => (
                    <div
                      key={a.id}
                      className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1.5 ${
                        a.isCorrect
                          ? "bg-teal-50 text-teal-700 font-semibold"
                          : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      {a.isCorrect && <span>✓</span>}
                      {a.text || <span className="italic text-slate-300">Empty</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Time limit badge */}
              <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                <Clock size={11} /> {q.timeLimit}s
              </div>
            </div>

            {/* Edit button */}
            <button
              onClick={() => setEditingQuestion(q)}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex-shrink-0"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
        ))}
      </div>

      {/* ── Question Modal ── */}
      {editingQuestion !== null && (
        <QuestionModal
          question={editingQuestion === "new" ? null : editingQuestion}
          onSave={handleSaveQuestion}
          onClose={() => setEditingQuestion(null)}
        />
      )}
    </div>
  );
}