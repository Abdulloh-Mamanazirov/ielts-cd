/**
 * Every string on the marketing site, in English.
 *
 * This is the reference locale: it is the only one guaranteed complete, and
 * every other locale falls back to it key by key. Contact details and links are
 * here too, because a locale may legitimately want a different Telegram channel
 * even when the wording is shared.
 */
export const en = {
  instructor: {
    name: "Davronbek Nabiev",
    role: "IELTS Instructor",
    tagline: "Helping students achieve IELTS Band 7–9",
    location: "Tashkent, Uzbekistan",
    email: "davronbeknabiev@gmail.com",
    phone: "+998 93 262 66 77",
    telegram: "https://t.me/DavronbekNabiev",
    telegramHandle: "@DavronbekNabiev",
    instagram: "https://instagram.com/",
    youtube: "https://youtube.com/",
  },

  stats: [
    { eyebrow: "EXPERIENCE", value: "4+", label: "years teaching IELTS" },
    { eyebrow: "PERSONAL SCORE", value: "8.0", label: "overall, IELTS Academic" },
    { eyebrow: "TAUGHT", value: "1000+", label: "students since 2022" },
  ],

  hero: {
    primaryCta: "Take a mock test",
    secondaryCta: "Practice for free",
  },

  results: {
    heading: "Student results",
    subheading: "Real band scores from students who prepared here.",
  },

  practice: {
    heading: "Practice tests",
    subheading: "Work on one skill at a time, or sit a full computer-delivered mock.",
    mockTitle: "Real IELTS mock tests",
    mockBody:
      "The computer-delivered interface, the real timing, and a band score the moment you finish.",
    mockPoints: [
      "Cambridge format",
      "Computer-based",
      "Timed like the real exam",
      "Detailed feedback and band score",
    ],
    mockCta: "Book a mock test",
  },

  why: {
    eyebrow: "About me",
    heading: "Why learn with me?",
    body:
      "My goal is simple: to help you reach your target band score with the right strategies, personal feedback, and steady support all the way to test day.",
    points: [
      "Personalised feedback on every submission",
      "Strategies that work under real exam timing",
      "Weekly mock exams",
      "Score analysis so you know what to fix",
      "Premium learning materials",
      "Support on Telegram between lessons",
    ],
  },

  testimonials: {
    heading: "What students say",
    subheading: "In their words, and in their own videos.",
  },

  footer: {
    blurb: "Helping students in Uzbekistan and beyond achieve IELTS Band 7–9.",
    quickLinks: "Quick links",
    resources: "Resources",
    contact: "Contact",
    followMe: "Follow me",
    rights: "All rights reserved.",
  },

  nav: [
    { href: "/results", label: "Student results" },
    { href: "/#practice", label: "Practice tests" },
    { href: "/pricing", label: "Plans" },
    { href: "/#about", label: "About me" },
    { href: "/#testimonials", label: "Reviews" },
  ],

  skills: [
    {
      slug: "listening",
      name: "Listening",
      blurb: "Four parts, played once, exactly like the exam.",
    },
    { slug: "reading", name: "Reading", blurb: "Academic passages with every question type." },
    { slug: "writing", name: "Writing", blurb: "Task 1 and Task 2 with word counts and feedback." },
    { slug: "speaking", name: "Speaking", blurb: "Cue cards, timers, and record yourself." },
  ],
};
