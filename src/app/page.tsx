import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import TrackRecord from "@/components/TrackRecord";
import { getAllPublicMatches } from "@/lib/store";
import { getTierPrices } from "@/lib/pricing";

const channelUrl = "https://whatsapp.com/channel/0029Vb6duVSH5JM4KZ2JxG3f";

const packageMeta = [
  {
    name: "Accurate Odds",
    slug: "accurate-odds" as const,
    description: "A carefully selected premium slip built around disciplined value.",
    icon: "fa-crown",
    accent: "teal",
    featured: true,
    features: ["Expert-reviewed fixtures", "Clear odds and kick-off times", "Valid for 24 hours"],
  },
  {
    name: "Draw Tips",
    slug: "draw-tips" as const,
    description: "Focused draw selections for bettors who prefer higher-value markets.",
    icon: "fa-handshake",
    accent: "amber",
    features: ["Purpose-built draw analysis", "Curated daily selections", "Valid for 24 hours"],
  },
  {
    name: "Correct Score",
    slug: "correct-score" as const,
    description: "Our most selective package for high-reward correct-score markets.",
    icon: "fa-bullseye",
    accent: "violet",
    features: ["Deep match assessment", "Limited premium picks", "Valid for 24 hours"],
  },
];

const steps = [
  { number: "01", title: "Choose a package", text: "Pick the market and risk profile that fits your approach." },
  { number: "02", title: "Complete payment", text: "Pay securely via Mobile Money or your preferred method." },
  { number: "03", title: "Access your tips", text: "Get your premium predictions instantly after payment confirmation." },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  const params = await searchParams;
  const showAdmin = params.admin === "true";

  const hasMatches = (await getAllPublicMatches()).length > 0;
  const prices = await getTierPrices();
  const packages = packageMeta.map((item) => ({
    ...item,
    price: `GH₵${prices[item.slug]}`,
  }));

  return (
    <>
      <Navbar />

      <main className="flex-1">
        <section className="premium-hero">
          <div className="premium-grid" aria-hidden="true" />
          <div className="premium-glow premium-glow-one" aria-hidden="true" />
          <div className="premium-glow premium-glow-two" aria-hidden="true" />
          <div className="relative z-10 container max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-14 sm:py-18 lg:py-22">
            <div className="grid lg:grid-cols-[1.15fr_.85fr] items-center gap-10">
              <div className="max-w-3xl">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.055em] text-white leading-[0.98]">
                  Better picks.<br />
                  <span className="premium-gradient-text">Less guesswork.</span>
                </h1>
                <p className="mt-5 text-sm sm:text-base text-slate-300 leading-7 max-w-xl">
                  Carefully researched football predictions, delivered privately to
                  bettors who value quality over noise. No free slips. No clutter.
                </p>
                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <a href="#packages" className="premium-button premium-button-primary text-sm">
                    Explore premium tips <i className="fas fa-arrow-right text-xs" />
                  </a>
                  <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="premium-button premium-button-secondary text-sm">
                    <i className="fab fa-whatsapp text-base" /> Join channel
                  </a>
                </div>
                <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                  <span><i className="fas fa-check text-teal-400 mr-1.5" />Expert reviewed</span>
                  <span><i className="fas fa-check text-teal-400 mr-1.5" />Private delivery</span>
                  <span><i className="fas fa-check text-teal-400 mr-1.5" />Responsible approach</span>
                </div>
              </div>

              <div className="relative hidden lg:block">
                <div className="insight-card overflow-visible">
                  <div className="absolute -top-8 -right-6 h-28 w-28 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-2xl shadow-teal-500/40" style={{ transform: "perspective(400px) rotateY(-12deg) rotateX(8deg)" }}>
                    <i className="fas fa-futbol text-5xl text-white drop-shadow-lg" />
                  </div>
                  <div className="absolute top-1/2 -left-5 h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30" style={{ transform: "perspective(400px) rotateY(15deg) rotateX(-10deg)" }}>
                    <i className="fas fa-trophy text-2xl text-white drop-shadow" />
                  </div>
                  <div className="absolute -bottom-4 right-12 h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30" style={{ transform: "perspective(400px) rotateY(-8deg) rotateX(12deg)" }}>
                    <i className="fas fa-medal text-xl text-white drop-shadow" />
                  </div>
                  <div className="pt-14 pb-10 px-6">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-bold">Elevate your game</p>
                    <p className="mt-1.5 text-base font-extrabold text-white">Premium predictions</p>
                    <p className="mt-3 text-xs text-slate-400 leading-5">Data-driven tips from expert analysts. Consistent wins, zero fluff.</p>
                    <div className="mt-6 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-teal-400/10 border border-teal-300/20 flex items-center justify-center text-teal-300">
                        <i className="fas fa-bolt text-sm" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Accuracy focused</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Proven track record</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="packages" className="py-14 sm:py-18 bg-[#f6f8f8] scroll-mt-20">
          <div className="container max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="section-kicker">Premium access</p>
              <h2 className="mt-2 text-2xl sm:text-4xl font-black tracking-[-0.04em] text-slate-950">Choose your edge.</h2>
              <p className="mt-3 text-sm text-slate-600 leading-6">Every package is curated, privately delivered, and designed for a specific betting style.</p>
            </div>
            <div className="mt-8 grid lg:grid-cols-3 gap-4">
              {packages.map((item) => (
                <article key={item.name} className={`package-card ${item.featured ? "package-card-featured" : ""}`}>
                  {item.featured && <span className="popular-badge">Most popular</span>}
                  <div className={`package-icon package-icon-${item.accent}`}><i className={`fas ${item.icon}`} /></div>
                  <h3 className="mt-4 text-lg font-black text-slate-950">{item.name}</h3>
                  <div className="mt-2 flex items-end gap-1.5">
                    <span className="text-3xl font-black tracking-tight text-slate-950">{item.price}</span>
                    <span className="text-xs text-slate-500 mb-0.5">per access</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{item.description}</p>
                  <ul className="mt-4 space-y-2">
                    {item.features.map((feature) => (
                      <li key={feature} className="flex gap-2 text-xs text-slate-700">
                        <i className="fas fa-check-circle text-teal-600 mt-0.5 text-[10px]" />{feature}
                      </li>
                    ))}
                  </ul>
                  <a href={`/payment/${item.slug}`} className={`mt-5 w-full premium-button text-sm ${item.featured ? "premium-button-dark" : "premium-button-light"}`}>
                    Pay now — {item.price} <i className="fas fa-arrow-right" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-14 sm:py-18 bg-white scroll-mt-20">
          <div className="container max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <p className="section-kicker">Simple access</p>
              <h2 className="mt-2 text-2xl sm:text-4xl font-black tracking-[-0.04em] text-slate-950">From choice to kickoff.</h2>
            </div>
            <div className="mt-10 grid md:grid-cols-3 gap-4">
              {steps.map((step) => (
                <div key={step.number} className="process-card">
                  <span className="process-number">{step.number}</span>
                  <h3 className="mt-4 text-base font-extrabold text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Track Record */}
        {hasMatches && (
          <section id="track-record" className="py-14 sm:py-18 bg-[#f6f8f8] scroll-mt-20">
            <div className="container max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <p className="section-kicker">Proven results</p>
                <h2 className="mt-2 text-2xl sm:text-4xl font-black tracking-[-0.04em] text-slate-950">Our track record.</h2>
                <p className="mt-3 text-sm text-slate-600 leading-6">Browse prediction outcomes by date — transparent, updated daily.</p>
              </div>
              <div className="mt-8">
                <TrackRecord />
              </div>
            </div>
          </section>
        )}

        <section className="px-5 sm:px-6 lg:px-8 pb-14 sm:pb-18 bg-white">
          <div className="container max-w-6xl mx-auto final-cta">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Ready when you are</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white">Make your next pick informed.</h2>
              <p className="mt-2 text-sm text-slate-300">Choose a package, pay securely, and access premium predictions instantly.</p>
            </div>
            <a href="#packages" className="premium-button bg-white text-slate-950 hover:bg-teal-50 shrink-0 text-sm">
              View packages <i className="fas fa-arrow-right" />
            </a>
          </div>
        </section>
      </main>
      {showAdmin && (
        <div className="fixed bottom-5 right-5 z-50">
          <Link
            href="/enokay-secure-login"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/80 text-slate-500 hover:bg-slate-800 hover:text-white transition shadow-lg"
            title="Admin"
          >
            <i className="fas fa-lock text-xs" />
          </Link>
        </div>
      )}
      <Footer />
    </>
  );
}
