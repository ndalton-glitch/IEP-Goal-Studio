import { useState, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────
// IEP Goal Studio v3
// Subject → Grade (K–5) → Area of Need → goals
// Skills are developmental ladders: each carries grade-specific
// parameters, so criteria genuinely scale K→5.
// 50+ goals per grade per subject · 3 support levels each.
// ─────────────────────────────────────────────────────────────

const GRADES = ["K", "1", "2", "3", "4", "5"];
const GRADE_LABEL = { K: "Kindergarten", 1: "1st Grade", 2: "2nd Grade", 3: "3rd Grade", 4: "4th Grade", 5: "5th Grade" };

const LEVEL_META = {
  support: { label: "More support", short: "Support" },
  standard: { label: "Standard", short: "Standard" },
  rigor: { label: "More rigor", short: "Rigor" },
};

const STORAGE_KEY = "iepgoals:library-v3";
const STUDENTS_KEY = "iepgoals:students-v1";
const SETTINGS_KEY = "iepgoals:pm-settings-v1";

const SUPPORT_LEVELS = ["independent", "minimal assistance", "moderate assistance", "maximum assistance"];
const DEFAULT_SETTINGS = { yearStart: "2026-08-20", yearEnd: "2027-05-30", periods: 6, required: 7 };

// ==DATA-START==
// Shared grade-parameter ladders (index 0 = K … index 5 = grade 5)
const P = {
  txt: ["kindergarten-level text", "first-grade text", "second-grade text", "third-grade text", "fourth-grade text", "fifth-grade text"],
  story: ["a story read aloud", "a first-grade story", "a second-grade story", "a third-grade story", "a fourth-grade story", "a fifth-grade story"],
  info: ["an informational book read aloud", "a first-grade informational text", "a second-grade informational text", "a third-grade informational text", "a fourth-grade informational text", "a fifth-grade informational text"],
  words: ["CVC words", "words with digraphs and blends", "words with long-vowel and r-controlled patterns", "multisyllabic words with common syllable types", "multisyllabic words with prefixes and suffixes", "multisyllabic words with Greek and Latin roots"],
  num: ["within 5", "within 10", "within 20", "within 100", "within 1,000", "with multi-digit numbers and decimals"],
};

// Criterion ladders: [support, standard, rigor]
const CRIT = {
  acc: ["with 80% accuracy", "with 90% accuracy", "with 95% accuracy"],
  tr: ["in 7 of 10 trials", "in 8 of 10 trials", "in 9 of 10 trials"],
  opp: ["in 4 of 5 opportunities", "in 8 of 10 opportunities", "in 9 of 10 opportunities"],
  smp: ["in 3 of 5 work samples", "in 4 of 5 work samples", "in 4 of 5 samples at rubric-proficient level"],
  day: ["in 3 of 5 school days", "in 4 of 5 school days", "in 9 of 10 school days"],
};

// Default measurement + criterion ladder per subject
const SUBJ_DEFAULTS = {
  "Reading": { m: "curriculum-based measurement", k: "acc" },
  "Writing": { m: "rubric-scored writing samples", k: "smp" },
  "Math": { m: "curriculum-based measurement", k: "acc" },
  "Communication": { m: "SLP data collection", k: "tr" },
  "Behavior / SEL": { m: "teacher observation data", k: "opp" },
  "Executive Functioning": { m: "teacher observation data", k: "opp" },
};

// Skill fields: n(name), c(condition), b(behavior), gr [min,max] (default [0,5]),
// p / q = grade ladders (array of 6, or a key of P) inserted at {x} / {q},
// k = criterion ladder key (default per subject), m = measured-by (default per subject),
// sc = support-level condition (default: c + scaffold phrase)
const SKILLS = {
  "Reading": {
    "Phonological Awareness & Word Study": [
      { n: "Sound & word analysis", c: "orally presented words and a modeled example", b: "analyze {x}", p: ["rhyming words and beginning sounds", "individual sounds in spoken words", "sounds in words with blends", "syllable types in written words", "base words and affixes", "Greek and Latin word parts"], k: "tr" },
      { n: "Blending word parts", c: "orally presented word parts", b: "blend {x} into a whole word", p: ["2–3 spoken sounds", "3–4 spoken sounds", "4–5 sounds including blends", "spoken syllables of multisyllabic words", "base words with prefixes and suffixes", "roots with affixes"], k: "tr" },
      { n: "Segmenting words", c: "orally presented words", b: "segment {x}", p: ["spoken words into 2–3 sounds", "spoken words into individual sounds", "words with blends into all sounds", "multisyllabic words into syllables", "written words into base words and affixes", "academic words into meaningful parts"], k: "tr" },
      { n: "Sound & word-part manipulation", c: "a spoken word and a target change", b: "add, delete, or substitute {x} to form a new word", p: ["beginning sounds", "beginning or ending sounds", "medial vowel sounds", "syllables", "prefixes or suffixes", "roots and affixes"], k: "tr" },
      { n: "Syllable awareness & division", c: "grade-appropriate words", b: "identify and divide {x}", p: ["syllables in spoken 1–2 syllable words", "syllables in spoken words", "closed and open syllables in written words", "common syllable types in written words", "syllables in words with affixes", "syllables in advanced multisyllabic words"], k: "tr" },
      { n: "Letter–sound correspondence", c: "printed letters and patterns", b: "produce the sounds for {x}", p: ["10 taught letters", "all consonants and short vowels", "digraphs and common blends", "vowel teams and r-controlled vowels", "less common vowel patterns", "advanced spelling patterns"] },
      { n: "Phoneme–grapheme mapping", c: "sound boxes and a dictated word", b: "map each sound to its spelling in {x}", p: "words", k: "tr" },
      { n: "Word families & chunking", c: "letter tiles or word cards", b: "read and build words using {x}", p: ["common word families (-at, -an, -it)", "short-vowel word families", "vowel-team chunks", "common syllable chunks", "affix chunks", "root-based word networks"], k: "tr" },
      { n: "Automatic sound recall", c: "flashed cards or a rapid-naming array", b: "respond to {x} within 3 seconds", p: ["letter names", "letter sounds", "digraph and blend sounds", "syllable chunks", "common affixes and meanings", "common roots and meanings"] },
    ],
    "Decoding & Word Recognition": [
      { n: "Decoding words in isolation", c: "a list of 10 unfamiliar words", b: "decode {x}", p: "words" },
      { n: "High-frequency words", c: "a word list presented in random order", b: "read {x} high-frequency words automatically", p: ["the first 25", "the first 100", "the first 200", "the first 300", "the first 400", "the first 500"] },
      { n: "Spelling target patterns", c: "dictated words featuring taught patterns", b: "spell {x}", p: "words", m: "dictated spelling probes" },
      { n: "Decoding in connected text", c: "an unpracticed passage of {x}", b: "accurately decode target-pattern words in context", p: "txt" },
      { n: "Irregularly spelled words", c: "word cards and connected text", b: "read {x} irregularly spelled words", p: ["10 common", "25 common", "50 grade-appropriate", "75 grade-appropriate", "100 grade-appropriate", "125 grade-appropriate"] },
      { n: "Self-monitoring decoding", c: "an instructional-level passage of {x}", b: "notice and correct their own decoding errors", p: "txt", k: "opp" },
      { n: "Transfer to novel words", c: "unfamiliar pseudo-words or rare words", b: "apply taught patterns to decode novel words featuring {x}", p: "words" },
      { n: "Letter & early word recognition", gr: [0, 1], c: "printed letters and simple words", b: "identify uppercase and lowercase letters and read taught words" },
      { n: "Multisyllabic word strategies", gr: [2, 5], c: "unfamiliar multisyllabic words", b: "apply a syllable-division or peel-off strategy to decode {x}", p: ["", "", "2-syllable words", "2–3 syllable words", "3-syllable words with affixes", "4+ syllable academic words"] },
    ],
    "Fluency": [
      { n: "Oral reading rate", gr: [1, 5], c: "an unpracticed instructional-level passage", b: "read aloud at {x}", p: ["", "50 words correct per minute", "80 words correct per minute", "100 words correct per minute", "115 words correct per minute", "130 words correct per minute"], m: "timed oral reading probes" },
      { n: "Letter & sound fluency", gr: [0, 1], c: "a randomized letter array", b: "name {x}", p: ["30 letter names per minute", "50 letter sounds per minute", "", "", "", ""], m: "timed probes" },
      { n: "Accuracy in connected text", c: "an instructional-level passage of {x}", b: "read with fewer than 3 errors per 100 words", p: "txt", k: "smp", m: "running records" },
      { n: "Prosody & expression", c: "a familiar passage of {x}", b: "read with appropriate phrasing, expression, and attention to punctuation", p: "txt", k: "smp", m: "a fluency rubric" },
      { n: "Self-correction while reading", c: "instructional-level text", b: "independently self-correct errors that affect meaning", k: "opp", m: "running records" },
      { n: "Sight-phrase fluency", c: "phrase cards and simple sentences", b: "read common phrases built from {x} automatically", p: ["the first 25 high-frequency words", "the first 100 high-frequency words", "the first 200 high-frequency words", "the first 300 high-frequency words", "the first 400 high-frequency words", "the first 500 high-frequency words"], m: "timed phrase probes" },
      { n: "Repeated-reading growth", c: "a repeated-reading routine on one passage", b: "increase their rate by 20% from first to third read", k: "smp", m: "timed oral reading probes" },
      { n: "Independent reading stamina", c: "self-selected books at independent level", b: "read independently for {x} while maintaining engagement", p: ["5 minutes", "10 minutes", "15 minutes", "20 minutes", "25 minutes", "30 minutes"], k: "day", m: "teacher observation data" },
      { n: "Punctuation-guided reading", c: "text with varied punctuation", b: "adjust pausing and intonation to match punctuation", k: "smp", m: "a fluency rubric" },
    ],
    "Vocabulary": [
      { n: "Naming & categorizing", c: "pictures, objects, or word cards", b: "name and categorize {x}", p: ["common objects and pictures", "grade-level nouns and verbs", "items by category and function", "words by category, function, and attribute", "academic terms by domain", "abstract terms by domain"], k: "tr" },
      { n: "Context clues", c: "a passage of {x} containing unfamiliar words", b: "determine word meaning using context", p: "txt" },
      { n: "Affixes & roots", c: "unfamiliar words and a word-parts routine", b: "use {x} to determine word meaning", p: ["picture clues and word parts", "common inflectional endings (-s, -ed, -ing)", "common prefixes (un-, re-, pre-)", "prefixes and suffixes", "Latin roots and affixes", "Greek and Latin roots"] },
      { n: "Multiple-meaning words", c: "sentences from {x}", b: "identify the intended meaning of multiple-meaning words", p: "txt", k: "tr" },
      { n: "Synonyms & antonyms", c: "target words in and out of context", b: "provide synonyms and antonyms for {x}", p: ["familiar words", "grade-level words", "grade-level verbs and adjectives", "academic words", "nuanced word pairs", "words across shades of meaning"], k: "tr" },
      { n: "Academic vocabulary", c: "explicit vocabulary instruction", b: "define and use {x} in original sentences", p: ["5 new theme words per week", "5 tier-2 words per week", "8 tier-2 words per week", "10 tier-2 words per week", "10 tier-2 and domain words per week", "12 tier-2 and domain words per week"] },
      { n: "Describing words", gr: [0, 1], c: "objects and pictures", b: "use describing words for size, color, and shape", k: "tr" },
      { n: "Figurative language", gr: [2, 5], c: "text containing figurative language", b: "interpret {x}", p: ["", "", "common idioms", "similes and idioms", "similes, metaphors, and idioms", "figurative language and its effect on meaning"] },
      { n: "Word relationships", c: "word pairs and sets", b: "explain relationships between words ({x})", p: ["opposites and matches", "categories and functions", "part–whole and sequence", "analogies with support", "analogies", "analogies and connotation"] },
    ],
    "Comprehension: Literature": [
      { n: "Retelling stories", c: "{x}", b: "retell the story including {q}", p: "story", q: ["the beginning, middle, and end", "characters, setting, and key events", "story elements in sequence", "plot elements including problem and solution", "a plot summary with supporting details", "a concise summary including theme"], k: "opp", m: "retell rubrics" },
      { n: "Answering questions about stories", c: "{x}", b: "answer {q}", p: "story", q: ["who and what questions", "who, what, and where questions", "wh- questions including when and why", "literal and simple inferential questions", "inferential questions citing evidence", "inferential and evaluative questions citing evidence"], m: "comprehension probes" },
      { n: "Character understanding", c: "{x}", b: "describe {q}", p: "story", q: ["how a character feels", "character feelings and their reasons", "character traits with examples", "traits and motivations with evidence", "how a character changes with evidence", "how character development supports the theme"], k: "opp" },
      { n: "Sequencing story events", c: "{x}", b: "sequence {q}", p: "story", q: ["3 story events with picture support", "3–4 story events", "4–5 story events", "events using transition words", "events distinguishing major from minor", "events analyzing cause-and-effect links"], k: "tr" },
      { n: "Making predictions", c: "{x}", b: "make and check predictions using {q}", p: "story", q: ["pictures and titles", "pictures and story clues", "text clues", "text evidence", "evidence and prior knowledge", "evidence, refining predictions while reading"], k: "opp" },
      { n: "Making inferences", c: "{x}", b: "make inferences about {q}", p: "story", q: ["feelings from pictures", "feelings and actions", "characters and events", "characters and events, citing evidence", "implied ideas, citing two pieces of evidence", "implied ideas and author choices, citing evidence"], m: "comprehension probes" },
      { n: "Theme & central message", c: "{x}", b: "identify {q}", p: "story", q: ["the lesson of a familiar story", "the lesson a story teaches", "the central message with one supporting detail", "the theme with two supporting details", "the theme and how it develops", "multiple themes and their development"], k: "opp" },
      { n: "Comparing stories", c: "two stories, including {x}", b: "compare {q}", p: "story", q: ["two versions of a familiar story", "characters in two stories", "two stories by the same author", "stories across genres", "the stories' themes and structures", "the texts' treatment of a shared theme"], k: "smp" },
      { n: "Comprehension strategies", c: "{x}", b: "apply strategies ({q}) to maintain understanding", p: "story", q: ["picture walks and retelling", "visualizing and retelling", "visualizing and questioning", "questioning and clarifying", "monitoring and fixing up meaning", "selecting strategies flexibly"], k: "opp" },
    ],
    "Comprehension: Informational Text": [
      { n: "Main idea & key details", c: "{x}", b: "identify {q}", p: "info", q: ["the topic and one detail", "the main topic and 2 details", "the main idea and 2 details", "the main idea and 3 supporting details", "main ideas of sections and how details support them", "central ideas across the text with supporting evidence"], m: "comprehension probes" },
      { n: "Text features", c: "{x}", b: "use {q} to locate and interpret information", p: "info", q: ["pictures and labels", "headings and pictures", "headings, captions, and bold words", "headings, captions, diagrams, and glossaries", "text features and search tools", "features, graphics, and multimedia elements"], k: "tr" },
      { n: "Summarizing informational text", c: "{x}", b: "produce {q}", p: "info", q: ["an oral statement of what the book was about", "an oral summary of the topic and 2 facts", "a 2–3 sentence summary", "a written summary of main idea and key details", "an objective summary free of opinion", "a concise summary integrating ideas across sections"], k: "smp" },
      { n: "Author's purpose", c: "{x}", b: "identify {q}", p: "info", q: ["whether the book is real or make-believe", "whether the text teaches or entertains", "the author's purpose (persuade, inform, entertain)", "the author's purpose with supporting evidence", "the author's purpose and point of view", "point of view and how the author supports it"], k: "tr" },
      { n: "Comparing informational texts", c: "two texts on one topic, including {x}", b: "compare {q}", p: "info", q: ["what each book shows about the topic", "the most important points in each", "key details across both texts", "the most important points and key details", "how each text presents the information", "the authors' evidence and presentation, evaluating each"], k: "smp" },
      { n: "Cause & effect", c: "{x}", b: "identify {q}", p: "info", q: ["what happened and why, with picture support", "a stated cause and effect", "cause-and-effect relationships", "cause-and-effect relationships using signal words", "chains of causes and effects", "implied cause-and-effect relationships with evidence"], k: "tr" },
      { n: "Fact vs. opinion", c: "{x}", b: "distinguish {q}", p: "info", q: ["real from make-believe", "what is true from what someone thinks", "facts from opinions", "facts from opinions with justification", "facts, opinions, and reasoned judgment", "claims supported by evidence from unsupported claims"], k: "tr" },
      { n: "Answering with evidence", c: "{x} and text-based questions", b: "answer using {q}", p: "info", q: ["pictures from the book", "words or pictures from the text", "a sentence from the text", "explicit text evidence", "quoted or paraphrased evidence", "multiple pieces of cited evidence"], m: "comprehension probes" },
      { n: "Content vocabulary in text", c: "{x}", b: "determine the meaning of {q}", p: "info", q: ["new naming words with picture support", "new words using pictures and context", "domain words using context and glossaries", "academic and domain words using context", "domain vocabulary using context and word parts", "technical vocabulary across a text"] },
    ],
  },
  "Writing": {
    "Conventions & Mechanics": [
      { n: "Capitalization", c: "their own writing and an editing routine", b: "correctly capitalize {x}", p: ["their name and the word I", "sentence beginnings and names", "sentence beginnings, names, and dates", "proper nouns and titles", "proper nouns, titles, and quotations", "all grade-level capitalization conventions"] },
      { n: "Punctuation", c: "sentence writing tasks", b: "correctly use {x}", p: ["ending periods with a model", "end punctuation (. ! ?)", "end punctuation and commas in dates and lists", "commas in addresses and dialogue punctuation", "commas in compound sentences and quotation marks", "commas, quotation marks, and other internal punctuation"] },
      { n: "Spelling in daily writing", c: "independent writing tasks", b: "correctly spell {x}", p: ["their name and 5 taught words", "25 high-frequency words", "100 high-frequency words", "grade-level high-frequency words", "grade-level words using patterns and rules", "grade-level words including affixed forms"], k: "acc", m: "writing sample analysis" },
      { n: "Grammar & usage", c: "sentence writing tasks", b: "correctly use {x}", p: ["naming words and action words orally", "singular and plural nouns", "subject–verb agreement in simple sentences", "past, present, and future verb tense", "consistent tense and pronoun agreement", "grade-level grammar including perfect tenses"] },
      { n: "Complete sentence conventions", c: "independent writing", b: "write sentences that are {x}", p: ["complete thoughts dictated then copied", "complete simple sentences", "complete sentences without run-ons", "complete sentences, correcting fragments", "free of fragments and run-ons", "varied and free of fragments and run-ons"] },
      { n: "Apostrophes & quotations", gr: [2, 5], c: "sentence and paragraph writing", b: "correctly use {x}", p: ["", "", "apostrophes in contractions", "apostrophes in contractions and possessives", "quotation marks in dialogue", "quotations, citations, and possessives"] },
      { n: "Writing their name & labels", gr: [0, 1], c: "a model as needed", b: "write their first and last name and label drawings with words", k: "smp" },
      { n: "Editing with a checklist", c: "a completed draft and an editing checklist", b: "find and correct {x}", p: ["capital letters at the start with support", "2 convention errors", "3 convention errors", "80% of convention errors", "85% of convention errors", "90% of convention errors, explaining corrections"], k: "smp" },
      { n: "Conventions in final drafts", c: "the publishing stage of writing", b: "produce final drafts with {x}", p: ["their name and a readable sentence", "no more than 3 convention errors", "no more than 3 errors per piece", "no more than 2 errors per paragraph", "no more than 2 errors per 100 words", "no more than 1 error per 100 words"], k: "smp" },
    ],
    "Handwriting & Production": [
      { n: "Letter & word formation", c: "lined paper and a model as needed", b: "legibly form {x}", p: ["10 taught letters", "all uppercase and lowercase letters", "letters with consistent size and placement", "fluent manuscript or introductory cursive", "legible cursive or manuscript", "legible, fluent handwriting in daily work"], k: "smp", m: "work sample review" },
      { n: "Spacing & organization on the page", c: "writing tasks on lined paper", b: "use {x}", p: ["left-to-right placement with a starting dot", "spaces between words", "consistent spacing and margins", "organized spacing, margins, and headings", "organized page layout across assignments", "organized layout including lists and paragraphs"], k: "smp", m: "work sample review" },
      { n: "Copying accurately", c: "a near-point or board model", b: "copy {x} accurately", p: ["letters and their name", "words and short sentences", "sentences from near point", "sentences from the board", "notes from the board within time limits", "extended notes accurately and efficiently"], k: "smp", m: "work sample review" },
      { n: "Writing stamina", c: "a daily writing block", b: "write continuously for {x}", p: ["3 minutes drawing and labeling", "5 minutes", "8 minutes", "12 minutes", "15 minutes", "20 minutes"], k: "day", m: "teacher observation data" },
      { n: "Written output volume", c: "a grade-appropriate prompt", b: "produce {x}", p: ["a drawing with a labeled word", "1–2 sentences", "3–4 sentences", "a paragraph of 5+ sentences", "6–8 sentences across paragraphs", "multiple organized paragraphs"], k: "smp" },
      { n: "Keyboarding", c: "a keyboard and grade-appropriate task", b: "type {x}", p: ["their name and taught letters", "words and short sentences", "sentences at 5 words per minute", "at 10 words per minute", "at 15 words per minute", "at 20 words per minute"], k: "acc", m: "timed typing samples" },
      { n: "Digital writing tools", c: "a device with writing software", b: "use {x}", p: ["a drawing/labeling app with support", "basic typing and saving", "word processing to write and save work", "editing tools (backspace, spellcheck) while drafting", "formatting and spellcheck tools while revising", "digital tools to draft, revise, and share writing"], k: "opp" },
      { n: "Pencil grasp & control", gr: [0, 2], c: "handwriting tasks and adaptive tools as needed", b: "use a functional grasp to produce {x}", p: ["pre-writing strokes and shapes", "legible letters within lines", "legible writing across a full task", "", "", ""], k: "smp", m: "OT/teacher observation" },
      { n: "Volume under time limits", gr: [3, 5], c: "a timed classroom writing task", b: "produce {x} within the allotted time", p: ["", "", "", "a complete paragraph", "a complete multi-paragraph response", "a complete, organized essay draft"], k: "smp" },
    ],
    "Sentence Construction": [
      { n: "Writing complete sentences", c: "a picture or topic prompt", b: "write {x}", p: ["a dictated sentence with a model", "a complete sentence independently", "2–3 related complete sentences", "complete sentences with correct structure", "varied complete sentences", "sophisticated complete sentences"], k: "smp" },
      { n: "Expanding sentences", c: "a simple sentence and question prompts (where? when? how?)", b: "expand it by adding {x}", p: ["one describing word orally", "one detail", "two details", "adjectives, adverbs, or prepositional phrases", "phrases and clauses for detail", "modifiers and clauses for precision and style"], k: "tr", m: "writing sample analysis" },
      { n: "Combining sentences", gr: [1, 5], c: "two or more short related sentences", b: "combine them using {x}", p: ["", "and", "and, but, or so", "conjunctions to form compound sentences", "conjunctions to form compound and complex sentences", "varied constructions including relative clauses"], k: "tr", m: "writing sample analysis" },
      { n: "Varied sentence beginnings", gr: [2, 5], c: "revision of their own writing", b: "vary sentence openings using {x}", p: ["", "", "different first words", "time and place openers", "phrase and clause openers", "varied openers for rhythm and emphasis"], k: "smp" },
      { n: "Question & exclamation sentences", gr: [0, 2], c: "a communicative purpose", b: "compose {x}", p: ["an oral question about a topic", "a written question with a question mark", "statements, questions, and exclamations", "", "", ""], k: "tr" },
      { n: "Descriptive sentences", c: "a picture or sensory experience", b: "write sentences using {x}", p: ["a color or size word", "one describing word per sentence", "two describing words per sentence", "sensory details", "precise adjectives and strong verbs", "figurative language and precise word choice"], k: "smp" },
      { n: "Compound & complex sentences", gr: [3, 5], c: "sentence-writing and revision tasks", b: "correctly write {x}", p: ["", "", "", "compound sentences", "compound and complex sentences", "complex sentences with correctly punctuated clauses"], k: "tr", m: "writing sample analysis" },
      { n: "Sentence editing", c: "sentences containing errors", b: "identify and correct {x}", p: ["a missing capital with support", "one error per sentence", "capitalization and end punctuation errors", "fragments and run-ons", "usage and punctuation errors", "varied errors, explaining each correction"], k: "tr", m: "editing probes" },
      { n: "From dictation to independence", gr: [0, 2], c: "a supported writing routine", b: "move from {x}", p: ["dictating a sentence to writing it with a model", "writing dictated sentences to composing their own", "composing sentences without models", "", "", ""], k: "smp" },
    ],
    "Composition": [
      { n: "Opinion writing", c: "an opinion prompt and planning support as needed", b: "compose {x}", p: ["a drawing with a dictated opinion", "an opinion sentence with one reason", "an opinion with 2 reasons and a closing", "an opinion paragraph with reasons and examples", "an opinion essay with grouped reasons", "an opinion essay with elaborated reasons and a strong conclusion"] },
      { n: "Informative writing", c: "a topic and source material as appropriate", b: "compose {x}", p: ["a labeled drawing about a topic", "2 facts about a topic with a topic sentence", "an informative paragraph with 3 facts and a closing", "an informative paragraph with grouped facts", "a multi-paragraph informative piece with sections", "an informative essay integrating researched facts"] },
      { n: "Narrative writing", c: "a narrative prompt", b: "compose {x}", p: ["a drawing with a dictated story event", "a 2–3 sentence story in order", "a narrative with beginning, middle, and end", "a narrative with sequenced events and details", "a narrative with dialogue and description", "a narrative with developed characters, pacing, and a resolution"] },
      { n: "Topic sentences & leads", gr: [1, 5], c: "a writing prompt", b: "begin pieces with {x}", p: ["", "a sentence that names the topic", "a clear topic sentence", "a topic sentence that previews details", "an engaging lead and clear focus", "a hook and thesis that frame the piece"], k: "smp" },
      { n: "Elaborating with details", c: "a draft needing development", b: "elaborate using {x}", p: ["one more label or word", "one added detail per sentence", "examples for each idea", "examples and explanations for each reason", "evidence, examples, and explanation", "layered elaboration that develops each idea fully"], k: "smp" },
      { n: "Conclusions", gr: [1, 5], c: "a draft missing an ending", b: "write {x}", p: ["", "an ending sentence", "a closing sentence that wraps up", "a conclusion that restates the main idea", "a conclusion that synthesizes key points", "a conclusion that synthesizes and extends the ideas"], k: "smp" },
      { n: "Transitions & cohesion", gr: [1, 5], c: "multi-sentence or multi-paragraph drafts", b: "connect ideas using {x}", p: ["", "first, next, last", "time-order and linking words", "transitions within paragraphs", "transitions within and between paragraphs", "varied cohesive devices across an essay"], k: "smp" },
      { n: "Organizing structure", c: "a prompt and an organizer as needed", b: "organize writing with {x}", p: ["a picture plan of first and next", "a beginning and an end", "a beginning, middle, and end", "paragraphs grouped by idea", "logical sections with paragraph breaks", "a structure matched to purpose and audience"], k: "smp" },
      { n: "Writing to a prompt on demand", gr: [2, 5], c: "an on-demand district or classroom prompt", b: "independently produce {x}", p: ["", "", "an organized response of 4+ sentences", "a complete paragraph response", "a complete multi-paragraph response", "a complete essay meeting all prompt requirements"], k: "smp" },
      { n: "Staying on topic", gr: [2, 5], c: "a single-topic writing task", b: "keep {x} on topic", p: ["", "", "all sentences", "all sentences in a paragraph", "all paragraphs, removing off-topic ideas", "the full piece, maintaining focus and purpose"], k: "smp" },
      { n: "Precise word choice & style", gr: [3, 5], c: "drafting and revision tasks", b: "use {x}", p: ["", "", "", "specific nouns and strong verbs", "precise vocabulary and varied word choice", "deliberate word choice and tone for the audience"], k: "smp" },
    ],
    "Writing Process": [
      { n: "Planning before writing", c: "a writing prompt and planning tools", b: "plan by {x}", p: ["drawing their idea first", "drawing and labeling a plan", "completing a simple organizer", "completing a graphic organizer independently", "selecting and completing an organizer", "outlining with an appropriate structure"], k: "smp", m: "work sample review" },
      { n: "Drafting from a plan", c: "a completed plan", b: "translate the plan into {x}", p: ["a labeled picture and sentence", "sentences matching the plan", "a draft following the plan", "a draft that develops each planned idea", "a draft elaborating on the plan", "a full draft that develops and extends the plan"], k: "smp" },
      { n: "Revising content", gr: [1, 5], c: "a completed draft and revision support", b: "revise by {x}", p: ["", "adding one detail", "adding and removing details", "adding, removing, and reordering ideas", "strengthening word choice and elaboration", "restructuring for clarity, elaboration, and style"], k: "smp" },
      { n: "Self-checklist use", c: "a task-appropriate checklist", b: "complete every checklist step {x}", p: ["with adult guidance", "with a picture checklist", "independently on short pieces", "independently before submitting", "independently, correcting found issues", "independently, tracking recurring errors"], k: "smp", m: "work sample review" },
      { n: "Using feedback", gr: [1, 5], c: "teacher or peer feedback on a draft", b: "apply the feedback by {x}", p: ["", "making one suggested change", "making suggested changes", "making changes and checking them", "prioritizing and applying feedback", "applying feedback and explaining how it improved the piece"], k: "smp" },
      { n: "Publishing final copies", c: "a revised draft", b: "produce a final copy that is {x}", p: ["displayed with their name", "neat and readable", "neat with corrections made", "complete, corrected, and formatted", "polished and formatted for the audience", "publication-ready in format and conventions"], k: "smp" },
      { n: "Rubric-based self-assessment", gr: [2, 5], c: "a grade-appropriate rubric", b: "self-assess and {x}", p: ["", "", "identify one strength and one goal", "score within one level of the teacher", "score accurately and set a revision goal", "score accurately, set goals, and track growth"], k: "smp" },
      { n: "Sustained work across sessions", gr: [1, 5], c: "a multi-day writing project", b: "resume and continue the same piece {x}", p: ["", "for 2 sessions", "for 3 sessions", "across sessions until complete", "across a week-long project", "across an extended project, managing each stage"], k: "opp" },
      { n: "Generating ideas", c: "idea-generation routines", b: "generate {x}", p: ["an idea by choosing from pictures", "2 ideas for a topic", "3 ideas and choose one", "topic ideas independently", "focused ideas suited to the prompt", "original angles on a prompt with supporting points"], k: "opp", m: "work sample review" },
    ],
    "Response & Real-World Writing": [
      { n: "Responding to reading", c: "a text and a response question", b: "compose {x}", p: ["a drawing about the story with a label", "a sentence about the story", "an answer with one text detail", "a response that restates and answers with evidence", "a RACE response with cited evidence", "a constructed response with two cited pieces of evidence and reasoning"], k: "smp" },
      { n: "Written summaries", gr: [1, 5], c: "a completed reading", b: "write {x}", p: ["", "one sentence about the topic", "a 2-sentence summary", "a summary of main idea and key details", "an objective summary in their own words", "a concise synthesis across sections or sources"], k: "smp" },
      { n: "Journals & personal writing", c: "a daily journal routine", b: "produce {x}", p: ["a drawing with a letter or word", "a sentence about their day", "2–3 sentences about experiences", "a detailed entry with feelings and events", "reflective entries with elaboration", "reflective entries analyzing experiences and ideas"], k: "day", m: "journal review" },
      { n: "Letters & emails", c: "a real audience and purpose", b: "compose {x}", p: ["a card with their name and a message word", "a note with a greeting and message", "a friendly letter with all parts", "a friendly letter or email for a purpose", "a formal letter or email with appropriate tone", "formal correspondence matched to audience and purpose"], k: "smp" },
      { n: "Note-taking", gr: [2, 5], c: "a source text or lesson", b: "record {x}", p: ["", "", "key words from a lesson", "main ideas in a simple format", "organized two-column notes", "organized notes they use to answer questions"], k: "opp", m: "work sample review" },
      { n: "Labeling & captions", gr: [0, 2], c: "diagrams, drawings, or photos", b: "write {x}", p: ["labels using letters or words", "labels for parts of a drawing", "captions that explain a picture", "", "", ""], k: "smp" },
      { n: "Research writing", gr: [2, 5], c: "sources and a research routine", b: "produce {x}", p: ["", "", "facts gathered from one source", "a report from 2 provided sources", "a report citing 2 sources", "a report synthesizing 3 sources with citations"], k: "smp" },
      { n: "Creative writing & poetry", c: "a creative prompt or model", b: "compose {x}", p: ["a shared-class story contribution", "a pattern poem or story sentence", "a short poem or story with a model", "a poem or story using sensory words", "creative pieces using figurative language", "creative pieces with deliberate craft choices"], k: "smp" },
      { n: "Content vocabulary in writing", c: "a content-area writing task", b: "correctly use {x}", p: ["one new theme word", "2 topic words", "3 domain words", "domain vocabulary in explanations", "domain vocabulary precisely", "technical vocabulary precisely and fluently"], k: "smp" },
    ],
    "Early & Emergent Writing": [
      { n: "Drawing to convey a message", gr: [0, 1], c: "a drawing prompt and materials", b: "create a drawing that conveys an idea and tell about it", k: "opp", m: "work sample review" },
      { n: "Dictating ideas", gr: [0, 1], c: "an adult scribe", b: "dictate {x}", p: ["a word or phrase about their drawing", "a complete sentence about their idea", "", "", "", ""], k: "opp", m: "work sample review" },
      { n: "Writing letters from dictation", gr: [0, 1], c: "dictated letter names or sounds", b: "write {x}", p: ["10 taught letters", "all letters from dictation", "", "", "", ""], k: "acc", m: "dictated probes" },
      { n: "Phonetic spelling", gr: [0, 2], c: "an unknown word they want to write", b: "represent {x}", p: ["the first sound with a letter", "beginning and ending sounds", "all sounds in sequence", "", "", ""], k: "smp" },
      { n: "Writing CVC words from sounds", gr: [0, 2], c: "dictated words and sound boxes as needed", b: "write {x}", p: ["the first letter of CVC words", "CVC words", "CVC and CCVC words", "", "", ""], k: "acc", m: "dictated probes" },
      { n: "Writing taught sight words", gr: [0, 2], c: "dictation or their own composing", b: "correctly write {x}", p: ["5 taught words", "25 high-frequency words", "50 high-frequency words", "", "", ""], k: "acc", m: "dictated probes" },
      { n: "Directionality in writing", gr: [0, 1], c: "lined or unlined paper", b: "write left to right and top to bottom with return sweep", k: "smp", m: "work sample review" },
      { n: "Rereading their own writing", gr: [0, 2], c: "their completed writing", b: "reread it {x}", p: ["pointing to each word", "to check that it makes sense", "to check meaning and fix one error", "", "", ""], k: "opp", m: "work sample review" },
      { n: "Shared & interactive writing", gr: [0, 1], c: "a shared writing routine", b: "contribute {x}", p: ["a letter or word to the class message", "a sentence to shared writing", "", "", "", ""], k: "opp" },
      { n: "Writing for real purposes", gr: [0, 2], c: "authentic writing tasks (lists, cards, signs)", b: "produce {x}", p: ["a card or sign with letters or a word", "a list or card with words", "a short functional text with sentences", "", "", ""], k: "smp" },
      { n: "Adding print to drawings", gr: [0, 1], c: "their own drawing", b: "add {x}", p: ["a letter or label", "a caption sentence", "", "", "", ""], k: "smp" },
      { n: "Concept of word in print", gr: [0, 1], c: "a familiar sentence or chart", b: "match spoken words to written words while pointing", k: "tr", m: "teacher-recorded probes" },
    ],
  },
  "Math": {
    "Counting & Number Sense": [
      { n: "Counting", c: "objects, number charts, or number lines", b: "count {x}", p: ["sets to 20 with one-to-one correspondence", "to 120 starting from any number", "by 2s, 5s, and 10s within 200", "within 1,000 including skip counting", "by multiples and factors within 100", "by fractions and decimals on a number line"] },
      { n: "Number identification & writing", c: "numerals presented in random order", b: "identify and write {x}", p: ["numerals 0–10", "numerals 0–120", "3-digit numerals", "numbers to 10,000 in standard and expanded form", "numbers to 1,000,000 in multiple forms", "decimals to thousandths in multiple forms"] },
      { n: "Comparing & ordering numbers", c: "sets or numerals to compare", b: "compare and order {x}", p: ["sets and numerals within 10", "numbers within 100", "3-digit numbers using <, >, =", "multi-digit numbers", "fractions with benchmarks and multi-digit numbers", "decimals and fractions"] },
      { n: "Place value", gr: [1, 5], c: "base-ten materials or place-value charts as needed", b: "represent and explain {x}", p: ["", "tens and ones in 2-digit numbers", "hundreds, tens, and ones", "place value to 10,000", "place value to 1,000,000", "decimal place value to thousandths"] },
      { n: "Rounding & estimation", gr: [2, 5], c: "numbers and real-world quantities", b: "round {x}", p: ["", "", "2-digit numbers to the nearest ten", "to the nearest ten and hundred", "multi-digit numbers to any place", "whole numbers and decimals to any place"] },
      { n: "Number line understanding", c: "labeled or open number lines", b: "locate and use {x}", p: ["positions to 10", "positions to 120", "jumps of 1s and 10s within 100", "whole numbers and unit fractions", "fractions and mixed numbers", "fractions and decimals"] },
      { n: "Number patterns", c: "pattern tasks and hundreds charts", b: "identify and extend {x}", p: ["repeating patterns with objects", "growing patterns and skip counts", "even and odd number patterns", "patterns in multiplication tables", "factor and multiple patterns", "numeric patterns and their rules"] },
      { n: "Subitizing", gr: [0, 1], c: "dot cards or quick images", b: "recognize {x} without counting", p: ["quantities to 5", "quantities to 6 in varied arrangements", "", "", "", ""], k: "tr" },
      { n: "More, less & number relationships", gr: [0, 1], c: "sets of objects and numerals", b: "identify {x}", p: ["which set has more or fewer", "one more and one less than a number", "", "", "", ""], k: "tr" },
    ],
    "Addition & Subtraction": [
      { n: "Concepts of addition & subtraction", c: "objects, drawings, or numbers", b: "add and subtract {x}", p: ["within 5 using objects", "within 10 with objects and drawings", "within 20 using strategies", "within 100 fluently", "multi-digit numbers fluently", "in multi-digit and decimal contexts"] },
      { n: "Fact fluency", c: "fact probes or flashcards", b: "answer {x} within 3 seconds", p: ["sums within 5", "facts within 10", "facts within 20", "facts within 20 with automaticity", "related facts and mental math within 100", "mental math with larger numbers and decimals"], m: "timed fact probes" },
      { n: "Multi-digit computation", gr: [1, 5], c: "written computation tasks with workspace supports as needed", b: "solve {x}", p: ["", "2-digit addition and subtraction without regrouping", "2-digit problems with regrouping", "3-digit problems with regrouping", "multi-digit problems fluently", "multi-digit and decimal problems fluently"] },
      { n: "Addition & subtraction word problems", c: "word problems read aloud as needed", b: "solve one- and two-step addition and subtraction problems {x}", p: "num" },
      { n: "Finding unknowns", c: "equations and problem situations", b: "find {x}", p: ["missing quantities within 5 with objects", "unknowns within 10", "unknowns in all positions within 20", "unknowns within 100", "unknowns using equations", "unknowns in equations with larger numbers and decimals"] },
      { n: "Mental math strategies", c: "mental math routines", b: "apply strategies ({x})", p: ["counting on from the larger number", "making ten and doubles", "adding tens and ones separately", "compensation and friendly numbers", "flexible strategies within 1,000", "flexible strategies with large numbers and decimals"] },
      { n: "Checking reasonableness", gr: [2, 5], c: "completed computation", b: "check answers using {x}", p: ["", "", "the inverse operation", "estimation and inverse operations", "estimation before and after solving", "estimation and error analysis"], k: "opp" },
      { n: "Counting on & counting back", gr: [0, 1], c: "a number line or counters", b: "count on and back {x}", p: ["within 10 to add and subtract 1 or 2", "within 20 to add and subtract", "", "", "", ""], k: "tr" },
      { n: "Modeling problems concretely", gr: [0, 1], c: "manipulatives and a story problem", b: "model and solve {x}", p: ["joining and separating stories within 5", "story problems within 10", "", "", "", ""], k: "tr" },
    ],
    "Multiplication, Division & Fractions": [
      { n: "Equal groups & comparison", c: "objects, arrays, or drawings", b: "represent {x}", p: ["sharing objects equally between 2 people", "equal groups with objects", "arrays and repeated addition", "multiplication as equal groups and arrays", "multiplicative comparisons", "rate and comparison situations"] },
      { n: "Multiplication facts", gr: [2, 5], c: "fact probes or flashcards", b: "answer multiplication facts for {x}", p: ["", "", "2s, 5s, and 10s", "facts 0–10", "facts 0–12 with automaticity", "facts applied within multi-digit computation"], m: "timed fact probes" },
      { n: "Division concepts", gr: [2, 5], c: "objects, arrays, or fact families", b: "solve {x}", p: ["", "", "sharing and grouping problems with objects", "division facts related to known multiplication facts", "division with 1-digit divisors including remainders", "division with 2-digit divisors, interpreting remainders"] },
      { n: "Fractions as parts of a whole", c: "shapes, sets, and number lines", b: "identify and represent {x}", p: ["halves as two equal shares", "halves and fourths of shapes", "halves, thirds, and fourths", "unit fractions and fractions on a number line", "equivalent fractions", "fraction and decimal equivalence"] },
      { n: "Comparing & operating with fractions", gr: [3, 5], c: "fraction models and number lines as needed", b: "{x}", p: ["", "", "", "compare fractions with the same numerator or denominator", "add and subtract fractions with like denominators", "add and subtract unlike denominators and multiply by whole numbers"] },
      { n: "Multi-digit multiplication", gr: [3, 5], c: "written computation with strategy supports as needed", b: "solve {x}", p: ["", "", "", "2-digit by 1-digit problems", "multi-digit by 1-digit and 2-digit by 2-digit problems", "multi-digit multiplication fluently"] },
      { n: "Dividing with remainders", gr: [3, 5], c: "division problems in and out of context", b: "solve {x}", p: ["", "", "", "basic division with and without remainders", "multi-digit division with 1-digit divisors", "multi-digit division, interpreting remainders in context"] },
      { n: "Doubles & halves", gr: [0, 1], c: "objects and drawings", b: "find {x}", p: ["doubles of quantities to 5", "doubles and halves within 20", "", "", "", ""], k: "tr" },
      { n: "Fair shares", gr: [0, 1], c: "objects to distribute", b: "share {x} equally", p: ["a set between 2 people", "sets among 2–4 people", "", "", "", ""], k: "tr" },
      { n: "Partitioning shapes", gr: [0, 2], c: "paper shapes or drawings", b: "partition shapes into {x}", p: ["two equal parts", "halves and fourths", "halves, thirds, and fourths, naming the parts", "", "", ""], k: "tr" },
    ],
    "Geometry & Spatial Reasoning": [
      { n: "Naming shapes", c: "2D and 3D shape examples", b: "name {x}", p: ["circles, squares, triangles, and rectangles", "2D shapes and common 3D solids", "shapes including pentagons and hexagons", "quadrilaterals by their attributes", "2D figures in a classification hierarchy", "2D and 3D figures by precise properties"] },
      { n: "Shape attributes", c: "shape examples and attribute language", b: "describe shapes by {x}", p: ["size and shape words", "number of sides and corners", "sides, vertices, and faces", "defining attributes of quadrilaterals", "angles and side relationships", "properties that classify figures hierarchically"] },
      { n: "Composing & decomposing shapes", c: "pattern blocks, tangrams, or drawings", b: "compose and decompose {x}", p: ["simple pictures from shapes", "new shapes from 2–3 shapes", "shapes into equal parts and new figures", "figures to find unknown areas", "figures into triangles and rectangles", "composite figures to solve problems"], k: "tr" },
      { n: "Comparing & classifying figures", c: "sets of 2D and 3D figures", b: "sort and classify figures by {x}", p: ["one attribute", "one or two attributes", "sides and vertices", "shared attributes across categories", "angle types and side lengths", "hierarchies of properties"], k: "tr" },
      { n: "Positional & spatial language", gr: [0, 2], c: "objects and position words", b: "follow and use {x}", p: ["above, below, next to", "position words including left and right", "spatial language to describe locations and directions", "", "", ""], k: "tr" },
      { n: "Angles & lines", gr: [2, 5], c: "figures and drawing tools", b: "identify and work with {x}", p: ["", "", "sides, corners, and edges of figures", "right angles and parallel sides", "angle types, and measure with a protractor", "angle relationships to solve problems"] },
      { n: "Symmetry & transformations", gr: [1, 5], c: "figures and grid paper", b: "identify {x}", p: ["", "shapes that match when folded", "lines of symmetry in simple shapes", "lines of symmetry in polygons", "symmetry and slides, flips, and turns", "transformations on a grid"], k: "tr" },
      { n: "Coordinate plane", gr: [4, 5], c: "a labeled coordinate grid", b: "{x}", p: ["", "", "", "", "plot and name points in the first quadrant", "graph points and interpret coordinate relationships"] },
      { n: "Sorting & classifying objects", gr: [0, 1], c: "collections of objects", b: "sort objects by {x}", p: ["one attribute (color, size, shape)", "two attributes, explaining the rule", "", "", "", ""], k: "tr" },
    ],
    "Measurement & Data": [
      { n: "Measuring length", c: "measurement tools appropriate to grade", b: "measure length {x}", p: ["by directly comparing two objects", "using nonstandard units", "to the nearest inch and centimeter", "to the nearest half inch", "to the nearest quarter inch", "converting among units within a system"] },
      { n: "Time", c: "analog and digital clocks and schedules", b: "tell and use time {x}", p: ["by sequencing daily events", "to the hour and half hour", "to the nearest 5 minutes", "to the minute, with elapsed time within the hour", "with elapsed time across hours", "solving schedule and conversion problems"] },
      { n: "Money", c: "coins, bills, and purchase scenarios", b: "{x}", p: ["identify pennies, nickels, dimes, and quarters", "identify coins and their values", "count mixed coins to $1.00", "count money and make change to $5.00", "solve money problems with decimal notation", "solve multi-step money and budget problems"] },
      { n: "Weight, capacity & volume", c: "measurement tools and containers", b: "{x}", p: ["compare objects as heavier or lighter", "compare and order by weight and capacity", "measure with appropriate units", "estimate and measure mass and liquid volume", "convert units and solve measurement problems", "find volume of rectangular prisms"] },
      { n: "Graphs & data interpretation", c: "grade-appropriate data displays", b: "read and interpret {x}", p: ["sorted groups of objects", "picture graphs", "bar graphs and picture graphs", "scaled bar graphs, answering comparison questions", "line plots including fractional units", "graphs, solving multi-step data problems"] },
      { n: "Creating data displays", gr: [1, 5], c: "a data set or survey results", b: "construct {x}", p: ["", "a picture graph with support", "a bar graph with labels", "a scaled bar graph", "a line plot with fractional units", "an appropriate display for the data"], k: "smp", m: "work sample review" },
      { n: "Area & perimeter", gr: [2, 5], c: "grid paper and figures with dimensions", b: "find {x}", p: ["", "", "area by counting unit squares", "area and perimeter of rectangles", "area and perimeter in real-world problems", "area of composite figures"] },
      { n: "Estimation with measurement", c: "everyday objects and benchmark referents", b: "estimate {x}", p: ["which object is longer or heavier", "lengths using nonstandard units", "lengths in inches and centimeters", "measurements using benchmarks", "measurements before verifying with tools", "measurements across units, checking precision"], k: "tr" },
      { n: "Ordering by size", gr: [0, 1], c: "sets of objects", b: "order {x}", p: ["3 objects by length or size", "several objects by length, height, or weight", "", "", "", ""], k: "tr" },
      { n: "Calendar skills", gr: [0, 2], c: "a classroom calendar", b: "{x}", p: ["name the days of the week in order", "identify today, yesterday, and tomorrow on the calendar", "use the calendar to answer date and duration questions", "", "", ""], k: "tr" },
    ],
    "Problem Solving & Reasoning": [
      { n: "One-step word problems", c: "word problems read aloud as needed", b: "solve one-step problems {x}", p: "num" },
      { n: "Two-step word problems", gr: [1, 5], c: "word problems with workspace supports", b: "solve two-step problems {x}", p: ["", "within 20", "within 100", "using all four operations", "with larger numbers", "with whole numbers, fractions, and decimals"] },
      { n: "Multi-step problems", gr: [3, 5], c: "multi-step problems with extraneous information", b: "solve {x}", p: ["", "", "", "multi-step problems, identifying needed information", "multi-step problems, checking reasonableness", "multi-step problems, explaining each step"] },
      { n: "Representing problems", c: "problem situations", b: "represent problems using {x}", p: ["objects and fingers", "drawings and number sentences", "equations with a symbol for the unknown", "equations and diagrams", "equations, tables, and diagrams", "equations and models, defining the unknown"] },
      { n: "Explaining mathematical reasoning", c: "solved problems and math discussions", b: "explain their thinking by {x}", p: ["showing with objects", "showing with drawings and words", "telling how they solved it in sentences", "writing an explanation of their strategy", "justifying their strategy and comparing approaches", "critiquing reasoning and justifying conclusions"], k: "opp", m: "work sample review" },
      { n: "Problem-solving vocabulary", c: "word problems and math discussions", b: "interpret {x}", p: ["more, fewer, and altogether", "words that signal joining and separating", "key words and what the question asks", "operation meanings without relying on key words alone", "problem structures across operations", "precise mathematical language across problem types"], k: "tr" },
      { n: "Estimating & checking answers", c: "problems before and after solving", b: "{x}", p: ["tell if an answer makes sense using objects", "predict about how many, then check", "estimate answers before solving", "estimate, solve, and compare to the estimate", "use rounding to evaluate reasonableness", "use estimation and inverse operations to verify"], k: "opp" },
      { n: "Acting out problems", gr: [0, 1], c: "story problems and props", b: "act out and solve {x}", p: ["story problems within 5", "story problems within 10", "", "", "", ""], k: "tr" },
      { n: "Choosing the operation", gr: [0, 2], c: "story problems", b: "choose whether to {x}", p: ["add or take away using objects", "add or subtract, then solve within 20", "add or subtract, then solve within 100", "", "", ""], k: "tr" },
    ],
    "Early Numeracy Foundations": [
      { n: "One-to-one correspondence", gr: [0, 1], c: "sets of objects", b: "count {x} touching each object once", p: ["sets to 10", "sets to 20", "", "", "", ""], k: "tr", m: "teacher-recorded probes" },
      { n: "Cardinality", gr: [0, 1], c: "counted sets", b: "state {x}", p: ["how many are in a set to 10 after counting", "how many without recounting when asked", "", "", "", ""], k: "tr" },
      { n: "Number formation", gr: [0, 2], c: "lined paper and models as needed", b: "legibly write {x}", p: ["numerals 0–10", "numerals 0–20 without reversals", "numerals to 120 without reversals", "", "", ""], k: "acc", m: "work sample review" },
      { n: "Counting on", gr: [0, 2], c: "a starting number and counters or a number line", b: "count on {x}", p: ["from a number within 10", "from any number within 30", "from any number within 120", "", "", ""], k: "tr" },
      { n: "Number bonds & part-part-whole", gr: [0, 2], c: "counters and number-bond frames", b: "show the parts that make {x}", p: ["numbers to 5", "numbers to 10", "numbers to 20", "", "", ""], k: "tr" },
      { n: "Comparing sets", gr: [0, 2], c: "two sets of objects or pictures", b: "identify {x}", p: ["more and fewer with objects", "more, fewer, and equal", "how many more or fewer", "", "", ""], k: "tr" },
      { n: "Ten frames & making ten", gr: [0, 2], c: "ten frames and counters", b: "{x}", p: ["build numbers to 10 on a ten frame", "make ten from a given number", "use making ten to add within 20", "", "", ""], k: "tr" },
      { n: "Ordinal numbers", gr: [0, 2], c: "lined-up objects or pictures", b: "identify positions {x}", p: ["first, second, third", "first through fifth", "first through tenth", "", "", ""], k: "tr" },
      { n: "Sorting & early classification", gr: [0, 1], c: "collections of objects", b: "sort and count {x}", p: ["objects into 2 groups by one attribute", "objects into categories, comparing counts", "", "", "", ""], k: "tr" },
      { n: "Repeating patterns", gr: [0, 1], c: "pattern materials", b: "copy, extend, and create {x}", p: ["AB patterns", "AB, ABB, and AAB patterns", "", "", "", ""], k: "tr" },
      { n: "Number words to numerals", gr: [0, 2], c: "spoken and written number words", b: "match number words to numerals {x}", p: ["to 10", "to 20", "to 120", "", "", ""], k: "tr" },
      { n: "Concrete math stories", gr: [0, 1], c: "story mats and manipulatives", b: "model {x}", p: ["simple joining stories within 5", "joining and separating stories within 10", "", "", "", ""], k: "tr" },
      { n: "Number talks participation", gr: [0, 2], c: "daily number-talk routines", b: "share {x}", p: ["an answer using objects or fingers", "an answer and how they got it", "a strategy and listen to others' strategies", "", "", ""], k: "opp", m: "teacher observation data" },
    ],
    "Pre-Algebra & Advanced Operations": [
      { n: "Order of operations", gr: [3, 5], c: "numerical expressions", b: "evaluate expressions {x}", p: ["", "", "", "with two operations", "with parentheses", "with parentheses, brackets, and all four operations"] },
      { n: "Writing & interpreting expressions", gr: [3, 5], c: "verbal and written descriptions", b: "{x}", p: ["", "", "", "write number sentences for situations", "write expressions for calculation descriptions", "write and interpret expressions without evaluating them"] },
      { n: "Factors & multiples", gr: [3, 5], c: "numbers within 100", b: "find {x}", p: ["", "", "", "factor pairs for numbers within 50", "factor pairs and multiples within 100", "common factors and multiples, identifying prime and composite"] },
      { n: "Decimal computation", gr: [3, 5], c: "decimal problems with place-value supports", b: "{x}", p: ["", "", "", "relate fractions with denominators 10 and 100 to decimals", "add and subtract decimals to hundredths", "compute with decimals in all four operations"] },
      { n: "Patterns & coordinate relationships", gr: [3, 5], c: "input-output tables and grids", b: "{x}", p: ["", "", "", "complete input-output tables and state the rule", "generate a pattern from a rule and identify features", "generate two patterns, form pairs, and graph them"] },
      { n: "Volume", gr: [3, 5], c: "unit cubes and rectangular prisms", b: "{x}", p: ["", "", "", "find area as a foundation for volume", "build and count unit cubes to find volume", "apply volume formulas to prisms and composite solids"] },
      { n: "Unit conversions", gr: [3, 5], c: "measurement equivalents and conversion tables", b: "convert {x}", p: ["", "", "", "between minutes and hours, inches and feet", "larger units to smaller within a system", "among units in a system, solving multi-step problems"] },
      { n: "Variables & simple equations", gr: [3, 5], c: "equations with an unknown", b: "solve for the unknown in {x}", p: ["", "", "", "equations with a symbol for the unknown", "one-step equations with a letter variable", "one- and two-step equations, checking solutions"] },
      { n: "Exponents & powers of ten", gr: [4, 5], c: "place-value patterns", b: "{x}", p: ["", "", "", "", "explain patterns when multiplying by 10", "use whole-number exponents to denote powers of 10"] },
    ],
  },
  "Communication": {
    "Speech Sound Production": [
      { n: "Target sounds in words", c: "picture stimuli and models as needed", b: "produce {x}", p: ["early developing sounds (p, b, m, w) in words", "target sounds in initial and final position", "target sounds in all word positions", "later developing sounds (r, s, l) in words", "target sounds in multisyllabic words", "all target sounds in complex words"], m: "SLP data collection" },
      { n: "Target sounds in sentences", c: "structured sentence tasks", b: "produce target sounds {x}", p: ["in 2–3 word phrases", "in short carrier phrases", "in simple sentences", "in self-generated sentences", "in longer sentences and reading tasks", "in complex sentences without cues"] },
      { n: "Conversational carryover", c: "conversation opportunities", b: "maintain target sound accuracy {x}", p: ["in structured play with an adult", "in structured conversation in therapy", "in spontaneous conversation in therapy", "in conversation in the classroom", "in conversation across school settings", "in all settings with unfamiliar listeners"] },
      { n: "Phonological process suppression", gr: [0, 2], c: "minimal-pair and cycles activities", b: "suppress targeted processes {x}", p: ["at the word level with models", "at the word and phrase level", "in connected speech", "", "", ""] },
      { n: "Complex clusters & sequences", gr: [3, 5], c: "words with consonant clusters", b: "accurately produce {x}", p: ["", "", "", "2-consonant clusters in words", "3-consonant clusters and multisyllabic sequences", "clusters and sequences in connected speech"] },
      { n: "Overall intelligibility", c: "conversation with varied listeners", b: "be understood {x}", p: ["by familiar listeners 70% of the time", "by familiar listeners 80% of the time", "by unfamiliar listeners 80% of the time", "by unfamiliar listeners 90% of the time", "in all settings at 90%+ intelligibility", "in all settings including presentations"], k: "opp", m: "SLP intelligibility ratings" },
      { n: "Self-monitoring speech", c: "structured and spontaneous speech", b: "identify and revise their own errors {x}", p: ["when the clinician signals an error", "on 50% of errors with a cue", "on most errors with intermittent cues", "independently on most errors", "independently across activities", "independently across settings"], k: "opp" },
      { n: "Clear-speech strategies", c: "speaking tasks and reminders as needed", b: "use clear-speech strategies ({x})", p: ["big mouth movements with models", "slow rate with visual cues", "slow rate and clear endings", "strategies during classroom speaking", "strategies across settings", "strategies automatically as needed"], k: "opp" },
      { n: "Multisyllabic word production", c: "grade-level vocabulary", b: "accurately produce {x}", p: ["2-syllable words", "2–3 syllable words", "3-syllable words", "3–4 syllable words including academic terms", "4+ syllable academic words", "complex academic vocabulary in connected speech"] },
    ],
    "Expressive Language": [
      { n: "Requesting", c: "natural and structured opportunities", b: "request items, actions, or help using {x}", p: ["single words, signs, or symbols", "2–3 word phrases", "complete sentences", "specific vocabulary in sentences", "polite, specific requests", "requests matched to listener and setting"] },
      { n: "Vocabulary use & naming", c: "pictures, objects, and discourse tasks", b: "name and use {x}", p: ["common objects and actions", "grade-level nouns, verbs, and adjectives", "category members and attributes", "curriculum vocabulary in sentences", "precise vocabulary across categories", "academic vocabulary in extended speaking"], k: "tr" },
      { n: "Sentence structure", c: "structured tasks and conversation", b: "produce {x}", p: ["2–3 word utterances", "4–5 word sentences with correct order", "complete simple sentences", "compound sentences with conjunctions", "complex sentences with clauses", "varied complex sentences in discourse"], k: "opp" },
      { n: "Grammatical morphemes", c: "structured tasks and conversation", b: "correctly use {x}", p: ["plural -s and present progressive -ing", "possessives and regular past tense", "irregular past tense and pronouns", "consistent verb tense and agreement", "advanced morphology including comparatives", "all grade-level morphology in discourse"] },
      { n: "Narrative & retell", c: "stories and personal experiences", b: "produce narratives including {x}", p: ["2 related events with prompts", "beginning, middle, and end", "character, setting, and sequenced events", "complete episodes with problem and solution", "cohesive narratives with transitions", "well-organized narratives with elaboration"], k: "opp", m: "narrative rubrics" },
      { n: "Describing & defining", c: "objects, pictures, and vocabulary items", b: "{x}", p: ["describe with one attribute", "describe with 2–3 attributes", "describe by category, function, and appearance", "define words including category and features", "define and compare related concepts", "give precise definitions using academic language"], k: "tr" },
      { n: "Asking questions", c: "natural and academic contexts", b: "ask {x}", p: ["single-word questions with rising intonation", "what and where questions", "grammatically correct wh- questions", "questions to gain information in class", "clarifying and follow-up questions", "purposeful questions across academic discussions"], k: "opp" },
      { n: "Word retrieval", c: "naming and discourse tasks", b: "retrieve target words {x}", p: ["with phonemic cues", "with semantic cues", "using a self-cueing strategy", "within 5 seconds in structured tasks", "efficiently in conversation", "efficiently in academic discourse"], k: "tr" },
      { n: "Oral contributions in class", c: "classroom discussions", b: "contribute {x}", p: ["a word or phrase when called on", "a sentence when called on", "a relevant sentence voluntarily", "relevant comments with detail", "elaborated contributions that build on others", "organized contributions across content areas"], k: "opp", m: "teacher observation data" },
    ],
    "Receptive Language": [
      { n: "Following directions", c: "verbal directions with repetition as needed", b: "follow {x}", p: ["1-step directions", "2-step related directions", "2-step directions with basic concepts", "3-step directions", "multi-step directions with temporal terms", "complex multi-step classroom directions"], k: "opp" },
      { n: "Answering wh- questions", c: "pictures, stories, and events", b: "answer {x}", p: ["who and what questions", "who, what, and where questions", "wh- questions including when", "why and how questions", "inferential wh- questions", "abstract and inferential questions with justification"], k: "tr" },
      { n: "Understanding concepts", c: "objects, pictures, and directions", b: "demonstrate understanding of {x}", p: ["basic spatial concepts (in, on, under)", "spatial and size concepts", "quantity and temporal concepts", "before/after and sequential concepts", "abstract relational concepts", "academic concepts across the curriculum"], k: "tr" },
      { n: "Identifying vocabulary", c: "picture arrays and real objects", b: "identify {x}", p: ["common objects from a field of 3", "objects and actions from a field of 4", "items by function and category", "items by attribute and association", "curriculum vocabulary by description", "academic terms by definition"], k: "tr" },
      { n: "Comprehending stories & lessons", c: "read-alouds and classroom lessons", b: "demonstrate comprehension by {x}", p: ["pointing to pictures about the story", "answering literal questions", "retelling key information", "answering literal and inferential questions", "summarizing key ideas from lessons", "synthesizing information across a lesson"], k: "opp" },
      { n: "Making verbal inferences", c: "scenarios, stories, and pictures", b: "make inferences about {x}", p: ["feelings from pictures", "what happens next", "why events happened", "characters' motivations", "implied meanings with evidence", "abstract implications across contexts"], k: "tr" },
      { n: "Categories & associations", c: "words and pictures", b: "identify {x}", p: ["items that go together", "category members", "the category and one more member", "associations and category relationships", "similarities and differences between concepts", "analogous relationships between concepts"], k: "tr" },
      { n: "Comprehension monitoring", c: "directions and instruction", b: "signal when they don't understand by {x}", p: ["responding to a comprehension check", "indicating yes or no when asked", "requesting repetition", "asking for repetition or rephrasing", "asking specific clarifying questions", "self-identifying and repairing comprehension gaps"], k: "opp" },
      { n: "Nonliteral language comprehension", gr: [2, 5], c: "conversation and texts", b: "interpret {x}", p: ["", "", "common expressions and jokes", "common idioms", "idioms, similes, and metaphors", "figurative language and sarcasm in context"], k: "tr" },
    ],
    "Social & Pragmatic Communication": [
      { n: "Greetings & initiation", c: "natural opportunities across the day", b: "greet and initiate interaction {x}", p: ["with an adult model", "with familiar adults and peers", "independently with peers", "appropriately for the person and setting", "flexibly across settings", "naturally, adjusting to context"], k: "opp" },
      { n: "Conversational turn-taking", c: "structured and natural conversations", b: "take turns {x}", p: ["in adult-supported exchanges of 2 turns", "for 2–3 turns without interrupting", "for 3–4 balanced turns", "for 4+ turns, responding to partner content", "with balanced participation in groups", "flexibly, managing interruptions and repairs"], k: "opp" },
      { n: "Topic maintenance & shift", c: "conversations with peers and adults", b: "{x}", p: ["respond on topic once", "stay on topic for 2 turns", "maintain a topic for 3–4 turns", "maintain and appropriately shift topics", "extend topics with questions and comments", "manage topics flexibly across partners"], k: "opp" },
      { n: "Nonverbal communication", c: "real interactions, photos, or video", b: "interpret and use {x}", p: ["pointing and gestures", "facial expressions for basic emotions", "body language and tone of voice", "nonverbal cues to adjust behavior", "subtle cues including sarcasm markers", "nonverbal signals across social contexts"], k: "tr" },
      { n: "Perspective taking", c: "social scenarios and real interactions", b: "identify {x}", p: ["how a peer feels with picture support", "others' feelings and a likely reason", "others' thoughts and feelings", "how their behavior affects others", "differing perspectives in a situation", "multiple perspectives, responding diplomatically"], k: "opp" },
      { n: "Communication repair", c: "communication breakdowns", b: "repair by {x}", p: ["repeating with a prompt", "repeating or gesturing", "rephrasing their message", "rephrasing or adding information", "selecting an effective repair strategy", "monitoring listeners and repairing proactively"], k: "opp" },
      { n: "Matching style to audience", c: "varied partners and settings", b: "adjust {x}", p: ["volume for inside and outside", "greetings for adults versus peers", "politeness for adults versus peers", "formality across settings", "vocabulary and tone for the audience", "register flexibly across audiences and purposes"], k: "opp" },
      { n: "Group discussion skills", c: "small-group and class discussions", b: "participate by {x}", p: ["staying with the group and attending", "responding when addressed", "contributing on topic once per discussion", "contributing and responding to peers", "building on others' ideas", "facilitating, inviting, and synthesizing ideas"], k: "opp", m: "teacher observation data" },
      { n: "Peer play & engagement", c: "play and cooperative activities", b: "engage in {x}", p: ["parallel play near peers", "associative play with sharing", "cooperative play with roles", "cooperative activities following group rules", "collaborative projects negotiating roles", "collaborative work resolving disagreements"], k: "opp" },
    ],
    "Fluency & Voice": [
      { n: "Fluency-enhancing strategies", c: "speaking tasks with cues as needed", b: "use strategies (easy onset, light contact) {x}", p: ["in single words with models", "in short phrases", "at the sentence level", "in structured conversation", "in spontaneous conversation", "across settings including presentations"], k: "opp" },
      { n: "Rate control", c: "speaking and reading tasks", b: "maintain an appropriate rate {x}", p: ["with pacing cues", "with visual reminders", "with intermittent cues", "independently in structured tasks", "independently in conversation", "independently across settings"], k: "opp" },
      { n: "Managing disfluent moments", c: "moments of stuttering", b: "ease out of disfluencies {x}", p: ["with clinician modeling", "with a verbal cue", "using one taught strategy with cues", "independently in therapy", "independently in classroom speaking", "independently across all settings"], k: "opp" },
      { n: "Vocal volume", c: "varied school settings", b: "use appropriate volume {x}", p: ["with a visual volume scale", "with one reminder per activity", "with no more than one daily reminder", "independently in the classroom", "independently across settings", "adjusting automatically to context"], k: "opp" },
      { n: "Healthy voice use", c: "voice routines and reminders", b: "{x}", p: ["identify loud versus easy voice", "identify vocally abusive behaviors", "use easy voice with reminders", "use healthy voice strategies independently", "self-monitor vocal quality", "maintain healthy voice across settings"], k: "opp", m: "SLP data collection" },
      { n: "Breath support & phrasing", c: "speaking tasks", b: "use appropriate breath support {x}", p: ["for single words", "for short phrases", "for full sentences", "for connected speech", "for extended speaking", "for presentations and reading aloud"], k: "opp" },
      { n: "Communication attitudes & participation", gr: [2, 5], c: "classroom speaking opportunities", b: "participate verbally {x}", p: ["", "", "in low-pressure small groups", "in small groups regularly", "in whole-class discussion", "in presentations and discussions comfortably"], k: "opp", m: "teacher and SLP data" },
      { n: "Self-advocacy about communication", gr: [2, 5], c: "communication situations", b: "{x}", p: ["", "", "tell a trusted adult what helps", "explain what helps their speech", "request supports (time, patience) as needed", "educate others and manage situations independently"], k: "opp" },
      { n: "Waiting for a speaking turn", gr: [0, 1], c: "group activities and a visual cue", b: "wait for their turn to speak {x}", p: ["with an adult cue", "with a visual reminder only", "", "", "", ""], k: "opp" },
    ],
    "AAC & Functional Communication": [
      { n: "Requesting with AAC", c: "aided language input and expectant pauses", b: "request using their system {x}", p: ["by selecting from 2–4 symbols", "with single symbols across activities", "independently across activities", "with peers and adults", "spontaneously across settings", "with unfamiliar partners independently"], k: "opp", m: "AAC data collection" },
      { n: "Multi-symbol messages", c: "their AAC system and modeling", b: "generate {x}", p: ["1-symbol messages by imitation", "2-symbol combinations", "2–3 symbol messages (agent-action-object)", "3–4 symbol messages with descriptors", "grammatically expanding messages", "sentence-level messages with grammar features"], k: "opp", m: "AAC data collection" },
      { n: "Communication functions", c: "daily routines and activities", b: "use their system to {x}", p: ["request and protest", "request, protest, and greet", "comment and answer questions", "share information and ask questions", "tell about past events and narrate", "converse across multiple functions"], k: "opp", m: "AAC data collection" },
      { n: "Device navigation", c: "their AAC system", b: "navigate {x}", p: ["to a preferred page with a gesture cue", "between 2 familiar pages", "across categories to find vocabulary", "efficiently within 10 seconds", "using search or word prediction", "fluently, personalizing vocabulary as needed"], k: "tr", m: "AAC data collection" },
      { n: "Partners & settings", c: "opportunities across the school day", b: "communicate with {x}", p: ["one familiar adult in one setting", "familiar adults in 2 settings", "adults and one peer across settings", "3+ partners including peers daily", "varied partners across all settings", "unfamiliar partners, repairing breakdowns"], k: "opp", m: "AAC data collection" },
      { n: "Repair with AAC", c: "communication breakdowns", b: "repair by {x}", p: ["re-selecting the symbol", "trying a second symbol", "rephrasing with different symbols", "adding information or spelling", "selecting the best repair strategy", "persisting flexibly until understood"], k: "opp" },
      { n: "Core vocabulary & literacy", c: "core word instruction and literacy routines", b: "use {x}", p: ["5 core words across activities", "10–20 core words", "core words in 2-word combinations", "core and fringe vocabulary flexibly", "spelling to supplement vocabulary", "spelling and word prediction for novel messages"], k: "opp", m: "AAC data collection" },
      { n: "Academic participation with AAC", c: "classroom instruction and pre-programmed supports", b: "participate by {x}", p: ["making choices during activities", "answering yes/no and choice questions", "answering curriculum questions", "contributing comments in lessons", "completing academic responses", "full participation including presentations"], k: "opp" },
      { n: "System responsibility", c: "daily routines", b: "{x}", p: ["keep their device nearby with reminders", "bring their device to activities with cues", "keep their system available all day", "charge and care for their system with reminders", "manage availability and care independently", "advocate for access and troubleshoot basic issues"], k: "day", m: "AAC data collection" },
    ],
  },
  "Behavior / SEL": {
    "Self-Regulation": [
      { n: "Identifying emotions", c: "check-ins and natural opportunities", b: "identify {x}", p: ["their emotion using a feelings chart", "their emotion by name", "their emotion and its intensity", "their emotion and its trigger", "emotions and early body signals", "emotions, triggers, and a matched response"] },
      { n: "Using calming strategies", c: "moments of frustration or overwhelm", b: "use a calming strategy {x}", p: ["with adult support", "with one verbal prompt", "with a visual cue only", "independently before escalating", "independently, returning to task within 10 minutes", "independently, returning to baseline within 5 minutes"] },
      { n: "Requesting a break", c: "access to a break system", b: "request a break appropriately {x}", p: ["with a break card and gesture prompt", "with a break card independently", "verbally or with a card before escalating", "independently, using the break appropriately", "independently, returning within 5 minutes", "rarely needing breaks, self-managing in place"] },
      { n: "Frustration tolerance", c: "difficult or non-preferred tasks", b: "{x}", p: ["begin the task after a first-then visual", "begin and continue for 2 minutes", "persist or ask for help without protest", "persist through difficulty calmly", "persist and try a second strategy", "manage frustration across tasks and settings"] },
      { n: "Managing transitions", c: "daily transitions with warnings as needed", b: "transition {x}", p: ["with a 2-minute warning and adult support", "with a visual schedule within 2 minutes", "with a class signal within 1 minute", "without disruptive behavior across the day", "including unpreferred transitions calmly", "flexibly, including unexpected changes"] },
      { n: "Body & voice regulation", c: "varied classroom activities", b: "match their {x}", p: ["voice level to a visual scale", "body and voice to the activity with cues", "body and voice to the activity with 1 reminder", "energy level to classroom expectations", "regulation across settings", "regulation automatically, self-correcting"] },
      { n: "Waiting", c: "structured and natural waiting situations", b: "wait {x}", p: ["30 seconds with a visual support", "1–2 minutes with a strategy", "for their turn without interrupting", "5+ minutes using self-management", "through delays calmly across settings", "through extended or uncertain waits appropriately"] },
      { n: "Impulse control", c: "instruction and group activities", b: "{x}", p: ["keep hands to self with visual reminders", "raise hand before speaking with cues", "raise hand and wait to be called on", "think before acting in 8 of 10 moments", "inhibit impulses across settings", "self-monitor impulses, repairing quickly when needed"] },
      { n: "Recovering from upsets", c: "upsetting moments in the school day", b: "return to expected behavior {x}", p: ["within 15 minutes with adult support", "within 10 minutes with support", "within 10 minutes with a cue", "within 5 minutes independently", "quickly, rejoining the activity", "quickly, repairing any impact independently"] },
    ],
    "On-Task Behavior & Engagement": [
      { n: "Task initiation", c: "assigned classwork", b: "begin within {x}", p: ["2 minutes with an individual prompt", "2 minutes with a visual cue", "1 minute with one prompt", "1 minute without prompts", "1 minute including non-preferred tasks", "30 seconds across all tasks"] },
      { n: "Sustained attention", c: "independent work periods", b: "remain on task for {x}", p: ["5 minutes with one redirection", "8 minutes with one redirection", "10 minutes with one redirection", "15 minutes without redirection", "20 minutes without redirection", "25+ minutes without redirection"], m: "interval observation data" },
      { n: "Work completion", c: "assigned classwork within class time", b: "complete {x}", p: ["50% of shortened assignments", "70% of assignments with supports", "80% of assignments", "85% of assignments at expected quality", "90% of assignments at expected quality", "95% of assignments, using extra time productively"], k: "day" },
      { n: "Remaining in assigned area", c: "instructional periods with movement breaks as needed", b: "remain in their area {x}", p: ["for 10-minute intervals with breaks", "for 15-minute intervals", "with no more than 1 reminder per period", "throughout instruction, requesting movement appropriately", "across all periods without reminders", "across all settings including assemblies"], m: "interval observation data" },
      { n: "Active participation", c: "whole-group and small-group lessons", b: "participate by {x}", p: ["attending to the speaker with cues", "responding to group prompts", "contributing once per lesson", "contributing relevant responses regularly", "volunteering and staying engaged throughout", "engaging fully across all instructional formats"] },
      { n: "Following along during instruction", c: "teacher-led lessons", b: "{x}", p: ["orient to the teacher with cues", "keep materials on the correct page with checks", "track the lesson with 1 reminder", "follow along independently", "follow along and take required actions promptly", "follow complex lessons, self-correcting when lost"] },
      { n: "Working near distractions", c: "typical classroom environments", b: "maintain work {x}", p: ["in a low-distraction area", "with a privacy support nearby", "in the regular seating area with cues", "despite ordinary distractions", "despite significant distractions", "in any reasonable environment"], m: "interval observation data" },
      { n: "Independent seatwork", c: "familiar independent tasks", b: "work independently for {x}", p: ["5 minutes with check-ins", "8 minutes with one check-in", "10 minutes before requesting help", "15 minutes, using help resources first", "20 minutes, managing obstacles", "a full work period without adult support"] },
      { n: "Task-to-reward independence", c: "work-then-preferred routines", b: "complete work before preferred activities {x}", p: ["with a first-then board", "with a visual token system", "with a delayed reward system", "with natural classroom schedules", "self-managing work-break balance", "without external reinforcement systems"], k: "day" },
    ],
    "Following Expectations": [
      { n: "Following adult directions", c: "directions from staff", b: "comply with {x}", p: ["1-step directions within 30 seconds with a cue", "1-step directions within 30 seconds", "2-step directions without additional prompts", "directions within 15 seconds across staff", "multi-step directions across settings", "all reasonable directions promptly, even when non-preferred"] },
      { n: "Following classroom rules", c: "posted classroom expectations", b: "follow expectations with {x}", p: ["no more than 3 reminders per day", "no more than 2 reminders per day", "no more than 1 reminder per day", "no reminders in 4 of 5 days", "no reminders across all classes", "no reminders, modeling expectations for peers"], k: "day" },
      { n: "Accepting no & feedback", c: "corrections and denied requests", b: "respond {x}", p: ["without aggression, with adult support", "calmly with a coping script", "calmly without arguing", "calmly, adjusting their behavior", "appropriately, applying the feedback", "gracefully across settings and adults"] },
      { n: "Safe body", c: "all school settings", b: "keep hands, feet, and objects to self {x}", p: ["during structured activities with reminders", "during structured activities", "across the classroom day", "across the day including transitions", "including unstructured times (recess, hallways)", "in all settings across a full grading period"], m: "incident and interval data" },
      { n: "Appropriate materials use", c: "classroom materials and technology", b: "use materials {x}", p: ["appropriately with modeling", "appropriately with reminders", "appropriately and return them", "for their intended purpose independently", "responsibly including technology", "responsibly, helping maintain shared materials"] },
      { n: "Expectations across settings", c: "hallways, cafeteria, and specials", b: "meet expectations {x}", p: ["with an adult nearby", "with a visual reminder", "with one reminder per setting", "independently in familiar settings", "independently in all settings", "independently, including new situations"], k: "day" },
      { n: "Honesty & ownership", c: "behavior incidents and daily interactions", b: "{x}", p: ["answer honestly when asked with support", "tell an accurate account when asked", "take ownership when involved", "take ownership without blaming others", "self-report incidents and accept outcomes", "take ownership and initiate making it right"] },
      { n: "Accepting help & correction on work", c: "academic support moments", b: "accept help {x}", p: ["without refusing, with a preferred adult", "from classroom staff calmly", "and attempt the suggested change", "and apply corrections willingly", "and use it to improve independently", "seeking it proactively when needed"] },
      { n: "Responding to their name & signals", gr: [0, 1], c: "adult attention-getting signals", b: "respond to {x}", p: ["their name within 5 seconds", "class signals within 5 seconds", "", "", "", ""], k: "tr" },
    ],
    "Social Skills": [
      { n: "Initiating peer interaction", c: "recess, centers, and free time", b: "initiate appropriately {x}", p: ["with an adult prompt and script", "with a scripted starter", "independently with familiar peers", "independently with varied peers", "and sustain the interaction", "across settings, reading peer receptiveness"] },
      { n: "Sharing & turn-taking", c: "cooperative activities and play", b: "share and take turns {x}", p: ["with adult mediation", "with a visual turn cue", "without adult mediation", "flexibly, including preferred items", "and invite others to join", "modeling fairness in groups"] },
      { n: "Cooperative group work", c: "assigned group tasks", b: "{x}", p: ["stay with the group for the activity", "complete an assigned role with support", "complete their role and share materials", "contribute ideas and accept others' input", "negotiate roles and resolve small conflicts", "collaborate flexibly, encouraging teammates"] },
      { n: "Perspective taking", c: "real and role-played situations", b: "identify {x}", p: ["how a peer feels with picture support", "others' feelings and a likely reason", "others' thoughts and feelings", "how their behavior affects others", "differing perspectives in a conflict", "multiple perspectives, adjusting their response"] },
      { n: "Conflict resolution", c: "peer conflicts", b: "{x}", p: ["get an adult instead of reacting physically", "use words or get help when upset with peers", "use a taught strategy (stop, talk, choose)", "resolve small conflicts with a strategy", "negotiate and compromise independently", "resolve conflicts and repair the relationship"] },
      { n: "Kind & respectful language", c: "interactions across the day", b: "use kind and respectful language {x}", p: ["with adult modeling and reminders", "with no more than 2 reminders daily", "with no more than 1 reminder daily", "consistently with peers and adults", "including during disagreements", "consistently, including giving compliments and encouragement"], k: "day" },
      { n: "Joining ongoing activities", c: "games and groups already underway", b: "join by {x}", p: ["approaching with adult support", "watching, then asking to join with a script", "asking to join appropriately", "reading the situation and joining smoothly", "joining and adapting to the group's rules", "joining varied groups and helping include others"] },
      { n: "Personal space & boundaries", c: "lines, carpet time, and play", b: "maintain appropriate personal space {x}", p: ["with visual boundary markers", "with gesture reminders", "with no more than 1 daily reminder", "independently across the classroom", "independently in all settings", "and respect others' stated boundaries consistently"] },
      { n: "Maintaining friendships", c: "ongoing peer relationships", b: "{x}", p: ["play near the same peers regularly", "play with a preferred peer cooperatively", "sustain play with peers across a week", "maintain friendly interactions across weeks", "maintain friendships through disagreements", "maintain reciprocal friendships, initiating repair when needed"], k: "day", m: "teacher observation data" },
    ],
    "Coping & Flexibility": [
      { n: "Accepting changes in routine", c: "planned and unplanned changes", b: "accept changes {x}", p: ["with advance notice and adult support", "with a change symbol on their schedule", "with brief verbal notice", "without notice, with one cue", "calmly without support", "flexibly, helping others adjust"] },
      { n: "Matching reaction to problem size", c: "problems that arise during the day", b: "{x}", p: ["rate the problem size with adult help", "rate the problem size accurately", "respond with a matched reaction with cues", "keep reactions proportionate independently", "keep reactions proportionate and recover quickly", "coach themselves through problems calmly"] },
      { n: "Positive self-talk", c: "challenging moments", b: "use {x}", p: ["a coping statement from a cue card", "a coping statement with a prompt", "positive self-talk independently", "self-talk to reframe and re-engage", "growth-oriented statements consistently", "flexible internal coping across situations"] },
      { n: "Asking for help appropriately", c: "moments of being stuck or overwhelmed", b: "{x}", p: ["signal for help with a help card", "ask for help instead of shutting down", "ask appropriately within 2 minutes", "try a strategy first, then ask specifically", "seek the right helper for the problem", "balance independence with well-timed help-seeking"] },
      { n: "Managing worry", c: "anxiety-provoking situations (tests, performances)", b: "{x}", p: ["participate with adult support and preparation", "use a coping plan with pre-teaching", "use a coping strategy with a cue", "use their coping plan independently", "anticipate stressors and apply strategies", "manage worry while maintaining full participation"] },
      { n: "Handling losing & competition", c: "games and competitive activities", b: "{x}", p: ["finish the game with adult support", "stay calm when losing with a script", "lose without disruptive behavior", "congratulate winners and stay engaged", "compete with good sportsmanship consistently", "model sportsmanship and encourage others"] },
      { n: "Trying new & hard things", c: "novel tasks and activities", b: "attempt {x}", p: ["a new task with adult support", "a new task after a model", "new tasks with one encouragement", "new tasks willingly", "challenging tasks with a positive approach", "challenges independently, viewing them as growth"] },
      { n: "Responding to mistakes", c: "errors in work and activities", b: "respond to mistakes by {x}", p: ["staying calm with adult support", "staying calm and hearing the correction", "correcting the error with support", "correcting errors and continuing", "treating errors as information and persisting", "analyzing errors and adjusting their approach"] },
      { n: "Using sensory strategies", c: "sensory needs across the day", b: "{x}", p: ["use offered sensory tools appropriately", "choose a sensory tool when offered", "request sensory supports when needed", "use sensory strategies proactively", "self-manage sensory needs discreetly", "self-regulate sensory needs across all settings"] },
    ],
    "Self-Monitoring & Reflection": [
      { n: "Self-rating behavior", c: "a self-monitoring system", b: "rate their behavior {x}", p: ["with an adult each period", "within 1 point of the adult rating", "matching adult ratings 80% of the time", "accurately with periodic checks", "accurately with weekly checks only", "accurately without a formal system"], k: "day", m: "self-monitoring data" },
      { n: "Setting behavior goals", c: "goal-setting routines", b: "{x}", p: ["choose a goal from 2 options with an adult", "state their goal and one strategy", "set a weekly goal and track it daily", "set, track, and review goals with staff", "set and adjust goals independently", "set meaningful goals and self-evaluate progress"], k: "day", m: "goal-tracking data" },
      { n: "Identifying triggers", c: "debriefs and check-ins", b: "identify {x}", p: ["what happened before an incident, with support", "the trigger of an incident in a debrief", "personal triggers during check-ins", "triggers and early warning signs", "triggers in advance of situations", "and prevent triggers with a self-managed plan"] },
      { n: "Using replacement behaviors", c: "situations that previously led to target behavior", b: "use their replacement behavior {x}", p: ["with a verbal prompt", "with a visual cue", "independently in 8 of 10 opportunities", "independently across the classroom", "independently across all settings", "automatically, reducing incidents below 1 per week"], m: "behavior incident data" },
      { n: "Repairing after incidents", c: "conflicts or behavior incidents", b: "{x}", p: ["complete a repair conversation with support", "complete a repair step with a script", "take responsibility and complete a repair step", "initiate an apology or restitution", "initiate repair and state what they'll do differently", "repair independently and follow through on changes"] },
      { n: "Check-in/check-out participation", c: "a daily check-in/check-out system", b: "{x}", p: ["attend check-ins with an escort", "attend check-ins independently", "attend and review their day honestly", "attend, reflect, and set a daily focus", "run their check-in with minimal adult input", "transition off the system, self-checking instead"], k: "day", m: "CICO data" },
      { n: "Reflecting on behavior", c: "reflection routines after activities", b: "reflect by {x}", p: ["choosing a face that shows how it went", "stating one thing that went well", "stating a success and a challenge", "completing a written reflection", "connecting choices to outcomes", "reflecting insightfully and planning adjustments"] },
      { n: "Tracking their own data", c: "a personal data-tracking tool", b: "{x}", p: ["place a token or mark with support", "mark their own chart with reminders", "track a target behavior accurately", "track and graph their progress", "track multiple goals and notice trends", "use their data to advocate in meetings"], k: "day", m: "self-monitoring data" },
      { n: "Generalizing across settings", c: "skills mastered in one setting", b: "demonstrate learned behavior skills {x}", p: ["in a second structured setting with support", "in a second setting with cues", "in 2 settings independently", "across most school settings", "across all school settings", "across school settings and reported home/community contexts"] },
    ],
  },
  "Executive Functioning": {
    "Organization": [
      { n: "Materials management", c: "daily classes and activities", b: "arrive with needed materials {x}", p: ["using a picture checklist with adult checks", "using a checklist with reminders", "using a checklist independently", "independently in 4 of 5 days", "independently across all classes", "anticipating and replacing missing items"], k: "day" },
      { n: "Personal storage systems", c: "desk, cubby, or binder", b: "maintain {x}", p: ["a cubby with a photo model", "a desk with weekly guided clean-outs", "an organized desk passing spot checks", "a binder with papers filed correctly", "an organization system across classes", "systems that let them find anything within a minute"], k: "day", m: "organization checks" },
      { n: "Workspace setup", c: "work sessions", b: "prepare their workspace by {x}", p: ["clearing it with a model", "gathering pictured materials", "gathering needed materials with a list", "setting up independently for the task", "setting up and resetting after work", "adapting setup efficiently to any task"] },
      { n: "Digital organization", c: "school devices and platforms", b: "{x}", p: ["log in with a visual support", "log in and open the right activity", "save work to the correct place", "maintain folders and find files within 2 minutes", "manage files and platforms across classes", "manage digital work efficiently, submitting to the right place"] },
      { n: "Home-school communication", c: "take-home folders and planners", b: "{x}", p: ["put papers in the folder with help", "bring the folder both ways daily", "deliver papers and return signed items", "manage the folder or planner independently", "communicate assignments and events home accurately", "manage all home-school logistics independently"], k: "day" },
      { n: "Managing a personal schedule", c: "daily schedules", b: "follow {x}", p: ["a 2-step picture schedule", "a picture schedule for the day", "a written daily schedule", "their schedule including specials and changes", "a weekly schedule independently", "schedule variations (assemblies, rotations) without support"], k: "day" },
      { n: "Cleaning up after tasks", c: "the end of activities", b: "clean up {x}", p: ["with step-by-step direction", "with the class cue and a model", "with the class cue only", "completely without reminders", "and check the area meets expectations", "and help restore shared spaces"] },
      { n: "Keeping track of belongings", c: "personal items across the day", b: "keep track of {x}", p: ["a single labeled item with checks", "coat and backpack with reminders", "personal items with 1 daily reminder", "all belongings independently", "belongings across settings and transitions", "belongings and loaned items, following up when misplaced"], k: "day" },
      { n: "Organizing ideas visually", c: "planning and thinking tools", b: "organize information using {x}", p: ["a 2-box sort with support", "picture webs with support", "simple graphic organizers", "organizers chosen from options", "self-selected organizers", "self-created organizational structures"], k: "smp", m: "work sample review" },
    ],
    "Planning & Prioritization": [
      { n: "Breaking down tasks", c: "multi-part assignments", b: "break tasks into {x}", p: ["2 steps with adult modeling", "first and next steps", "3 steps with a template", "steps in order independently", "steps with time estimates", "steps with self-set checkpoints for long-term work"], k: "smp", m: "work sample review" },
      { n: "Recording assignments", c: "a planner or agenda system", b: "record {x}", p: ["a picture of the day's home task", "the daily home task with a prompt", "assignments with an end-of-day prompt", "all assignments daily without prompts", "assignments and due dates across classes", "assignments, events, and study plans"], k: "day", m: "planner checks" },
      { n: "Prioritizing", c: "multiple tasks or choices", b: "prioritize by {x}", p: ["doing the first-then order given", "choosing which of 2 tasks comes first, with reasons", "ordering 3 tasks by importance with support", "ordering tasks by due date and importance", "working their priority order independently", "re-prioritizing as new demands arise"] },
      { n: "Estimating time", c: "familiar tasks", b: "estimate how long tasks take {x}", p: ["choosing quick or long with support", "within 10 minutes of actual for short tasks", "within 5 minutes for familiar tasks", "within 25% of actual time", "and build a work plan from estimates", "accurately across a full day or week of tasks"], k: "smp" },
      { n: "Planning multi-day work", c: "projects with future due dates", b: "{x}", p: ["complete teacher-set daily parts", "complete checkpoints marked on a calendar", "set 2 checkpoints with support and meet them", "create a simple timeline and follow it", "create timelines with milestones, meeting 80%", "manage long-term projects across classes independently"], k: "smp" },
      { n: "Gathering before starting", c: "the start of tasks", b: "gather everything needed {x}", p: ["from a picture list", "from a materials list", "by previewing the task with a cue", "by previewing the task independently", "efficiently for multi-step tasks", "for complex tasks, anticipating needs"] },
      { n: "Making a plan before acting", c: "open-ended tasks", b: "state or write a plan {x}", p: ["choosing between 2 offered plans", "telling their first step", "telling their steps before starting", "writing a brief plan independently", "planning with alternatives in mind", "planning strategically, adjusting as needed"] },
      { n: "Sequencing steps", c: "familiar routines and new tasks", b: "sequence {x}", p: ["3 picture steps of a routine", "steps of familiar routines", "steps of a new task with support", "steps of new tasks independently", "steps efficiently, spotting missing steps", "complex sequences, optimizing the order"], k: "tr" },
      { n: "Adjusting plans", c: "plans that hit obstacles", b: "{x}", p: ["accept an adult's plan change", "accept a change and continue", "identify that a plan isn't working, with support", "adjust their plan with a cue", "adjust plans independently", "revise plans proactively before problems grow"] },
    ],
    "Time Management": [
      { n: "On-time transitions", c: "class transitions and arrivals", b: "arrive on time {x}", p: ["with an escort or buddy", "with a transition warning", "with a posted schedule cue", "independently in 9 of 10 transitions", "independently including specials and lunch", "independently all day, every day"], k: "day" },
      { n: "Pacing work", c: "timed tasks", b: "pace themselves by {x}", p: ["working until a visual timer ends", "reaching a marked halfway point on time", "checking a timer at checkpoints", "finishing within the allotted time", "adjusting speed to finish with time to check", "self-pacing across varied task types"], k: "smp" },
      { n: "Meeting deadlines", c: "assignments with due dates", b: "submit on time {x}", p: ["daily tasks with same-day reminders", "with reminders the day before", "in 80% of opportunities with one reminder", "in 85% of opportunities independently", "in 95% of opportunities", "consistently, requesting extensions in advance when needed"], k: "day", m: "assignment records" },
      { n: "Completing routines on time", c: "arrival, packing, and dismissal routines", b: "complete routines {x}", p: ["with step-by-step support", "with a picture schedule in the expected time", "with one reminder in the expected time", "independently in the expected time", "independently with time to spare", "efficiently, helping peers when done"], k: "day" },
      { n: "Homework routines", c: "assigned homework", b: "{x}", p: ["return a signed folder daily", "complete a short daily task with family support", "complete and return homework 3 of 5 days", "complete and return homework 4 of 5 days", "follow a homework schedule independently", "manage homework and study time across subjects"], k: "day", m: "homework records" },
      { n: "Using timers & time tools", c: "clocks, timers, and schedules", b: "use time tools by {x}", p: ["responding when a timer ends", "starting and stopping with a visual timer", "setting a timer for a task with support", "setting timers to manage their own tasks", "using clocks to self-monitor progress", "managing time flexibly with minimal tools"] },
      { n: "Time awareness", c: "the daily schedule", b: "{x}", p: ["identify what comes next in the day", "identify the time of daily events", "check the clock at natural checkpoints", "track how long tasks actually take", "notice and respond to time remaining", "maintain accurate time awareness across the day"] },
      { n: "Managing free & unstructured time", c: "recess, choice time, and early finishes", b: "use unstructured time by {x}", p: ["choosing from 2 offered activities", "choosing and staying with an activity", "choosing appropriate activities independently", "using early-finish time productively", "balancing preferred and needed activities", "planning their unstructured time purposefully"] },
      { n: "Preparedness at start of work", c: "the beginning of lessons", b: "be ready to work {x}", p: ["within 2 minutes with support", "within 2 minutes with a class cue", "within 1 minute with a class cue", "within 1 minute independently", "immediately, with materials out", "immediately, previewing the task while waiting"], k: "day" },
    ],
    "Attention & Working Memory": [
      { n: "Retaining directions", c: "verbal directions", b: "carry out {x}", p: ["1-step directions after a repeat", "2-step directions", "2-step directions after repeating them back", "3-step directions", "multi-step directions using a self-strategy", "complex directions across a delay"], k: "tr" },
      { n: "Using checklists", c: "task checklists", b: "{x}", p: ["complete pictured steps with prompts", "check off each step with reminders", "use provided checklists independently", "use checklists on multi-step tasks accurately", "create simple checklists for themselves", "create and use checklists across contexts"], k: "smp" },
      { n: "Managing distractions", c: "typical classroom distractions", b: "{x}", p: ["return to task within 1 minute of redirection", "return within 30 seconds of a signal", "return within 30 seconds independently", "use a strategy to stay on task", "identify their distractors and choose supports", "sustain focus in any reasonable environment"], m: "interval observation data" },
      { n: "Note & memory supports", c: "lessons and instructions", b: "use supports by {x}", p: ["keeping a picture cue on their desk", "using provided visual reminders", "completing guided notes with blanks", "taking simple notes of key points", "choosing and using a note format", "using notes and memory strategies fluidly"], k: "smp" },
      { n: "Refocusing independently", c: "moments of drifting attention", b: "refocus {x}", p: ["with a verbal prompt", "with a nonverbal signal", "with a private visual cue", "using a self-strategy when they notice", "quickly, with a private self-check system", "automatically, maintaining task momentum"], m: "interval observation data" },
      { n: "Remembering routines", c: "daily and weekly routines", b: "carry out routines {x}", p: ["with step-by-step prompts", "with a picture sequence", "with an initial reminder only", "from memory with occasional checks", "from memory including weekly variations", "from memory, adapting when routines change"], k: "day" },
      { n: "Holding information while working", c: "multi-part academic tasks", b: "{x}", p: ["match to a visible model", "keep 2 things in mind with a visual anchor", "hold the goal in mind through a short task", "hold multiple steps in mind while working", "juggle task requirements without losing the goal", "manage complex tasks, offloading strategically to paper"], k: "smp" },
      { n: "Following along in lessons", c: "read-alouds and shared work", b: "keep their place {x}", p: ["with a tracking tool and support", "with a tracking tool", "with occasional checks", "independently through a lesson", "independently, catching up quickly if lost", "independently across long or complex lessons"] },
      { n: "Rehearsal & memory strategies", c: "information to remember", b: "use strategies by {x}", p: ["repeating information with a prompt", "repeating information to themselves", "using a taught strategy with a cue", "choosing repetition, chunking, or writing it down", "matching the strategy to the material", "using memory strategies flexibly across subjects"], k: "tr" },
    ],
    "Task Initiation & Completion": [
      { n: "Starting promptly", c: "assigned tasks", b: "begin within {x}", p: ["2 minutes with a private prompt", "2 minutes with a visual cue", "1 minute with one prompt", "1 minute without prompts", "1 minute including non-preferred tasks", "30 seconds across all task types"] },
      { n: "Persisting through difficulty", c: "challenging tasks", b: "{x}", p: ["continue 2 more minutes with encouragement", "continue 5 more minutes or ask for help", "persist or seek help rather than stopping", "persist using one self-strategy", "persist using multiple strategies", "persist through extended challenges to quality completion"] },
      { n: "Submitting work", c: "completed assignments", b: "turn in work {x}", p: ["when handed the tray with support", "with an end-of-class reminder", "to the correct place without reminders", "on time in 85% of opportunities", "tracking their own completion status", "resolving missing work within 2 days on their own"], k: "day", m: "assignment records" },
      { n: "Asking clarifying questions", c: "unclear directions or tasks", b: "{x}", p: ["indicate confusion with a card or signal", "ask for help when confused", "ask a question before starting when unclear", "ask specific clarifying questions", "monitor understanding and ask at good moments", "clarify proactively, restating expectations back"] },
      { n: "Working with fading prompts", c: "routine tasks with a prompt hierarchy", b: "complete tasks with {x}", p: ["partial physical or model prompts", "gestural prompts only", "one verbal prompt per task", "no more than 1 prompt across tasks", "independence on all routine tasks", "full independence including novel tasks"], k: "day" },
      { n: "Finishing to criteria", c: "quality expectations for work", b: "complete work that {x}", p: ["has all parts attempted, with checks", "meets a 2-item quality checklist", "meets the stated criteria with a reminder", "meets criteria checked before submitting", "meets criteria consistently", "exceeds criteria, self-correcting before submission"], k: "smp" },
      { n: "Transitioning between tasks", c: "multi-task work periods", b: "move to the next task {x}", p: ["with adult direction each time", "with a visual list and prompts", "using a task list with one reminder", "using their list independently", "smoothly, without losing work time", "seamlessly, sequencing tasks themselves"] },
      { n: "Managing multi-part assignments", c: "assignments with several components", b: "{x}", p: ["complete one part at a time as given", "complete 2 parts with a checklist", "track parts with a checklist independently", "complete all parts in a logical order", "manage parts across multiple days", "manage complex assignments, verifying completeness"], k: "smp" },
      { n: "Restarting after interruptions", c: "interrupted work sessions", b: "resume work {x}", p: ["with adult redirection", "with a visual reminder of the task", "within 1 minute with a cue", "within 1 minute independently", "quickly, recalling where they left off", "seamlessly, using self-created placeholders"] },
    ],
    "Independence & Self-Advocacy": [
      { n: "Requesting help & accommodations", c: "moments of need", b: "{x}", p: ["signal for help with a card", "raise their hand and ask for help", "ask for specific help", "request their accommodations when needed", "explain what helps and arrange it with teachers", "advocate for supports across settings proactively"] },
      { n: "Communicating needs", c: "check-ins and natural moments", b: "communicate {x}", p: ["a choice between 2 options", "what they need using words or symbols", "what is hard and what helps, when asked", "learning needs to familiar adults", "needs to any staff member appropriately", "needs proactively before problems grow"] },
      { n: "Self-assessing work", c: "completed work and simple criteria", b: "{x}", p: ["point to their best part", "tell one thing done well and one to fix", "check work against a 2-item list", "self-assess against criteria and fix one thing", "self-assess within one level of the teacher", "self-assess accurately and set improvement goals"], k: "smp" },
      { n: "Participating in goal setting", c: "conferences and IEP-related discussions", b: "{x}", p: ["share a favorite activity and something hard", "share a strength and something to work on", "help choose between 2 goal options", "state their goals and why they matter", "report progress on their goals with data", "contribute meaningfully to planning their supports"], k: "opp", m: "conference records" },
      { n: "Solving problems independently", c: "everyday obstacles (missing materials, minor conflicts)", b: "{x}", p: ["choose a solution from 2 offered", "try one taught solution before seeking help", "state the problem and one option", "identify options, choose one, and act", "solve routine problems without adult help", "solve novel problems, seeking the right resource"] },
      { n: "Making choices & decisions", c: "structured choice opportunities", b: "make choices by {x}", p: ["selecting between 2 concrete options", "selecting among 3–4 options", "choosing and sticking with a choice", "choosing with a reason", "weighing options against their goal", "making and owning decisions, adjusting when warranted"], k: "opp" },
      { n: "Personal responsibility", c: "daily personal tasks", b: "manage {x}", p: ["one daily job with reminders", "personal belongings and one job", "personal tasks with a morning reminder", "personal tasks independently", "personal tasks and commitments reliably", "responsibilities reliably, anticipating what's needed"], k: "day" },
      { n: "Trying before asking", c: "independent work", b: "{x}", p: ["attempt one item before requesting help", "attempt the task for 2 minutes first", "use one resource (example, notes) before asking", "use 2 resources before asking", "exhaust reasonable strategies before asking", "calibrate well between persistence and help-seeking"] },
      { n: "Reflecting on strategies", c: "completed tasks and routines", b: "{x}", p: ["show or tell what they used to finish", "name the strategy they used", "tell whether their strategy worked", "identify what worked and what didn't", "compare strategies and pick the better one", "refine their personal strategy toolkit over time"], k: "opp" },
    ],
  },
};
// ==DATA-END==

// ── TEKS-ALIGNED EXPANSION ───────────────────────────────────
// New skills aligned to the Texas Essential Knowledge & Skills:
// ELAR strands (oral language, comprehension, response, genres,
// author's purpose & craft, composition, inquiry & research) and
// Math strands (algebraic reasoning, data analysis, personal
// financial literacy, mathematical process standards), plus
// TEKS-informed additions across all subjects.
const TEKS_SKILLS = {
  "Reading": {
    "Oral Language & Discussion (TEKS)": [
      { n: "Active listening", c: "oral instruction or a partner's sharing", b: "demonstrate active listening by {x}", p: ["looking at the speaker and staying quiet", "restating one thing the speaker said", "asking a relevant follow-up question", "summarizing the speaker's main point", "paraphrasing the speaker's message and adding a comment", "summarizing multiple speakers' points in a discussion"], k: "opp", m: "teacher observation data" },
      { n: "Restating oral directions", c: "orally delivered directions", b: "restate the directions in order before beginning {x}", p: ["a 1-step direction", "a 2-step direction", "a 2-step direction with details", "a 3-step direction", "a 3-step direction with academic terms", "multi-step directions with qualifiers"], k: "opp", m: "teacher observation data" },
      { n: "Speaking clearly & audibly", c: "a structured share or class discussion", b: "share information and ideas by speaking audibly in {x}", p: ["simple complete sentences", "complete sentences", "complete sentences with details", "organized sentences using the conventions of language", "organized remarks with supporting details", "organized remarks with facts and relevant details"], k: "opp", m: "teacher observation data" },
      { n: "Collaborative discussion", c: "a small-group academic discussion", b: "work collaboratively by {x}", p: ["taking turns speaking", "listening to others and taking turns", "building on a peer's idea", "following discussion rules and building on others' ideas", "posing and answering questions about the topic", "elaborating on others' ideas and citing the text"], k: "opp", m: "teacher observation data" },
      { n: "Asking & answering questions orally", c: "a class topic or text discussion", b: "ask and answer {x} about the topic or text", p: ["simple who and what questions", "who, what, and where questions", "questions in complete sentences", "open-ended questions", "clarifying and probing questions", "analytical questions supported by the text"], k: "tr", m: "teacher observation data" },
      { n: "Oral presentation", c: "a prepared topic and visual support", b: "give an organized oral presentation {x}", p: ["of 2–3 sentences about a familiar topic", "of 3–4 sentences with a beginning and end", "with a clear beginning, middle, and end", "that organizes facts in a logical order", "with an introduction, supporting details, and conclusion", "employing appropriate eye contact, rate, and volume"], k: "smp", m: "rubric-scored presentations" },
    ],
    "Metacognitive Comprehension (TEKS)": [
      { n: "Predicting & confirming", c: "{q} with planned stopping points", q: "story", b: "make a prediction, read or listen on, and confirm or revise it", k: "opp" },
      { n: "Generating questions", c: "{q} before, during, and after reading", q: "txt", b: "generate {x} about the text", p: ["one question", "who, what, and where questions", "literal and simple inferential questions", "questions that deepen understanding", "inferential questions answered with evidence", "synthesis questions across sections of text"], k: "tr" },
      { n: "Creating mental images", c: "{q} read aloud or independently", q: "story", b: "describe the mental images the text creates and connect them to {x}", p: ["the pictures", "key words in the text", "story events", "deeper understanding of the text", "understanding of characters and setting", "understanding of meaning and mood"], k: "opp" },
      { n: "Monitoring & adjusting", c: "{q} at instructional level", q: "txt", b: "notice when understanding breaks down and apply a fix-up strategy such as {x}", p: ["asking for help", "re-reading", "re-reading or using picture clues", "re-reading, checking context, or reading on", "annotating and re-reading", "adjusting rate and re-reading strategically"], k: "opp" },
      { n: "Making connections", c: "{q}", q: "story", b: "make and explain {x} connection to the text", p: ["a personal", "a personal", "a text-to-self or text-to-text", "a text-to-self, text-to-text, or text-to-world", "a relevant connection that deepens comprehension of the", "a connection to other texts and society that interprets the"], k: "opp" },
      { n: "Summarizing & synthesizing", c: "{q}", q: "txt", b: "{x}", p: ["retell the important events in order", "retell the text including key details", "summarize the text in own words", "summarize the text maintaining meaning and logical order", "summarize and synthesize information within a text", "synthesize information across two related texts"], k: "opp" },
    ],
    "Response & Text Evidence (TEKS)": [
      { n: "Answering with text evidence", c: "{q} and comprehension questions", q: "txt", b: "answer questions {x}", p: ["by pointing to or naming the part of the book", "using details from the text", "using text evidence", "citing text evidence", "citing specific text evidence with explanation", "citing multiple pieces of evidence with analysis"] },
      { n: "Paraphrasing text", c: "{q}", q: "info", b: "paraphrase a section of the text {x}", p: ["by telling it in own words with picture support", "in own words", "in own words maintaining meaning", "maintaining meaning and logical order", "maintaining meaning, order, and key vocabulary", "concisely without copying the author's words"], k: "opp" },
      { n: "Written response to reading", c: "{q} and a response prompt", q: "txt", b: "write a response that {x}", p: ["uses a drawing and a label about the text", "states an idea about the text", "states an idea with one text detail", "demonstrates understanding with text evidence", "analyzes the text with supporting evidence", "interprets and evaluates the text with evidence"], k: "smp", m: "rubric-scored responses" },
      { n: "Annotating while reading", c: "{q} and annotation tools", q: "txt", b: "mark or note {x} while reading", p: ["favorite parts with a flag or sticker", "unknown words and favorite parts", "unknown words and important ideas", "key ideas and confusing parts", "evidence, questions, and key ideas", "claims, evidence, and author's craft moves"], k: "opp" },
      { n: "Responding & recommending", c: "a completed text and a discussion partner", b: "share a response to the text by {x}", p: ["telling a favorite part and why", "describing a favorite part with a reason", "recommending the book with two reasons", "supporting an opinion of the text with evidence", "comparing responses with a peer using evidence", "defending an interpretation using text evidence"], k: "opp", m: "teacher observation data" },
      { n: "Using new vocabulary in response", c: "{q} and follow-up discussion or writing", q: "txt", b: "use {x} from the text when responding", p: ["one new word", "new story words", "new vocabulary words", "academic vocabulary", "academic and content-area vocabulary", "precise academic vocabulary"], k: "opp" },
    ],
    "Author's Purpose & Craft (TEKS)": [
      { n: "Author's purpose", c: "{q}", q: "txt", b: "identify the author's purpose {x}", p: ["as telling a story or giving facts", "as entertaining or informing", "as persuading, informing, or entertaining", "and explain how the text shows it", "and analyze how the author's craft supports it", "and analyze purpose and message across texts"], k: "tr" },
      { n: "Text structure", c: "{q}", q: "info", b: "identify the text's organizational pattern {x}", p: ["as beginning, middle, and end", "as a sequence of events", "as sequence or description", "as description, sequence, or compare and contrast", "as cause/effect, problem/solution, or compare/contrast", "and explain how the structure contributes to meaning"], k: "tr" },
      { n: "Graphic & print features", c: "{q}", q: "info", b: "use {x} to gain information", p: ["pictures and labels", "titles, pictures, and bold words", "headings, captions, and diagrams", "maps, charts, and sidebars", "multiple graphic features across a text", "graphic and print features to locate and evaluate information"], k: "tr" },
      { n: "Narrator & point of view", c: "{q}", q: "story", b: "identify {x}", p: ["who is telling the story, with support", "who is telling the story", "whether the narrator is a character in the story", "the narrator's point of view", "how point of view shapes what readers know", "differences between narrator and character perspectives"], k: "tr" },
      { n: "Literary devices & figurative language", c: "{q} or grade-appropriate poems", q: "story", b: "identify and explain {x}", p: ["repeated words and sounds", "rhyme and repetition", "sensory words and sound devices", "similes and sound devices", "similes, metaphors, and imagery", "figurative language including personification and hyperbole"], k: "tr" },
      { n: "Genre characteristics", c: "a set of grade-appropriate texts", b: "identify the genre and its characteristics for {x}", p: ["stories and information books", "stories, poems, and information books", "fiction, poetry, and informational text", "realistic fiction, fables, poetry, and expository text", "fiction genres, drama, poetry, and persuasive text", "multiple genres including drama, argumentative, and multimodal texts"], k: "tr" },
    ],
  },
  "Writing": {
    "TEKS Genres": [
      { n: "Personal narrative", c: "a prompt and planning support", b: "compose a personal narrative {x}", p: ["using a drawing with dictated or written words", "with a beginning and end about a real event", "that sequences a real event with details", "with a clear sequence and concrete details", "with dialogue and descriptive details", "that develops a real experience with craft and reflection"] },
      { n: "Informational text", c: "a topic and planning support", b: "compose an informational piece {x}", p: ["by drawing and labeling facts", "stating facts about a topic", "with a topic sentence and facts", "with a central idea, supporting facts, and a closing", "organized with a central idea, details, and structure", "with genre characteristics and accurately used facts"] },
      { n: "Opinion & argument", c: "a prompt and planning support", b: "compose an opinion piece {x}", p: ["stating a preference with a drawing", "stating an opinion with one reason", "with an opinion and supporting reasons", "with an opinion, reasons, and examples", "with a clear stance, ordered reasons, and evidence", "that addresses a counterpoint with evidence"] },
      { n: "Poetry writing", c: "models and a planning frame", b: "compose {x}", p: ["a contribution to a shared class poem", "a simple poem using rhyme or a pattern", "a poem using rhyme, rhythm, or repetition", "a poem using sound devices and imagery", "poems using figurative language", "original poetry employing poetic techniques"] },
      { n: "Correspondence", c: "a real audience and purpose", b: "compose {x}", p: ["a card with a drawing and their name", "a thank-you note with a complete sentence", "a friendly letter with a greeting and closing", "a friendly letter with all letter parts", "informal and formal letters for real purposes", "correspondence matched to audience, purpose, and format"] },
      { n: "Procedural writing", c: "a familiar task or process", b: "compose a procedural text that {x}", p: ["shows the steps in pictures", "lists 2–3 steps in order", "explains steps with transition words", "explains steps with materials and transitions", "includes precise steps, materials, and visuals", "anticipates reader questions with precise, complete steps"] },
    ],
    "Inquiry & Research (TEKS)": [
      { n: "Generating research questions", c: "a topic study and teacher modeling", b: "generate {x}", p: ["a wondering about the topic", "questions about a topic, with support", "questions about a self-selected topic", "focused research questions", "research questions that can guide inquiry", "open-ended research questions refined during inquiry"], k: "opp", m: "teacher observation data" },
      { n: "Gathering information", c: "an inquiry task", b: "gather information from {x}", p: ["a book read aloud", "one provided source", "two provided sources", "provided print and digital sources", "relevant print and digital sources", "primary and secondary sources"], k: "opp", m: "teacher observation data" },
      { n: "Note-taking from sources", c: "sources and a note-taking format", b: "record information by {x}", p: ["drawing and labeling one fact", "writing one fact from the source", "writing facts in own words", "taking simple notes in own words", "taking organized notes with source titles", "taking categorized notes without plagiarizing"] },
      { n: "Judging relevance", c: "gathered information and a research question", b: "sort information as {x}", p: ["about the topic or not about the topic", "on-topic or off-topic", "relevant or not relevant to the question", "relevant to the research question, with reasons", "relevant and reliable for the purpose", "credible, relevant, and sufficient for the task"], k: "tr", m: "teacher observation data" },
      { n: "Acknowledging sources", c: "a completed research task", b: "acknowledge sources by {x}", p: ["naming the book used", "naming the book and author", "listing the titles and authors used", "recording title, author, and page", "creating a simple works-cited entry", "citing sources in a standard format"] },
      { n: "Research product", c: "completed research notes", b: "create and share a research product {x}", p: ["with a labeled drawing of their learning", "with a page of facts", "that organizes facts with a visual", "that answers the research question", "that organizes findings for an audience", "that synthesizes findings with citations"] },
    ],
    "Spelling & Encoding (TEKS)": [
      { n: "Spelling taught patterns", c: "a dictated word list", b: "spell {x}", p: "words", k: "acc", m: "dictated spelling assessments" },
      { n: "High-frequency word spelling", c: "a dictated word list", b: "spell {x}", p: ["10 taught high-frequency words", "25 common high-frequency words", "the first 100 high-frequency words", "the first 200 high-frequency words", "commonly misspelled grade-level words", "commonly confused and misspelled words"], k: "acc", m: "dictated spelling assessments" },
      { n: "Spelling rules & endings", c: "dictated words and taught rules", b: "apply spelling rules for {x}", p: ["adding -s to words", "-s, -ed, and -ing endings", "doubling and drop-e rules", "plural and inflected endings", "suffix rules that change base words", "words with Greek and Latin roots and affixes"], k: "acc", m: "dictated spelling assessments" },
      { n: "Sentence dictation", c: "orally dictated sentences", b: "encode dictated sentences containing {x}", p: "words", k: "acc", m: "dictated writing samples" },
      { n: "Using spelling resources", c: "a writing or editing task", b: "check and correct spelling using {x}", p: ["a word wall", "a word wall or word bank", "a personal dictionary", "a dictionary or spell-check tool", "print and digital resources", "print and digital resources during editing"], k: "opp", m: "teacher observation data" },
      { n: "Proofreading for spelling", c: "their own completed draft", b: "identify and correct {x}", p: ["2 misspelled taught words", "misspelled high-frequency words", "misspellings of taught patterns", "most misspellings in the draft", "misspellings including homophones", "spelling errors across multiple drafts"] },
    ],
    "Revision & Author's Craft": [
      { n: "Adding details in revision", c: "a completed draft and a revision conference", b: "revise by adding {x}", p: ["a detail to a drawing or sentence", "a describing word or detail", "details that tell more about the idea", "descriptive details and examples", "elaboration that develops the ideas", "precise details that develop the central idea"] },
      { n: "Revising for organization", c: "a completed draft", b: "revise for organization by {x}", p: ["putting pictures in order", "putting sentences in order", "grouping like ideas together", "sequencing and grouping related ideas", "adding transitions between ideas", "restructuring paragraphs for coherence"] },
      { n: "Word choice", c: "a completed draft and word resources", b: "improve word choice by {x}", p: ["adding a color or size word", "replacing one word with a stronger one", "replacing overused words", "using precise nouns and verbs", "using precise and vivid language", "using precise academic and figurative language"] },
      { n: "Sentence fluency in revision", c: "a completed draft", b: "revise sentences by {x}", p: ["saying the sentence aloud and fixing it", "combining two short sentences", "combining and expanding sentences", "varying sentence beginnings", "varying sentence structure and length", "controlling rhythm with purposefully varied structures"] },
      { n: "Leads & conclusions", c: "a completed draft and mentor examples", b: "strengthen the piece with {x}", p: ["a title", "a clear beginning sentence", "a beginning and an ending sentence", "an engaging lead or closing", "an engaging lead and a satisfying conclusion", "a purposeful lead and a resonant conclusion"] },
      { n: "Applying feedback", c: "teacher or peer feedback on a draft", b: "apply {x} to improve the draft", p: ["one teacher suggestion", "one specific suggestion", "teacher or peer suggestions", "rubric-based feedback", "peer and teacher feedback selectively", "feedback prioritized against the rubric"], k: "opp" },
    ],
  },
  "Math": {
    "Personal Financial Literacy (TEKS)": [
      { n: "Money identification & value", c: "coins, bills, or money amounts", b: "identify {x}", p: ["pennies, nickels, and dimes by name", "coins by name and value", "coin values and count collections to one dollar", "values of coins and bills to twenty dollars", "money amounts written in decimal notation", "money amounts in decimal notation within computations"] },
      { n: "Earning & income", c: "discussion prompts and real-world scenarios", b: "explain {x}", p: ["ways people earn money by working", "that people earn income by working at jobs", "how jobs and skills relate to earning income", "how income relates to labor, skills, and education", "examples of fixed and variable income", "the difference between gross and net income"], k: "tr", m: "teacher observation data" },
      { n: "Spending & saving decisions", c: "real-world money scenarios", b: "{x}", p: ["sort wants and needs using pictures", "distinguish wants from needs", "explain that saving is an alternative to spending", "identify decisions involving income, spending, and saving", "compare spending and saving options for a goal", "analyze spending decisions and their opportunity cost"], k: "tr", m: "teacher observation data" },
      { n: "Saving toward goals", c: "a savings scenario or class store activity", b: "{x}", p: ["explain why people save money", "set a simple savings goal for an item", "track saving toward a goal with support", "calculate the time needed to save for a goal", "develop a savings plan for a goal", "balance a simple budget that includes savings"], k: "opp" },
      { n: "Borrowing & payment methods", c: "discussion prompts and scenarios", b: "explain {x}", p: ["borrowing and returning items responsibly", "that borrowed money or items must be returned", "the responsibilities of borrowing money", "that credit is borrowing that costs money", "advantages and disadvantages of different saving and borrowing options", "payment methods including check, credit, debit, and electronic payments"], k: "tr", m: "teacher observation data" },
      { n: "Financial problem solving", c: "money word problems and price lists", b: "{x}", p: ["choose between two priced items within a given amount", "decide whether there is enough money to buy an item", "solve one-step money word problems", "solve real-world problems about cost and income", "distinguish fixed from variable expenses in scenarios", "identify types of taxes and their effect on take-home pay"] },
    ],
    "Data Analysis (TEKS)": [
      { n: "Collecting & organizing data", c: "a class survey or measurement activity", b: "collect and organize data {x}", p: ["into two groups using real objects", "into categories with tally marks", "into a tally chart with up to three categories", "using a frequency table", "using frequency tables with grouped values", "using frequency tables for numerical data"] },
      { n: "Creating graphs", c: "an organized data set", b: "create {x}", p: ["a real-object graph", "a picture graph", "a pictograph or bar graph with intervals of one", "a pictograph or bar graph with scaled intervals", "a dot plot or stem-and-leaf plot", "a bar graph, dot plot, or scatter plot from the data"], k: "smp", m: "work samples" },
      { n: "Reading & interpreting graphs", c: "a completed graph", b: "answer {x}", p: ["questions about which group has more or fewer", "one-step questions about the data", "one-step questions comparing categories", "one- and two-step problems using the data", "one- and two-step problems including finding differences", "one- and two-step problems across multiple graph types"] },
      { n: "Drawing conclusions from data", c: "a completed graph or table", b: "draw a conclusion from the data by {x}", p: ["telling which has the most and least", "stating one fact the graph shows", "writing one conclusion the data supports", "explaining what the data shows and making a prediction", "supporting conclusions with specific data values", "evaluating a claim using the data"], k: "opp", m: "teacher observation data" },
      { n: "Comparing data", c: "graphs or data sets", b: "compare {x}", p: ["two groups of objects", "two categories in a graph", "data across two categories", "data across categories and explain the differences", "two representations of the same data", "two data sets and describe differences informally"], k: "tr" },
      { n: "Solving problems with data", c: "data displays and word problems", b: "solve problems using data from {x}", p: ["a class picture graph", "a picture graph", "bar graphs", "frequency tables and dot plots", "dot plots and stem-and-leaf plots", "tables, dot plots, bar graphs, and scatter plots"] },
    ],
    "Algebraic Reasoning (TEKS)": [
      { n: "Number patterns", c: "pattern tasks and number charts", b: "identify and extend {x}", p: ["repeating patterns with objects", "skip-counting patterns by 2s, 5s, and 10s", "number patterns on a hundreds chart", "patterns in addition and multiplication tables", "patterns when multiplying by 10 and 100", "additive and multiplicative numerical patterns"] },
      { n: "Unknowns in equations", c: "number sentences with a missing value", b: "find the unknown in {x}", p: ["a missing-object problem", "addition sentences within 10", "number sentences within 20", "equations using the four operations within 100", "multi-step equations with a letter for the unknown", "equations with a variable across all four operations"] },
      { n: "Relating operations", c: "fact tasks and models", b: "represent and explain {x}", p: ["joining and separating using objects", "addition and subtraction as related operations", "fact families for addition and subtraction", "multiplication and division as related operations", "fact relationships across all four operations", "inverse operations used to check solutions"], k: "tr" },
      { n: "Representing problems", c: "a word problem", b: "represent the problem using {x}", p: ["objects or pictures", "pictures and a number sentence", "a number sentence and a drawing", "strip diagrams and equations", "strip diagrams and equations with unknowns", "equations and diagrams across operations"] },
      { n: "Properties & strategies", c: "computation tasks", b: "apply {x}", p: ["counting on from a number", "turn-around facts to add in any order", "doubles and making-ten strategies", "the commutative and associative properties", "the distributive property with arrays or area models", "properties of operations to simplify expressions"] },
      { n: "Input-output relationships", c: "tables, rules, and pattern tasks", b: "{x}", p: ["continue a growing pattern with blocks", "complete a simple in-and-out table", "complete input-output tables with one rule", "generate a table from a given rule", "describe the rule of an input-output table", "generate expressions and tables from real situations"] },
    ],
    "Mathematical Process (TEKS)": [
      { n: "Problem-solving model", c: "grade-level word problems", b: "apply a problem-solving model by {x}", p: ["telling what the problem asks, with support", "telling what is known and what is asked", "identifying information, choosing a strategy, and solving", "analyzing, planning, solving, and checking", "analyzing, planning, solving, justifying, and evaluating", "using the full model and evaluating reasonableness"], k: "opp", m: "teacher observation data" },
      { n: "Selecting tools & techniques", c: "problems and available tools", b: "select and use appropriate tools such as {x}", p: ["counters or fingers", "counters, number lines, or ten frames", "base-ten blocks, number lines, or drawings", "manipulatives, number lines, or paper-and-pencil strategies", "models, diagrams, or algorithms as appropriate", "efficient tools and techniques matched to the problem"], k: "opp", m: "teacher observation data" },
      { n: "Communicating reasoning", c: "a solved problem and a discussion or written prompt", b: "explain mathematical thinking {x}", p: ["by showing with objects", "using words or drawings", "using math words and drawings", "using mathematical vocabulary in complete sentences", "using precise vocabulary and representations", "using precise language, symbols, and representations"], k: "opp", m: "teacher observation data" },
      { n: "Multiple representations", c: "a quantity or problem", b: "represent it in {x}", p: ["objects and pictures", "two ways, such as objects and numbers", "two different ways", "two or more ways including a diagram", "multiple ways including diagrams and equations", "multiple equivalent representations"], k: "tr" },
      { n: "Justifying & evaluating solutions", c: "completed problems", b: "{x}", p: ["show how the answer was found", "tell whether an answer makes sense", "check the answer and tell if it is reasonable", "justify the solution and check reasonableness", "justify solutions and evaluate the reasoning of others", "construct arguments and critique mathematical reasoning"], k: "opp", m: "teacher observation data" },
      { n: "Everyday application", c: "real-life classroom and home scenarios", b: "apply mathematics to everyday situations by {x}", p: ["counting real objects during class jobs", "solving real counting problems from daily life", "solving real one-step problems from daily life", "solving real multi-step situations", "modeling real situations mathematically", "modeling and solving workplace-style problems"] },
    ],
  },
  "Communication": {
    "Speech Sound Production": [
      { n: "Multisyllabic word production", c: "picture or word stimuli", b: "produce target sounds accurately in {x}", p: ["2-syllable words", "2-syllable words", "2–3 syllable words", "multisyllabic words", "multisyllabic words in phrases", "multisyllabic academic words in sentences"], k: "tr" },
      { n: "Auditory discrimination", c: "recorded or live speech models", b: "discriminate correct versus incorrect productions of target sounds in {x}", p: ["single words with pictures", "minimal pairs", "minimal pairs and short phrases", "their own recorded productions", "their own productions in sentences", "their own connected speech"], k: "tr" },
      { n: "Self-monitoring speech", c: "structured speaking tasks", b: "self-monitor and self-correct target-sound errors {x}", p: ["with a visual cue after each word", "after a verbal cue", "after a nonverbal cue", "independently at the phrase level", "independently at the sentence level", "independently in conversation"], k: "opp" },
      { n: "Target sounds in oral reading", c: "{q} read aloud", q: "txt", b: "produce target sounds accurately", k: "acc" },
    ],
    "Expressive Language": [
      { n: "Complete-sentence answers", c: "curriculum-based questions", b: "answer in complete sentences using {x}", p: ["3–4 word utterances", "4–5 word sentences", "subject-verb-object sentences", "complete sentences with a detail", "complex sentences", "complex sentences with academic vocabulary"], k: "tr" },
      { n: "Conjunction use", c: "structured tasks and conversation", b: "produce sentences using {x}", p: ["the word and to join ideas", "and plus because", "because and so", "temporal conjunctions such as first, then, and after", "causal and temporal conjunctions", "subordinating conjunctions such as although, unless, and while"], k: "tr" },
      { n: "Asking questions", c: "natural and structured opportunities", b: "ask grammatically correct questions to {x}", p: ["request items or help", "get information using what and where", "get information using who, what, where, and when", "clarify directions or content", "gather information for academic tasks", "probe for detail in an interview or discussion"], k: "opp" },
      { n: "Supported oral presentation", c: "a familiar topic and visual supports", b: "present orally {x}", p: ["for 2 sentences with picture support", "for 3 sentences with visual support", "for 4–5 sentences with notes", "for 1 minute using note cards", "for 2 minutes using an outline", "for 3 minutes using organized notes"], k: "smp" },
    ],
    "Receptive Language": [
      { n: "Basic concepts", c: "objects, pictures, or directions", b: "demonstrate understanding of {x}", p: ["spatial concepts such as in, on, and under", "spatial and size concepts", "quantity and temporal concepts such as before and after", "comparative concepts such as more, less, and taller", "sequence and inclusion/exclusion concepts", "abstract temporal and conditional concepts"], k: "tr" },
      { n: "Academic vocabulary comprehension", c: "classroom instruction and materials", b: "identify or define {x}", p: ["names of classroom objects", "classroom action and object words", "topic words from instruction", "tier-two academic terms from instruction", "content vocabulary across subjects", "multiple-meaning academic vocabulary in context"], k: "tr" },
      { n: "Directions with academic language", c: "classroom directions", b: "follow directions containing {x}", p: ["one basic concept", "two basic concepts", "sequence words", "academic terms such as underline and compare", "multiple steps with academic terms", "conditional academic directions using if-then"], k: "opp" },
      { n: "Comprehension monitoring", c: "spoken messages and instruction", b: "indicate when a message is not understood and {x}", p: ["look to the speaker or gesture for help", "raise a hand or say help", "ask for repetition", "request repetition or rephrasing", "request specific clarification", "paraphrase the message to verify understanding"], k: "opp" },
    ],
    "Social & Pragmatic Communication": [
      { n: "Collaborative discussion participation", c: "small-group academic discussions", b: "participate by {x}", p: ["staying with the group and looking at speakers", "taking one speaking turn", "taking turns and staying on topic", "building on a peer's comment", "posing questions and building on ideas", "facilitating turn-taking and synthesizing ideas"], k: "opp" },
      { n: "Entering & exiting interactions", c: "natural peer opportunities", b: "{x}", p: ["approach a peer and greet or gesture to join play", "ask to join play", "join a group activity appropriately", "enter an ongoing conversation appropriately", "enter and exit conversations smoothly", "adjust entry and exit strategies to the context"], k: "opp" },
      { n: "Register & politeness", c: "interactions across partners", b: "adjust language for the listener by {x}", p: ["using please and greetings", "using polite forms with adults", "using different greetings for peers versus adults", "matching formality to the situation", "adjusting tone and word choice to the context", "shifting style across audiences and settings"], k: "opp" },
      { n: "Academic topic maintenance", c: "academic discussions", b: "remain on the academic topic for {x}", p: ["1 exchange", "2 exchanges", "3 exchanges", "3–4 exchanges with relevant comments", "4–5 exchanges while adding content", "an extended discussion while adding relevant content"], k: "opp" },
    ],
    "Fluency & Voice": [
      { n: "Phrasing & pausing", c: "speaking and reading tasks", b: "use phrasing and pausing {x}", p: ["after a model in short phrases", "in 3–4 word phrases", "at natural boundaries in sentences", "at punctuation while reading aloud", "across sentences in conversation", "flexibly to support fluent speech"], k: "opp" },
      { n: "Fluency strategy ladder", c: "structured speaking tasks", b: "use {x} at the {q} level", p: ["easy, stretchy speech", "easy onsets", "easy onsets and light contacts", "taught fluency strategies", "taught fluency strategies", "fluency-shaping and stuttering-modification strategies"], q: ["word", "phrase", "sentence", "sentence", "conversation", "conversation"], k: "tr" },
      { n: "Breath support", c: "speaking tasks", b: "use appropriate breath support to {x}", p: ["say 3–4 word phrases", "complete short sentences", "complete sentences without strain", "sustain speech across sentences", "support voicing in longer utterances", "support presentations and oral reading"], k: "opp" },
      { n: "Fluency self-advocacy", c: "communication situations", b: "{x}", p: ["signal for wait time", "request wait time", "tell a partner to give them a second", "explain their fluency strategies to a familiar adult", "educate a peer or teacher about stuttering", "self-advocate for time and strategies across settings"], k: "opp" },
    ],
    "AAC & Functional Communication": [
      { n: "Academic responses with AAC", c: "curriculum-based questions and the AAC system", b: "answer using {x}", p: ["1 symbol", "1–2 symbols", "2-symbol messages", "2–3 symbol messages", "3–4 symbol messages", "sentence-level messages"], k: "tr" },
      { n: "Social openings & closings", c: "daily social routines and the AAC system", b: "use the device for {x}", p: ["greetings", "greetings and farewells", "greetings, farewells, and thanking", "social phrases across the school day", "personalized social messages", "topic starters and closers with peers"], k: "opp" },
      { n: "Message repair with AAC", c: "communication breakdowns", b: "repair the message by {x}", p: ["repeating the selection", "re-selecting or pointing", "navigating to a clearer word", "rephrasing with different vocabulary", "adding words to clarify", "spelling or using word prediction to clarify"], k: "opp" },
      { n: "New vocabulary on device", c: "newly added device vocabulary", b: "locate and use {x}", p: ["2 new activity words", "5 new core words", "new topic vocabulary", "curriculum vocabulary", "academic vocabulary across pages", "self-requested new vocabulary"], k: "tr" },
    ],
  },
  "Behavior / SEL": {
    "Self-Regulation": [
      { n: "Regulation check-in", c: "scheduled check-ins and natural moments", b: "identify their current regulation zone or energy level {x}", p: ["with an adult using a chart", "using a visual chart", "using a chart and choosing a matched strategy", "and select a matching strategy", "and adjust using a strategy proactively", "and adjust independently across settings"], k: "opp" },
      { n: "Waiting appropriately", c: "natural waiting situations", b: "wait appropriately for {x}", p: ["30 seconds with a visual support", "1 minute with a visual support", "2 minutes for a turn or help", "3–5 minutes for attention or materials", "5 or more minutes while continuing to work", "delayed outcomes across activities"], k: "opp" },
      { n: "Sensory strategy use", c: "approved sensory supports", b: "use an approved sensory strategy {x}", p: ["when offered by an adult", "when offered a choice of two", "by requesting from a strategy menu", "by selecting one independently when needed", "proactively before difficult tasks", "and return to task within 2 minutes"], k: "opp" },
      { n: "Calm body during instruction", c: "whole-group instruction", b: "maintain a calm, safe body during {x}", p: ["5-minute carpet times", "10-minute lessons", "15-minute lessons", "20-minute lessons", "whole-class lessons", "lessons and assemblies"], k: "opp" },
    ],
    "On-Task Behavior & Engagement": [
      { n: "Attending to instruction", c: "whole-group instruction", b: "orient to the speaker and materials during {x}", p: ["short read-alouds", "10-minute lessons", "15-minute lessons", "20-minute lessons", "full lessons", "full lessons while taking notes"], k: "opp" },
      { n: "Hand-raising & waiting", c: "whole-group settings", b: "gain attention by raising a hand and waiting {x}", p: ["with a visual reminder", "up to 10 seconds", "up to 30 seconds", "until called on", "until called on across classes", "until called on across settings including specials"], k: "opp" },
      { n: "Arrival & warm-up routine", c: "the posted arrival or warm-up routine", b: "complete the routine {x}", p: ["with one prompt per step", "with one prompt", "with a checklist", "independently within 5 minutes", "independently within the expected time", "independently across all classes"], k: "day" },
      { n: "Independent practice engagement", c: "assigned independent practice", b: "remain engaged for {x} without redirection", p: ["5 minutes", "8 minutes", "10 minutes", "15 minutes", "20 minutes", "25 minutes"], k: "opp" },
    ],
    "Following Expectations": [
      { n: "Expectations across settings", c: "posted school-wide expectations", b: "follow expectations in {x}", p: ["the classroom with visual cues", "the classroom and hallway", "the hallway, cafeteria, and recess", "all common areas", "all school settings including specials", "all settings including assemblies and field trips"], k: "day" },
      { n: "Technology expectations", c: "classroom devices and the technology agreement", b: "use technology {x}", p: ["only with adult permission", "for the assigned activity with reminders", "for assigned activities only", "following the device agreement", "responsibly and log off when directed", "responsibly and self-correct off-task use"], k: "opp" },
      { n: "Generalizing across staff", c: "directions from school adults", b: "follow directions from {x}", p: ["the classroom teacher", "two familiar adults", "any classroom staff member", "all school staff including specials teachers", "substitutes and unfamiliar staff", "all adults across school settings"], k: "opp" },
      { n: "First-request compliance", c: "adult directions", b: "comply {x}", p: ["within 1 minute with a visual support", "within 30 seconds with one repetition", "within 30 seconds of the first request", "on the first request", "on the first request across settings", "on the first request including non-preferred tasks"], k: "opp" },
    ],
    "Social Skills": [
      { n: "Compliments", c: "structured and natural peer interactions", b: "give and accept compliments {x}", p: ["using a modeled script", "using a sentence starter", "using their own words", "genuinely tied to a peer's specific action", "across peers and situations", "and respond graciously across settings"], k: "opp" },
      { n: "Peer help exchange", c: "partner and group work", b: "{x}", p: ["accept help from a peer", "ask a peer for help using a script", "ask a peer for help appropriately", "offer help to a peer appropriately", "exchange help with peers during work", "serve as a peer support during activities"], k: "opp" },
      { n: "Games with rules", c: "structured games at recess or in class", b: "participate by {x}", p: ["staying with the game and taking turns with support", "following 1–2 game rules", "following the rules for a full game", "following rules and handling disputes calmly", "negotiating fair play with peers", "organizing fair play and including others"], k: "opp" },
      { n: "Sportsmanship", c: "competitive games and activities", b: "respond to winning or losing by {x}", p: ["staying calm with adult support", "staying calm", "congratulating the other player", "congratulating others and staying regulated", "encouraging teammates regardless of outcome", "modeling sportsmanship for peers"], k: "opp" },
    ],
    "Coping & Flexibility": [
      { n: "Coping menu use", c: "a personal coping menu and stressful moments", b: "select and use a strategy {x}", p: ["with adult prompting", "with a gesture prompt", "with a visual prompt only", "independently", "independently and rate its helpfulness", "proactively before known stressors"], k: "opp" },
      { n: "Recovering after correction", c: "corrective feedback", b: "return to expected behavior within {x}", p: ["5 minutes with support", "5 minutes", "3 minutes", "2 minutes", "1–2 minutes", "1 minute across settings"], k: "opp" },
      { n: "Adapting to changes", c: "changes in materials, seating, or plans", b: "adapt by {x}", p: ["accepting the change with a transition object", "accepting the change with advance notice", "accepting the change with brief notice", "adjusting without disruption", "adjusting and helping peers adjust", "adjusting to unannounced changes calmly"], k: "opp" },
      { n: "Accepting denied access", c: "moments when a request is denied", b: "respond by {x}", p: ["accepting with a first-then visual", "accepting within 1 minute", "accepting calmly", "accepting and choosing an alternative", "negotiating appropriately or accepting the answer", "accepting and self-advocating for access later"], k: "opp" },
    ],
    "Self-Monitoring & Reflection": [
      { n: "Self-graphing behavior data", c: "a self-monitoring system", b: "record and graph their own data {x}", p: ["by coloring a chart with help", "by marking a simple chart", "on a daily point chart", "on a self-monitoring graph", "and describe the trend", "and set a goal based on the trend"], k: "opp" },
      { n: "Check-in / check-out", c: "the daily check-in/check-out routine", b: "complete the routine by {x}", p: ["greeting the adult and getting the card", "reviewing goals at check-in", "rating one goal accurately", "rating goals within one point of the adult", "leading the check-out conversation", "leading check-ins and proposing goal adjustments"], k: "day" },
      { n: "Post-incident reflection", c: "a structured reflection routine", b: "complete a reflection identifying {x}", p: ["the feeling using pictures", "what happened and the feeling", "what happened and a better choice", "the trigger and a replacement behavior", "the impact on others and a repair step", "patterns across incidents and a prevention plan"], k: "opp" },
      { n: "Goal conferences", c: "scheduled goal conferences with staff", b: "participate by {x}", p: ["pointing to a met goal", "stating whether the goal was met", "stating progress using the chart", "explaining progress using their data", "proposing next steps from the data", "leading the conference using their data"], k: "opp" },
    ],
  },
  "Executive Functioning": {
    "Organization": [
      { n: "Paper flow & submission", c: "classroom turn-in systems", b: "turn in and file papers by {x}", p: ["placing work in the bin with a prompt", "placing work in the labeled bin", "using the turn-in and take-home system", "filing by subject without reminders", "managing paper flow across classes", "managing paper and digital submissions"], k: "opp" },
      { n: "Schedule management", c: "a personal schedule", b: "use the schedule by {x}", p: ["checking a picture schedule with prompts", "checking a picture schedule", "checking and marking completed items", "updating a written schedule", "maintaining a planner-based schedule", "adjusting the schedule when plans change"], k: "day" },
      { n: "Pack-up routine", c: "the end-of-day routine", b: "complete pack-up {x}", p: ["with step-by-step prompts", "with a picture checklist", "with a checklist", "independently with all materials", "independently including homework materials", "independently and verify against the planner"], k: "day" },
      { n: "Device & digital organization", c: "classroom technology", b: "manage the device and logins by {x}", p: ["carrying the device safely", "keeping the device charged and stored correctly", "logging in with a reference card", "logging in and saving to correct folders", "managing files, tabs, and charging", "managing the digital workspace across platforms"], k: "opp" },
    ],
    "Planning & Prioritization": [
      { n: "Previewing tasks", c: "a new assignment", b: "preview before starting by {x}", p: ["looking at the example with an adult", "looking at all the parts", "reading the directions aloud first", "reading directions and marking key words", "identifying the steps and materials needed", "annotating directions and planning the steps"], k: "opp" },
      { n: "Gathering materials first", c: "assigned tasks", b: "gather all needed materials {x}", p: ["with a picture list", "with a checklist", "before starting, with a checklist", "before starting, independently", "for multi-part tasks independently", "for multi-day projects independently"], k: "opp" },
      { n: "Chunking multi-part work", c: "multi-part assignments", b: "break the work into parts by {x}", p: ["completing one row at a time with support", "completing marked chunks", "marking their own stopping points", "dividing the task into steps", "creating a step list with time estimates", "sequencing steps with checkpoints"], k: "opp" },
      { n: "Weekly previewing", c: "the class calendar and planner", b: "preview upcoming events by {x}", p: ["reviewing tomorrow's picture schedule", "reviewing tomorrow with an adult", "reviewing the week's specials and events", "recording the week's due dates", "planning the week's tasks by day", "planning and adjusting the week's plan"], k: "opp" },
    ],
    "Time Management": [
      { n: "Timer-based pacing", c: "a visual timer and assigned tasks", b: "use the timer to {x}", p: ["finish clean-up before it rings", "complete a task before it rings", "pace work using the halfway signal", "self-pace and finish on time", "estimate, set, and beat a work timer", "manage multiple timed work blocks"], k: "opp" },
      { n: "Time estimation", c: "familiar tasks", b: "estimate task time {x}", p: ["as short or long, with support", "as short or long, correctly", "within 5 minutes of actual time", "within a quarter of actual time", "accurately and adjust plans accordingly", "accurately and build realistic schedules"], k: "tr" },
      { n: "Routine punctuality", c: "daily timed routines", b: "complete timed routines {x}", p: ["by unpacking within 10 minutes of arrival", "by finishing the arrival routine within 5 minutes", "by finishing transitions within 2 minutes", "by finishing transitions within 1 minute", "within all expected times", "early or on time across the day"], k: "day" },
      { n: "First-then prioritizing", c: "multiple assigned tasks", b: "order tasks by {x}", p: ["completing first before then using a board", "following a first-then board", "completing must-do work before may-do work", "ranking 2–3 tasks by importance", "prioritizing tasks by due date and effort", "re-prioritizing when new tasks arrive"], k: "opp" },
    ],
    "Attention & Working Memory": [
      { n: "Rehearsing directions", c: "multi-step directions", b: "hold directions in mind by {x}", p: ["repeating 1 step aloud", "repeating 2 steps aloud", "whispering the steps while working", "self-rehearsing or jotting the steps", "jotting key words before starting", "selecting a strategy such as rehearsing, jotting, or visualizing"], k: "opp" },
      { n: "Work-break cycles", c: "extended work periods", b: "sustain effort using work-break cycles of {x}", p: ["3 minutes of work and 1-minute breaks", "5 minutes of work and 1-minute breaks", "8 minutes of work and 2-minute breaks", "10 minutes of work and 2-minute breaks", "15 minutes of work with self-managed breaks", "self-selected cycles managed independently"], k: "opp" },
      { n: "Organizers to hold information", c: "graphic organizers and content tasks", b: "use an organizer to hold information during {x}", p: ["a read-aloud with pictures", "short lessons", "reading tasks", "multi-step problems", "note-taking in lessons", "research and multi-text tasks"], k: "opp" },
      { n: "Filtering relevant information", c: "problems and texts with extra information", b: "identify {x}", p: ["the picture that matches the question", "what the question is asking", "needed versus extra information by highlighting", "relevant versus irrelevant details in problems", "relevant information in multi-step problems", "relevant information across multiple sources"], k: "tr" },
    ],
    "Task Initiation & Completion": [
      { n: "Starting after group directions", c: "whole-group directions", b: "begin the task {x}", p: ["with one individual prompt", "with a gesture prompt", "with a visual cue only", "without individual prompts within 1 minute", "without prompts within 30 seconds", "immediately, including non-preferred tasks"], k: "opp" },
      { n: "Self-start scripts", c: "task starts", b: "use a self-start script such as {x}", p: ["saying First I with adult modeling", "saying First I with a cue card", "asking themselves what to do first", "a personal start routine", "a start routine with a written first step", "an internalized start routine across tasks"], k: "opp" },
      { n: "Restarting after interruptions", c: "interruptions during work", b: "return to the task {x}", p: ["with adult redirection", "with a gesture cue", "within 1 minute with a visual", "within 1 minute independently", "within 30 seconds independently", "independently after noting their place"], k: "opp" },
      { n: "Attempting before asking", c: "challenging problems", b: "attempt before requesting help by {x}", p: ["trying once with support nearby", "trying once", "trying one strategy first", "trying two strategies first", "trying strategies and naming the specific difficulty", "exhausting resources and asking a targeted question"], k: "opp" },
    ],
    "Independence & Self-Advocacy": [
      { n: "Self-checking work", c: "completed work and checking tools", b: "check the work {x}", p: ["against a picture model", "against a model", "with a checklist before turning it in", "against a rubric or answer key", "and correct the errors found", "and correct errors before submission across subjects"], k: "opp" },
      { n: "Making & following choices", c: "structured choice opportunities", b: "make and follow through on choices {x}", p: ["between two activities", "among three options", "about task order", "about tools and strategies for tasks", "about goals and methods, with a rationale", "and evaluate the outcome of the choice"], k: "opp" },
      { n: "Home-school communication", c: "the take-home folder system", b: "manage home communication by {x}", p: ["placing the folder in the backpack with prompts", "transporting the folder daily", "returning signed papers within 2 days", "recording and relaying messages accurately", "managing forms and deadlines", "managing all home-school logistics independently"], k: "day" },
      { n: "Reporting needs & problems", c: "school situations requiring adult help", b: "report to the appropriate adult by {x}", p: ["showing or leading the adult to the problem", "using words or pictures for basic needs", "stating the need clearly", "choosing the right adult and stating the need", "stating the need, the context, and the help wanted", "resolving or appropriately escalating the problem"], k: "opp" },
    ],
  },
};

// Merge TEKS expansion into the main bank
for (const [subj, strands] of Object.entries(TEKS_SKILLS)) {
  for (const [st, arr] of Object.entries(strands)) {
    (SKILLS[subj][st] = SKILLS[subj][st] || []).push(...arr);
  }
}


const AREAS = Object.keys(SKILLS);
const AREA_ICONS = {
  "Reading": "📖", "Writing": "✏️", "Math": "🔢",
  "Communication": "💬", "Behavior / SEL": "🌱", "Executive Functioning": "🧭",
};

// ── Goal generation from skill ladders ──
const LEVELS = ["support", "standard", "rigor"];

function ladder(v, gi) {
  if (v == null) return null;
  const arr = typeof v === "string" ? P[v] : v;
  return arr ? arr[gi] : null;
}

function goalText(subject, sk, gi, levelIdx) {
  const d = SUBJ_DEFAULTS[subject];
  const x = ladder(sk.p, gi);
  const q = ladder(sk.q, gi);
  const fill = (s) => s.replace(/\{x\}/g, x || "").replace(/\{q\}/g, q || "");
  let cond = fill(sk.c);
  if (levelIdx === 0) cond = sk.sc ? fill(sk.sc) : cond + ", with visual supports and prompting as needed";
  const crit = CRIT[sk.k || d.k][levelIdx];
  const meas = sk.m || d.m;
  return `By the end of the IEP period, given ${cond}, STUDENT will ${fill(sk.b)} ${crit}, as measured by ${meas}, on 3 out of 4 progress monitoring events.`;
}

// Flat index: one entry per (skill, grade)
let _uid = 0;
const ALL_GOALS = AREAS.flatMap((subject) =>
  Object.entries(SKILLS[subject]).flatMap(([strand, arr]) =>
    arr.flatMap((sk) => {
      const [a, b] = sk.gr || [0, 5];
      const out = [];
      for (let gi = a; gi <= b; gi++) {
        out.push({ id: `g${_uid++}`, subject, strand, grade: GRADES[gi], gi, sk });
      }
      return out;
    })
  )
);

const countFor = (subject, gi, strand) =>
  ALL_GOALS.reduce((n, g) => n + (g.subject === subject && g.gi === gi && (!strand || g.strand === strand) ? 1 : 0), 0);

// ── Storage ──
async function loadLibrary() {
  try { const res = await window.storage.get(STORAGE_KEY); return res ? JSON.parse(res.value) : []; }
  catch { return []; }
}
async function persistLibrary(items) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(items)); return true; }
  catch { return false; }
}

// ── AI drafting ──
async function draftGoalsWithAI({ subject, strand, grade, presentLevels }) {
  const prompt = `You are an expert special education consultant. Draft IEP annual goals.

Context:
- Subject: ${subject}
- Area of need: ${strand || "not specified"}
- Grade: ${GRADE_LABEL[grade] || grade}
- Present levels / needs (student referred to only as "STUDENT"): ${presentLevels}

Write 3 measurable annual goals for the SAME target skill, with criteria appropriate for ${GRADE_LABEL[grade] || grade}, at three levels: "support" (more scaffolding), "standard", and "rigor" (more ambitious). Each goal follows EXACTLY this frame: By the end of the IEP period, given [condition], STUDENT will [observable behavior] [criterion], as measured by [measurement], on 3 out of 4 progress monitoring events. Use "STUDENT" as the name.

Respond ONLY with valid JSON, no markdown fences:
{"skill": "short skill name", "goals": [{"level": "support", "text": "..."}, {"level": "standard", "text": "..."}, {"level": "rigor", "text": "..."}]}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function parseGoal(text) {
  const pmMatch = text.match(/,?\s*on (\d+ out of \d+ progress monitoring events)\.?$/i);
  text = text
    .replace(/^By the end of the IEP period,\s*/i, "")
    .replace(/,?\s*on \d+ out of \d+ progress monitoring events\.?$/i, "");
  const m = text.match(/^Given (.+?), STUDENT will (.+?)(?: (?:with|in) (\d.+?|\d+% .+?))?(?:,? as measured by (.+?))?\.?$/i);
  return {
    condition: m ? m[1] : "",
    behavior: m ? (m[2] || "") : text.replace(/^Given .*?, STUDENT will /i, "").replace(/\.$/, ""),
    criterion: m && m[3] ? m[3] : "",
    measure: m && m[4] ? m[4] : "",
    pm: pmMatch ? pmMatch[1] : "3 out of 4 progress monitoring events",
  };
}

const CRITERION_OPTIONS = ["70% accuracy", "75% accuracy", "80% accuracy", "85% accuracy", "90% accuracy", "95% accuracy", "100% accuracy"];
const PM_OPTIONS = ["3 out of 4 progress monitoring events", "4 out of 5 progress monitoring events"];

// Dropdown with a Custom… option that reveals a free-text input
function ComboSelect({ value, onChange, options, placeholder }) {
  const [customMode, setCustomMode] = useState(false);
  const showText = customMode || (value !== "" && !options.includes(value));
  return (
    <div className="combo">
      <select
        value={showText ? "__custom" : value}
        onChange={(e) => {
          if (e.target.value === "__custom") setCustomMode(true);
          else { setCustomMode(false); onChange(e.target.value); }
        }}
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__custom">Custom…</option>
      </select>
      {showText && <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus />}
    </div>
  );
}

// ── Small components ──
function CopyButton({ text, small }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className={`btn ghost ${small ? "sm" : ""}`} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {}
    }}>{copied ? "Copied ✓" : "Copy"}</button>
  );
}

function LevelToggle({ value, onChange }) {
  return (
    <div className="seg-ctrl" role="tablist" aria-label="Support level">
      {LEVELS.map((lvl) => (
        <button key={lvl} role="tab" aria-selected={value === lvl}
          className={`seg ${value === lvl ? "on" : ""} lv-${lvl}`} onClick={() => onChange(lvl)}>
          {LEVEL_META[lvl].short}
        </button>
      ))}
    </div>
  );
}

function GoalCard({ entry, showContext, onUse, onSave }) {
  const [level, setLevel] = useState("standard");
  const text = goalText(entry.subject, entry.sk, entry.gi, LEVELS.indexOf(level));
  return (
    <article className="card rise">
      <div className="card-head">
        <div>
          <div className="skill">{entry.sk.n}</div>
          <div className="meta">{showContext ? `${entry.subject} · ` : ""}{entry.strand} · {GRADE_LABEL[entry.grade]}</div>
        </div>
        <LevelToggle value={level} onChange={setLevel} />
      </div>
      <p className="goal-text" key={level}>{text}</p>
      <div className="row-actions">
        <CopyButton text={text} small />
        <button className="btn ghost sm" onClick={() => onUse(entry, text)}>Edit in builder</button>
        <button className="btn ghost sm" onClick={() => onSave({ subject: entry.subject, strand: entry.strand, grade: entry.grade, skill: entry.sk.n, level, text, initials: "" })}>Save</button>
      </div>
    </article>
  );
}

// ── Main app ──
export default function App() {
  const [tab, setTab] = useState("bank");
  const [library, setLibrary] = useState([]);
  const [libLoaded, setLibLoaded] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => { loadLibrary().then((items) => { setLibrary(items); setLibLoaded(true); }); }, []);
  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2000); };

  const saveToLibrary = async (entry) => {
    const item = { ...entry, id: `lib_${Date.now()}`, savedAt: new Date().toISOString() };
    const next = [item, ...library];
    setLibrary(next);
    const ok = await persistLibrary(next);
    notify(ok ? "Saved to library" : "Saved for this session only");
  };
  const removeFromLibrary = async (id) => {
    const next = library.filter((g) => g.id !== id);
    setLibrary(next);
    await persistLibrary(next);
  };

  const [builder, setBuilder] = useState({
    initials: "", subject: "Reading", strand: "", grade: "3",
    condition: "", behavior: "", criterion: "", measure: "",
    timeframe: "By the end of the IEP period",
    pm: "3 out of 4 progress monitoring events",
  });

  const useInBuilder = (entry, text) => {
    setBuilder((b) => ({ ...b, subject: entry.subject, strand: entry.strand, grade: entry.grade, ...parseGoal(text) }));
    setTab("builder");
    notify("Loaded into builder");
  };

  return (
    <div className="app">
      <style>{CSS}</style>
      <header className="masthead">
        <div>
          <div className="eyebrow">Special Education · Goal Writing</div>
          <h1>IEP Goal Studio</h1>
        </div>
        <nav className="tabs">
          {[["bank", "Goal Bank"], ["builder", "Builder"], ["library", `Library${libLoaded && library.length ? ` · ${library.length}` : ""}`], ["students", "Students"]].map(([id, label]) => (
            <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>

      <div className="privacy">Use student <strong>initials only</strong> — never enter names, IDs, or identifying details.</div>

      <main key={tab} className="panel">
        {tab === "bank" && <BankView onSave={saveToLibrary} onUse={useInBuilder} />}
        {tab === "builder" && <BuilderView builder={builder} setBuilder={setBuilder} onSave={saveToLibrary} />}
        {tab === "library" && <LibraryView items={library} loaded={libLoaded} onRemove={removeFromLibrary} />}
        {tab === "students" && <StudentsView library={library} notify={notify} />}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ── Goal Bank: Subject → Grade → Area of Need ──
function BankView({ onSave, onUse }) {
  const [subject, setSubject] = useState(null);
  const [grade, setGrade] = useState(null); // one grade state: dropdown + chips both control it
  const [strand, setStrand] = useState(null);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(40);

  const searching = q.trim().length > 1;
  const gi = grade ? GRADES.indexOf(grade) : -1;
  const strands = subject ? Object.keys(SKILLS[subject]) : [];

  const results = useMemo(() => {
    if (searching) {
      const needle = q.toLowerCase();
      return ALL_GOALS.filter((g) => {
        if (grade && g.grade !== grade) return false;
        const hay = (g.sk.n + " " + g.strand + " " + g.subject + " " + goalText(g.subject, g.sk, g.gi, 1)).toLowerCase();
        return hay.includes(needle);
      });
    }
    if (!subject || gi < 0) return [];
    return ALL_GOALS.filter((g) => g.subject === subject && g.gi === gi && (!strand || g.strand === strand));
  }, [searching, q, grade, subject, gi, strand]);

  useEffect(() => { setShown(40); }, [q, subject, grade, strand]);

  return (
    <section>
      <div className="searchbar">
        <input placeholder={`Search all ${ALL_GOALS.length.toLocaleString()} goals… (e.g., fractions, fluency, turn-taking)`} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={grade ?? "All"} onChange={(e) => setGrade(e.target.value === "All" ? null : e.target.value)} aria-label="Student's grade">
          <option value="All">All grades</option>
          {GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}
        </select>
      </div>

      {!searching && (
        <>
          <div className="step-label">1 · Subject</div>
          <div className="chip-row">
            {AREAS.map((a) => (
              <button key={a} className={`chip subject ${subject === a ? "on" : ""}`}
                onClick={() => { setSubject(subject === a ? null : a); setStrand(null); }}>
                <span className="chip-icon" aria-hidden>{AREA_ICONS[a]}</span><span>{a}</span>
              </button>
            ))}
          </div>

          {subject && (
            <div className="rise">
              <div className="step-label">2 · Student's grade</div>
              <div className="chip-row">
                {GRADES.map((g, i) => (
                  <button key={g} className={`chip grade ${grade === g ? "on" : ""}`}
                    onClick={() => setGrade(grade === g ? null : g)}>
                    {GRADE_LABEL[g]} <span className="count">{countFor(subject, i)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {subject && grade && (
            <div className="rise">
              <div className="step-label">3 · Area of need</div>
              <div className="chip-row">
                <button className={`chip strand ${!strand ? "on" : ""}`} onClick={() => setStrand(null)}>All areas</button>
                {strands.map((s) => {
                  const c = countFor(subject, gi, s);
                  if (c === 0) return null;
                  return (
                    <button key={s} className={`chip strand ${strand === s ? "on" : ""}`} onClick={() => setStrand(strand === s ? null : s)}>
                      {s} <span className="count">{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {searching && <div className="step-label">{results.length} result{results.length === 1 ? "" : "s"}{grade ? ` · ${GRADE_LABEL[grade]}` : " across all grades"}</div>}
      {!searching && subject && grade && (
        <div className="step-label">{results.length} goals · {subject} · {GRADE_LABEL[grade]}{strand ? ` · ${strand}` : ""} — each in 3 support levels</div>
      )}

      {!searching && !subject && <div className="empty">Pick a subject to get started, or search everything above.</div>}
      {!searching && subject && !grade && <div className="empty">Now pick the student's grade — every goal's criteria are tuned to the grade you choose.</div>}
      {(searching || (subject && grade)) && results.length === 0 && <div className="empty">No goals match. Try a broader search or a different grade.</div>}

      <div className="cards">
        {results.slice(0, shown).map((g) => (
          <GoalCard key={g.id} entry={g} showContext={searching} onUse={onUse} onSave={onSave} />
        ))}
      </div>
      {results.length > shown && (
        <div className="load-more">
          <button className="btn ghost" onClick={() => setShown(shown + 40)}>Show more ({results.length - shown} remaining)</button>
        </div>
      )}
    </section>
  );
}

// ── Builder ──
function BuilderView({ builder, setBuilder, onSave }) {
  const set = (k) => (e) => setBuilder((b) => ({ ...b, [k]: e.target.value }));

  const composed = useMemo(() => {
    const name = builder.initials.trim() || "STUDENT";
    const opener = (builder.timeframe.trim() || "By the end of the IEP period").replace(/[,.]$/, "");
    let s = `${opener}, `;
    if (builder.condition.trim()) s += `given ${builder.condition.trim().replace(/\.$/, "")}, `;
    s += `${name} will ${builder.behavior.trim() ? builder.behavior.trim().replace(/\.$/, "") : "…"}`;
    if (builder.criterion.trim()) s += ` with ${builder.criterion.trim().replace(/\.$/, "")}`;
    if (builder.measure.trim()) s += `, as measured by ${builder.measure.trim().replace(/\.$/, "")}`;
    return s + `, on ${(builder.pm || "3 out of 4 progress monitoring events").trim().replace(/\.$/, "")}.`;
  }, [builder]);

  const strandOptions = Object.keys(SKILLS[builder.subject] || {});
  const [presentLevels, setPresentLevels] = useState("");
  const [drafts, setDrafts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runAI = async () => {
    if (!presentLevels.trim()) { setError("Describe present levels or needs first (no identifying info)."); return; }
    setLoading(true); setError(""); setDrafts(null);
    try {
      setDrafts(await draftGoalsWithAI({ subject: builder.subject, strand: builder.strand, grade: builder.grade, presentLevels }));
    } catch { setError("Couldn't generate drafts. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <section className="builder">
      <div className="compose-live">
        <div className="eyebrow">Live goal</div>
        <p className="composed">
          {(builder.timeframe.trim() || "By the end of the IEP period").replace(/[,.]$/, "")},{" "}
          {builder.condition.trim() && <><span className="hl c">given {builder.condition.trim()}</span>, </>}
          <strong>{builder.initials.trim() || "STUDENT"}</strong> will{" "}
          <span className="hl b">{builder.behavior.trim() || "…"}</span>
          {builder.criterion.trim() && <> with <span className="hl k">{builder.criterion.trim()}</span></>}
          {builder.measure.trim() && <>, as measured by {builder.measure.trim()}</>}
          , on {(builder.pm || "3 out of 4 progress monitoring events").trim()}.
        </p>
        <div className="row-actions">
          <CopyButton text={composed} />
          <button className="btn solid" onClick={() => onSave({
            subject: builder.subject, strand: builder.strand || "Custom", grade: builder.grade,
            skill: (builder.behavior || "Custom goal").slice(0, 60), level: "standard",
            text: composed, initials: builder.initials.trim(),
          })}>Save to library</button>
        </div>
      </div>

      <div className="grid2">
        <label>Student initials <input value={builder.initials} onChange={set("initials")} placeholder="e.g., J.R." maxLength={8} /></label>
        <label>Timeframe <input value={builder.timeframe} onChange={set("timeframe")} /></label>
        <label>Subject
          <select value={builder.subject} onChange={(e) => setBuilder((b) => ({ ...b, subject: e.target.value, strand: "" }))}>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label>Area of need
          <select value={builder.strand} onChange={set("strand")}>
            <option value="">—</option>
            {strandOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Grade
          <select value={builder.grade} onChange={set("grade")}>
            {GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}
          </select>
        </label>
      </div>

      <label>Condition — <em>Given…</em>
        <input value={builder.condition} onChange={set("condition")} placeholder="a grade-level passage and a graphic organizer" />
      </label>
      <label>Observable behavior — <em>will…</em>
        <input value={builder.behavior} onChange={set("behavior")} placeholder="identify the main idea and two supporting details" />
      </label>
      <div className="grid2">
        <label>Criterion — <em>with…</em>
          <ComboSelect value={builder.criterion} onChange={(v) => setBuilder((b) => ({ ...b, criterion: v }))} options={CRITERION_OPTIONS} placeholder="e.g., 8 of 10 trials" />
        </label>
        <label>Measurement — <em>on…</em>
          <ComboSelect value={builder.pm} onChange={(v) => setBuilder((b) => ({ ...b, pm: v }))} options={PM_OPTIONS} placeholder="e.g., 5 out of 6 progress monitoring events" />
        </label>
      </div>
      <label>Measured by — <em>as measured by…</em>
        <input value={builder.measure} onChange={set("measure")} placeholder="curriculum-based measurement" />
      </label>

      <div className="ai-panel">
        <div className="eyebrow">AI drafting assist</div>
        <p className="hint">Describe present levels (initials only). Drafts target {builder.strand || builder.subject}, {GRADE_LABEL[builder.grade]}.</p>
        <textarea rows={3} value={presentLevels} onChange={(e) => setPresentLevels(e.target.value)}
          placeholder="e.g., Reads 62 wcpm at 2nd-grade level; struggles with multisyllabic words; strong listening comprehension." />
        <div className="row-actions">
          <button className="btn solid" onClick={runAI} disabled={loading}>{loading ? "Drafting…" : "Draft 3 goals"}</button>
        </div>
        {error && <div className="err">{error}</div>}
        {drafts && (
          <div className="drafts rise">
            <div className="meta">Target skill: {drafts.skill}</div>
            {(drafts.goals || []).map((d, i) => (
              <div key={i} className="goal-row">
                <span className={`lvl lv-${d.level}`}>{(LEVEL_META[d.level] || LEVEL_META.standard).label}</span>
                <p className="goal-text">{d.text}</p>
                <div className="row-actions">
                  <button className="btn ghost sm" onClick={() => setBuilder((b) => ({ ...b, ...parseGoal(d.text) }))}>Load into builder</button>
                  <CopyButton text={d.text} small />
                </div>
              </div>
            ))}
            <p className="hint">Drafts are starting points — review for IDEA compliance and district requirements before use.</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Library ──
function LibraryView({ items, loaded, onRemove }) {
  if (!loaded) return <div className="empty">Loading your library…</div>;
  if (items.length === 0)
    return <div className="empty">Nothing saved yet. Save goals from the bank or builder — they'll persist between sessions.</div>;
  return (
    <section className="cards">
      {items.map((g) => (
        <article key={g.id} className="card rise">
          <div className="card-head">
            <div>
              <div className="skill">{g.initials ? `${g.initials} · ` : ""}{g.skill}</div>
              <div className="meta">{g.subject}{g.strand ? ` · ${g.strand}` : ""} · {GRADE_LABEL[g.grade] || g.grade} · saved {new Date(g.savedAt).toLocaleDateString()}</div>
            </div>
            <span className={`lvl lv-${g.level}`}>{(LEVEL_META[g.level] || LEVEL_META.standard).label}</span>
          </div>
          <p className="goal-text">{g.text}</p>
          <div className="row-actions">
            <CopyButton text={g.text} small />
            <button className="btn ghost sm danger" onClick={() => onRemove(g.id)}>Delete</button>
          </div>
        </article>
      ))}
    </section>
  );
}

// ── Styles ──
const CSS = `
:root {
  --ink: #21303b; --ink-soft: #64747f; --paper: #f3f5f6; --card: #ffffff;
  --teal: #16696b; --teal-soft: #e2efee; --marigold: #e0972f; --marigold-d: #a96a10;
  --line: #e2e8ea; --line-strong: #cfd8db; --danger: #a33c3c;
  --r: 12px; --shadow: 0 1px 2px rgba(33,48,59,.05); --shadow-up: 0 6px 18px rgba(33,48,59,.10);
}
* { box-sizing: border-box; }
.app { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--ink); background: var(--paper); min-height: 100vh; padding: 18px 18px 60px; max-width: 920px; margin: 0 auto; }
.masthead { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; justify-content: space-between; margin-bottom: 8px; }
h1 { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; font-size: 28px; margin: 2px 0 0; letter-spacing: -0.01em; }
.eyebrow { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--teal); font-weight: 700; }
.tabs { display: flex; gap: 4px; background: #e9edee; padding: 3px; border-radius: 999px; }
.tab { border: none; background: transparent; padding: 7px 14px; border-radius: 999px; cursor: pointer; font-size: 13.5px; font-weight: 500; color: var(--ink-soft); transition: color .15s, background .15s, box-shadow .15s; }
.tab.on { background: var(--card); color: var(--ink); box-shadow: var(--shadow); }
.tab:focus-visible, .btn:focus-visible, .chip:focus-visible, .seg:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.privacy { background: var(--teal-soft); border: 1px solid #c9dedd; color: #114c4e; font-size: 12.5px; padding: 7px 12px; border-radius: 8px; margin: 10px 0 16px; }
.panel { animation: fadeUp .22s ease-out; }
.searchbar { display: flex; gap: 8px; margin-bottom: 16px; }
.searchbar input { flex: 1; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); font-size: 14px; transition: border-color .15s, box-shadow .15s; }
.searchbar input:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(22,105,107,.10); outline: none; }
.searchbar select { padding: 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); font-size: 13.5px; }
.step-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-soft); font-weight: 700; margin: 14px 0 8px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line-strong); background: var(--card); border-radius: 999px; padding: 8px 14px; font-size: 13.5px; cursor: pointer; color: var(--ink); transition: background .15s, border-color .15s, color .15s, transform .12s; }
.chip:hover { border-color: var(--ink); transform: translateY(-1px); }
.chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.chip.grade.on { background: var(--marigold-d); border-color: var(--marigold-d); }
.chip.strand.on { background: var(--teal); border-color: var(--teal); }
.chip .count { font-size: 11px; opacity: .65; font-weight: 600; }
.chip-icon { font-size: 15px; }
.cards { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 14px 16px; box-shadow: var(--shadow); transition: box-shadow .18s, transform .18s, border-color .18s; }
.card:hover { box-shadow: var(--shadow-up); transform: translateY(-1px); border-color: var(--line-strong); }
.card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
.skill { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-size: 17px; font-weight: 600; }
.meta { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
.goal-text { margin: 10px 0 8px; font-size: 14.5px; line-height: 1.55; animation: fadeUp .18s ease-out; }
.seg-ctrl { display: flex; background: #eef1f2; border-radius: 999px; padding: 2px; }
.seg { border: none; background: transparent; font-size: 11.5px; font-weight: 600; padding: 5px 10px; border-radius: 999px; cursor: pointer; color: var(--ink-soft); transition: background .15s, color .15s, box-shadow .15s; }
.seg.on { background: var(--card); box-shadow: var(--shadow); }
.seg.on.lv-support { color: var(--teal); }
.seg.on.lv-standard { color: var(--ink); }
.seg.on.lv-rigor { color: var(--marigold-d); }
.lvl { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid; border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
.lv-support { color: var(--teal); border-color: var(--teal); }
.lv-standard { color: var(--ink); border-color: var(--ink); }
.lv-rigor { color: var(--marigold-d); border-color: var(--marigold-d); }
.row-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.btn { border-radius: 9px; cursor: pointer; font-size: 13.5px; padding: 8px 14px; border: 1px solid var(--ink); transition: background .15s, transform .12s, border-color .15s; }
.btn:active { transform: scale(.98); }
.btn.solid { background: var(--ink); color: #fff; }
.btn.solid:hover { background: #32424f; }
.btn.solid:disabled { opacity: .55; cursor: default; }
.btn.ghost { background: transparent; color: var(--ink); border-color: var(--line-strong); }
.btn.ghost:hover { border-color: var(--ink); }
.btn.sm { padding: 4px 10px; font-size: 12.5px; }
.btn.danger { color: var(--danger); }
.empty { color: var(--ink-soft); background: var(--card); border: 1px dashed var(--line-strong); border-radius: var(--r); padding: 26px; text-align: center; margin-top: 12px; font-size: 14px; }
.load-more { text-align: center; margin: 14px 0; }
.builder label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 12px; color: var(--ink); }
.builder label em { font-weight: 400; color: var(--ink-soft); }
.builder input, .builder select, .builder textarea { display: block; width: 100%; margin-top: 5px; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; font-size: 14px; background: var(--card); font-family: inherit; transition: border-color .15s, box-shadow .15s; }
.builder input:focus, .builder select:focus, .builder textarea:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(22,105,107,.10); outline: none; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
@media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; } .searchbar { flex-direction: column; } }
.compose-live { background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--marigold); border-radius: var(--r); padding: 14px 16px; margin-bottom: 18px; box-shadow: var(--shadow); }
.composed { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-size: 17px; line-height: 1.6; margin: 6px 0 10px; }
.hl.c { color: var(--teal); } .hl.b { font-weight: 600; } .hl.k { color: var(--marigold-d); }
.ai-panel { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 14px 16px; margin-top: 6px; box-shadow: var(--shadow); }
.hint { font-size: 12.5px; color: var(--ink-soft); margin: 6px 0 8px; }
.err { color: var(--danger); font-size: 13px; margin-top: 6px; }
.drafts { margin-top: 10px; }
.goal-row { border-top: 1px solid var(--line); padding: 10px 0 4px; }
.pill { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
.pill-ok { background: #e3efe6; color: #2c6e3f; }
.pill-warn { background: #fdf1dc; color: var(--marigold-d); }
.st-mastered { background: #e3efe6; color: #2c6e3f; }
.st-ontrack { background: var(--teal-soft); color: var(--teal); }
.st-attn { background: #f7e3e3; color: var(--danger); }
.st-none { background: #eef1f2; color: var(--ink-soft); }
.track-badges { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.chev { color: var(--ink-soft); font-size: 12px; }
.goal-text-sm { font-size: 13px; color: var(--ink-soft); line-height: 1.5; margin: 8px 0; }
.pm-chart { width: 100%; height: auto; background: #fafbfb; border: 1px solid var(--line); border-radius: 8px; margin: 6px 0; }
.pm-chart .tgt-line { stroke: var(--marigold); stroke-width: 1.5; stroke-dasharray: 5 4; }
.pm-chart .tgt-txt { font-size: 10px; fill: var(--marigold-d); }
.pm-chart .data-line { fill: none; stroke: var(--teal); stroke-width: 2; opacity: .7; }
.pm-chart .dot.met { fill: var(--teal); }
.pm-chart .dot.miss { fill: #c8867f; }
.chart-empty { font-size: 12.5px; color: var(--ink-soft); background: #fafbfb; border: 1px dashed var(--line); border-radius: 8px; padding: 14px; text-align: center; margin: 6px 0; }
.period-strip { display: flex; gap: 6px; margin: 8px 0; flex-wrap: wrap; }
.period { flex: 1; min-width: 56px; text-align: center; border: 1px solid var(--line); border-radius: 8px; padding: 5px 4px; background: var(--card); }
.period.cur { border-color: var(--teal); box-shadow: 0 0 0 2px rgba(22,105,107,.12); }
.p-label { font-size: 10px; font-weight: 700; color: var(--ink-soft); letter-spacing: .05em; }
.p-count { font-size: 13px; font-weight: 600; color: var(--marigold-d); }
.p-count.ok { color: #2c6e3f; }
.entry-form { border-top: 1px solid var(--line); margin-top: 8px; padding-top: 10px; }
.entry-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 8px; }
.entry-row.wrap { align-items: center; }
.entry-row .inline { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; gap: 4px; margin: 0; }
.entry-row .inline input, .entry-row .inline select { margin: 0; width: auto; min-width: 90px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 8px; font-size: 13.5px; background: var(--card); }
.entry-row .inline.chk { flex-direction: row; align-items: center; }
.entry-row .inline.chk input { min-width: 0; width: 16px; height: 16px; }
.ratio-wrap { display: flex; align-items: center; gap: 6px; font-weight: 400; font-size: 13px; }
.ratio-wrap input { width: 62px !important; min-width: 0 !important; }
.note-in { flex: 1; min-width: 160px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 13.5px; }
.log summary { font-size: 12.5px; font-weight: 600; color: var(--ink-soft); cursor: pointer; padding: 6px 0; }
.log-row { display: flex; gap: 10px; align-items: center; font-size: 12.5px; border-top: 1px solid var(--line); padding: 5px 0; }
.log-date { color: var(--ink-soft); min-width: 82px; }
.log-score { font-weight: 700; min-width: 52px; color: var(--danger); }
.log-score.ok { color: #2c6e3f; }
.log-sup { color: var(--ink-soft); min-width: 130px; }
.log-note { flex: 1; color: var(--ink-soft); }
.note-panel { border-top: 1px solid var(--line); margin-top: 10px; padding-top: 10px; }
.note-panel textarea { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; font-size: 13.5px; font-family: inherit; margin-bottom: 6px; }
.note-out { background: #fafbfb; border: 1px solid var(--line); border-left: 3px solid var(--teal); border-radius: 8px; padding: 12px 14px; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; margin-top: 8px; }
.profile-head { display: flex; gap: 14px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 14px; }
.student-card { cursor: pointer; }
.attach { margin-top: 14px; }
.attach select { flex: 1; min-width: 200px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 13.5px; background: var(--card); }
.attach input { flex: 1; min-width: 160px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 13.5px; }
.settings { margin-bottom: 14px; }
.combo { display: flex; flex-direction: column; gap: 6px; }
.combo select, .combo input { width: 100%; }
.del-confirm { background: var(--danger); border-color: var(--danger); }
.file-btn { display: inline-flex; align-items: center; cursor: pointer; }
.toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: var(--ink); color: #fff; padding: 9px 16px; border-radius: 999px; font-size: 13px; box-shadow: var(--shadow-up); animation: fadeUp .2s ease-out; }
.rise { animation: fadeUp .22s ease-out; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .panel, .rise, .toast, .goal-text { animation: none; } .card:hover, .chip:hover { transform: none; } }
`;

// ═════════════════════════════════════════════════════════════
// PROGRESS MONITORING — student profiles, 9-week periods,
// 7-event tracking, data charts, and structured progress notes
// ═════════════════════════════════════════════════════════════

async function loadJSON(key, fallback) {
  try { const res = await window.storage.get(key); return res ? JSON.parse(res.value) : fallback; }
  catch { return fallback; }
}
async function saveJSON(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
function downloadJSON(filename, obj) {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    return true;
  } catch { return false; }
}

// ── Period math: school year (start → end) split evenly into N periods ──
function periodBounds(settings) {
  if (!settings.yearStart || !settings.yearEnd) return null;
  const a = new Date(settings.yearStart + "T00:00:00");
  const b = new Date(settings.yearEnd + "T00:00:00");
  const total = Math.floor((b - a) / 86400000) + 1;
  if (!(total > 0)) return null;
  return { a, total, len: total / settings.periods };
}
function periodOf(dateStr, settings) {
  const pb = periodBounds(settings);
  if (!pb) return null;
  const d = new Date(dateStr + "T00:00:00");
  const days = Math.floor((d - pb.a) / 86400000);
  if (days < 0 || days >= pb.total) return null;
  return Math.min(settings.periods - 1, Math.floor(days / pb.len));
}
function periodRange(idx, settings) {
  const pb = periodBounds(settings);
  if (!pb) return null;
  const s = new Date(pb.a.getTime() + Math.round(idx * pb.len) * 86400000);
  const e = new Date(pb.a.getTime() + (Math.round((idx + 1) * pb.len) - 1) * 86400000);
  const fmt = (x) => x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}
function weeksPerPeriod(settings) {
  const pb = periodBounds(settings);
  return pb ? (pb.len / 7).toFixed(1) : null;
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

// ── Parse a goal's criterion into a measurable target ──
function parseTarget(goalText) {
  let m = goalText.match(/with (\d+)% accuracy/i);
  if (m) return { type: "pct", target: Number(m[1]), label: `${m[1]}% accuracy` };
  m = goalText.match(/in (\d+) of (\d+) (trials|opportunities|work samples|samples|school days)/i);
  if (m) return { type: "ratio", x: Number(m[1]), y: Number(m[2]), target: Math.round((Number(m[1]) / Number(m[2])) * 100), unit: m[3], label: `${m[1]} of ${m[2]} ${m[3]}` };
  return { type: "binary", label: "criterion met" };
}

function entryPct(e) {
  if (e.pct != null && e.pct !== "") return Number(e.pct);
  if (e.x != null && e.y) return Math.round((Number(e.x) / Number(e.y)) * 100);
  return null;
}
function entryMet(e, target) {
  if (e.metOverride != null) return e.metOverride;
  const p = entryPct(e);
  if (p != null && target.target != null) return p >= target.target;
  return !!e.met;
}

// Mastery per your goal frame: met on 3 of the last 4 events
function masteryStatus(entries, target) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const last4 = sorted.slice(-4);
  const metCount = last4.filter((e) => entryMet(e, target)).length;
  if (sorted.length === 0) return { label: "No data", cls: "st-none", metCount: 0, of: 0 };
  if (last4.length >= 4 && metCount >= 3) return { label: "Mastered", cls: "st-mastered", metCount, of: last4.length };
  const recent = sorted.slice(-3);
  const recentMet = recent.filter((e) => entryMet(e, target)).length;
  if (recentMet >= 2) return { label: "On track", cls: "st-ontrack", metCount, of: last4.length };
  return { label: "Needs attention", cls: "st-attn", metCount, of: last4.length };
}

// ── AI: rewrite shorthand into the district's 3-part note ──
async function rewriteProgressNote(shorthand) {
  const prompt = `TASK: Rewrite raw progress-monitoring notes into a structured 3-part format matching a specific exemplar style used for IEP/student progress reports.

STRUCTURE TO FOLLOW (always these 3 labeled parts, in this order):
1. Goal:
- State the target skill/behavior and the specific measurable objective (e.g., mastery percentage, skill benchmark).
- Written as a full sentence starting with the condition (e.g., "When given...") and ending with the target criterion (e.g., "...achieving X% mastery").
2. Current Progress:
- State the student's current performance level (e.g., current % mastery).
- State the level of support/assistance currently required (e.g., independent, moderate assistance, maximum assistance).
- Note the trend/trajectory (e.g., "steady progress," "inconsistent progress," "rapid growth") — do not invent this if not given, just rephrase what's provided.
3. Next Steps:
- State the specific skill-building focus going forward (what the student needs to work on next).
- Frame it as forward-looking action, tied back to closing the gap between current progress and the stated goal.

RULES:
- Use only the information given — do not add specifics (numbers, skills, timelines) that weren't in the original input.
- Keep each of the 3 sections to 1–2 sentences; this is a concise note, not a report.
- Use clear, professional, teacher-facing language (third person, student's name used naturally, no jargon beyond standard IEP terms like "mastery" and "assistance level").
- Preserve all factual details from the input exactly (percentages, skill names, assistance levels) — only the phrasing/structure changes, not the substance.
- Do not merge sections into one paragraph; keep them as clearly separated labeled parts.

OUTPUT FORMAT: the 3-part structure above, using **Goal:**, **Current Progress:**, and **Next Steps:** as bolded labels. Respond with ONLY the 3-part note, nothing else.

INPUT:
${shorthand}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

// Render **bold** labels from the note
function NoteText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="note-out">
      {parts.map((p, i) => p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)}
    </div>
  );
}

// ── Mini chart: dots per event, line when numeric, target line ──
function ProgressChart({ entries, target }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return <div className="chart-empty">No data points yet</div>;
  const W = 560, H = 120, pad = 26;
  const n = sorted.length;
  const xAt = (i) => pad + (n === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const numeric = sorted.every((e) => entryPct(e) != null);
  const yAt = (p) => H - pad - (p / 100) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pm-chart" role="img" aria-label="Progress chart">
      {numeric && target.target != null && (
        <>
          <line x1={pad} x2={W - pad} y1={yAt(target.target)} y2={yAt(target.target)} className="tgt-line" />
          <text x={W - pad + 2} y={yAt(target.target) + 4} className="tgt-txt">{target.target}%</text>
        </>
      )}
      {numeric && n > 1 && (
        <polyline className="data-line" points={sorted.map((e, i) => `${xAt(i)},${yAt(entryPct(e))}`).join(" ")} />
      )}
      {sorted.map((e, i) => {
        const met = entryMet(e, target);
        const cy = numeric ? yAt(entryPct(e)) : H / 2;
        return <circle key={e.id} cx={xAt(i)} cy={cy} r="5" className={met ? "dot met" : "dot miss"} />;
      })}
    </svg>
  );
}

// ── Per-goal tracker inside a student profile ──
function GoalTracker({ goal, settings, onUpdate, onRemove, studentInitials, notify }) {
  const target = useMemo(() => parseTarget(goal.text), [goal.text]);
  const status = masteryStatus(goal.entries, target);
  const [open, setOpen] = useState(false);

  // entry form state
  const [date, setDate] = useState(todayStr());
  const [pct, setPct] = useState("");
  const [x, setX] = useState("");
  const [metManual, setMetManual] = useState(false);
  const [support, setSupport] = useState("moderate assistance");
  const [note, setNote] = useState("");

  const addEntry = () => {
    const e = { id: `e_${Date.now()}`, date, support, note: note.trim() };
    if (target.type === "pct") { if (pct === "") return notify("Enter a score first"); e.pct = Number(pct); }
    else if (target.type === "ratio") { if (x === "") return notify("Enter a score first"); e.x = Number(x); e.y = target.y; }
    else e.met = metManual;
    onUpdate({ ...goal, entries: [...goal.entries, e] });
    setPct(""); setX(""); setNote(""); setMetManual(false);
    notify("Data point logged");
  };
  const removeEntry = (id) => onUpdate({ ...goal, entries: goal.entries.filter((e) => e.id !== id) });

  // period meter
  const curPeriod = periodOf(todayStr(), settings);
  const countIn = (idx) => goal.entries.filter((e) => periodOf(e.date, settings) === idx).length;

  // shorthand for the note generator
  const sorted = [...goal.entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const defaultShorthand = latest
    ? `${goal.skill} - ${studentInitials} at ${entryPct(latest) != null ? entryPct(latest) + "%" : (entryMet(latest, target) ? "criterion met" : "criterion not met")} with ${latest.support} toward goal of ${target.label}. Next: `
    : `${goal.skill} - ${studentInitials} working toward ${target.label} with `;
  const [shorthand, setShorthand] = useState("");
  const [noteOut, setNoteOut] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [noteErr, setNoteErr] = useState("");

  const generateNote = async () => {
    const input = shorthand.trim();
    if (!input) return setNoteErr("Add your shorthand first — include the trend and next focus.");
    setDrafting(true); setNoteErr(""); setNoteOut("");
    try { setNoteOut(await rewriteProgressNote(input)); }
    catch { setNoteErr("Couldn't generate the note. Please try again."); }
    finally { setDrafting(false); }
  };

  return (
    <article className="card goal-track">
      <div className="card-head" onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
        <div>
          <div className="skill">{goal.skill}</div>
          <div className="meta">{goal.subject} · {goal.strand} · target: {target.label}</div>
        </div>
        <div className="track-badges">
          {curPeriod != null && (
            <span className={`pill ${countIn(curPeriod) >= settings.required ? "pill-ok" : "pill-warn"}`}>
              {countIn(curPeriod)}/{settings.required} this period
            </span>
          )}
          <span className={`pill ${status.cls}`}>{status.label}{status.of >= 4 ? ` · ${status.metCount}/4` : ""}</span>
          <span className="chev">{open ? "▾" : "▸"}</span>
        </div>
      </div>

      {open && (
        <div className="rise">
          <p className="goal-text-sm">{goal.text}</p>
          <ProgressChart entries={goal.entries} target={target} />

          {periodBounds(settings) && (
            <div className="period-strip">
              {Array.from({ length: settings.periods }, (_, i) => (
                <div key={i} className={`period ${i === curPeriod ? "cur" : ""}`} title={periodRange(i, settings)}>
                  <div className="p-label">P{i + 1}</div>
                  <div className={`p-count ${countIn(i) >= settings.required ? "ok" : ""}`}>{countIn(i)}/{settings.required}</div>
                </div>
              ))}
            </div>
          )}

          <div className="entry-form">
            <div className="entry-row">
              <label className="inline">Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              {target.type === "pct" && <label className="inline">Score % <input type="number" min="0" max="100" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="e.g., 80" /></label>}
              {target.type === "ratio" && <label className="inline">Score <span className="ratio-wrap"><input type="number" min="0" max={target.y} value={x} onChange={(e) => setX(e.target.value)} placeholder={String(target.x)} /> / {target.y} {target.unit}</span></label>}
              {target.type === "binary" && <label className="inline chk"><input type="checkbox" checked={metManual} onChange={(e) => setMetManual(e.target.checked)} /> Criterion met</label>}
              <label className="inline">Support
                <select value={support} onChange={(e) => setSupport(e.target.value)}>
                  {SUPPORT_LEVELS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="entry-row">
              <input className="note-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (prompting, materials, context)…" />
              <button className="btn solid sm" onClick={addEntry}>Log data point</button>
            </div>
          </div>

          {sorted.length > 0 && (
            <details className="log">
              <summary>Data log ({sorted.length})</summary>
              {[...sorted].reverse().map((e) => (
                <div key={e.id} className="log-row">
                  <span className="log-date">{e.date}</span>
                  <span className={`log-score ${entryMet(e, target) ? "ok" : ""}`}>
                    {entryPct(e) != null ? `${entryPct(e)}%` : (entryMet(e, target) ? "met" : "not met")}
                  </span>
                  <span className="log-sup">{e.support}</span>
                  <span className="log-note">{e.note}</span>
                  <button className="btn ghost sm danger" onClick={() => removeEntry(e.id)}>✕</button>
                </div>
              ))}
            </details>
          )}

          <div className="note-panel">
            <div className="eyebrow">Progress note (3-part format)</div>
            <p className="hint">Shorthand in → structured note out. State the trend yourself (steady, inconsistent, rapid) and the next focus — the rewrite never invents facts.</p>
            <textarea rows={2} value={shorthand} onChange={(e) => setShorthand(e.target.value)} placeholder={defaultShorthand} />
            <div className="row-actions">
              <button className="btn ghost sm" onClick={() => setShorthand(defaultShorthand)}>Prefill from latest data</button>
              <button className="btn solid sm" onClick={generateNote} disabled={drafting}>{drafting ? "Writing…" : "Generate note"}</button>
            </div>
            {noteErr && <div className="err">{noteErr}</div>}
            {noteOut && (
              <div className="rise">
                <NoteText text={noteOut} />
                <div className="row-actions"><CopyButton text={noteOut} small /></div>
              </div>
            )}
          </div>

          <div className="row-actions" style={{ marginTop: 10 }}>
            <button className="btn ghost sm danger" onClick={onRemove}>Remove goal from student</button>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Student profile ──
function StudentProfile({ student, library, settings, onUpdate, onDelete, onBack, notify }) {
  const [attachId, setAttachId] = useState("");
  const [customText, setCustomText] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const attachFromLibrary = () => {
    const item = library.find((g) => g.id === attachId);
    if (!item) return;
    const g = { id: `sg_${Date.now()}`, text: item.text, skill: item.skill, subject: item.subject, strand: item.strand, grade: item.grade, entries: [] };
    onUpdate({ ...student, goals: [...student.goals, g] });
    setAttachId("");
    notify("Goal attached");
  };
  const attachCustom = () => {
    const t = customText.trim();
    if (!t) return;
    const g = { id: `sg_${Date.now()}`, text: t, skill: t.replace(/^By the end of the IEP period,\s*given .*?, STUDENT will /i, "").slice(0, 60), subject: "Custom", strand: "Custom", grade: student.grade, entries: [] };
    onUpdate({ ...student, goals: [...student.goals, g] });
    setCustomText("");
    notify("Goal attached");
  };

  const exportData = () => {
    const blob = JSON.stringify(student, null, 2);
    navigator.clipboard.writeText(blob).then(() => notify("Student data copied as JSON — paste somewhere safe"));
  };

  return (
    <section>
      <div className="profile-head">
        <button className="btn ghost sm" onClick={onBack}>← All students</button>
        <div className="profile-id">
          <div className="skill" style={{ fontSize: 22 }}>{student.initials}</div>
          <div className="meta">{GRADE_LABEL[student.grade] || student.grade} · {student.goals.length} goal{student.goals.length === 1 ? "" : "s"}</div>
        </div>
        <div className="row-actions">
          <button className="btn ghost sm" onClick={exportData}>Export data</button>
          {!confirmDel ? (
            <button className="btn ghost sm danger" onClick={() => setConfirmDel(true)}>Delete student</button>
          ) : (
            <>
              <button className="btn solid sm del-confirm" onClick={onDelete}>Really delete {student.initials} & all data</button>
              <button className="btn ghost sm" onClick={() => setConfirmDel(false)}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="cards">
        {student.goals.map((g) => (
          <GoalTracker key={g.id} goal={g} settings={settings} studentInitials={student.initials} notify={notify}
            onUpdate={(ng) => onUpdate({ ...student, goals: student.goals.map((x) => (x.id === ng.id ? ng : x)) })}
            onRemove={() => onUpdate({ ...student, goals: student.goals.filter((x) => x.id !== g.id) })} />
        ))}
      </div>

      <div className="attach card">
        <div className="eyebrow">Attach a goal</div>
        {library.length > 0 ? (
          <div className="entry-row">
            <select value={attachId} onChange={(e) => setAttachId(e.target.value)}>
              <option value="">From your library…</option>
              {library.map((g) => <option key={g.id} value={g.id}>{g.skill} — {g.subject}, {GRADE_LABEL[g.grade] || g.grade}</option>)}
            </select>
            <button className="btn solid sm" onClick={attachFromLibrary} disabled={!attachId}>Attach</button>
          </div>
        ) : <p className="hint">Your library is empty — save goals from the Goal Bank or Builder first, then attach them here.</p>}
        <div className="entry-row">
          <input value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="…or paste a full goal here" />
          <button className="btn ghost sm" onClick={attachCustom} disabled={!customText.trim()}>Attach custom</button>
        </div>
      </div>
    </section>
  );
}

// ── Students tab: caseload + settings ──
function StudentsView({ library, notify }) {
  const [students, setStudents] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [newInitials, setNewInitials] = useState("");
  const [newGrade, setNewGrade] = useState("3");

  useEffect(() => {
    Promise.all([loadJSON(STUDENTS_KEY, []), loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS)]).then(([st, se]) => {
      setStudents(st); setSettings({ ...DEFAULT_SETTINGS, ...se }); setLoaded(true);
    });
  }, []);

  const saveStudents = (next) => { setStudents(next); saveJSON(STUDENTS_KEY, next); };
  const saveSettings = (next) => { setSettings(next); saveJSON(SETTINGS_KEY, next); };

  const exportAll = async () => {
    const lib = await loadJSON(STORAGE_KEY, []);
    const payload = { app: "IEP Goal Studio", exported: new Date().toISOString(), settings, students, library: lib };
    if (downloadJSON(`iep-goal-studio-backup-${todayStr()}.json`, payload)) notify("Backup downloaded");
    else { try { await navigator.clipboard.writeText(JSON.stringify(payload)); notify("Download blocked — backup copied to clipboard instead"); } catch { notify("Couldn't export — try again"); } }
  };

  const onImportFile = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = JSON.parse(r.result);
        if (!Array.isArray(d.students)) throw new Error("bad file");
        await saveJSON(STUDENTS_KEY, d.students);
        setStudents(d.students);
        if (d.settings) { const s = { ...DEFAULT_SETTINGS, ...d.settings }; await saveJSON(SETTINGS_KEY, s); setSettings(s); }
        if (Array.isArray(d.library)) await saveJSON(STORAGE_KEY, d.library);
        notify(`Backup restored — ${d.students.length} student${d.students.length === 1 ? "" : "s"}${Array.isArray(d.library) ? " (reopen the app to refresh the Library tab)" : ""}`);
      } catch { notify("That file doesn't look like a valid IEP Goal Studio backup"); }
    };
    r.readAsText(f);
  };

  const addStudent = () => {
    const ini = newInitials.trim();
    if (!ini) return notify("Enter the student's initials");
    if (ini.length > 8 || /\s.*\s/.test(ini)) return notify("Initials only, please — no names");
    const s = { id: `s_${Date.now()}`, initials: ini, grade: newGrade, goals: [], createdAt: todayStr() };
    saveStudents([...students, s]);
    setNewInitials("");
    setOpenId(s.id);
  };

  if (!loaded) return <div className="empty">Loading caseload…</div>;

  const open = students.find((s) => s.id === openId);
  if (open) {
    return <StudentProfile student={open} library={library} settings={settings} notify={notify}
      onUpdate={(ns) => saveStudents(students.map((s) => (s.id === ns.id ? ns : s)))}
      onDelete={() => { saveStudents(students.filter((s) => s.id !== open.id)); setOpenId(null); notify(`${open.initials} deleted`); }}
      onBack={() => setOpenId(null)} />;
  }

  const curPeriod = periodOf(todayStr(), settings);

  return (
    <section>
      <div className="card settings">
        <div className="eyebrow">Progress monitoring setup</div>
        <div className="entry-row wrap">
          <label className="inline">School year start <input type="date" value={settings.yearStart} onChange={(e) => saveSettings({ ...settings, yearStart: e.target.value })} /></label>
          <label className="inline">School year end <input type="date" value={settings.yearEnd} onChange={(e) => saveSettings({ ...settings, yearEnd: e.target.value })} /></label>
          <label className="inline">Periods <input type="number" min="1" max="12" value={settings.periods} onChange={(e) => saveSettings({ ...settings, periods: Math.max(1, Number(e.target.value) || 1) })} /></label>
          <label className="inline">Events required <input type="number" min="1" max="20" value={settings.required} onChange={(e) => saveSettings({ ...settings, required: Math.max(1, Number(e.target.value) || 1) })} /></label>
        </div>
        <p className="hint">
          {periodBounds(settings)
            ? curPeriod != null
              ? `Currently in Period ${curPeriod + 1} of ${settings.periods} (${periodRange(curPeriod, settings)}). The year divides into ${settings.periods} periods of about ${weeksPerPeriod(settings)} weeks each; every goal needs ${settings.required} data points per period.`
              : `Today falls outside the school year (${settings.yearStart} → ${settings.yearEnd}). The year divides into ${settings.periods} periods of about ${weeksPerPeriod(settings)} weeks each, ${settings.required} data points per goal per period. Period 1 begins ${periodRange(0, settings)}.`
            : "Set the school year start and end dates to activate period tracking."}
        </p>
        <div className="row-actions">
          <button className="btn ghost sm" onClick={exportAll}>⬇ Export all data (backup)</button>
          <label className="btn ghost sm file-btn">
            Import backup
            <input type="file" accept=".json,application/json" onChange={onImportFile} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      <div className="cards">
        {students.map((s) => {
          const flags = s.goals.filter((g) => masteryStatus(g.entries, parseTarget(g.text)).cls === "st-attn").length;
          const behind = curPeriod != null ? s.goals.filter((g) => g.entries.filter((e) => periodOf(e.date, settings) === curPeriod).length < settings.required).length : 0;
          return (
            <article key={s.id} className="card student-card" onClick={() => setOpenId(s.id)}>
              <div className="card-head">
                <div>
                  <div className="skill">{s.initials}</div>
                  <div className="meta">{GRADE_LABEL[s.grade] || s.grade} · {s.goals.length} goal{s.goals.length === 1 ? "" : "s"}</div>
                </div>
                <div className="track-badges">
                  {flags > 0 && <span className="pill st-attn">{flags} needs attention</span>}
                  {curPeriod != null && s.goals.length > 0 && (behind > 0
                    ? <span className="pill pill-warn">{behind} behind on data</span>
                    : <span className="pill pill-ok">data on pace</span>)}
                  <span className="chev">▸</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="attach card">
        <div className="eyebrow">Add a student</div>
        <div className="entry-row">
          <input value={newInitials} onChange={(e) => setNewInitials(e.target.value)} placeholder="Initials only, e.g., J.R." maxLength={8} />
          <select value={newGrade} onChange={(e) => setNewGrade(e.target.value)}>
            {GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}
          </select>
          <button className="btn solid sm" onClick={addStudent}>Add student</button>
        </div>
        <p className="hint">Reminder: initials only — never full names, IDs, or other identifying details. Use Export on each profile to back up data.</p>
      </div>
    </section>
  );
}
