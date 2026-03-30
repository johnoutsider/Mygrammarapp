"use client";

import { useState } from "react";
import {
  HelpCircle,
  Edit3,
  FileUp,
  Image as ImageIcon,
  Link2,
  Upload,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type CreationMethod = "manual" | "quizlet" | "csv" | "khanmigo";

export function QuestionSetCreator() {
  const [selectedMethod, setSelectedMethod] =
    useState<CreationMethod>("manual");
  const [isPublic, setIsPublic] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Creation Method */}
            <div>
              <h2 className="text-lg text-gray-800 mb-1">
                Choose a Creation Method
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                This decides how you will start adding questions
                to your set
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedMethod("manual")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedMethod === "manual"
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-gray-300 bg-white hover:border-gray-400"
                  }`}
                >
                  <Edit3 className="w-5 h-5" />
                  <span className="text-sm">
                    Manual (Default)
                  </span>
                </button>
                <button
                  onClick={() => setSelectedMethod("quizlet")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedMethod === "quizlet"
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-gray-300 bg-white hover:border-gray-400"
                  }`}
                >
                  
                  <span className="text-sm">Upload Excel</span>
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-lg text-gray-800 mb-2">
                Title (required)
              </label>
              <Input
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Add a descriptive title"
                className="w-full"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-lg text-gray-800 mb-2">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder="Tell users about your question set"
                className="w-full min-h-[160px] resize-none"
              />
            </div>

            {/* Privacy Setting */}
            <div>
              <h2 className="text-lg text-gray-800 mb-1">
                Privacy Setting
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                This decides who can find and play your question
                set
              </p>
              <div className="flex items-center gap-3">
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  className="w-[52px] h-[28px] !rounded-xl data-[state=checked]:!bg-[#13C2C2] data-[state=unchecked]:!bg-gray-200 [&_[data-slot=switch-thumb]]:!w-[22px] [&_[data-slot=switch-thumb]]:!h-[22px] [&_[data-slot=switch-thumb]]:!rounded-[8px] [&_[data-slot=switch-thumb]]:!bg-white [&_[data-slot=switch-thumb]]:shadow-sm [&_[data-slot=switch-thumb]]:data-[state=checked]:!translate-x-[26px] [&_[data-slot=switch-thumb]]:data-[state=unchecked]:!translate-x-[2px]"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Public</span>{" "}
                  (Playable by everyone)
                </span>
              </div>
            </div>

            {/* Create Set Button */}
            <div className="pt-4">
              <Button
                className="px-8 py-6 bg-gray-300 text-gray-400 rounded-lg text-base cursor-not-allowed"
                disabled
              >Save </Button>
            </div>
          </div>

          {/* Right Column - Cover Image */}
          <div className="p-[70px] m-[0px]">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center min-h-[300px] bg-[#817b7b21]">
              <h3 className="text-xl text-gray-800 mb-6">
                Cover Image
              </h3>
              <p className="text-gray-600 mb-6">
                Drag and Drop or
              </p>
              <div className="flex flex-col gap-3 mb-6">
                <Button
                  variant="outline"
                  className="px-6 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg flex items-center gap-2 hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4" />
                  Upload a File
                </Button>
              </div>
              <Button
                variant="outline"
                className="px-6 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg flex items-center gap-2 hover:bg-gray-50"
              >
                <ImageIcon className="w-4 h-4" />
                Image Gallery
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
