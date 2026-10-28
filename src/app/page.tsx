import { FinalCta, Footer } from "../components/Cta";
import { Hero } from "../components/Hero";
import { Navbar } from "../components/Navbar";
import { RoleDialogProvider } from "../components/RoleDialog";
import { Benefits, Features, HowItWorks, Parents, Preview } from "../components/Sections";
import { Topics } from "../components/Topics";

export default function Home() {
  return (
    <RoleDialogProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:border-2 focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        মূল বিষয়বস্তুতে যান
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <Preview />
        <Benefits />
        <Parents />
        <Topics />
        <FinalCta />
      </main>
      <Footer />
    </RoleDialogProvider>
  );
}
