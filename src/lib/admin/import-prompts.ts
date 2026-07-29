import type { SkillSlug } from "@/lib/tests/schema";

/**
 * Copy-paste prompts for converting a source paper into this project's test
 * JSON.
 *
 * Written for a weak, cheap model, because that is what an instructor will
 * reach for. Every rule the validator enforces is stated as an instruction
 * rather than left to be discovered from an error message, and each prompt
 * carries a complete worked example — a model given only a schema will invent
 * plausible-looking keys (`questionText`, `answer`) that fail on import.
 *
 * The rules that actually caused failures in practice, and are therefore
 * repeated in every prompt:
 *  - a `part` needs both `number` and a non-empty `groups` array;
 *  - a group needs `id`, `type` and `rubricHtml`;
 *  - reading parts need `passageHtml` containing the whole passage;
 *  - every question 1..N needs an entry in `answerKey.answers`.
 */

const SHARED_RULES = `
RULES YOU MUST FOLLOW (these are checked, and the import is rejected if broken):
1. Output ONLY raw JSON. No markdown, no \`\`\`json fences, no commentary before or after.
2. Use these exact key names. Do not rename, add or omit keys.
3. "schemaVersion" is always the number 1, in both "content" and "answerKey".
4. Every string ending in "Html" holds HTML, e.g. "<p>text</p>". Plain text is allowed but must still be a string.
5. Copy the wording of the original paper VERBATIM. Do not paraphrase, summarise, shorten or improve it.
6. Never invent content. If the source is missing something, leave the optional key out.
`.trim();

const GRADED_RULES = `
QUESTION NUMBERING (the most common reason an import fails):
- Questions are numbered 1..N across the WHOLE test, continuing across parts. Part 2 does not restart at 1.
- "totalQuestions" must equal N exactly.
- Every number from 1 to N must appear exactly once in the content, and exactly once in "answerKey".
- A gap or a duplicate is rejected.

STRUCTURE (every level is required):
- "parts" is an array. EVERY part object must have "number" (1, 2, 3 …) and "groups".
- "groups" is an array with AT LEAST ONE group. Never an empty array, never omitted.
- EVERY group must have "id" (any unique string like "p1g1"), "type", and "rubricHtml".
- "rubricHtml" is the instruction line from the paper, e.g. "<p>Questions 1-5. Complete the notes below. Write ONE WORD ONLY for each answer.</p>".

GROUP TYPES — pick one per group, and give it the shape that type requires:
- "completion" — gap fill in a passage of text/notes/table/form/flow-chart.
    Needs "bodyHtml" containing {{n}} where each blank goes. NO "questions" array.
    Example: "bodyHtml": "<p>The tour starts at {{1}} and lasts {{2}} minutes.</p>"
- "short_answer" — standalone numbered questions each with a blank.
    Needs "questions": [{ "number": 5, "textHtml": "<p>What time does it open?</p>" }]
- "mcq" — multiple choice.
    Needs "questions", each with "number", "textHtml" and "options".
    "options" is [{ "letter": "A", "textHtml": "…" }, …] with at least two, letters A, B, C… capital single letters.
    For "choose TWO letters", set "selectCount": 2 on the GROUP, give the item the FIRST number, and it silently occupies that number and the next one.
- "tfng" — True / False / Not Given. Needs "questions" with "number" and "textHtml". Do NOT supply options.
- "ynng" — Yes / No / Not Given. Same shape as tfng.
- "matching" — numbered items answered with a letter from a shared list.
    Needs "questions" AND "wordBank": [{ "letter": "A", "textHtml": "…" }, …]
- "map_labeling" — a map or diagram with lettered positions.
    Needs "wordBank" of letters, plus either "bodyHtml" with {{n}} slots or a "questions" array, and "imageUrl" if you have one. Leave "imageUrl" out; it is uploaded separately.

OPTIONAL BUT USEFUL:
- "maxWords": the number from the rubric. "ONE WORD ONLY" -> 1. "NO MORE THAN TWO WORDS" -> 2. "NO MORE THAN TWO WORDS AND/OR A NUMBER" -> 3 (the number counts as one extra word).

THE ANSWER KEY:
- "answers" is an object keyed by the question number AS A STRING: { "1": { "accepted": ["…"] } }.
- "accepted" is an array of every correct form. Put the canonical answer first.
  Include real spelling variants, e.g. ["colour", "color"] or ["theatre", "theater"], and both singular and plural if either is acceptable.
- For tfng use exactly "TRUE", "FALSE" or "NOT GIVEN". For ynng use "YES", "NO" or "NOT GIVEN". Nothing else.
- For mcq and matching, the answer is the LETTER: { "accepted": ["B"] }.
- For a "choose TWO letters" group, do NOT use "answers". Add to "sets":
  "sets": [{ "questions": [11, 12], "accepted": ["A", "D"] }]
- "type" is a short label for the review screen, e.g. "Note completion", "True/False/Not Given".
- "explanation" is one sentence saying why, shown to the student after marking. Include it when you can.
`.trim();

const READING_EXAMPLE = {
  "slug": "cambridge-22-reading-test-1",
  "isPremium": true,
  "content": {
    "schemaVersion": 1,
    "skill": "reading",
    "title": "Cambridge 22 Reading Test 1",
    "totalQuestions": 5,
    "durationSeconds": 3600,
    "parts": [
      {
        "number": 1,
        "instructionsHtml": "<p>You should spend about 20 minutes on Questions 1-5.</p>",
        "passageHtml": "<h4>The Giant Water Lily</h4><p id=\"para-1\">The giant water lily is an aquatic plant native to South America. Its leaves can reach three metres across and support considerable weight.</p><p id=\"para-2\">The plant was first described in 1837 and quickly became popular in European glasshouses.</p>",
        "groups": [
          {
            "id": "p1g1",
            "type": "completion",
            "rubricHtml": "<p>Questions 1-2. Complete the notes below. Write ONE WORD ONLY for each answer.</p>",
            "maxWords": 1,
            "bodyHtml": "<ul class=\"notes-list\"><li>Native to {{1}} America</li><li>Leaves can be {{2}} metres across</li></ul>"
          },
          {
            "id": "p1g2",
            "type": "tfng",
            "rubricHtml": "<p>Questions 3-4. Do the following statements agree with the information in the passage?</p>",
            "questions": [
              { "number": 3, "textHtml": "The leaves can hold a lot of weight." },
              { "number": 4, "textHtml": "The plant is now extinct in the wild." }
            ]
          },
          {
            "id": "p1g3",
            "type": "mcq",
            "rubricHtml": "<p>Question 5. Choose the correct letter, A, B or C.</p>",
            "questions": [
              {
                "number": 5,
                "textHtml": "The plant was first described in",
                "options": [
                  { "letter": "A", "textHtml": "1837" },
                  { "letter": "B", "textHtml": "1873" },
                  { "letter": "C", "textHtml": "1938" }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "answerKey": {
    "schemaVersion": 1,
    "answers": {
      "1": { "accepted": ["South"], "type": "Note completion", "explanation": "The passage says it is native to South America.", "evidence": { "anchor": "para-1", "snippet": "native to South America" } },
      "2": { "accepted": ["three", "3"], "type": "Note completion", "explanation": "The leaves reach three metres across." },
      "3": { "accepted": ["TRUE"], "type": "True/False/Not Given", "explanation": "The passage says they support considerable weight." },
      "4": { "accepted": ["NOT GIVEN"], "type": "True/False/Not Given", "explanation": "Nothing in the passage mentions extinction." },
      "5": { "accepted": ["A"], "type": "Multiple choice", "explanation": "It was first described in 1837." }
    },
    "sets": []
  }
} as const;

const LISTENING_EXAMPLE = {
  "slug": "cambridge-22-listening-test-1",
  "isPremium": true,
  "content": {
    "schemaVersion": 1,
    "skill": "listening",
    "title": "Cambridge 22 Listening Test 1",
    "totalQuestions": 4,
    "durationSeconds": 1980,
    "parts": [
      {
        "number": 1,
        "instructionsHtml": "<p>Listen and answer questions 1-2.</p>",
        "groups": [
          {
            "id": "p1g1",
            "type": "completion",
            "rubricHtml": "<p>Questions 1-2. Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.</p>",
            "maxWords": 2,
            "bodyHtml": "<div class=\"form-row\"><span class=\"form-label\">Name:</span> {{1}}</div><div class=\"form-row\"><span class=\"form-label\">Phone:</span> {{2}}</div>"
          }
        ]
      },
      {
        "number": 2,
        "groups": [
          {
            "id": "p2g1",
            "type": "mcq",
            "rubricHtml": "<p>Questions 3-4. Choose the correct letter, A, B or C.</p>",
            "questions": [
              {
                "number": 3,
                "textHtml": "The meeting will be held in",
                "options": [
                  { "letter": "A", "textHtml": "the main hall" },
                  { "letter": "B", "textHtml": "the library" },
                  { "letter": "C", "textHtml": "room 12" }
                ]
              },
              {
                "number": 4,
                "textHtml": "Members should bring",
                "options": [
                  { "letter": "A", "textHtml": "a notebook" },
                  { "letter": "B", "textHtml": "a laptop" },
                  { "letter": "C", "textHtml": "nothing" }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "answerKey": {
    "schemaVersion": 1,
    "answers": {
      "1": { "accepted": ["Peterson"], "type": "Form completion" },
      "2": { "accepted": ["07700 900123"], "type": "Form completion" },
      "3": { "accepted": ["B"], "type": "Multiple choice" },
      "4": { "accepted": ["A"], "type": "Multiple choice" }
    },
    "sets": []
  }
} as const;

const WRITING_EXAMPLE = {
  "slug": "academic-writing-test-3",
  "isPremium": true,
  "content": {
    "schemaVersion": 1,
    "skill": "writing",
    "title": "Academic Writing Test 3",
    "totalQuestions": 0,
    "durationSeconds": 3600,
    "tasks": [
      {
        "number": 1,
        "promptHtml": "<p>The chart below shows household spending in four countries in 2010.</p><p>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</p>",
        "minWords": 150,
        "suggestedMinutes": 20
      },
      {
        "number": 2,
        "promptHtml": "<p>Write about the following topic:</p><blockquote><p>Some people believe that university education should be free for everyone.</p><p>To what extent do you agree or disagree?</p></blockquote><p>Give reasons for your answer and include any relevant examples from your own knowledge or experience.</p>",
        "minWords": 250,
        "suggestedMinutes": 40
      }
    ]
  },
  "answerKey": { "schemaVersion": 1, "answers": {}, "sets": [] }
} as const;

const SPEAKING_EXAMPLE = {
  "slug": "speaking-test-2-work-and-study",
  "isPremium": false,
  "content": {
    "schemaVersion": 1,
    "skill": "speaking",
    "title": "Speaking Test 2 — Work and Study",
    "totalQuestions": 0,
    "durationSeconds": 840,
    "prompts": [
      { "part": 1, "promptHtml": "<p class=\"frame\">Let's talk about your home town.</p><p>Where do you come from?</p>", "prepSeconds": 0, "speakSeconds": 30 },
      { "part": 1, "promptHtml": "<p>What do you like most about it?</p>", "prepSeconds": 0, "speakSeconds": 30 },
      { "part": 1, "promptHtml": "<p>Would you like to live there in the future?</p>", "prepSeconds": 0, "speakSeconds": 30 },
      { "part": 1, "promptHtml": "<p class=\"frame\">Now let's talk about work.</p><p>Do you work or are you a student?</p>", "prepSeconds": 0, "speakSeconds": 30 },
      { "part": 1, "promptHtml": "<p>What do you enjoy about it?</p>", "prepSeconds": 0, "speakSeconds": 30 },
      { "part": 1, "promptHtml": "<p>Is it what you imagined it would be?</p>", "prepSeconds": 0, "speakSeconds": 30 },
      {
        "part": 2,
        "promptHtml": "<p>Describe a skill you would like to learn.</p>",
        "bulletsHtml": ["what the skill is", "how you would learn it", "how difficult it would be", "and explain why you want to learn it"],
        "prepSeconds": 60,
        "speakSeconds": 120
      },
      { "part": 2, "promptHtml": "<p class=\"frame\">Rounding off.</p><p>Have you tried to learn it before?</p>", "prepSeconds": 0, "speakSeconds": 20 },
      { "part": 2, "promptHtml": "<p>Would you learn it alone or with a teacher?</p>", "prepSeconds": 0, "speakSeconds": 20 },
      { "part": 3, "promptHtml": "<p class=\"frame\">Let's consider how people learn.</p><p>Do you think adults learn differently from children?</p>", "prepSeconds": 0, "speakSeconds": 60 },
      { "part": 3, "promptHtml": "<p>Why do some people give up on a new skill so quickly?</p>", "prepSeconds": 0, "speakSeconds": 60 },
      { "part": 3, "promptHtml": "<p class=\"frame\">Finally, let's talk about work and training.</p><p>Should employers pay for their staff to learn new skills?</p>", "prepSeconds": 0, "speakSeconds": 60 },
      { "part": 3, "promptHtml": "<p>Will the skills people need change in the next twenty years?</p>", "prepSeconds": 0, "speakSeconds": 60 }
    ]
  },
  "answerKey": { "schemaVersion": 1, "answers": {}, "sets": [] }
} as const;

const SOURCE_NOTE = `
THE SOURCE
I will give you a PDF, an image, or an HTML file of a real IELTS paper.
If it is an HTML file exported from a test player, the questions and answers may sit inside <script> data or inline JavaScript objects rather than in the visible markup — read those too, and use them.
Work through the WHOLE paper from beginning to end. Do not stop early and do not summarise.
`.trim();

export type ImportPrompt = {
  skill: SkillSlug;
  label: string;
  hint: string;
  prompt: string;
};

export const IMPORT_PROMPTS: ImportPrompt[] = [
  {
    skill: "reading",
    label: "Reading",
    hint: "Needs the full passage text for every part.",
    prompt: `You convert IELTS papers into a specific JSON format. Convert the attached IELTS ACADEMIC READING paper.

${SOURCE_NOTE}

${SHARED_RULES}

READING-SPECIFIC:
- "skill" is "reading". "durationSeconds" is 3600 for a full 3-passage test.
- EVERY part MUST have "passageHtml" containing the COMPLETE passage text for that part, copied word for word. This is the single most common mistake — do not leave it out and do not shorten the passage.
- Wrap each paragraph in <p> tags. Give paragraphs ids like <p id="para-1"> so answers can point at them.
- If the paper labels paragraphs A, B, C, put the letter in <span class="para-label">A</span> at the start of that paragraph.
- A standard test has 3 parts and 40 questions.

${GRADED_RULES}

COMPLETE WORKED EXAMPLE (a short 5-question test — copy this structure exactly):
${JSON.stringify(READING_EXAMPLE, null, 2)}

Now output the JSON for the attached paper. Raw JSON only.`,
  },
  {
    skill: "listening",
    label: "Listening",
    hint: "Audio is uploaded separately, after import.",
    prompt: `You convert IELTS papers into a specific JSON format. Convert the attached IELTS LISTENING paper.

${SOURCE_NOTE}

${SHARED_RULES}

LISTENING-SPECIFIC:
- "skill" is "listening". "durationSeconds" is 1980 (33 minutes) for a full test.
- Listening parts have NO "passageHtml". Do not add one.
- A standard test has 4 parts and 40 questions, usually 10 per part.
- If the source mentions or links an audio file, add its URL as a top-level "audioSourceUrl" so it can be re-hosted. The audio itself is uploaded separately after import.
- If there is a transcript, use it ONLY to work out the answers. Do not put the transcript in the JSON.

${GRADED_RULES}

COMPLETE WORKED EXAMPLE (a short 4-question test — copy this structure exactly):
${JSON.stringify(LISTENING_EXAMPLE, null, 2)}

Now output the JSON for the attached paper. Raw JSON only.`,
  },
  {
    skill: "writing",
    label: "Writing",
    hint: "Charts and diagrams are uploaded after import.",
    prompt: `You convert IELTS papers into a specific JSON format. Convert the attached IELTS ACADEMIC WRITING paper.

${SOURCE_NOTE}

${SHARED_RULES}

WRITING-SPECIFIC:
- "skill" is "writing". "totalQuestions" is 0. "durationSeconds" is 3600 for a full test.
- There is no "parts" array and no answer key content. "answerKey" is exactly { "schemaVersion": 1, "answers": {}, "sets": [] }.
- "tasks" is an array. "number" is 1 or 2 — those are the only allowed values.
- Task 1: "minWords" 150, "suggestedMinutes" 20. Task 2: "minWords" 250, "suggestedMinutes" 40.
- "promptHtml" is the task wording copied verbatim, including the "Summarise the information…" or "Give reasons for your answer…" sentence.
- Academic Task 1 always describes a chart, graph, table, map or process diagram. DESCRIBE NOTHING ABOUT THE IMAGE and do NOT add an "imageUrl" key — the picture is uploaded through the admin screen after import. Just include the sentence that introduces it, e.g. "The chart below shows…".
- If the paper has several alternative Task 1s or Task 2s, produce ONE test per pairing and tell me how many you made.

COMPLETE WORKED EXAMPLE (copy this structure exactly):
${JSON.stringify(WRITING_EXAMPLE, null, 2)}

Now output the JSON for the attached paper. Raw JSON only.`,
  },
  {
    skill: "speaking",
    label: "Speaking",
    hint: "One entry per question — not one per part.",
    prompt: `You convert IELTS papers into a specific JSON format. Convert the attached IELTS SPEAKING paper.

${SOURCE_NOTE}

${SHARED_RULES}

SPEAKING-SPECIFIC:
- "skill" is "speaking". "totalQuestions" is 0. "durationSeconds" is 840 (14 minutes).
- There is no "parts" array and no answer key content. "answerKey" is exactly { "schemaVersion": 1, "answers": {}, "sets": [] }.
- "prompts" is a FLAT array with ONE OBJECT PER INDIVIDUAL QUESTION. This is the most common mistake: do NOT create one object per part, and do NOT put a topic name like "Work" or "Hometown" as the whole prompt. A real test has roughly 12-15 objects.
- "part" is 1, 2 or 3 — those are the only allowed values.
- Part 1: every question separately. "prepSeconds": 0, "speakSeconds": 30.
    When the examiner introduces a new topic ("Let's talk about your home town."), put that sentence in its own paragraph with class "frame" BEFORE the question, on the first question of that topic only:
    "<p class=\\"frame\\">Let's talk about your home town.</p><p>Where do you come from?</p>"
- Part 2: ONE object for the cue card. "promptHtml" is the "Describe…" line. "bulletsHtml" is an array of the "You should say" bullet lines, including the final "and explain why…" line. "prepSeconds": 60, "speakSeconds": 120.
    If the paper has rounding-off questions after the cue card, add them as extra part 2 objects with "prepSeconds": 0 and "speakSeconds": 20.
- Part 3: every discussion question separately. "prepSeconds": 0, "speakSeconds": 60. Use the same "frame" paragraph trick for the examiner's topic sentences.
- IGNORE any sample answers, model answers, examiner comments, transcripts or recordings in the source. Only the questions are wanted.

COMPLETE WORKED EXAMPLE (copy this structure exactly — note one object per question):
${JSON.stringify(SPEAKING_EXAMPLE, null, 2)}

Now output the JSON for the attached paper. Raw JSON only.`,
  },
];

export function promptFor(skill: SkillSlug): ImportPrompt | undefined {
  return IMPORT_PROMPTS.find((entry) => entry.skill === skill);
}
