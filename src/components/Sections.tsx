"use client";

import { Icon, type IconName } from "./Icon";
import { SectionHead, TextureOverlay } from "./Hero";
import { Reveal } from "./Reveal";
import { GetStartedButton } from "./GetStarted";
import { pick, useLang, type Lang } from "../lib/i18n";
import { YOUTUBE_VIDEO_URL, youtubeEmbedUrl } from "../lib/site";

type Bi = { en: string; bn: string };
const bi = (en: string, bn: string): Bi => ({ en, bn });
const t = (lang: Lang, v: Bi) => (lang === "bn" ? v.bn : v.en);

const FEATURES: { icon: IconName; chip: string; title: Bi; body: Bi }[] = [
  { icon: "board", chip: "bg-brand-500 text-white", title: bi("Taught on the board, explained out loud", "বোর্ডে লিখে, কণ্ঠে বোঝানো ক্লাস"), body: bi("The teacher writes every step on the whiteboard, marks the important parts, draws pictures — and explains it all in a clear voice.", "শিক্ষক প্রতিটি ধাপ হোয়াইটবোর্ডে লেখেন, দরকারি জায়গা দাগিয়ে দেন, ছবি এঁকে দেখান — আর পুরোটা মুখে বোঝান।") },
  { icon: "chat", chip: "bg-marigold text-ink", title: bi("Explained in simple language", "সহজ ভাষায় ব্যাখ্যা"), body: bi("Learn in Bangla or English — whichever suits you. Familiar examples from pitha, the bazaar and cricket. Answer in Bangla, English or Banglish, by typing or speaking.", "ক্লাস বাংলায় বা English-এ — যেটা তোমার সুবিধা। পিঠা, বাজার, ক্রিকেট — চেনা উদাহরণে বোঝানো।") },
  { icon: "lightbulb", chip: "bg-lagoon text-white", title: bi("Asks questions, gives hints", "প্রশ্ন করেন, হিন্ট দেন"), body: bi("The teacher checks your understanding as you go. Wrong answer? A hint first, another try — then the full step-by-step solution.", "পড়ানোর মাঝে শিক্ষক তোমাকে প্রশ্ন করেন। ভুল হলে আগে হিন্ট, আবার চেষ্টার সুযোগ; তারপর ধাপে ধাপে পুরো সমাধান।") },
  { icon: "heart", chip: "bg-coral text-white", title: bi("Classmates and friends with you", "সহপাঠী আর বন্ধুরা সাথে"), body: bi("AI classmates ask questions, make mistakes and make you laugh. Invite real friends too — up to 4 in one live class.", "AI সহপাঠীরা প্রশ্ন তোলে, ভুল করে, হাসায়। চাইলে বন্ধুদের ডাকো — ৪ জন পর্যন্ত একসাথে একই লাইভ ক্লাসে।") },
];

export function Features() {
  const { lang } = useLang();
  return (
    <section id="features" aria-labelledby="features-title" className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <TextureOverlay kind="dots" className="opacity-40" />
        <SectionHead
          id="features-title"
          badge={pick(lang, "Why Kupi", "কেন কুপি")}
          badgeClass="bg-brand-50 text-brand-700 border-brand-200"
          title={<>{pick(lang, "A teacher who never ", "একজন শিক্ষক, যে কখনো ")}<span className="text-brand-600">{pick(lang, "rushes you", "তাড়া দেয় না")}</span></>}
          sub={pick(lang, "Explaining, questioning and showing it another way — everything you need to truly understand, in one place.", "বুঝিয়ে দেওয়া, প্রশ্ন করা, আবার অন্যভাবে দেখানো — একটা ধারণা সত্যিই বোঝার জন্য যা যা দরকার, সব এক জায়গায়।")}
        />
        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title.en} as="li" delay={i * 90} className="h-full">
              <article className="group relative flex h-full flex-col gap-2.5 rounded-2xl border-2 border-ink bg-white p-4 shadow-hard-sm transition-[transform,box-shadow] duration-300 ease-spring hover:-translate-x-0.5 hover:-translate-y-1 hover:shadow-hard-lg">
                <span className={`grid size-10 place-items-center rounded-xl border-2 border-ink transition-transform duration-300 ease-spring group-hover:-rotate-6 ${f.chip}`}>
                  <Icon name={f.icon} className="size-5" strokeWidth={1.8} />
                </span>
                <h3 className="text-lg leading-snug text-ink">{t(lang, f.title)}</h3>
                <p className="text-[0.88rem] leading-relaxed text-ink-soft">{t(lang, f.body)}</p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS: { icon: IconName; num: string; numChip: string; iconClass: string; title: Bi; body: Bi }[] = [
  { icon: "target", num: "1", numChip: "bg-brand-600 text-white", iconClass: "text-brand-600 bg-brand-50", title: bi("Write what you want to learn", "কী শিখতে চাও লেখো"), body: bi("A topic, exam prep, practice or homework — pick a chapter, or just type your question or add a photo of your notebook.", "টপিক, পরীক্ষার প্রস্তুতি, অনুশীলন বা হোমওয়ার্ক — অধ্যায় থেকে বিষয় নাও, অথবা প্রশ্নটাই লিখে দাও।") },
  { icon: "board", num: "2", numChip: "bg-marigold text-ink", iconClass: "text-ember-ink bg-marigold-soft", title: bi("Choose your teacher and classmates", "শিক্ষক আর সহপাঠী বেছে নাও"), body: bi("Pick who teaches you, set up your AI classmates, and invite friends if you like.", "কে পড়াবেন ঠিক করো, AI সহপাঠীদের সাজাও, চাইলে বন্ধুদের আমন্ত্রণ পাঠাও।") },
  { icon: "chart", num: "3", numChip: "bg-lagoon text-white", iconClass: "text-padma-ink bg-lagoon-soft", title: bi("Learn, then check with practice", "ক্লাস করো, অনুশীলনে মিলিয়ে নাও"), body: bi("Lessons on the board, questions along the way, practice at the end. Notes and answers stay saved in your history.", "বোর্ডে পাঠ, মাঝে মাঝে প্রশ্ন, শেষে অনুশীলন। নোট আর উত্তর ইতিহাসে জমা থাকে।") },
];

export function HowItWorks() {
  const { lang } = useLang();
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="relative border-y-2 border-ink/8 bg-paper-deep/55 px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <SectionHead
          id="how-title"
          badge={pick(lang, "How it works", "কীভাবে কাজ করে")}
          badgeClass="bg-lagoon-soft text-padma-ink border-lagoon/30"
          title={<>{pick(lang, "Start in three steps — ", "তিন ধাপেই শুরু — ")}<span className="text-brand-600">{pick(lang, "within two minutes", "দুই মিনিটের মধ্যে")}</span></>}
          sub={pick(lang, "No setup, no class schedule. Pick a chapter and start learning.", "কোনো সেটআপ নেই, কোনো ক্লাসের সময়সূচি নেই। অধ্যায় বেছে নাও, পড়া শুরু হয়ে যাক।")}
        />
        <div className="relative mt-9">
          <div aria-hidden="true" className="absolute top-10 right-[12%] left-[12%] hidden border-t-2 border-dashed border-ink/18 lg:block" />
          <ol className="relative grid gap-6 sm:grid-cols-3 sm:gap-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title.en} as="li" delay={i * 110} className="h-full">
                <div className="group relative flex h-full flex-col items-start gap-2.5 rounded-2xl border-2 border-ink bg-white p-4 pt-6 shadow-hard transition-[transform,box-shadow] duration-300 ease-spring hover:-translate-y-1 hover:shadow-hard-lg">
                  <span className={`absolute -top-4 left-4 grid size-8 place-items-center rounded-xl border-2 border-ink font-display text-base font-bold shadow-hard-sm ${s.numChip}`}>{s.num}</span>
                  <span className={`grid size-9 place-items-center rounded-lg transition-transform duration-300 ease-spring group-hover:scale-105 ${s.iconClass}`}>
                    <Icon name={s.icon} className="size-4.5" strokeWidth={1.8} />
                  </span>
                  <h3 className="text-lg leading-snug text-ink">{t(lang, s.title)}</h3>
                  <p className="text-[0.88rem] leading-relaxed text-ink-soft">{t(lang, s.body)}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const PREVIEW_ITEMS: { icon: IconName; title: Bi; body: Bi }[] = [
  { icon: "board", title: bi("Writes it on the board", "বোর্ডে লিখে দেখায়"), body: bi("Every step is written in front of you — learn by seeing, not just reading.", "প্রতিটি ধাপ চোখের সামনে লেখা হয় — শুধু পড়া নয়, দেখে শেখা।") },
  { icon: "chat", title: bi("Ask anytime mid-lesson", "মাঝপথে প্রশ্ন করা যায়"), body: bi("Say “explain that step again” and it is explained another way.", "‘এই ধাপটা আবার বলো’ বললেই আরেকভাবে বুঝিয়ে দেয়।") },
  { icon: "lightbulb", title: bi("Hints before answers", "উত্তর নয়, হিন্ট আগে"), body: bi("Small clues keep the chance to figure it out yourself.", "নিজে চেষ্টা করার সুযোগ রেখে ছোট ছোট সংকেত দেয়।") },
  { icon: "chart", title: bi("Adapts to your answers", "তোমার উত্তর দেখে গতি বদলায়"), body: bi("Stuck often? The teacher slows down. Doing well? You move faster.", "বারবার আটকালে শিক্ষক আরও ধীরে বোঝান; ভালো করলে এগিয়ে যান দ্রুত।") },
];

function YoutubePlaceholder() {
  const { lang } = useLang();
  const embed = youtubeEmbedUrl(YOUTUBE_VIDEO_URL);
  if (embed) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-paper/25 bg-black shadow-hard">
        <iframe className="absolute inset-0 size-full" src={embed} title="Kupi AI Teacher video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    );
  }
  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-paper/35 bg-board-soft px-6 text-center">
      <TextureOverlay kind="board" className="opacity-60" />
      <span className="relative grid size-16 place-items-center rounded-full border-2 border-ink bg-flame text-night shadow-hard-sm">
        <Icon name="play" className="ml-1 size-7" />
      </span>
      <p className="relative font-display text-lg font-bold text-paper">{pick(lang, "Watch the AI Teacher in action", "AI শিক্ষককে কাজে দেখো")}</p>
      <p className="relative max-w-sm text-sm leading-relaxed text-brand-100/65">
        {pick(lang, "Video coming soon. Paste your YouTube link in src/lib/site.ts (YOUTUBE_VIDEO_URL) and it will play here automatically.", "ভিডিও শীঘ্রই আসছে। src/lib/site.ts-এ YOUTUBE_VIDEO_URL-তে তোমার YouTube লিংক বসালেই এখানে চলবে।")}
      </p>
      <span className="relative rounded-full border border-paper/25 px-3 py-1 font-mono text-[0.72rem] text-brand-200/80">youtube.com / watch?v=…</span>
    </div>
  );
}

export function Preview() {
  const { lang } = useLang();
  return (
    <section id="preview" aria-labelledby="preview-title" className="relative scroll-mt-24 overflow-hidden bg-board px-4 py-10 text-brand-50 sm:px-6 sm:py-12">
      <TextureOverlay kind="board" className="opacity-70" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-10">
        <div>
          <h2 id="preview-title" className="text-[clamp(1.45rem,3.4vw,2.2rem)] leading-[1.2] text-paper">
            {lang === "bn" ? <>এভাবেই পড়ায় তোমার <span className="text-chalk text-brand-300">AI শিক্ষক</span></> : <>This Is How Your <span className="text-chalk text-brand-300">AI Teacher</span> Teaches</>}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-100/70 sm:text-base">
            {pick(lang, "Give it a question — the solution starts step by step on the board. Pause and ask wherever you get stuck, as many times as you need. Speed can be changed from 0.75x to 1.5x.", "একটা প্রশ্ন দাও — বোর্ডে ধাপে ধাপে সমাধান শুরু হবে। যেখানে আটকাবে সেখানে থামিয়ে প্রশ্ন করো, যতবার দরকার ততবার।")}
          </p>
          <ul className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {PREVIEW_ITEMS.map((item) => (
              <li key={item.title.en} className="flex gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-400/12 text-brand-300">
                  <Icon name={item.icon} className="size-4.5" strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className="text-[0.98rem] font-semibold text-paper">{t(lang, item.title)}</h3>
                  <p className="mt-1 text-[0.85rem] leading-relaxed text-brand-100/60">{t(lang, item.body)}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <GetStartedButton className="h-11 border-2 border-flame/60 bg-flame px-5 text-[0.95rem] text-night hover:bg-[#ffbe45] active:translate-y-px active:bg-ember">
              {pick(lang, "Try it with your own question", "নিজের প্রশ্ন দিয়ে দেখো")}
            </GetStartedButton>
          </div>
        </div>
        <YoutubePlaceholder />
      </div>
    </section>
  );
}

const BENEFITS: { icon: IconName; title: Bi; body: Bi }[] = [
  { icon: "clock", title: bi("Ask without embarrassment", "লজ্জা ছাড়া যত প্রশ্ন"), body: bi("Ask the same question ten times — the teacher explains it differently every time, never says “this is easy”.", "একই প্রশ্ন দশবার করো — শিক্ষক প্রতিবার অন্যভাবে বোঝাবে।") },
  { icon: "stairs", title: bi("Understand from the basics", "গোড়া থেকে বোঝা"), body: bi("Not memorised — you learn why the rule works, so new exam questions do not stop you.", "মুখস্থ নয় — নিয়মটা কেন কাজ করে সেটাই বোঝানো হয়।") },
  { icon: "lightbulb", title: bi("Confidence grows", "আত্মবিশ্বাস বাড়ে"), body: bi("Small hints build the habit of finding answers yourself. When you can do it, the fear goes away.", "ছোট ছোট হিন্ট দিয়ে নিজে খুঁজে বের করার অভ্যাস তৈরি হয়।") },
  { icon: "target", title: bi("Learn at your own pace", "নিজের গতিতে শেখা"), body: bi("Pause, slow down, speed up, replay a part or skip ahead — you are in control.", "ক্লাস থামাও, গতি কমাও-বাড়াও — নিয়ন্ত্রণ তোমার হাতে।") },
  { icon: "heart", title: bi("Learning becomes fun", "শেখা হয়ে ওঠে মজার"), body: bi("Stories, familiar examples and answers to “why?” — so you want to know the next step.", "গল্প আর চেনা উদাহরণে বোঝানো — তাই পরের ধাপটা জানতে ইচ্ছে করে।") },
  { icon: "notes", title: bi("Notes stay with you", "নোট থাকে সাথে"), body: bi("Write your own notes during class and download everything at the end in one file.", "ক্লাস শেষে বোর্ডের সব লেখা আর নোট এক ফাইলে নামিয়ে নাও।") },
];

export function Benefits() {
  const { lang } = useLang();
  return (
    <section id="benefits" aria-labelledby="benefits-title" className="relative px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHead
          id="benefits-title"
          badge={pick(lang, "For students", "শিক্ষার্থীদের জন্য")}
          badgeClass="bg-coral-soft text-shapla-ink border-coral/35"
          title={<>{pick(lang, "Let the fear go, ", "ভয়টা কাটুক, ")}<span className="text-brand-600">{pick(lang, "let the light turn on", "আলোটা জ্বলুক")}</span></>}
          sub={pick(lang, "Memorising without understanding makes study feel heavy. Kupi explains first — once you understand, the rest gets easier.", "না বুঝে মুখস্থ করলে পড়া ভারী লাগে। কুপি আগে বোঝায় — বুঝলে বাকিটা নিজেই সহজ হয়ে আসে।")}
        />
        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title.en} as="li" delay={i * 70} className="h-full">
              <article className="group relative h-full overflow-hidden rounded-xl border border-paper-edge bg-white/80 p-3.5 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white sm:p-4">
                <span className="relative grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-500 group-hover:text-white">
                  <Icon name={b.icon} className="size-4" strokeWidth={1.8} />
                </span>
                <h3 className="relative mt-2.5 text-base leading-snug text-ink">{t(lang, b.title)}</h3>
                <p className="relative mt-1 text-[0.86rem] leading-relaxed text-ink-soft">{t(lang, b.body)}</p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const PARENT_POINTS: { icon: IconName; title: Bi; body: Bi }[] = [
  { icon: "chart", title: bi("Result of every class", "প্রতিটি ক্লাসের ফলাফল"), body: bi("See on the board how many questions were answered correctly. Download notes and answers to check later.", "ক্লাসে কয়টি প্রশ্নের সঠিক উত্তর হলো তা বোর্ডেই দেখা যায়।") },
  { icon: "shield", title: bi("Safe and ad-free", "নিরাপদ ও বিজ্ঞাপনমুক্ত"), body: bi("No ads. If an off-topic question comes up, the teacher gently brings the class back to study.", "কোনো বিজ্ঞাপন নেই। শিক্ষক আলতো করে আবার পড়ায় ফিরিয়ে আনেন।") },
  { icon: "check", title: bi("No account needed to start", "শুরু করতে অ্যাকাউন্ট লাগে না"), body: bi("Students start right away — no login, no password. Their name and progress stay on their own device.", "শিক্ষার্থী সাথে সাথে শুরু করতে পারে — লগইন বা পাসওয়ার্ড ছাড়াই।") },
  { icon: "check", title: bi("Follows the national curriculum", "জাতীয় পাঠ্যক্রম অনুসারে"), body: bi("Organised by NCTB books for Class 6 to 10, so school study and Kupi study move together.", "NCTB-র ষষ্ঠ থেকে দশম শ্রেণির বই ধরে সাজানো।") },
];

export function Parents() {
  const { lang } = useLang();
  return (
    <section id="parents" aria-labelledby="parents-title" className="relative overflow-x-clip border-y-2 border-ink/8 bg-paper-deep/55 px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:gap-10">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/30 bg-lagoon-soft px-3 py-1 text-xs font-semibold tracking-wide text-padma-ink">
                <Icon name="shield" className="size-3.5" strokeWidth={2} />
                {pick(lang, "For parents", "অভিভাবকদের জন্য")}
              </span>
            </Reveal>
            <Reveal delay={70}>
              <h2 id="parents-title" className="mt-3 text-[clamp(1.45rem,3.4vw,2.2rem)] leading-[1.2] text-ink">{pick(lang, "Stay worry-free about your child's study", "সন্তানের পড়াশোনায় নিশ্চিন্ত থাকুন")}</h2>
            </Reveal>
            <Reveal delay={130}>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-base">
                {pick(lang, "Your child gets a patient teacher who never scolds for mistakes — and explains again, another way. No ads, no tricks.", "আপনার সন্তান পাচ্ছে একজন ধৈর্যশীল শিক্ষক, যিনি ভুলে বকেন না — অন্যভাবে আবার বোঝান। কোনো বিজ্ঞাপন নেই, কোনো চালাকি নেই।")}
              </p>
            </Reveal>
            <Reveal delay={200}>
              <figure className="mt-5 max-w-lg -rotate-[0.6deg] rounded-2xl border-2 border-ink bg-white p-4 shadow-hard sm:p-5">
                <Icon name="chat" className="size-6 text-marigold" strokeWidth={1.6} />
                <blockquote className="mt-2 text-[0.92rem] leading-relaxed text-ink">
                  {pick(lang, "“We do not make students memorise answers. The teacher gives a hint first; if it still does not match, the whole method is explained step by step — so the next question, the student can do alone.”", "“আমরা উত্তর মুখস্থ করাই না। শিক্ষক আগে হিন্ট দেন; তারপর ধাপে ধাপে পুরো পদ্ধতিটা বোঝান — যাতে পরের প্রশ্নটা শিক্ষার্থী নিজেই পারে।”")}
                </blockquote>
                <figcaption className="mt-3 flex items-center gap-3 border-t border-paper-edge pt-3">
                  <span className="grid size-10 place-items-center rounded-full bg-lagoon-soft font-display text-sm font-bold text-padma-ink">Ku</span>
                  <span className="text-sm">
                    <span className="block font-semibold text-ink">{pick(lang, "Kupi Team", "কুপি টিম")}</span>
                    <span className="block text-[0.8rem] text-ink-muted">{pick(lang, "Our teaching principle", "আমাদের শেখানোর নীতি")}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-5">
                <GetStartedButton className="h-11 border-2 border-ink bg-paper px-5 text-[0.95rem] text-ink shadow-hard-sm hover:-translate-y-px hover:bg-white hover:shadow-hard active:translate-y-0.5 active:shadow-none">
                  {pick(lang, "Start as a parent", "অভিভাবক হিসেবে শুরু করুন")}
                </GetStartedButton>
              </div>
            </Reveal>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PARENT_POINTS.map((point, i) => (
              <Reveal key={point.title.en} as="li" from="right" delay={i * 90} className="h-full">
                <article className="flex h-full flex-col gap-2 rounded-xl border border-paper-edge bg-white p-4 shadow-soft transition-transform duration-300 hover:-translate-y-1">
                  <span className="grid size-9 place-items-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600">
                    <Icon name={point.icon} className="size-4" strokeWidth={1.8} />
                  </span>
                  <h3 className="text-[1.05rem] leading-snug text-ink">{t(lang, point.title)}</h3>
                  <p className="text-[0.86rem] leading-relaxed text-ink-soft">{t(lang, point.body)}</p>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
