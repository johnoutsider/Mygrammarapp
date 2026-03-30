'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Clock, X, Copy, Trash2, Menu, Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { getUserProfile, UserProfile } from '@/lib/auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection, onSnapshot, query, orderBy, where,
    doc, updateDoc, arrayUnion, getDoc, serverTimestamp
} from 'firebase/firestore';
import { submitQuizForReview } from '@/lib/quizService';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useRouter, useSearchParams } from 'next/navigation';

type QuestionType = 'quiz' | 'true_or_false';
type QuizStatus = 'pending' | 'peer_approved' | 'teacher_approved' | 'rejected';

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

const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
};

const STATUS_CONFIG: Record<QuizStatus, { label: string; color: string; icon: string }> = {
    pending: { label: 'Awaiting Review', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: '⏳' },
    peer_approved: { label: 'Peer Approved', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: '👥' },
    teacher_approved: { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-300', icon: '✅' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-300', icon: '❌' },
};

function QuizCreatorInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<FullQuestion[]>([defaultQuestion(1)]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [saveLabel, setSaveLabel] = useState('');
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [newSubtopic, setNewSubtopic] = useState('');
    const [addingSubtopic, setAddingSubtopic] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [quizStatus, setQuizStatus] = useState<QuizStatus | null>(null);
    const [teacherNote, setTeacherNote] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showLeftDrawer, setShowLeftDrawer] = useState(false);
    const [showRightDrawer, setShowRightDrawer] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const questionTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) setUserProfile(await getUserProfile(u.uid));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!userProfile?.classId) return;
        let unsub: (() => void) | undefined;
        (async () => {
            const { getStudentTeacherId } = await import('@/lib/classService');
            const teacherId = await getStudentTeacherId(userProfile.classId);
            const q = teacherId
                ? query(collection(db, 'topics'), where('teacherId', '==', teacherId), orderBy('createdAt', 'asc'))
                : query(collection(db, 'topics'), orderBy('createdAt', 'asc'));
            unsub = onSnapshot(q, (snap) => {
                setTopics(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Topic[]);
            });
        })();
        return () => unsub?.();
    }, [userProfile?.classId]);

    useEffect(() => {
        const el = questionTextareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }, [activeIdx, questions[activeIdx]?.text]);

    useEffect(() => {
        const id = searchParams.get('edit');
        if (!id) return;
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'quizzes', id));
                if (!snap.exists()) return;
                const data = snap.data() as any;
                if (data.title) setTitle(data.title);
                if (data.questions) setQuestions(data.questions);
                if (data.status) setQuizStatus(data.status as QuizStatus);
                if (data.teacherNote) setTeacherNote(data.teacherNote);
                setEditId(id);
            } catch (e) { console.error(e); }
        };
        load();
    }, [searchParams, editId, topics]);


    const current = questions[activeIdx];
    const selectedTopic = topics.find(t => t.id === current.topicId);
    const isLocked = quizStatus === 'teacher_approved';

    const updateQuestion = (field: keyof FullQuestion, value: any) => {
        if (isLocked) return;
        setQuestions(prev => prev.map((q, i) => i === activeIdx ? { ...q, [field]: value } : q));
    };

    const updateAnswer = (answerId: number, text: string) => {
        if (isLocked) return;
        setQuestions(prev => prev.map((q, i) =>
            i === activeIdx ? { ...q, answers: q.answers.map(a => a.id === answerId ? { ...a, text } : a) } : q
        ));
    };

    const updateExplanation = (answerId: number, explanation: string) => {
        if (isLocked) return;
        setQuestions(prev => prev.map((q, i) =>
            i === activeIdx ? { ...q, answers: q.answers.map(a => a.id === answerId ? { ...a, explanation } : a) } : q
        ));
    };

    const setCorrectAnswer = (answerId: number) => {
        if (isLocked) return;
        setQuestions(prev => prev.map((q, i) =>
            i === activeIdx ? { ...q, answers: q.answers.map(a => ({ ...a, isCorrect: a.id === answerId })) } : q
        ));
    };

    const changeQuestionType = (newType: QuestionType) => {
        if (isLocked) return;
        setQuestions(prev => prev.map((q, i) =>
            i === activeIdx ? { ...q, type: newType, answers: newType === 'quiz' ? makeQuizAnswers() : makeTFAnswers() } : q
        ));
    };

    const addQuestion = (type: QuestionType) => {
        if (isLocked) return;
        setQuestions(prev => [...prev, defaultQuestion(prev.length + 1, type)]);
        setActiveIdx(questions.length);
        setShowTypePicker(false);
        setShowLeftDrawer(false);
    };

    const deleteQuestion = () => {
        if (isLocked || questions.length === 1) return;
        setQuestions(prev => prev.filter((_, i) => i !== activeIdx));
        setActiveIdx(Math.max(0, activeIdx - 1));
    };

    const duplicateQuestion = () => {
        if (isLocked) return;
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
        if (isLocked) return;
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
                setUploading(false);
                setUploadProgress(0);
            }
        );
    };

    const handleSave = async () => {
        if (isLocked) return alert('This quiz has been teacher-approved and cannot be edited.');
        if (!title.trim()) return alert('Please enter a quiz title.');
        if (!userProfile) return alert('You must be signed in.');

        const missing = questions.findIndex(q => !q.answers.some(a => a.isCorrect));
        if (missing !== -1) {
            setActiveIdx(missing);
            return alert(`Question ${missing + 1} has no correct answer selected.`);
        }

        const incomplete = questions.findIndex(
            q => q.type === 'quiz' && q.answers.filter(a => a.text.trim()).length < 2
        );
        if (incomplete !== -1) {
            setActiveIdx(incomplete);
            return alert(`Question ${incomplete + 1} needs at least 2 answer options.`);
        }

        const unanswered = questions.findIndex(q => !q.text.trim());
        if (unanswered !== -1) {
            setActiveIdx(unanswered);
            return alert(`Question ${unanswered + 1} has no question text.`);
        }

        setSaving(true);
        setSaveLabel('Saving…');

        try {
            if (editId) {
                await updateDoc(doc(db, 'quizzes', editId), {
                    title,
                    questions,
                    status: 'pending',
                    updatedAt: serverTimestamp(),
                });
                setSaveLabel('✓ Updated!');
                setTimeout(() => router.push('/my-questions'), 1200);
            } else {
                await submitQuizForReview(
                    { title, questions },
                    userProfile.uid,
                    userProfile.classId,
                    { status: 'pending', createdBy: userProfile.uid }
                );
                setSaveLabel('✓ Submitted for review!');
                setTimeout(() => router.push('/my-questions'), 1200);
            }
        } catch (err) {
            console.error(err);
            setSaveLabel('Error — check console');
            setSaving(false);
        }
    };

    // ── Sidebar question status icon ─────────────────────────────────────
    const getQuestionStatusIcon = (q: FullQuestion) => {
        if (!editId || !quizStatus) return null;
        const hasCorrect = q.answers.some(a => a.isCorrect);
        if (quizStatus === 'teacher_approved') return <CheckCircle size={10} className="text-green-400 shrink-0" />;
        if (quizStatus === 'rejected') return <XCircle size={10} className="text-red-400 shrink-0" />;
        if (quizStatus === 'peer_approved') return <CheckCircle size={10} className="text-blue-400 shrink-0" />;
        if (!hasCorrect) return <AlertCircle size={10} className="text-yellow-400 shrink-0" />;
        return null;
    };

    // ── Reusable panels ──────────────────────────────────────────────────
    const QuestionListPanel = () => (
        <div className="flex flex-col h-full">
            <div className="px-3 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-700 flex items-center justify-between">
                <span>{questions.length} Question{questions.length !== 1 ? 's' : ''}</span>
                <button onClick={() => setShowLeftDrawer(false)} className="text-gray-400 hover:text-white md:hidden">
                    <X size={16} />
                </button>
            </div>

            {/* Quiz review status banner in sidebar */}
            {editId && quizStatus && (
                <div className={`mx-2 mt-2 px-2 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${STATUS_CONFIG[quizStatus].color}`}>
                    <span>{STATUS_CONFIG[quizStatus].icon}</span>
                    <span>{STATUS_CONFIG[quizStatus].label}</span>
                </div>
            )}
            {teacherNote && (
                <div className="mx-2 mt-1 px-2 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-[10px] text-orange-700">
                    💬 <span className="font-semibold">Note:</span> {teacherNote}
                </div>
            )}

            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
                {questions.map((q, i) => {
                    const hasCorrect = q.answers.some(a => a.isCorrect);
                    return (
                        <button
                            key={q.id}
                            onClick={() => { setActiveIdx(i); setShowLeftDrawer(false); }}
                            className={`w-full text-left rounded-lg p-2 text-xs text-white transition ${i === activeIdx ? 'bg-purple-600 ring-2 ring-white/40' : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                        >
                            <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[10px] opacity-70">
                                    {q.type === 'true_or_false' ? '✓/✗' : '📊'}
                                </span>
                                <span className="opacity-70 text-[10px]">Q{i + 1}</span>
                                <span className="ml-auto">{getQuestionStatusIcon(q)}</span>
                                {!hasCorrect && !quizStatus && (
                                    <AlertCircle size={10} className="text-yellow-400" />
                                )}
                            </div>
                            <p className="truncate opacity-90">{q.text || `Question ${i + 1}`}</p>
                            {/* Per-question status label */}
                            {editId && quizStatus && (
                                <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${quizStatus === 'teacher_approved' ? 'bg-green-500/30 text-green-200' :
                                    quizStatus === 'rejected' ? 'bg-red-500/30 text-red-200' :
                                        quizStatus === 'peer_approved' ? 'bg-blue-500/30 text-blue-200' :
                                            'bg-yellow-500/20 text-yellow-200'
                                    }`}>
                                    {STATUS_CONFIG[quizStatus].icon} {STATUS_CONFIG[quizStatus].label}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {!isLocked && (
                <div className="p-2 border-t border-gray-700">
                    <button
                        onClick={() => setShowTypePicker(true)}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 text-xs font-semibold transition"
                    >
                        + Add Question
                    </button>
                </div>
            )}
        </div>
    );

    const PropertiesPanel = () => (
        <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
            <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-gray-800">Properties</span>
                <button onClick={() => setShowRightDrawer(false)} className="text-gray-400 hover:text-gray-600 md:hidden">
                    <X size={16} />
                </button>
            </div>

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
                    disabled={isLocked}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                >
                    <option value="">Select a topic...</option>
                    {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {current.topicId && (
                <div>
                    <label className="text-xs text-gray-600 font-semibold mb-1 block">🔖 Subtopic</label>
                    {selectedTopic?.subtopics && selectedTopic.subtopics.length > 0 ? (
                        <select
                            value={current.subtopic || ''}
                            onChange={e => updateQuestion('subtopic', e.target.value)}
                            disabled={isLocked}
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                        >
                            <option value="">Select subtopic...</option>
                            {selectedTopic.subtopics.map((s, i) => <option key={i} value={s}>{s}</option>)}
                        </select>
                    ) : (
                        <p className="text-xs text-gray-400 italic mb-1">No subtopics yet.</p>
                    )}
                    {!isLocked && (
                        <div className="flex gap-1 mt-2">
                            <input
                                type="text"
                                placeholder="Add subtopic..."
                                value={newSubtopic}
                                onChange={e => setNewSubtopic(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddSubtopic()}
                                className="flex-1 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-black focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                            <button
                                onClick={handleAddSubtopic}
                                disabled={!newSubtopic.trim() || addingSubtopic}
                                className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
                            >
                                {addingSubtopic ? '…' : '+'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block">🔄 Question type</label>
                <select
                    value={current.type}
                    onChange={e => changeQuestionType(e.target.value as QuestionType)}
                    disabled={isLocked}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                >
                    <option value="quiz">📊 Quiz (4 choices)</option>
                    <option value="true_or_false">✓/✗ True or False</option>
                </select>
            </div>

            <div>
                <label className="text-xs text-gray-600 font-semibold flex items-center gap-1 mb-1">
                    <Clock size={11} /> Time limit
                </label>
                <select
                    value={current.timeLimit}
                    onChange={e => updateQuestion('timeLimit', Number(e.target.value))}
                    disabled={isLocked}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                >
                    {[5, 10, 20, 30, 60, 90, 120, 180, 240].map(t => (
                        <option key={t} value={t}>{t} seconds</option>
                    ))}
                </select>
            </div>

            {!isLocked && (
                <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
                    <button
                        onClick={deleteQuestion}
                        disabled={questions.length === 1}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 flex items-center justify-center gap-1 disabled:opacity-40 transition"
                    >
                        <Trash2 size={13} /> Delete
                    </button>
                    <button
                        onClick={duplicateQuestion}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1 transition"
                    >
                        <Copy size={13} /> Copy
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50">

            {/* ── TOP BAR ─────────────────────────────────────────────────── */}
            <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0 z-20">

                {/* Mobile: open left drawer */}
                <button
                    onClick={() => { setShowLeftDrawer(true); setShowRightDrawer(false); }}
                    className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 text-gray-600 shrink-0"
                >
                    <Menu size={18} />
                </button>

                {/* Title input */}
                <input
                    type="text"
                    placeholder="Enter quiz title..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    disabled={isLocked}
                    className="flex-1 min-w-0 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 disabled:opacity-50"
                />

                {/* Status badge (when editing existing quiz) */}
                {editId && quizStatus && (
                    <span className={`hidden sm:inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border shrink-0 ${STATUS_CONFIG[quizStatus].color}`}>
                        {STATUS_CONFIG[quizStatus].icon} {STATUS_CONFIG[quizStatus].label}
                    </span>
                )}

                {/* Save label */}
                {saveLabel && (
                    <span className={`hidden sm:block text-xs font-semibold shrink-0 ${saveLabel.startsWith('✓') ? 'text-green-600' : 'text-red-500'
                        }`}>
                        {saveLabel}
                    </span>
                )}

                {/* Save button */}
                {!isLocked && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg px-5 py-2 text-sm font-bold transition shrink-0 flex items-center gap-2 shadow-sm"
                    >
                        {saving ? (
                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving…</>
                        ) : (
                            <>{editId ? '💾 Update' : '🚀 Submit'}</>
                        )}
                    </button>
                )}

                {/* Exit button */}
                <button
                    onClick={() => router.push('/my-questions')}
                    className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm font-bold transition shrink-0"
                >
                    Exit
                </button>

                {/* Mobile: open right drawer */}
                <button
                    onClick={() => { setShowRightDrawer(true); setShowLeftDrawer(false); }}
                    className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 text-gray-600 shrink-0"
                >
                    <Settings size={18} />
                </button>
            </div>

            {/* ── BODY ────────────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Question Type Picker Modal */}
                {showTypePicker && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-800">Choose question type</h3>
                                <button onClick={() => setShowTypePicker(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => addQuestion('quiz')}
                                    className="border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 rounded-xl p-4 flex flex-col items-center gap-2 transition"
                                >
                                    <span className="text-2xl">📊</span>
                                    <span className="text-sm font-semibold text-slate-700">Quiz</span>
                                    <span className="text-xs text-slate-400">4 choices</span>
                                </button>
                                <button
                                    onClick={() => addQuestion('true_or_false')}
                                    className="border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 rounded-xl p-4 flex flex-col items-center gap-2 transition"
                                >
                                    <div className="flex gap-1 text-xl font-bold">
                                        <span className="text-blue-500">✓</span>
                                        <span className="text-red-500">✗</span>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700">True or False</span>
                                    <span className="text-xs text-slate-400">2 choices</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile backdrop */}
                {(showLeftDrawer || showRightDrawer) && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 md:hidden"
                        onClick={() => { setShowLeftDrawer(false); setShowRightDrawer(false); }}
                    />
                )}

                {/* ── Left: Question List ── */}
                <div className={`
                    fixed md:relative top-0 left-0 h-full z-40
                    w-64 md:w-52 shrink-0 bg-gray-800 flex flex-col
                    transition-transform duration-300
                    ${showLeftDrawer ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}>
                    <QuestionListPanel />
                </div>

                {/* ── Centre: Canvas ── */}
                <div className="flex-1 overflow-y-auto">

                    {/* Locked banner */}
                    {isLocked && (
                        <div className="bg-green-50 border-b border-green-200 px-4 py-2.5 text-center text-sm text-green-700 font-semibold">
                            ✅ This quiz has been teacher-approved — editing is locked
                        </div>
                    )}

                    {/* Rejected banner with teacher note */}
                    {quizStatus === 'rejected' && (
                        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-center text-sm text-red-700 font-semibold">
                            ❌ This quiz was rejected
                            {teacherNote && <> — <span className="font-normal italic">"{teacherNote}"</span></>}
                            <span className="font-normal ml-1">. Fix and resubmit.</span>
                        </div>
                    )}

                    <div
                        className="flex flex-col items-center min-h-full px-3 sm:px-4 py-6 sm:py-8"
                        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
                    >
                        {/* Question type badge */}
                        <div className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                            {current.type === 'true_or_false' ? '✓/✗ True or False' : '📊 Quiz'}
                        </div>

                        {!isLocked && !current.answers.some(a => a.isCorrect) && (
                            <div className="bg-yellow-400/20 text-yellow-100 text-xs font-semibold px-4 py-2 rounded-xl mb-4 border border-yellow-300/30 text-center">
                                ⚠️ Tap an answer below to mark the correct one
                            </div>
                        )}

                        {/* Question textarea */}
                        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg mb-5">
                            <textarea
                                ref={questionTextareaRef}
                                placeholder="Start typing your question..."
                                value={current.text}
                                onChange={e => updateQuestion('text', e.target.value)}
                                readOnly={isLocked}
                                rows={2}
                                style={{ resize: 'none', overflow: 'hidden' }}
                                onInput={e => autoResize(e.currentTarget)}
                                className="w-full text-center text-base sm:text-lg bg-transparent rounded-2xl border-none outline-none px-4 sm:px-6 py-4 sm:py-5 text-black placeholder-gray-400 focus:ring-0 leading-relaxed read-only:cursor-default"
                            />
                        </div>

                        {/* Image upload */}
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        <div className="w-full max-w-3xl mb-5">
                            {current.imageUrl ? (
                                <div className="relative rounded-xl overflow-hidden shadow-lg">
                                    <img src={current.imageUrl} alt="Question media" className="w-full max-h-52 object-cover" />
                                    {!isLocked && (
                                        <button
                                            onClick={() => updateQuestion('imageUrl', '')}
                                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            ) : uploading ? (
                                <div className="rounded-xl border-2 border-dashed border-white/40 bg-white/20 flex flex-col items-center justify-center py-8">
                                    <p className="text-white text-sm font-medium mb-3">Uploading... {uploadProgress}%</p>
                                    <div className="w-40 bg-white/30 rounded-full h-2">
                                        <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                </div>
                            ) : !isLocked ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="rounded-xl border-2 border-dashed border-white/40 bg-white/10 flex flex-col items-center justify-center py-5 cursor-pointer hover:bg-white/20 transition"
                                >
                                    <div className="text-2xl mb-1">🖼️</div>
                                    <p className="text-white/70 text-xs">Click to upload an image (optional)</p>
                                    <p className="text-white/50 text-xs mt-0.5">JPG, PNG, GIF — max 5MB</p>
                                </div>
                            ) : null}
                        </div>

                        {/* Quiz answers */}
                        {current.type === 'quiz' && (
                            <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {current.answers.map((answer, idx) => (
                                    <div
                                        key={answer.id}
                                        className={`${QUIZ_STYLES[idx].bg} rounded-xl flex flex-col shadow-lg overflow-hidden transition-all ${answer.isCorrect ? 'ring-4 ring-white scale-[1.01]' : 'opacity-90 hover:opacity-100'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3 px-4 py-3">
                                            <button
                                                onClick={() => setCorrectAnswer(answer.id)}
                                                disabled={isLocked}
                                                className={`text-white text-lg font-bold w-7 h-7 flex items-center justify-center shrink-0 rounded-full transition-all disabled:cursor-default ${answer.isCorrect ? 'bg-white/40 ring-2 ring-white scale-110' : 'hover:bg-white/20'
                                                    }`}
                                            >
                                                {answer.isCorrect ? '✓' : QUIZ_STYLES[idx].shape}
                                            </button>
                                            <textarea
                                                placeholder={idx < 2 ? `Add answer ${idx + 1}` : `Add answer ${idx + 1} (optional)`}
                                                value={answer.text}
                                                onChange={e => updateAnswer(answer.id, e.target.value)}
                                                readOnly={isLocked}
                                                rows={1}
                                                style={{ resize: 'none', overflow: 'hidden' }}
                                                onInput={e => autoResize(e.currentTarget)}
                                                className="flex-1 bg-transparent text-white placeholder-white/70 border-none outline-none text-sm font-medium leading-relaxed read-only:cursor-default"
                                            />
                                            {answer.isCorrect && (
                                                <span className="text-[10px] bg-white/30 text-white font-bold px-2 py-0.5 rounded-full shrink-0 self-center">
                                                    ✓
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-black/20 px-4 py-2 flex items-start gap-2">
                                            <span className="text-white/60 text-xs mt-1">💬</span>
                                            <textarea
                                                placeholder="Explain why this answer is correct or incorrect..."
                                                value={answer.explanation}
                                                onChange={e => updateExplanation(answer.id, e.target.value)}
                                                readOnly={isLocked}
                                                rows={1}
                                                style={{ resize: 'none', overflow: 'hidden' }}
                                                onInput={e => autoResize(e.currentTarget)}
                                                className="flex-1 bg-transparent text-white/90 placeholder-white/40 border-none outline-none text-xs leading-relaxed read-only:cursor-default"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* True or False */}
                        {current.type === 'true_or_false' && (
                            <div className="w-full max-w-3xl grid grid-cols-2 gap-3 sm:gap-4">
                                {current.answers.map((answer, idx) => (
                                    <div
                                        key={answer.id}
                                        onClick={() => setCorrectAnswer(answer.id)}
                                        className={`${TF_STYLES[idx].bg} rounded-xl flex flex-col shadow-lg overflow-hidden transition-all select-none ${isLocked ? 'cursor-default' : 'cursor-pointer'
                                            } ${answer.isCorrect ? 'ring-4 ring-white scale-[1.01]' : 'opacity-80 hover:opacity-100'}`}
                                    >
                                        <div className="flex flex-col items-center justify-center gap-1 py-5 sm:py-6 relative">
                                            <span className="text-white text-3xl sm:text-4xl font-bold">{TF_STYLES[idx].shape}</span>
                                            <span className="text-white text-lg sm:text-xl font-bold">{TF_STYLES[idx].label}</span>
                                            {answer.isCorrect && (
                                                <span className="absolute top-2 right-2 text-[10px] bg-white/30 text-white font-bold px-2 py-0.5 rounded-full">
                                                    ✓
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-black/20 px-3 py-2 flex items-start gap-2">
                                            <span className="text-white/60 text-xs mt-1">💬</span>
                                            <textarea
                                                placeholder="Explain why..."
                                                value={answer.explanation}
                                                onChange={e => { e.stopPropagation(); updateExplanation(answer.id, e.target.value); }}
                                                onClick={e => e.stopPropagation()}
                                                readOnly={isLocked}
                                                rows={1}
                                                style={{ resize: 'none', overflow: 'hidden' }}
                                                onInput={e => autoResize(e.currentTarget)}
                                                className="flex-1 bg-transparent text-white/90 placeholder-white/40 border-none outline-none text-xs leading-relaxed read-only:cursor-default"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Mobile save/exit at bottom of canvas */}
                        {!isLocked && (
                            <div className="w-full max-w-3xl mt-8 flex flex-col gap-3 md:hidden">
                                {saveLabel && (
                                    <div className={`text-center text-sm font-semibold px-4 py-2 rounded-xl ${saveLabel.startsWith('✓') ? 'bg-green-500/25 text-white' : 'bg-red-500/25 text-white'
                                        }`}>
                                        {saveLabel}
                                    </div>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full bg-white hover:bg-gray-100 disabled:opacity-50 text-purple-700 font-bold py-4 rounded-2xl text-base shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" /> Saving…</>
                                    ) : (
                                        <>{editId ? '💾 Update Quiz' : '🚀 Submit for Review'}</>
                                    )}
                                </button>
                                <button
                                    onClick={() => router.push('/my-questions')}
                                    className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-3 rounded-2xl text-sm border border-white/30 transition-all"
                                >
                                    ← Exit to My Questions
                                </button>
                            </div>
                        )}

                        <div className="h-10" />
                    </div>
                </div>

                {/* ── Right: Properties Panel ── */}
                <div className={`
                    fixed md:relative top-0 right-0 h-full z-40
                    w-72 md:w-56 shrink-0 bg-white border-l border-gray-200
                    transition-transform duration-300
                    ${showRightDrawer ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                `}>
                    <PropertiesPanel />
                </div>
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
            </div>
        }>
            <QuizCreatorInner />
        </Suspense>
    );
}
