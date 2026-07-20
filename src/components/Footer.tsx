import Link from "next/link";

const channelUrl = "https://whatsapp.com/channel/0029Vb6duVSH5JM4KZ2JxG3f";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-12 mt-auto border-t border-white/5">
      <div className="container max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-[1.3fr_.7fr_.7fr] gap-8 mb-8">
          <div className="max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-teal-400 rounded-xl flex items-center justify-center text-slate-950 font-black text-sm">69</div>
              <span className="text-xl font-black text-white tracking-tight">Enokay<span className="text-teal-400">69</span></span>
            </div>
            <p className="text-sm leading-6">Private, carefully researched football predictions for bettors who prefer signal over noise.</p>
            <p className="mt-4 text-xs leading-5 text-slate-500">Bet responsibly. Predictions are opinions, not guarantees.</p>
          </div>
          <div>
            <h4 className="text-white font-extrabold mb-4">Explore</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/#packages" className="hover:text-teal-300 transition">Premium packages</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-teal-300 transition">How it works</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-extrabold mb-4">Connect</h4>
            <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white transition text-sm">
              <span className="h-8 w-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center"><i className="fab fa-whatsapp" /></span>
              WhatsApp channel
            </a>
            <div className="flex items-center gap-2 text-sm mt-4"><i className="fas fa-location-dot text-teal-500" />Ghana, West Africa</div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row gap-3 justify-between text-xs">
          <p>&copy; {new Date().getFullYear()} Enokay69. All rights reserved.</p>
          <p>Premium predictions. Private delivery.</p>
        </div>
      </div>
    </footer>
  );
}
