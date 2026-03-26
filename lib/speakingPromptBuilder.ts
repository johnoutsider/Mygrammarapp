export interface QAPair {
    questionText: string
    transcript: string
}

export function buildAnalysisPrompt(pairs: QAPair[]): string {
    const sessionLines = pairs
        .map((pair, index) => {
            const q = pair.questionText.trim() || '(no question text)'
            const a = pair.transcript.trim() || '(no answer recorded)'
            if (pairs.length === 1) {
                return `**Question:** ${q}\n**Student Answer:** ${a}`
            }
            return `**Question ${index + 1}:** ${q}\n**Student Answer ${index + 1}:** ${a}`
        })
        .join('\n\n')

    const sessionBlock =
        pairs.length === 1
            ? sessionLines
            : `=== SPEAKING SESSION ===\n\n${sessionLines}\n\n=== END OF SESSION ===`

    const criteriaBlock = `Assess the student's speaking performance using these IELTS criteria:
1. Task Response — Did the student address the question(s) fully?
2. Fluency and Coherence — Was speech smooth, logically connected, and easy to follow?
3. Lexical Resource — Variety and accuracy of vocabulary used.
4. Grammatical Range and Accuracy — Sentence structure variety and grammatical correctness.
5. Pronunciation — Clarity and naturalness (infer cautiously from transcript if audio not available).`

    const jsonShape = `Return strict JSON in this exact shape:
{
  "taskResponse": <0-9 in 0.5 increments>,
  "fluencyCoherence": <0-9 in 0.5 increments>,
  "lexicalResource": <0-9 in 0.5 increments>,
  "grammaticalRangeAccuracy": <0-9 in 0.5 increments>,
  "pronunciation": <0-9 in 0.5 increments>,
  "overallBand": <0-9 in 0.5 increments>,
  "strengths": ["short point", "short point"],
  "improvements": ["short action point", "short action point", "short action point"],
  "feedback": "A concise but specific teacher-facing evaluation in 180-260 words."
}

Be concrete. Reference specific phrases or details from the student's answers. If pronunciation cannot be fully verified from transcript alone, infer cautiously and say so in the feedback.`

    return `You are an experienced IELTS Speaking examiner. Below is a speaking session showing each question and the student's spoken response.

${sessionBlock}

${criteriaBlock}

${jsonShape}`
}
