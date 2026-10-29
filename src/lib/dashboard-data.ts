import type { IconName } from "../components/Icon";

export type Bi = { en: string; bn: string };
export const bi = (en: string, bn: string): Bi => ({ en, bn });

export type Subject = { id: string; icon: IconName; title: Bi; cover: string; live: boolean; bar: string; chapters: Bi[] };
export const SUBJECTS: Subject[] = [
  { id: "math", icon: "calc", title: bi("Mathematics", "গণিত"), cover: "/BookCover/Math.png", live: true, bar: "bg-brand-500", chapters: [bi("Natural Numbers & Fractions", "স্বাভাবিক সংখ্যা ও ভগ্নাংশ"), bi("Algebraic Expressions", "বীজগণিতীয় রাশি"), bi("Equations & Geometry", "সমীকরণ ও জ্যামিতি"), bi("Measurement", "পরিমাপ")] },
  { id: "science", icon: "lightbulb", title: bi("Science", "বিজ্ঞান"), cover: "/BookCover/Science.png", live: false, bar: "bg-lagoon", chapters: [bi("Force, Motion & Energy", "বল, গতি ও শক্তি"), bi("Light, Sound & Electricity", "আলো, শব্দ ও বিদ্যুৎ")] },
  { id: "bangla", icon: "book", title: bi("Bangla", "বাংলা"), cover: "/BookCover/Bangla.png", live: false, bar: "bg-coral", chapters: [bi("Language & Grammar", "ভাষা ও ব্যাকরণ"), bi("Literature", "সাহিত্য পাঠ")] },
  { id: "english", icon: "chat", title: bi("English", "ইংরেজি"), cover: "/BookCover/English.png", live: false, bar: "bg-marigold", chapters: [bi("English Grammar", "English Grammar"), bi("Reading & Vocabulary", "Reading & Vocabulary")] },
  { id: "social", icon: "compass", title: bi("Social Science", "সমাজ ও বিশ্বপরিচয়"), cover: "/BookCover/Bangladesh and Studies.png", live: false, bar: "bg-brand-500", chapters: [bi("History of Bangladesh", "বাংলাদেশের ইতিহাস"), bi("Geography & Environment", "ভূগোল ও পরিবেশ")] },
  { id: "ict", icon: "keyboard", title: bi("ICT", "তথ্য ও যোগাযোগ প্রযুক্তি"), cover: "/BookCover/ICT.png", live: false, bar: "bg-lagoon", chapters: [bi("Computer & Internet", "কম্পিউটার ও ইন্টারনেট"), bi("Intro to Programming", "প্রোগ্রামিংয়ের হাতেখড়ি")] },
];

export const LESSONS = [
  { subject: bi("Mathematics", "গণিত"), title: bi("Solving Simple Equations", "সরল সমীকরণের সমাধান"), meta: bi("Chapter 4 · 12 min · Board lesson", "অধ্যায় ৪ · ১২ মিনিট · বোর্ড লেসন"), progress: 60 },
  { subject: bi("Mathematics", "গণিত"), title: bi("Factors, Multiples, LCM & HCF", "গুণিতক ও গুণনীয়ক, ল.সা.গু ও গ.সা.গু"), meta: bi("Chapter 1 · 10 min · Board lesson", "অধ্যায় ১ · ১০ মিনিট · বোর্ড লেসন"), progress: 30 },
  { subject: bi("Science", "বিজ্ঞান"), title: bi("Force and Motion", "বল ও গতি"), meta: bi("Chapter 2 · 9 min · Board lesson", "অধ্যায় ২ · ৯ মিনিট · বোর্ড লেসন"), progress: 0 },
];

export const REVISION = [
  { title: bi("Simple Equations — key steps", "সরল সমীকরণ — মূল ধাপ"), meta: bi("Due today · 8 flashcards", "আজকে বাকি · ৮টি ফ্ল্যাশকার্ড") },
  { title: bi("LCM & HCF shortcuts", "ল.সা.গু ও গ.সা.গু-র শর্টকাট"), meta: bi("Due tomorrow · 6 flashcards", "আগামীকাল · ৬টি ফ্ল্যাশকার্ড") },
  { title: bi("What you have learned this week", "এই সপ্তাহে যা যা শিখেছ"), meta: bi("3 topics · Quick recap", "৩টি টপিক · ঝটপট রিক্যাপ") },
];

export const HOMEWORK = [
  { title: bi("Solve: 2x − 1 = 5, 3x + 4 = 19", "সমাধান করো: 2x − 1 = 5, 3x + 4 = 19"), meta: bi("Mathematics · Due tonight", "গণিত · আজ রাতে জমা") },
  { title: bi("Write 5 sentences with new words", "নতুন শব্দ দিয়ে ৫টি বাক্য লেখো"), meta: bi("English · Due tomorrow", "ইংরেজি · আগামীকাল জমা") },
  { title: bi("Draw and label a plant cell", "উদ্ভিদ কোষ এঁকে অংশগুলো চিহ্নিত করো"), meta: bi("Science · Due Friday", "বিজ্ঞান · শুক্রবার জমা") },
];

export const PRACTICE_QS = [
  { q: bi("Which one is a prime number?", "কোনটি মৌলিক সংখ্যা?"), options: ["21", "29", "39", "51"], answer: 1 },
  { q: bi("If 2x − 1 = 5, then x = ?", "2x − 1 = 5 হলে x = ?"), options: ["2", "3", "4", "6"], answer: 1 },
  { q: bi("What is the LCM of 6 and 8?", "৬ ও ৮-এর ল.সা.গু কত?"), options: ["12", "18", "24", "48"], answer: 2 },
];

export const GAMES = [
  { icon: "game" as IconName, title: bi("Question Mountain", "প্রশ্নের পাহাড়"), body: bi("Climb higher with every right answer.", "প্রতিটি সঠিক উত্তরে আরও উপরে ওঠো।"), chip: "bg-brand-500 text-white" },
  { icon: "target" as IconName, title: bi("Math Rocket", "অঙ্ক-রকেট"), body: bi("Solve fast, fly further.", "দ্রুত সমাধান করো, আরও দূরে ওড়ো।"), chip: "bg-marigold text-ink" },
  { icon: "heart" as IconName, title: bi("Pair Magic", "জোড়া-জাদু"), body: bi("Match the pairs before time runs out.", "সময় শেষ হওয়ার আগে জোড়া মেলাও।"), chip: "bg-coral text-white" },
  { icon: "lightbulb" as IconName, title: bi("True or Story?", "সত্যি না গপ্পো?"), body: bi("Spot what is true and what is made up.", "কোনটা সত্যি আর কোনটা গপ্পো, ধরো।"), chip: "bg-lagoon text-white" },
  { icon: "chat" as IconName, title: bi("Word Bridge", "শব্দ-সেতু"), body: bi("Build bridges with the right words.", "সঠিক শব্দে সেতু বানাও।"), chip: "bg-brand-500 text-white" },
  { icon: "compass" as IconName, title: bi("Sort the Bazaar", "বাছাই-বাজার"), body: bi("Sort living and non-living things.", "জীব আর জড় আলাদা করো।"), chip: "bg-marigold text-ink" },
];
