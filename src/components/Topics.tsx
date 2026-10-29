"use client";

import Image from "next/image";
import { Icon, type IconName } from "./Icon";
import { SectionHead, TextureOverlay } from "./Hero";
import { Reveal } from "./Reveal";
import { pick, useLang } from "../lib/i18n";

const TITLE_EN: Record<string, string> = {
  "গণিত": "Mathematics",
  "বিজ্ঞান": "Science",
  "বাংলা": "Bangla",
  "ইংরেজি": "English",
  "সমাজ ও বিশ্বপরিচয়": "Social Science & World Studies",
  "তথ্য ও যোগাযোগ প্রযুক্তি": "ICT",
};

type Topic = {
  icon: IconName;
  title: string;
  live: boolean;
  bar: string;
  iconClass: string;
  cover: string;
  coverW: number;
  coverH: number;
  chapters: [string, string][];
};

const TOPICS: Topic[] = [
  {
    icon: "calc",
    title: "গণিত",
    live: true,
    bar: "bg-brand-500",
    iconClass: "text-brand-600 bg-brand-50 border-brand-100",
    cover: "/BookCover/Math.png",
    coverW: 502,
    coverH: 636,
    chapters: [
      ["স্বাভাবিক সংখ্যা ও ভগ্নাংশ", "গুণিতক ও গুণনীয়ক, ল.সা.গু ও গ.সা.গু…"],
      ["পূর্ণসংখ্যা, অনুপাত ও শতকরা", "ঋণাত্মক সংখ্যা, অনুপাত ও সমানুপাত…"],
      ["বীজগণিতীয় রাশি", "৪.১ বীজগণিতীয় প্রতীক, চলক ও প্রক্রিয়া চিহ্ন, ৪.২ বীজগণিতীয় রাশি, পদ ও সহগ…"],
      ["বীজগণিতের হাতেখড়ি", "বীজগণিতীয় রাশি, সূত্রের ব্যবহার…"],
      ["সমীকরণ ও জ্যামিতি", "সরল সমীকরণ, রেখা ও কোণ…"],
      ["পরিমাপ", "দৈর্ঘ্য ও ক্ষেত্রফল, আয়তন…"],
      ["তথ্য ও উপস্থাপন", "তথ্য সংগ্রহ, সারণি তৈরি…"],
    ],
  },
  {
    icon: "lightbulb",
    title: "বিজ্ঞান",
    live: false,
    bar: "bg-lagoon",
    iconClass: "text-padma-ink bg-lagoon-soft border-lagoon/25",
    cover: "/BookCover/Science.png",
    coverW: 499,
    coverH: 636,
    chapters: [
      ["বল, গতি ও শক্তি", "বল ও গতি, কাজ, ক্ষমতা ও শক্তি…"],
      ["আলো, শব্দ ও বিদ্যুৎ", "আলোর প্রতিফলন ও প্রতিসরণ, শব্দ ও তরঙ্গ…"],
    ],
  },
  {
    icon: "book",
    title: "বাংলা",
    live: false,
    bar: "bg-coral",
    iconClass: "text-shapla-ink bg-coral-soft border-coral/25",
    cover: "/BookCover/Bangla.png",
    coverW: 507,
    coverH: 648,
    chapters: [
      ["ভাষা ও ব্যাকরণ", "ধ্বনি ও বর্ণ, সন্ধি…"],
      ["সাহিত্য পাঠ", "কবিতার মূলভাব, গল্পের চরিত্র বিশ্লেষণ…"],
    ],
  },
  {
    icon: "chat",
    title: "ইংরেজি",
    live: false,
    bar: "bg-marigold",
    iconClass: "text-ember-ink bg-marigold-soft border-marigold/30",
    cover: "/BookCover/English.png",
    coverW: 504,
    coverH: 640,
    chapters: [
      ["English Grammar", "Parts of Speech, Tense…"],
      ["Reading & Vocabulary", "Reading Comprehension, Vocabulary in Context…"],
    ],
  },
  {
    icon: "compass",
    title: "সমাজ ও বিশ্বপরিচয়",
    live: false,
    bar: "bg-brand-500",
    iconClass: "text-brand-600 bg-brand-50 border-brand-100",
    cover: "/BookCover/Bangladesh and Studies.png",
    coverW: 502,
    coverH: 654,
    chapters: [
      ["বাংলাদেশের ইতিহাস", "প্রাচীন বাংলা, ভাষা আন্দোলন…"],
      ["ভূগোল ও পরিবেশ", "বাংলাদেশের ভৌগোলিক অবস্থান, নদ-নদী ও জলবায়ু…"],
    ],
  },
  {
    icon: "keyboard",
    title: "তথ্য ও যোগাযোগ প্রযুক্তি",
    live: false,
    bar: "bg-lagoon",
    iconClass: "text-padma-ink bg-lagoon-soft border-lagoon/25",
    cover: "/BookCover/ICT.png",
    coverW: 502,
    coverH: 677,
    chapters: [
      ["কম্পিউটার ও ইন্টারনেট", "কম্পিউটারের অংশ, ইন্টারনেট ও নিরাপত্তা…"],
      ["প্রোগ্রামিংয়ের হাতেখড়ি", "অ্যালগরিদম ও ফ্লোচার্ট, সংখ্যা পদ্ধতি…"],
    ],
  },
];

export function Topics() {
  const { lang } = useLang();
  return (
    <>
      <section id="topics" aria-labelledby="topics-title" className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
        <div className="mx-auto w-full max-w-7xl">
          <TextureOverlay kind="grid" className="opacity-60" />
          <SectionHead
            id="topics-title"
            title={lang === "bn" ? <>ষষ্ঠ থেকে দশম শ্রেণি — <span className="text-brand-600">সব বিষয়, অধ্যায় ধরে ধরে</span></> : <>Class 6 to 10 — <span className="text-brand-600">every subject, chapter by chapter</span></>}
            sub={pick(lang, "Organised by the national curriculum books, so it moves together with your school study.", "জাতীয় পাঠ্যক্রমের বই অনুসারে সাজানো, তাই স্কুলের পড়ার সাথে মিলিয়েই এগোনো যায়।")}
          />
          <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((topic, i) => (
              <Reveal key={topic.title} as="li" delay={i * 70} className="h-full">
                <article
                  aria-disabled={!topic.live || undefined}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-paper-edge pl-1.5 transition-[transform,box-shadow] duration-300 ${
                    topic.live ? "bg-white shadow-soft hover:-translate-y-1 hover:shadow-lift" : "bg-white/50 grayscale-[0.6]"
                  }`}
                >
                  <span aria-hidden="true" className={`absolute top-0 bottom-0 left-0 w-1.5 transition-[width] duration-300 ease-spring group-hover:w-2.5 ${topic.bar}`} />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`grid size-9 place-items-center rounded-lg border transition-transform duration-300 ease-spring group-hover:-rotate-6 ${topic.iconClass}`}>
                        <Icon name={topic.icon} className="size-4" strokeWidth={1.8} />
                      </span>
                      <Image
                        src={topic.cover}
                        alt={`${topic.title} বইয়ের প্রচ্ছদ`}
                        width={topic.coverW}
                        height={topic.coverH}
                        className="h-16 w-auto shrink-0 rounded-md border border-paper-edge object-cover shadow-hard-sm"
                      />
                      {topic.live ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold tracking-wide text-brand-700">{pick(lang, "Live now", "চালু আছে")}</span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-ink/15 bg-paper px-3 py-1 text-xs font-semibold text-ink-muted">{pick(lang, "Coming soon", "শীঘ্রই আসছে")}</span>
                      )}
                    </div>
                    <h3 className={`mt-3 text-[1.05rem] leading-snug ${topic.live ? "text-ink" : "text-ink-muted"}`}>{lang === "bn" ? topic.title : (TITLE_EN[topic.title] ?? topic.title)}</h3>
                    <ul className="mt-3 flex flex-col gap-1.5 border-t border-paper-edge pt-3">
                      {topic.chapters.map(([name, detail]) => (
                        <li key={name} className={`flex items-start gap-2 text-[0.84rem] ${topic.live ? "text-ink-soft" : "text-ink-muted"}`}>
                          <Icon name={topic.live ? "check" : "clock"} className={`mt-1 size-3.5 shrink-0 ${topic.live ? "text-kolapata" : "text-ink-muted"}`} strokeWidth={2.8} />
                          <span>
                            {name}
                            <span className="text-ink-muted"> — {detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
      <div aria-hidden="true" className="relative mx-auto w-full max-w-5xl px-6">
        <svg viewBox="0 0 400 24" preserveAspectRatio="none" className="h-6 w-full" fill="none">
          <line x1="0" y1="12" x2="186" y2="12" stroke="var(--color-flame)" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="7 6" />
          <line x1="214" y1="12" x2="400" y2="12" stroke="var(--color-flame)" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="7 6" />
          <path d="M200 2c3.8 4.6 6.4 8 6.4 11.4a6.4 6.4 0 0 1-12.8 0C193.6 10 196.2 6.6 200 2z" fill="var(--color-flame)" />
          <path d="M200 9.2c1.7 2.1 2.8 3.6 2.8 5a2.8 2.8 0 0 1-5.6 0c0-1.4 1.1-2.9 2.8-5z" fill="#ffe29a" />
        </svg>
      </div>
    </>
  );
}
