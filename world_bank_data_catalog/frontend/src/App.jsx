import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { motion } from "framer-motion";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import CountriesList from "./pages/CountriesList";
import CountryExplorer from "./pages/CountryExplorer";
import Compare from "./pages/Compare";
import CorrelationExplorer from "./pages/CorrelationExplorer";
import Indicators from "./pages/Indicators";
import Rankings from "./pages/Rankings";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";
import { Menu } from "lucide-react";

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-surface dark:bg-navy-900 transition-colors">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        {/* mobile top bar */}
        <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-navy-900 text-white flex items-center px-4">
          <button onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="ml-3 font-semibold text-sm">Global Development Atlas</span>
        </div>
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="w-64">
              <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
            </div>
            <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
          <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-6 md:py-8">
            <Routes>
              <Route path="/" element={<PageTransition><Overview /></PageTransition>} />
              <Route path="/countries" element={<PageTransition><CountriesList /></PageTransition>} />
              <Route path="/countries/:code" element={<PageTransition><CountryExplorer /></PageTransition>} />
              <Route path="/compare" element={<PageTransition><Compare /></PageTransition>} />
              <Route path="/correlate" element={<PageTransition><CorrelationExplorer /></PageTransition>} />
              <Route path="/indicators" element={<PageTransition><Indicators /></PageTransition>} />
              <Route path="/rankings" element={<PageTransition><Rankings /></PageTransition>} />
              <Route path="/insights" element={<PageTransition><Insights /></PageTransition>} />
              <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
