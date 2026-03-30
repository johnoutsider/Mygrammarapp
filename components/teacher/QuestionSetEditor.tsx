"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Lock,
  Save,
  Edit3,
  Clock,
  Plus,
  Search,
  Grid,
  Building2,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Shuffle,
  Check,
  X,
  EyeOff,
} from "lucide-react";
import { Question, QuestionOption } from "./types";
import { QuestionModal } from "./QuestionModal";

// ── Excel template column mapping ────────────────────────────────────────────
// col[0]=Question#(skip), col[1]=QuestionText, col[2-5]=Answers, col[6]=TimeLimit, col[7]=CorrectAnswer(s)
const OPTION_COLORS = ["bg-[#f89b29]", "bg-[#3b82f6]", "bg-[#00c0a3]", "bg-[#ef4444]"];

function parseRowsToQuestions(rows: (string | number)[][]): Question[] {
  return rows.slice(1).map((cols, i) => {
    const text = String(cols[1] ?? "").trim();
    if (!text) return null;

    const rawCorrect = String(cols[7] ?? "").trim();
    const correctIndices = new Set(
      rawCorrect.split(",").map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n) && n >= 0)
    );

    const timeLimitRaw = parseInt(String(cols[6] ?? ""));
    const timeLimit = isNaN(timeLimitRaw) || timeLimitRaw <= 0 ? 20 : Math.min(timeLimitRaw, 300);

    const options: QuestionOption[] = [cols[2], cols[3], cols[4], cols[5]]
      .map((ans, idx) => ({
        id: String(idx + 1),
        text: String(ans ?? "").trim(),
        isCorrect: correctIndices.has(idx),
        colorClass: OPTION_COLORS[idx],
      }))
      .filter(o => o.text !== "");

    if (options.length < 2) return null;
    return { id: Date.now() + i, text, options, timeLimit };
  }).filter((q): q is Question => q !== null);
}

async function parseImportFile(file: File): Promise<{ questions: Question[]; error: string }> {
  try {
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    let rows: (string | number)[][];

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });
    } else {
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      rows = lines.map(line => {
        const cols: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === "," && !inQuotes) { cols.push(current.trim()); current = ""; }
          else { current += char; }
        }
        cols.push(current.trim());
        return cols;
      });
    }

    const questions = parseRowsToQuestions(rows);
    if (questions.length === 0) {
      return { questions: [], error: "No valid questions found. Check the file matches the template columns." };
    }
    return { questions, error: "" };
  } catch {
    return { questions: [], error: "Failed to read file. Make sure it is a valid Excel or CSV file." };
  }
}

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
  const normalizedInitialQuestions = initialQuestions.map(q => ({
    ...q,
    options: q.options || (q as any).answers?.map((a: any, i: number) => ({
      id: String(a.id || i),
      text: a.text,
      isCorrect: a.isCorrect,
      colorClass: ["bg-[#f89b29]", "bg-[#3b82f6]", "bg-[#00c0a3]", "bg-[#ef4444]"][i % 4]
    })) || [
        { id: '1', text: "", isCorrect: true, colorClass: "bg-[#f89b29]" },
        { id: '2', text: "", isCorrect: false, colorClass: "bg-[#3b82f6]" },
        { id: '3', text: "", isCorrect: false, colorClass: "bg-[#00c0a3]" },
        { id: '4', text: "", isCorrect: false, colorClass: "bg-[#ef4444]" },
      ]
  }));
  const [questions, setQuestions] = useState<Question[]>(normalizedInitialQuestions);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [globalTimeLimit, setGlobalTimeLimit] = useState(20);
  const [tempTimeLimit, setTempTimeLimit] = useState(20);
  const [isTimeLimitModalOpen, setIsTimeLimitModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelError, setExcelError] = useState("");
  const [excelSuccess, setExcelSuccess] = useState<number | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);

  // In the real UI, there isn't a privacy toggle, so we'll just keep it internal
  const [privacy, setPrivacy] = useState(initialPrivacy);

  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      await onSave({ title, privacy, questions });
      toast.success("Info saved successfully!", {
        description: `Test title is now: "${title}"`,
      });
    } catch (e) {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const focusEditInfo = () => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  };

  const toggleQuestion = (id: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllAnswers = () => {
    if (expandedQuestions.size === questions.length) {
      setExpandedQuestions(new Set());
    } else {
      setExpandedQuestions(new Set(questions.map((q) => q.id)));
    }
  };

  const openEditModal = (id: number | null = null) => {
    setEditingQuestionId(id);
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    setIsModalOpen(false);
    setEditingQuestionId(null);
  };

  const moveQuestionUp = (index: number) => {
    if (index === 0) return;
    setQuestions((prev) => {
      const newQuestions = [...prev];
      const temp = newQuestions[index - 1];
      newQuestions[index - 1] = newQuestions[index];
      newQuestions[index] = temp;
      return newQuestions;
    });
  };

  const moveQuestionDown = (index: number) => {
    if (index === questions.length - 1) return;
    setQuestions((prev) => {
      const newQuestions = [...prev];
      const temp = newQuestions[index + 1];
      newQuestions[index + 1] = newQuestions[index];
      newQuestions[index] = temp;
      return newQuestions;
    });
  };

  const deleteQuestion = (id: number) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const copyQuestion = (q: Question) => {
    setQuestions((prev) => {
      const newQuestion = {
        ...q,
        id: Date.now(), // Generate a new ID
        options: JSON.parse(JSON.stringify(q.options)), // Deep copy options just in case
      };
      // Insert right after the copied question
      const index = prev.findIndex((item) => item.id === q.id);
      if (index === -1) return [...prev, newQuestion];

      const newQuestions = [...prev];
      newQuestions.splice(index + 1, 0, newQuestion);
      return newQuestions;
    });
  };

  const handleSaveQuestion = (updatedQuestion: Question) => {
    setQuestions((prev) => {
      // If we are editing an existing question
      if (editingQuestionId !== null) {
        return prev.map((q) =>
          q.id === editingQuestionId ? updatedQuestion : q,
        );
      }
      // If we are adding a new question
      return [...prev, updatedQuestion];
    });
  };

  const editingQuestion = questions.find((q) => q.id === editingQuestionId) || null;

  return (
    <div className="min-h-screen bg-[#f2f2f2] font-sans pb-12">
      <div className="flex justify-end pr-4"></div>

      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-6 items-start px-[24px] py-[20px] mx-[0px] mt-[15px] mb-[0px]">
        {/* Left Sidebar */}
        <div className="w-full md:w-[280px] flex-shrink-0 flex flex-col gap-4 p-[0px] mx-[0px] my-[70px]">
          {/* Info Card */}
          <div className="bg-white p-4 shadow-sm border border-gray-200 rounded-[20px]">
            <div className="flex justify-center w-full mb-2">
              <div
                className="relative grid max-w-full"
                style={{ gridTemplateAreas: "'inner'" }}
              >
                <div
                  className="invisible whitespace-pre-wrap text-xl font-bold leading-tight py-1.5 px-2 border-2 border-transparent text-center break-words"
                  style={{ gridArea: "inner" }}
                >
                  {title ? title + " " : "Enter test title "}
                </div>
                <textarea
                  ref={titleInputRef as any}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter test title"
                  rows={1}
                  className="w-full h-full text-xl font-bold text-gray-800 leading-tight text-center bg-white border-2 border-transparent hover:border-gray-200 focus:border-[#00c0a3] focus:outline-none transition-colors rounded-lg py-1.5 px-2 resize-none overflow-hidden block m-0"
                  style={{ gridArea: "inner" }}
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-1 text-gray-600 mb-4 text-sm px-[100px] py-[0px]">
              <Lock className="w-4 h-4" />
              <span className="text-center">
                {privacy === "public" ? "Public" : "Private"}
              </span>
            </div>

            <button
              onClick={handleSaveInfo}
              disabled={saving}
              className="w-full bg-[#00c0a3] hover:bg-[#00a88f] disabled:opacity-50 active:border-b-0 active:translate-y-[4px] text-white font-bold py-3 px-4 rounded-lg border-b-[4px] border-[#009b84] flex items-center justify-center gap-2 mb-3 transition-all"
            >
              <Save className="w-5 h-5" />
              <span className="text-lg">{saving ? "Saving..." : "Save"}</span>
            </button>

            <div className="grid grid-cols-2 gap-2 relative">
              <button
                onClick={focusEditInfo}
                className="bg-[#e2e2e2] hover:bg-[#d4d4d4] active:border-b-0 active:translate-y-[4px] text-gray-700 font-bold py-2 px-2 rounded-lg border-b-[4px] border-[#c0c0c0] flex items-center justify-center gap-1 text-xs transition-all"
              >
                <Edit3 className="w-3 h-3" />
                Edit Info
              </button>
              <button
                onClick={() => {
                  setTempTimeLimit(globalTimeLimit);
                  setIsTimeLimitModalOpen(true);
                }}
                className="bg-[#e2e2e2] hover:bg-[#d4d4d4] active:border-b-0 active:translate-y-[4px] text-gray-700 font-bold py-2 px-2 rounded-lg border-b-[4px] border-[#c0c0c0] flex items-center justify-center gap-1 text-xs transition-all"
              >
                <Clock className="w-3 h-3" />
                Time Limit
              </button>
            </div>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openEditModal()}
              className="bg-[#9059ff] hover:bg-[#7e47ec] active:border-b-0 active:translate-y-[4px] text-white font-bold py-3 px-2 rounded-lg border-b-[4px] border-[#7544d6] flex items-center gap-2 text-sm transition-all leading-tight"
            >
              <Plus className="w-5 h-5 bg-white/20 rounded-sm p-0.5 shrink-0" />
              <span className="text-left">Add Question</span>
            </button>

            <button
              onClick={() => setIsExcelModalOpen(true)}
              className="bg-[#0a8a3c] hover:bg-[#087834] active:border-b-0 active:translate-y-[4px] text-white font-bold py-3 px-2 rounded-lg border-b-[4px] border-[#06632b] flex items-center gap-2 text-sm transition-all leading-tight"
            >
              <Grid className="w-5 h-5 bg-white/20 rounded-sm p-0.5 shrink-0" />
              <span className="text-left">Excel Import</span>
            </button>
          </div>

          {/* Show Answers Toggle */}
          <button
            onClick={toggleAllAnswers}
            className="bg-[#00c0a3] hover:bg-[#00a88f] active:border-b-0 active:translate-y-[2px] text-white font-bold py-2 px-5 rounded-lg border-b-[2px] border-[#009b84] flex items-center justify-center gap-2 w-fit mx-auto transition-all text-sm"
          >
            <div className="bg-white/20 rounded-full p-1">
              {expandedQuestions.size === questions.length && questions.length > 0 ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <HelpCircle className="w-4 h-4" />
              )}
            </div>
            <span className="text-left leading-tight">
              {expandedQuestions.size === questions.length && questions.length > 0
                ? "Hide Answers"
                : "Show Answers"}
            </span>
          </button>
        </div>

        {/* Right Main Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Header Bar */}
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-white px-4 py-2 rounded-lg font-bold text-gray-700 shadow-sm border border-gray-200">
              {questions.length} Questions
            </div>
            <button
              onClick={() => openEditModal()}
              className="bg-[#9059ff] hover:bg-[#7e47ec] active:border-b-0 active:translate-y-[4px] text-white font-bold py-2 px-4 rounded-lg border-b-[4px] border-[#7544d6] flex items-center gap-2 transition-all shadow-sm"
            >
              <Plus className="w-5 h-5 bg-white/20 rounded-sm p-0.5" />
              Add Question
            </button>
          </div>

          {/* Question List */}
          <div className="flex flex-col gap-4">
            {questions.map((q, index) => (
              <div
                key={q.id}
                onClick={() => toggleQuestion(q.id)}
                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 flex flex-col gap-4 cursor-pointer transition-all"
              >
                <div className="flex gap-4 relative w-full">
                  {/* Left Controls */}
                  <div
                    className="flex gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Arrows */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveQuestionUp(index);
                        }}
                        className="bg-[#e2e2e2] hover:bg-[#d4d4d4] active:border-b-0 active:translate-y-[4px] text-gray-500 p-1.5 rounded-lg border-b-[4px] border-[#c0c0c0] transition-all"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveQuestionDown(index);
                        }}
                        className="bg-[#e2e2e2] hover:bg-[#d4d4d4] active:border-b-0 active:translate-y-[4px] text-gray-500 p-1.5 rounded-lg border-b-[4px] border-[#c0c0c0] transition-all"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Edit/Trash/Copy */}
                    <div className="flex flex-col gap-2 w-[70px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(q.id);
                        }}
                        className="w-full bg-[#00c0a3] hover:bg-[#00a88f] active:border-b-0 active:translate-y-[4px] text-white font-bold py-1.5 px-2 rounded-lg border-b-[4px] border-[#009b84] flex items-center justify-center gap-1 text-sm transition-all"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteQuestion(q.id);
                          }}
                          className="flex-1 bg-[#e2e2e2] hover:bg-[#d4d4d4] active:border-b-0 active:translate-y-[4px] text-gray-600 p-1.5 rounded-lg border-b-[4px] border-[#c0c0c0] flex justify-center transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyQuestion(q);
                          }}
                          className="flex-1 bg-[#e2e2e2] hover:bg-[#d4d4d4] active:border-b-0 active:translate-y-[4px] text-gray-600 p-1.5 rounded-lg border-b-[4px] border-[#c0c0c0] flex justify-center transition-all"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="flex-1 pl-2 pb-6">
                    <h3 className="font-bold text-gray-800 text-lg mb-1">
                      Question {index + 1}
                    </h3>
                    <p className="text-gray-600 text-[15px] pr-16">{q.text}</p>

                    {/* Time Limit Badge */}
                    <div className="absolute bottom-0 right-0 bg-gray-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                      <Shuffle className="w-3 h-3" />
                      {q.timeLimit || globalTimeLimit} {(q.timeLimit || globalTimeLimit) >= 60 ? ((q.timeLimit || globalTimeLimit) === 60 ? "min" : "mins") : "sec"}
                    </div>
                  </div>
                </div>

                {/* Options (visible when expanded) */}
                {expandedQuestions.has(q.id) && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {q.options?.map((opt) => (
                      <div
                        key={opt.id}
                        className={`${opt.colorClass} rounded-lg p-4 text-white font-bold flex items-center shadow-sm min-h-[60px] cursor-default`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-10 flex justify-center shrink-0">
                          {opt.isCorrect ? (
                            <Check className="w-7 h-7" strokeWidth={3} />
                          ) : (
                            <X className="w-7 h-7" strokeWidth={3} />
                          )}
                        </div>
                        <div className="flex-1 text-center pr-10 text-lg leading-tight">
                          {opt.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Question Modal */}
      <QuestionModal
        isOpen={isModalOpen}
        onClose={closeEditModal}
        onSave={handleSaveQuestion}
        initialQuestion={editingQuestion}
        globalTimeLimit={globalTimeLimit}
      />

      {/* Time Limit Modal */}
      {isTimeLimitModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] p-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-[22px] font-bold text-gray-700 mb-6 text-center leading-snug">
              Set the time limit for all
              <br />
              questions (in seconds):
            </h2>

            <div className="relative mb-8">
              <input
                type="number"
                value={tempTimeLimit}
                onChange={(e) => setTempTimeLimit(Number(e.target.value))}
                className="w-[140px] py-2 px-4 text-center text-xl font-bold border-2 border-[#00cdd6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00cdd6]/50 text-gray-800 bg-white"
              />
              <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-800" strokeWidth={2.5} />
            </div>

            <div className="flex w-full justify-between gap-4">
              <button
                onClick={() => setIsTimeLimitModalOpen(false)}
                className="flex-1 bg-[#00cdd6] hover:bg-[#00b5bd] active:translate-y-[4px] active:border-b-0 text-white font-bold py-3 rounded-lg border-b-[4px] border-[#00a6ad] transition-all text-lg"
              >
                Back
              </button>
              <button
                onClick={() => {
                  setGlobalTimeLimit(tempTimeLimit);
                  setQuestions((prev) =>
                    prev.map((q) => ({
                      ...q,
                      timeLimit: tempTimeLimit,
                    }))
                  );
                  setIsTimeLimitModalOpen(false);
                }}
                className="flex-1 bg-[#00cdd6] hover:bg-[#00b5bd] active:translate-y-[4px] active:border-b-0 text-white font-bold py-3 rounded-lg border-b-[4px] border-[#00a6ad] transition-all text-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[500px] flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="text-[22px] font-bold text-gray-800 tracking-tight">
                Import From Spreadsheet
              </h2>
              <button
                onClick={() => {
                  setIsExcelModalOpen(false);
                  setExcelFile(null);
                  setExcelError("");
                  setExcelSuccess(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-7 h-7" strokeWidth={3} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 space-y-4">
              {/* Steps */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center space-y-2">
                <p className="text-gray-600 text-sm">
                  1.{" "}
                  <a
                    href="/excel_template.xlsx"
                    download="quiz-template.xlsx"
                    className="text-[#00cdd6] font-bold hover:underline"
                  >
                    Download
                  </a>{" "}
                  our template.
                </p>
                <p className="text-gray-600 text-sm">2. Fill it out and save as Excel</p>
                <p className="text-gray-600 text-sm">3. Upload below</p>
              </div>

              {/* Column guide */}
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[11px] font-bold text-slate-500 mb-2">Template columns:</p>
                <div className="grid grid-cols-4 gap-1">
                  {["Question Text", "Answer 1–4", "Time Limit (sec)", "Correct Answer #"].map((col, i) => (
                    <span key={i} className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded text-center">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Success */}
              {excelSuccess !== null && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-green-700 font-bold text-sm">
                    ✅ {excelSuccess} question{excelSuccess !== 1 ? "s" : ""} added!
                  </p>
                </div>
              )}

              {/* Error */}
              {excelError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm font-semibold">{excelError}</p>
                </div>
              )}

              {/* Upload button */}
              <label className={`block w-full text-white font-bold text-sm py-3.5 rounded-xl text-center cursor-pointer transition-all
                ${excelImporting || excelSuccess !== null
                  ? "bg-teal-300 cursor-not-allowed"
                  : "bg-[#00cdd6] hover:bg-[#00b5bd]"}`}>
                {excelImporting
                  ? "⏳ Reading file..."
                  : excelSuccess !== null
                    ? "✅ Imported!"
                    : excelFile
                      ? `📄 ${excelFile.name}`
                      : "📁 Upload Excel / CSV"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={excelImporting || excelSuccess !== null}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setExcelFile(file);
                    setExcelError("");
                    setExcelSuccess(null);
                    setExcelImporting(true);

                    const { questions: imported, error: parseError } = await parseImportFile(file);

                    if (parseError) {
                      setExcelError(parseError);
                      setExcelImporting(false);
                      return;
                    }

                    setQuestions(prev => [...prev, ...imported]);
                    setExcelSuccess(imported.length);
                    setExcelImporting(false);
                    toast.success(`${imported.length} question${imported.length !== 1 ? "s" : ""} imported!`);

                    setTimeout(() => {
                      setIsExcelModalOpen(false);
                      setExcelFile(null);
                      setExcelSuccess(null);
                    }, 1500);

                    e.target.value = "";
                  }}
                />
              </label>
              <p className="text-xs text-slate-400 text-center">
                Accepts .xlsx, .xls, or .csv — questions will be appended to your quiz
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
