'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Clock, X, Copy, Trash2, ChevronDown, Menu } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { getUserProfile, UserProfile } from '@/lib/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { submitQuizForReview } from '@/lib/quizService';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

type QuestionType = 'quiz' | 'true_or_false';

interface Answer {
    id: number;
    text: string;
    isCorrect: boolean;
    explanation: string;
}

interface FullQuestion {
    id: number;
    type: QuestionType;
    text: string;
    timeLimit: number;
    imageUrl?: string;
    answers: Answer[];
    topicId?: string;
    topicName?: string;
    subtopic?: string;
}

interface Topic {
    id: string;
    name: string;
    subtopics?: string[];
}

const QUIZ_STYLES = [
    { bg: 'bg-red-500', shape: '▲' },
    { bg: 'bg-blue-600', shape: '◆' },
    { bg: 'bg-yellow-500', shape: '●' },
    { bg: 'bg-green-600', shape: '■' },
];

const TF_STYLES = [
    { bg: 'bg-blue-500', shape: '✓', label: 'True' },
    { bg: 'bg-red-500', shape: '✗', label: 'False' },
];

const makeQuizAnswers = (): Answer[] => [
    { id: 1, text: '', isCorrect: false, explanation: '' },
    { id: 2, text: '', isCorrect: false, explanation: '' },
    { id: 3, text: '', isCorrect: false, explanation: '' },
    { id: 4, text: '', isCorrect: false, explanation: '' },
];

const makeTFAnswers = (): Answer[] => [
    { id: 1, text: 'True', isCorrect: false, explanation: '' },
    { id: 2, text: 'False', isCorrect: false, explanation: '' },
];

const defaultQuestion = (id: number, type: QuestionType = 'quiz'): FullQuestion => ({
    id, type, text: '', timeLimit: 20, imageUrl: '',
    answers: type === 'quiz' ? makeQuizAnswers() : makeTFAnswers(),
});

// Auto-expand textarea helper
const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
};

export default function QuizCreatorPage() {
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<FullQuestion[]>([defaultQuestion(1)]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [saveLabel, setSaveLabel] = useState('Saved to: Your drafts');
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [newSubtopic, setNewSubtopic] = useState('');
    const [addingSubtopic, setAddingSubtopic] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [propsOpen, setPropsOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const questionTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) setUserProfile(await getUserProfile(u.uid));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'topics'), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setTopics(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Topic[]);
        });
        return () => unsub();
    }, []);

    // Reset question textarea height on question switch
    useEffect(() => {
        const el = questionTextareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }, [activeIdx, questions[activeIdx]?.text]);

    const current = questions[activeIdx];
    const selectedTopic = topics.find(t => t.id === current.topicId);

    const updateQuestion = (field: keyof FullQuestion, value: any) =>
        setQuestions(prev => prev.map((q, i) => i === activeIdx ? { ...q, [field]: value } : q));

    const updateAnswer = (answerId: number, text: string) =>
        setQuestions(prev => prev.map((q, i) =>
            i === activeIdx
                ? { ...q, answers: q.answers.map(a => a.id === answerId ? { ...a, text } : a) }
                : q
        ));

    const updateExplanation = (answerId: number, explanation: string) =>
        setQuestions(prev => prev.map((q, i) =>
            i === activeIdx
                ? { ...q, answers: q.answers.map(a => a.id === answerId ? { ...a, explanation } : a) }
                : q
        ));

    const changeQuestionType = (newType: QuestionType) => {
        setQuestions(prev => prev.map((q, i) =>
            i === activeIdx
                ? { ...q, type: newType, answers: newType === 'quiz' ? makeQuizAnswers() : makeTFAnswers() }
                : q
        ));
    };

    const addQuestion = (type: QuestionType) => {
        setQuestions(prev => [...prev, defaultQuestion(prev.length + 1, type)]);
        setActiveIdx(questions.length);
        setShowTypePicker(false);
        setSidebarOpen(false);
    };

    const deleteQuestion = () => {
        if (questions.length === 1) return;
        setQuestions(prev => prev.filter((_, i) => i !== activeIdx));
        setActiveIdx(Math.max(0, activeIdx - 1));
    };

    const duplicateQuestion = () => {
        setQuestions(prev => [...prev, { ...current, id: prev.length + 1 }]);
    };

    const handleAddSubtopic = async () => {
        if (!newSubtopic.trim() || !current.topicId) return;
        setAddingSubtopic(true);
        try {
            await updateDoc(doc(db, 'topics', current.topicId), {
                subtopics: arrayUnion(newSubtopic.trim()),
            });
            setNewSubtopic('');
        } catch (e) { console.error(e); }
        setAddingSubtopic(false);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return alert('Please select an image file.');
        if (file.size > 5 * 1024 * 1024) return alert('Image must be under 5MB.');
        const storage = getStorage();
        const storageRef = ref(storage, `quiz-images/${Date.now()}_${file.name}`);
        const task = uploadBytesResumable(storageRef, file);
        setUploading(true);
        task.on('state_changed',
            s => setUploadProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
            err => { console.error(err); setUploading(false); },
            async () => {
                updateQuestion('imageUrl', await getDownloadURL(task.snapshot.ref));
                setUploading(false); setUploadProgress(0);
            }
        );
    };

    const handleSave = async () => {
        if (!title.trim()) return alert('Please add a quiz title!');
        if (!userProfile) return alert('You must be signed in.');
        try {
            setSaveLabel('Saving...');
            await submitQuizForReview({ title, questions }, userProfile.uid, userProfile.classId);
            setSaveLabel('✓ Submitted for peer review!');
        } catch (err) {
            console.error(err);
            setSaveLabel('Error saving — check console');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

            {/* ── Question Type Picker Modal ── */}
            {showTypePicker && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-gray-800">Choose question type</h2>
                            <button onClick={() => setShowTypePicker(false)}>
                                <X size={18} className="text-gray-400 hover:text-gray-600" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Test knowledge</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => addQuestion('quiz')}
                                className="border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 rounded-xl p-4 flex flex-col items-center gap-2 transition group">
                                <div className="grid grid-cols-2 gap-0.5 w-10 h-10">
                                    <div className="bg-red-500 rounded-tl-md" />
                                    <div className="bg-blue-500 rounded-tr-md" />
                                    <div className="bg-yellow-500 rounded-bl-md" />
                                    <div className="bg-green-500 rounded-br-md" />
                                </div>
                                <span className="text-sm font-semibold text-gray-700 group-hover:text-purple-700">Quiz</span>
                                <span className="text-xs text-gray-400 text-center">4 choices</span>
                            </button>
                            <button onClick={() => addQuestion('true_or_false')}
                                className="border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 rounded-xl p-4 flex flex-col items-center gap-2 transition group">
                                <div className="flex gap-1 w-10 h-10 items-center justify-center">
                                    <div className="bg-blue-500 rounded-l-md w-5 h-10 flex items-center justify-center text-white font-bold text-sm">✓</div>
                                    <div className="bg-red-500 rounded-r-md w-5 h-10 flex items-center justify-center text-white font-bold text-sm">✗</div>
                                </div>
                                <span className="text-sm font-semibold text-gray-700 group-hover:text-purple-700">True or False</span>
                                <span className="text-xs text-gray-400 text-center">2 choices</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mobile Sidebar Overlay ── */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* ── Top Bar ── */}
            <div className="flex items-center justify-between px-3 py-2 bg-white border-b shadow-sm z-10 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Mobile sidebar toggle */}
                    <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded hover:bg-gray-100">
                        <Menu size={18} className="text-gray-600" />
                    </button>
                    <input
                        type="text"
                        placeholder="Enter quiz title..."
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-black w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
                    />
                    <span className="text-xs text-gray-400 hidden sm:block whitespace-nowrap">✓ {saveLabel}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* Mobile properties toggle */}
                    <button onClick={() => setPropsOpen(true)} className="lg:hidden p-1.5 rounded hover:bg-gray-100 border border-gray-200">
                        <ChevronDown size={16} className="text-gray-600" />
                    </button>
                    <button onClick={handleSave} className="bg-green-500 hover:bg-green-600 text-white rounded px-3 py-1.5 text-sm font-semibold">
                        Save
                    </button>
                    <button onClick={() => window.history.back()} className="bg-white border border-gray-300 hover:bg-gray-50 text-black rounded px-3 py-1.5 text-sm font-semibold">
                        Exit
                    </button>

                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">

                {/* ── Left Sidebar ── */}
                <div className={`
          bg-gray-800 flex flex-col p-3 gap-2 overflow-y-auto z-40 transition-all duration-300
          fixed top-0 left-0 h-full w-52 pt-16
          lg:relative lg:w-40 lg:pt-3 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
                    {/* Close button on mobile */}
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden absolute top-3 right-3 text-gray-400 hover:text-white">
                        <X size={18} />
                    </button>

                    <div className="text-white text-xs font-semibold mb-1">{questions.length} Quiz</div>
                    {questions.map((q, i) => (
                        <div
                            key={q.id}
                            onClick={() => { setActiveIdx(i); setSidebarOpen(false); }}
                            className={`rounded p-2 cursor-pointer text-xs text-white transition ${i === activeIdx ? 'bg-purple-600 ring-2 ring-white' : 'bg-gray-600 hover:bg-gray-500'
                                }`}
                        >
                            <div className="text-gray-300 text-[10px] mb-0.5">
                                {q.type === 'true_or_false' ? '✓/✗ True or False' : '📊 Quiz'}
                            </div>
                            <div className="truncate">{q.text || `Question ${i + 1}`}</div>
                        </div>
                    ))}
                    <button
                        onClick={() => setShowTypePicker(true)}
                        className="mt-2 flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white rounded px-2 py-2 text-sm font-semibold w-full"
                    >
                        <Plus size={14} /> Add
                    </button>
                </div>

                {/* ── Main Canvas ── */}
                <div
                    className="flex-1 flex flex-col items-center justify-start p-3 sm:p-6 overflow-y-auto"
                    style={{ background: 'linear-gradient(135deg, #4a1d8f 0%, #6b21a8 50%, #7c3aed 100%)' }}
                >
                    {/* Type badge */}
                    <div className="w-full max-w-3xl flex justify-center mb-2">
                        <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-medium">
                            {current.type === 'true_or_false' ? '✓/✗ True or False' : '📊 Quiz'}
                        </span>
                    </div>

                    {/* Question textarea */}
                    <div className="w-full max-w-3xl bg-white rounded-xl shadow mb-4">
                        <textarea
                            ref={questionTextareaRef}
                            placeholder="Start typing your question"
                            value={current.text}
                            onChange={e => updateQuestion('text', e.target.value)}
                            rows={1}
                            style={{ resize: 'none', overflow: 'hidden' }}
                            onInput={e => autoResize(e.currentTarget)}
                            className="w-full text-center text-lg sm:text-xl bg-white rounded-xl border-none outline-none px-4 sm:px-6 py-4 text-black placeholder-gray-400 focus:ring-0 leading-relaxed"
                        />
                    </div>

                    {/* Media Upload */}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <div className="w-full max-w-3xl mb-4 sm:mb-6">
                        {current.imageUrl ? (
                            <div className="relative rounded-xl overflow-hidden shadow-lg">
                                <img src={current.imageUrl} alt="Question media" className="w-full max-h-56 sm:max-h-64 object-cover" />
                                <button
                                    onClick={() => updateQuestion('imageUrl', '')}
                                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : uploading ? (
                            <div className="rounded-xl border-2 border-dashed border-white/40 bg-white/20 flex flex-col items-center justify-center py-8 min-h-[100px]">
                                <p className="text-white text-sm font-medium mb-3">Uploading... {uploadProgress}%</p>
                                <div className="w-40 bg-white/30 rounded-full h-2">
                                    <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${uploadProgress}%` }} />
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="rounded-xl border-2 border-dashed border-white/40 bg-white/20 flex flex-col items-center justify-center py-7 cursor-pointer hover:bg-white/30 transition min-h-[100px]"
                            >
                                <div className="flex gap-2 text-2xl sm:text-3xl mb-2">🎭 🖼️ 🎬</div>
                                <p className="text-white font-medium text-sm">Click to upload an image</p>
                                <p className="text-white/60 text-xs mt-1">JPG, PNG, GIF — max 5MB</p>
                            </div>
                        )}
                    </div>

                    {/* ── Quiz: answer boxes ── */}
                    {current.type === 'quiz' && (
                        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {current.answers.map((answer, idx) => (
                                <div key={answer.id} className={`${QUIZ_STYLES[idx].bg} rounded-xl flex flex-col shadow-lg overflow-hidden`}>
                                    <div className="flex items-start gap-3 px-4 sm:px-5 py-3">
                                        <span className="text-white text-lg sm:text-xl font-bold w-7 text-center select-none mt-0.5">
                                            {QUIZ_STYLES[idx].shape}
                                        </span>
                                        <textarea
                                            placeholder={idx < 2 ? `Add answer ${idx + 1}` : `Add answer ${idx + 1} (optional)`}
                                            value={answer.text}
                                            onChange={e => updateAnswer(answer.id, e.target.value)}
                                            rows={1}
                                            style={{ resize: 'none', overflow: 'hidden' }}
                                            onInput={e => autoResize(e.currentTarget)}
                                            className="flex-1 bg-transparent text-white placeholder-white/70 border-none outline-none text-sm font-medium leading-relaxed"
                                        />
                                    </div>
                                    <div className="bg-black/20 px-4 sm:px-5 py-2 flex items-start gap-2">
                                        <span className="text-white/60 text-xs mt-1">💬</span>
                                        <textarea
                                            placeholder="Explain why this answer is correct or incorrect..."
                                            value={answer.explanation}
                                            onChange={e => updateExplanation(answer.id, e.target.value)}
                                            rows={1}
                                            style={{ resize: 'none', overflow: 'hidden' }}
                                            onInput={e => autoResize(e.currentTarget)}
                                            className="flex-1 bg-transparent text-white/90 placeholder-white/40 border-none outline-none text-xs leading-relaxed"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── True or False ── */}
                    {current.type === 'true_or_false' && (
                        <div className="w-full max-w-3xl grid grid-cols-2 gap-3 sm:gap-4">
                            {current.answers.map((answer, idx) => (
                                <div key={answer.id} className={`${TF_STYLES[idx].bg} rounded-xl flex flex-col shadow-lg overflow-hidden`}>
                                    <div className="flex flex-col items-center justify-center gap-1 py-5 sm:py-6">
                                        <span className="text-white text-3xl sm:text-4xl font-bold">{TF_STYLES[idx].shape}</span>
                                        <span className="text-white text-lg sm:text-xl font-bold">{TF_STYLES[idx].label}</span>
                                    </div>
                                    <div className="bg-black/20 px-3 sm:px-4 py-2 flex items-start gap-2">
                                        <span className="text-white/60 text-xs mt-1">💬</span>
                                        <textarea
                                            placeholder={`Why is ${TF_STYLES[idx].label} correct or incorrect?`}
                                            value={answer.explanation}
                                            onChange={e => updateExplanation(answer.id, e.target.value)}
                                            rows={1}
                                            style={{ resize: 'none', overflow: 'hidden' }}
                                            onInput={e => autoResize(e.currentTarget)}
                                            className="flex-1 bg-transparent text-white/90 placeholder-white/40 border-none outline-none text-xs leading-relaxed"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Bottom padding for mobile */}
                    <div className="h-8" />
                </div>

                {/* ── Right Sidebar (desktop) / Bottom Sheet (mobile) ── */}
                {/* Mobile overlay */}
                {propsOpen && (
                    <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setPropsOpen(false)} />
                )}

                <div className={`
          bg-white border-t lg:border-t-0 lg:border-l shadow-sm p-4 flex flex-col gap-4 overflow-y-auto z-40
          fixed bottom-0 left-0 right-0 max-h-[80vh] rounded-t-2xl
          lg:relative lg:w-64 lg:max-h-full lg:rounded-none lg:translate-y-0
          transition-transform duration-300
          ${propsOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        `}>
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-gray-800">Question properties</span>
                        <button onClick={() => setPropsOpen(false)} className="lg:hidden">
                            <X size={15} className="text-gray-400" />
                        </button>
                    </div>

                    {/* Topic */}
                    <div>
                        <label className="text-xs text-gray-600 font-semibold mb-1 block">📚 Topic</label>
                        <select
                            value={current.topicId || ''}
                            onChange={e => {
                                const topic = topics.find(t => t.id === e.target.value);
                                updateQuestion('topicId', e.target.value);
                                updateQuestion('topicName', topic?.name || '');
                                updateQuestion('subtopic', '');
                            }}
                            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            <option value="">Select a topic...</option>
                            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    {/* Subtopic */}
                    {current.topicId && (
                        <div>
                            <label className="text-xs text-gray-600 font-semibold mb-1 block">🔖 Subtopic</label>
                            {selectedTopic?.subtopics && selectedTopic.subtopics.length > 0 ? (
                                <select
                                    value={current.subtopic || ''}
                                    onChange={e => updateQuestion('subtopic', e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400"
                                >
                                    <option value="">Select subtopic...</option>
                                    {selectedTopic.subtopics.map((s, i) => <option key={i} value={s}>{s}</option>)}
                                </select>
                            ) : (
                                <p className="text-xs text-gray-400 italic mb-1">No subtopics yet.</p>
                            )}
                            <div className="flex gap-1 mt-2">
                                <input
                                    type="text"
                                    placeholder="Add subtopic..."
                                    value={newSubtopic}
                                    onChange={e => setNewSubtopic(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddSubtopic()}
                                    className="flex-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-black focus:outline-none focus:ring-1 focus:ring-purple-400"
                                />
                                <button
                                    onClick={handleAddSubtopic}
                                    disabled={!newSubtopic.trim() || addingSubtopic}
                                    className="bg-purple-600 hover:bg-purple-700 text-white rounded px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
                                >
                                    {addingSubtopic ? '...' : '+'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Question type */}
                    <div>
                        <label className="text-xs text-gray-600 font-semibold flex items-center gap-1 mb-1">🔄 Question type</label>
                        <select
                            value={current.type}
                            onChange={e => changeQuestionType(e.target.value as QuestionType)}
                            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            <option value="quiz">📊 Quiz (4 choices)</option>
                            <option value="true_or_false">✓/✗ True or False</option>
                        </select>
                    </div>

                    {/* Time limit */}
                    <div>
                        <label className="text-xs text-gray-600 font-semibold flex items-center gap-1 mb-1">
                            <Clock size={11} /> Time limit
                        </label>
                        <select
                            value={current.timeLimit}
                            onChange={e => updateQuestion('timeLimit', Number(e.target.value))}
                            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            {[5, 10, 20, 30, 60, 90, 120, 180, 240].map(t => (
                                <option key={t} value={t}>{t} seconds</option>
                            ))}
                        </select>
                        <button className="text-xs text-purple-600 mt-1 hover:underline">Apply to all questions</button>
                    </div>

                    {/* Delete / Duplicate */}
                    <div className="flex gap-2 mt-auto pt-4 border-t">
                        <button
                            onClick={deleteQuestion}
                            disabled={questions.length === 1}
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-black hover:bg-red-50 hover:border-red-300 hover:text-red-600 flex items-center justify-center gap-1 disabled:opacity-40"
                        >
                            <Trash2 size={13} /> Delete
                        </button>
                        <button
                            onClick={duplicateQuestion}
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-black hover:bg-gray-50 flex items-center justify-center gap-1"
                        >
                            <Copy size={13} /> Duplicate
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
