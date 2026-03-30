"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Shuffle,
  Grid,
  ChevronDown,
  CheckSquare,
  X,
  Save,
  Image as ImageIcon,
  Mic,
  Keyboard,
  Check,
} from "lucide-react";
import { Question, QuestionOption } from "./types";

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (question: Question) => void;
  initialQuestion: Question | null;
  globalTimeLimit: number;
}

const getShadowClass = (colorClass: string) => {
  switch (colorClass) {
    case 'bg-[#f89b29]': return 'shadow-[0_6px_0_#d9821a]';
    case 'bg-[#3b82f6]': return 'shadow-[0_6px_0_#2563eb]';
    case 'bg-[#00c0a3]': return 'shadow-[0_6px_0_#009b84]';
    case 'bg-[#ef4444]': return 'shadow-[0_6px_0_#dc2626]';
    case 'bg-[#8fb6ff]': return 'shadow-[0_6px_0_#6b9dff]';
    case 'bg-[#76e6b5]': return 'shadow-[0_6px_0_#50d89e]';
    case 'bg-[#ff8f8f]': return 'shadow-[0_6px_0_#ff6b6b]';
    default: return 'shadow-[0_6px_0_rgba(0,0,0,0.15)]';
  }
};

export function QuestionModal({ isOpen, onClose, onSave, initialQuestion, globalTimeLimit }: QuestionModalProps) {
  const [draftText, setDraftText] = useState("");
  const [draftOptions, setDraftOptions] = useState<QuestionOption[]>([]);
  const [localTimeLimit, setLocalTimeLimit] = useState(globalTimeLimit);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);

  const timeOptions = [5, 10, 20, 30, 45, 60, 90, 120, 240];

  useEffect(() => {
    if (isOpen) {
      if (initialQuestion) {
        setDraftText(initialQuestion.text);
        setDraftOptions(JSON.parse(JSON.stringify(initialQuestion.options)));
        setLocalTimeLimit(initialQuestion.timeLimit || globalTimeLimit);
      } else {
        setDraftText("");
        setLocalTimeLimit(globalTimeLimit);
        setDraftOptions([
          { id: '1', text: "", isCorrect: true, colorClass: "bg-[#f89b29]" },
          { id: '2', text: "", isCorrect: false, colorClass: "bg-[#3b82f6]" },
          { id: '3', text: "", isCorrect: false, colorClass: "bg-[#00c0a3]" },
          { id: '4', text: "", isCorrect: false, colorClass: "bg-[#ef4444]" },
        ]);
      }
    }
  }, [isOpen, initialQuestion, globalTimeLimit]);

  if (!isOpen) return null;

  const toggleCorrect = (index: number) => {
    const newOptions = [...draftOptions];
    newOptions[index].isCorrect = !newOptions[index].isCorrect;
    setDraftOptions(newOptions);
  };

  const updateOptionText = (index: number, text: string) => {
    const newOptions = [...draftOptions];
    newOptions[index].text = text;
    setDraftOptions(newOptions);
  };

  const handleSave = () => {
    onSave({
      id: initialQuestion ? initialQuestion.id : Date.now(),
      text: draftText,
      options: draftOptions,
      timeLimit: localTimeLimit,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#9059ff] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-white">
            {/* Time Limit */}
            <div className="relative">
              <button
                onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                className="flex items-center gap-2 border-2 border-white rounded-lg px-2 py-1 bg-transparent cursor-pointer hover:bg-white/10 transition-colors"
              >
                <Clock className="w-5 h-5" />
                <span className="text-sm font-bold leading-none">Time<br />Limit</span>
                <span className="border-2 border-white px-2 py-0.5 rounded text-sm font-bold ml-1">
                  {localTimeLimit} {localTimeLimit >= 60 ? (localTimeLimit === 60 ? 'min' : 'mins') : 'sec'}
                </span>
              </button>

              {/* Dropdown Menu */}
              {isTimeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsTimeDropdownOpen(false)} />
                  <div className="absolute top-[calc(100%+8px)] left-0 w-[240px] bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-[#9059ff] text-white p-3 font-bold text-sm">
                      Time limit
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {timeOptions.map((time) => (
                        <button
                          key={time}
                          onClick={() => {
                            setLocalTimeLimit(time);
                            setIsTimeDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm font-bold border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${localTimeLimit === time ? 'bg-[#f0eaff] text-[#9059ff]' : 'text-gray-700'}`}
                        >
                          {time} {time === 60 ? 'min' : time > 60 ? 'mins' : 'sec'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Type */}
            <div className="flex items-center gap-2 border-2 border-white rounded-lg px-2 py-1 bg-transparent cursor-pointer">
              <Grid className="w-5 h-5" />
              <span className="text-sm font-bold leading-none">Multiple<br />Choice</span>
              <ChevronDown className="w-4 h-4 ml-1" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-white bg-transparent border-2 border-white hover:bg-white/10 px-4 py-1.5 rounded-lg font-bold transition-colors"
            >
              <X className="w-5 h-5" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 text-[#9059ff] bg-white border-2 border-white hover:bg-gray-100 px-4 py-1.5 rounded-lg font-bold transition-colors"
            >
              <Save className="w-5 h-5" />
              Save
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 bg-white flex flex-col gap-4">
          {/* Top section: Media + Question */}
          <div className="flex gap-4">
            {/* Media Buttons */}
            <div className="flex flex-col gap-2 shrink-0">
              <button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white p-2 rounded-xl flex flex-col items-center justify-center w-[72px] h-[72px] transition-colors shadow-sm cursor-pointer border-b-[4px] border-[#2563eb] active:border-b-0 active:translate-y-[4px]">
                <ImageIcon className="w-7 h-7 mb-1" />
                <span className="text-[11px] font-bold">Image</span>
              </button>
            </div>

            {/* Question Text Input */}
            <div className="flex-1 bg-white border-2 border-[#00c0a3] rounded-xl flex items-center justify-center relative shadow-inner">
              <textarea
                className="w-full h-full p-6 text-center text-2xl text-gray-800 placeholder-gray-400 resize-none focus:outline-none bg-white"
                placeholder="Question Text"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
              ></textarea>
              <div className="absolute bottom-3 right-3 text-gray-300 hover:text-gray-500 cursor-pointer">
                <Keyboard className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Answers Grid */}
          <div className="grid grid-cols-2 gap-3 mt-1">
            {draftOptions.map((opt, index) => {
              const shadowClass = getShadowClass(opt.colorClass);

              return (
                <div
                  key={opt.id}
                  className={`${opt.colorClass} rounded-xl p-3 min-h-[140px] flex flex-col relative ${shadowClass} transition-all cursor-text group border-4 ${opt.isCorrect ? 'border-white ring-2 ring-white/50' : 'border-white/10 ring-2 ring-transparent'} focus-within:ring-white/50 focus-within:border-white`}
                >
                  <div className="absolute top-3 left-3 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCorrect(index);
                      }}
                      className={`w-7 h-7 border-[3px] border-white rounded flex items-center justify-center cursor-pointer transition-colors ${opt.isCorrect ? 'bg-transparent' : 'hover:bg-white/20'}`}
                    >
                      {opt.isCorrect && <Check className="w-5 h-5 text-white" strokeWidth={4} />}
                    </button>
                  </div>

                  <textarea
                    className="flex-1 w-full h-full bg-transparent text-center text-white placeholder-white/90 text-xl font-bold resize-none focus:outline-none flex items-center justify-center mt-6"
                    placeholder={`Answer ${index + 1}`}
                    value={opt.text}
                    onChange={(e) => updateOptionText(index, e.target.value)}
                  ></textarea>

                  <div className="absolute bottom-3 left-3 flex gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="border border-white/50 p-1 rounded cursor-pointer hover:bg-white/20"><ImageIcon className="w-4 h-4 text-white" /></div>
                    <div className="border border-white/50 p-1 rounded cursor-pointer hover:bg-white/20 flex items-center justify-center w-[26px]"><span className="text-white font-bold text-xs leading-none">x¹</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
