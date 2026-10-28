import { Icon, type IconName } from "./Icon";
import { SectionHead, TextureOverlay } from "./Hero";
import { Reveal } from "./Reveal";

const APP = "https://classroom-impactx.vercel.app";
const BTN =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-200 ease-[var(--ease-spring)] disabled:pointer-events-none disabled:opacity-55";

const FEATURES: { icon: IconName; chip: string; title: string; body: string }[] = [
  {
    icon: "board",
    chip: "bg-brand-500 text-white",
    title: "বোর্ডে লিখে, কণ্ঠে বোঝানো ক্লাস",
    body: "শিক্ষক প্রতিটি ধাপ হোয়াইটবোর্ডে লেখেন, দরকারি জায়গা দাগিয়ে দেন, ছবি এঁকে দেখান — আর বাংলা নিউরাল কণ্ঠে পুরোটা মুখে বোঝান।",
  },
  {
    icon: "chat",
    chip: "bg-marigold text-ink",
    title: "সহজ বাংলায় ব্যাখ্যা",
    body: "ক্লাস বাংলায় বা English-এ — যেটা তোমার সুবিধা। পিঠা, বাজার, ক্রিকেট — চেনা উদাহরণে বোঝানো। উত্তর দিতে পারো বাংলা, English বা Banglish-এ, লিখে বা মাইকে বলে।",
  },
  {
    icon: "lightbulb",
    chip: "bg-lagoon text-white",
    title: "প্রশ্ন করেন, হিন্ট দেন",
    body: "পড়ানোর মাঝে শিক্ষক তোমাকে প্রশ্ন করেন। ভুল হলে আগে হিন্ট, আবার চেষ্টার সুযোগ; দ্বিতীয়বারও না মিললে ধাপে ধাপে পুরো সমাধান।",
  },
  {
    icon: "heart",
    chip: "bg-coral text-white",
    title: "সহপাঠী আর বন্ধুরা সাথে",
    body: "AI সহপাঠীরা প্রশ্ন তোলে, ভুল করে, হাসায়। চাইলে ইমেইলে বন্ধুদের ডাকো — ৪ জন পর্যন্ত একসাথে একই লাইভ ক্লাসে।",
  },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <TextureOverlay kind="dots" className="opacity-40" />
        <SectionHead
          id="features-title"
          badge="কেন কুপি"
          badgeClass="bg-brand-50 text-brand-700 border-brand-200"
          title={<>একজন শিক্ষক, যে কখনো <span className="text-brand-600">তাড়া দেয় না</span></>}
          sub="বুঝিয়ে দেওয়া, প্রশ্ন করা, আবার অন্যভাবে দেখানো — একটা ধারণা সত্যিই বোঝার জন্য যা যা দরকার, সব এক জায়গায়।"
        />
        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} as="li" delay={i * 90} className="h-full">
              <article className="group relative flex h-full flex-col gap-2.5 rounded-2xl border-2 border-ink bg-white p-4 shadow-hard-sm transition-[transform,box-shadow] duration-300 ease-spring hover:-translate-x-0.5 hover:-translate-y-1 hover:shadow-hard-lg">
                <span className={`grid size-10 place-items-center rounded-xl border-2 border-ink transition-transform duration-300 ease-spring group-hover:-rotate-6 ${f.chip}`}>
                  <Icon name={f.icon} className="size-5" strokeWidth={1.8} />
                </span>
                <h3 className="text-lg leading-snug text-ink">{f.title}</h3>
                <p className="text-[0.88rem] leading-relaxed text-ink-soft">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS: { icon: IconName; num: string; numChip: string; iconClass: string; title: string; body: string }[] = [
  {
    icon: "target",
    num: "১",
    numChip: "bg-brand-600 text-white",
    iconClass: "text-brand-600 bg-brand-50",
    title: "কী শিখতে চাও লেখো",
    body: "টপিক, পরীক্ষার প্রস্তুতি, অনুশীলন বা হোমওয়ার্ক — অধ্যায় থেকে বিষয় নাও, অথবা প্রশ্নটাই লিখে দাও বা খাতার ছবি যোগ করো।",
  },
  {
    icon: "board",
    num: "২",
    numChip: "bg-marigold text-ink",
    iconClass: "text-ember-ink bg-marigold-soft",
    title: "শিক্ষক আর সহপাঠী বেছে নাও",
    body: "রাকিব স্যার বা নাসরিন ম্যাম — কে পড়াবেন ঠিক করো, AI সহপাঠীদের সাজাও, চাইলে বন্ধুদের ইমেইলে আমন্ত্রণ পাঠাও।",
  },
  {
    icon: "chart",
    num: "৩",
    numChip: "bg-lagoon text-white",
    iconClass: "text-padma-ink bg-lagoon-soft",
    title: "ক্লাস করো, অনুশীলনে মিলিয়ে নাও",
    body: "বোর্ডে পাঠ, মাঝে মাঝে প্রশ্ন, শেষে অনুশীলন। ক্লাসের নোট আর তোমার উত্তর ডাউনলোড করা যায়, আগের ক্লাসগুলো ইতিহাসে জমা থাকে।",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="relative border-y-2 border-ink/8 bg-paper-deep/55 px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <SectionHead
          id="how-title"
          badge="কীভাবে কাজ করে"
          badgeClass="bg-lagoon-soft text-padma-ink border-lagoon/30"
          title={<>তিন ধাপেই শুরু — <span className="text-brand-600">দুই মিনিটের মধ্যে</span></>}
          sub="কোনো সেটআপ নেই, কোনো ক্লাসের সময়সূচি নেই। অধ্যায় বেছে নাও, পড়া শুরু হয়ে যাক।"
        />
        <div className="relative mt-9">
          <div aria-hidden="true" className="absolute top-10 right-[12%] left-[12%] hidden border-t-2 border-dashed border-ink/18 lg:block" />
          <ol className="relative grid gap-6 sm:grid-cols-3 sm:gap-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} as="li" delay={i * 110} className="h-full">
                <div className="group relative flex h-full flex-col items-start gap-2.5 rounded-2xl border-2 border-ink bg-white p-4 pt-6 shadow-hard transition-[transform,box-shadow] duration-300 ease-spring hover:-translate-y-1 hover:shadow-hard-lg">
                  <span className={`numerals-bn absolute -top-4 left-4 grid size-8 place-items-center rounded-xl border-2 border-ink font-display text-base font-bold shadow-hard-sm ${s.numChip}`}>{s.num}</span>
                  <span className={`grid size-9 place-items-center rounded-lg transition-transform duration-300 ease-spring group-hover:scale-105 ${s.iconClass}`}>
                    <Icon name={s.icon} className="size-4.5" strokeWidth={1.8} />
                  </span>
                  <h3 className="text-lg leading-snug text-ink">{s.title}</h3>
                  <p className="text-[0.88rem] leading-relaxed text-ink-soft">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const PREVIEW_ITEMS: { icon: IconName; title: string; body: string }[] = [
  { icon: "board", title: "বোর্ডে লিখে দেখায়", body: "প্রতিটি ধাপ চোখের সামনে লেখা হয় — শুধু পড়া নয়, দেখে শেখা।" },
  { icon: "chat", title: "মাঝপথে প্রশ্ন করা যায়", body: "‘এই ধাপটা আবার বলো’ বললেই আরেকভাবে বুঝিয়ে দেয়।" },
  { icon: "lightbulb", title: "উত্তর নয়, হিন্ট আগে", body: "নিজে চেষ্টা করার সুযোগ রেখে ছোট ছোট সংকেত দেয়।" },
  { icon: "chart", title: "তোমার উত্তর দেখে গতি বদলায়", body: "বারবার আটকালে শিক্ষক আরও ধীরে, আরও যত্নে বোঝান; ভালো করলে এগিয়ে যান দ্রুত।" },
];

export function Preview() {
  return (
    <section id="preview" aria-labelledby="preview-title" className="relative overflow-hidden bg-board px-4 py-10 text-brand-50 sm:px-6 sm:py-12">
      <TextureOverlay kind="board" className="opacity-70" />
      <div className="relative mx-auto w-full max-w-5xl">
        <h2 id="preview-title" className="text-[clamp(1.45rem,3.4vw,2.2rem)] leading-[1.2] text-paper">
          এভাবেই পড়ায় তোমার <span className="text-chalk text-brand-300">AI শিক্ষক</span>
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-100/70 sm:text-base">
          একটা প্রশ্ন দাও — বোর্ডে ধাপে ধাপে সমাধান শুরু হবে। যেখানে আটকাবে সেখানে থামিয়ে প্রশ্ন করো, যতবার দরকার ততবার। শিক্ষক রাকিব স্যার ও নাসরিন ম্যাম বাংলা কণ্ঠে পড়ান; গতি ০.৭৫x থেকে ১.৫x পর্যন্ত বদলানো যায়।
        </p>
        <ul className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {PREVIEW_ITEMS.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-400/12 text-brand-300">
                <Icon name={item.icon} className="size-4.5" strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-[0.98rem] font-semibold text-paper">{item.title}</h3>
                <p className="mt-1 text-[0.85rem] leading-relaxed text-brand-100/60">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <a
            className={`${BTN} h-11 border-2 border-flame/60 bg-flame px-5 text-[0.95rem] text-night hover:bg-[#ffbe45] hover:shadow-[0_6px_24px_-6px_rgba(255,176,32,0.55)] active:translate-y-px active:bg-ember`}
            href={`${APP}/signup`}
          >
            নিজের প্রশ্ন দিয়ে দেখো
            <Icon name="arrow" className="size-5" strokeWidth={2} />
          </a>
        </div>
      </div>
    </section>
  );
}

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  { icon: "clock", title: "লজ্জা ছাড়া যত প্রশ্ন", body: "ক্লাসে হাত তুলতে সংকোচ? এখানে একই প্রশ্ন দশবার করো — শিক্ষক প্রতিবার অন্যভাবে বোঝাবে, কখনো বলবে না “এটা তো সহজ”।" },
  { icon: "stairs", title: "গোড়া থেকে বোঝা", body: "মুখস্থ নয় — নিয়মটা কেন কাজ করে সেটাই বোঝানো হয়, তাই পরীক্ষায় নতুন প্রশ্নেও আটকায় না।" },
  { icon: "lightbulb", title: "আত্মবিশ্বাস বাড়ে", body: "ছোট ছোট হিন্ট দিয়ে নিজে খুঁজে বের করার অভ্যাস তৈরি হয়। নিজে পারলে ভয়টাও কেটে যায়।" },
  { icon: "target", title: "নিজের গতিতে শেখা", body: "ক্লাস থামাও, গতি কমাও-বাড়াও, একটা অংশ আবার শোনো, বা পরের অংশে চলে যাও — নিয়ন্ত্রণ তোমার হাতে।" },
  { icon: "heart", title: "শেখা হয়ে ওঠে মজার", body: "গল্প, চেনা উদাহরণ আর “কেন?”-এর উত্তর দিয়ে বোঝানো — তাই পরের ধাপটা জানতে ইচ্ছে করে।" },
  { icon: "notes", title: "নোট থাকে সাথে", body: "ক্লাসের মাঝে নিজের নোট লেখো। ক্লাস শেষে বোর্ডের সব লেখা, নোট আর উত্তরের ফলাফল এক ফাইলে নামিয়ে নাও।" },
];

export function Benefits() {
  return (
    <section id="benefits" aria-labelledby="benefits-title" className="relative px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHead
          id="benefits-title"
          badge="শিক্ষার্থীদের জন্য"
          badgeClass="bg-coral-soft text-shapla-ink border-coral/35"
          title={<>ভয়টা কাটুক, <span className="text-brand-600">আলোটা জ্বলুক</span></>}
          sub="না বুঝে মুখস্থ করলে পড়া ভারী লাগে, ভয়ও জমে। কুপি আগে বোঝায় — বুঝলে বাকিটা নিজেই সহজ হয়ে আসে।"
        />
        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} as="li" delay={i * 70} className="h-full">
              <article className="group relative h-full overflow-hidden rounded-xl border border-paper-edge bg-white/80 p-3.5 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white sm:p-4">
                <span aria-hidden="true" className="absolute -top-10 -right-10 size-24 rounded-full bg-marigold/0 blur-2xl transition-colors duration-500 group-hover:bg-marigold/25" />
                <span className="relative grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-500 group-hover:text-white">
                  <Icon name={b.icon} className="size-4" strokeWidth={1.8} />
                </span>
                <h3 className="relative mt-2.5 text-base leading-snug text-ink">{b.title}</h3>
                <p className="relative mt-1 text-[0.86rem] leading-relaxed text-ink-soft">{b.body}</p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const PARENT_POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: "chart", title: "প্রতিটি ক্লাসের ফলাফল", body: "ক্লাসে কয়টি প্রশ্নের সঠিক উত্তর হলো তা বোর্ডেই দেখা যায়। নোট আর প্রতিটি উত্তর ডাউনলোড করে পরে মিলিয়ে দেখা যায়।" },
  { icon: "shield", title: "নিরাপদ ও বিজ্ঞাপনমুক্ত", body: "কোনো বিজ্ঞাপন নেই। ক্লাসের বাইরের প্রশ্ন এলে শিক্ষক আলতো করে আবার পড়ায় ফিরিয়ে আনেন।" },
  { icon: "lock", title: "সুরক্ষিত অ্যাকাউন্ট", body: "Google দিয়ে সাইন-ইন। শিক্ষার্থীর প্রোফাইল শুধু সে নিজেই দেখতে পারে, আর শেয়ার করা ক্লাসে ঢোকা যায় শুধু আমন্ত্রণ গ্রহণ করে।" },
  { icon: "check", title: "জাতীয় পাঠ্যক্রম অনুসারে", body: "NCTB-র ষষ্ঠ থেকে দশম শ্রেণির বই ধরে ধরে সাজানো, তাই স্কুলের পড়া আর এখানের পড়া একসাথে চলে।" },
];

export function Parents() {
  return (
    <section id="parents" aria-labelledby="parents-title" className="relative overflow-x-clip border-y-2 border-ink/8 bg-paper-deep/55 px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:gap-10">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/30 bg-lagoon-soft px-3 py-1 text-xs font-semibold tracking-wide text-padma-ink">
                <Icon name="shield" className="size-3.5" strokeWidth={2} />
                অভিভাবকদের জন্য
              </span>
            </Reveal>
            <Reveal delay={70}>
              <h2 id="parents-title" className="mt-3 text-[clamp(1.45rem,3.4vw,2.2rem)] leading-[1.2] text-ink">সন্তানের পড়াশোনায় নিশ্চিন্ত থাকুন</h2>
            </Reveal>
            <Reveal delay={130}>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-base">
                আপনার সন্তান পাচ্ছে একজন ধৈর্যশীল শিক্ষক, যিনি ভুলে বকেন না — অন্যভাবে আবার বোঝান। সন্তান কী বুঝেছে আর কী এখনো বাকি, তা আপনি সৎভাবে, সহজ বাংলায় দেখতে পাবেন। কোনো বিজ্ঞাপন নেই, কোনো চালাকি নেই।
              </p>
            </Reveal>
            <Reveal delay={200}>
              <figure className="mt-5 max-w-lg -rotate-[0.6deg] rounded-2xl border-2 border-ink bg-white p-4 shadow-hard sm:p-5">
                <Icon name="chat" className="size-6 text-marigold" strokeWidth={1.6} />
                <blockquote className="mt-2 text-[0.92rem] leading-relaxed text-ink">
                  “আমরা উত্তর মুখস্থ করাই না। শিক্ষক আগে হিন্ট দেন; দ্বিতীয়বারও না মিললে ধাপে ধাপে পুরো পদ্ধতিটা বোঝান — যাতে পরের প্রশ্নটা শিক্ষার্থী নিজেই পারে। একটা ধারণা তখনই শেখা, যখন ৭ দিন পরেও আলোটা জ্বলে থাকে।”
                </blockquote>
                <figcaption className="mt-3 flex items-center gap-3 border-t border-paper-edge pt-3">
                  <span className="grid size-10 place-items-center rounded-full bg-lagoon-soft font-display text-sm font-bold text-padma-ink">কু</span>
                  <span className="text-sm">
                    <span className="block font-semibold text-ink">কুপি টিম</span>
                    <span className="block text-[0.8rem] text-ink-muted">আমাদের শেখানোর নীতি</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-5">
                <a
                  className={`${BTN} h-11 border-2 border-ink bg-paper px-5 text-[0.95rem] text-ink shadow-hard-sm hover:-translate-y-px hover:bg-white hover:shadow-hard active:translate-y-0.5 active:shadow-none`}
                  href={`${APP}/signup`}
                >
                  অভিভাবক হিসেবে শুরু করুন
                  <Icon name="external" className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" strokeWidth={2} />
                </a>
              </div>
            </Reveal>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PARENT_POINTS.map((point, i) => (
              <Reveal key={point.title} as="li" from="right" delay={i * 90} className="h-full">
                <article className="flex h-full flex-col gap-2 rounded-xl border border-paper-edge bg-white p-4 shadow-soft transition-transform duration-300 hover:-translate-y-1">
                  <span className="grid size-9 place-items-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600">
                    <Icon name={point.icon} className="size-4" strokeWidth={1.8} />
                  </span>
                  <h3 className="text-[1.05rem] leading-snug text-ink">{point.title}</h3>
                  <p className="text-[0.86rem] leading-relaxed text-ink-soft">{point.body}</p>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
