export const SKILL_SLUGS = ["listening", "reading", "writing", "speaking"] as const;
export type SkillSlug = (typeof SKILL_SLUGS)[number];

export const SKILLS: Array<{
  slug: SkillSlug;
  name: string;
  db: "LISTENING" | "READING" | "WRITING" | "SPEAKING";
  blurb: string;
}> = [
  {
    slug: "listening",
    name: "Listening",
    db: "LISTENING",
    blurb: "Four parts, played once, exactly like the exam.",
  },
  {
    slug: "reading",
    name: "Reading",
    db: "READING",
    blurb: "Academic passages with every question type.",
  },
  {
    slug: "writing",
    name: "Writing",
    db: "WRITING",
    blurb: "Task 1 and Task 2 with word counts and feedback.",
  },
  {
    slug: "speaking",
    name: "Speaking",
    db: "SPEAKING",
    blurb: "Cue cards, timers, and record yourself.",
  },
];

export function isSkillSlug(value: string | undefined): value is SkillSlug {
  return Boolean(value && (SKILL_SLUGS as readonly string[]).includes(value));
}

export function skillBySlug(slug: string | undefined) {
  return SKILLS.find((skill) => skill.slug === slug);
}
