import { useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatWidget from "./ChatWidget";
import { PROD_API_URL } from "./utils/constants";

// Lazy-load pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Market = lazy(() => import("./pages/Market"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Calculator = lazy(() => import("./pages/Calculator"));
const Compare = lazy(() => import("./pages/Compare"));
const News = lazy(() => import("./pages/News"));
const Summary = lazy(() => import("./pages/Summary"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));

function PageLoading() {
  return (
    <div className="al-page-loading">
      <div className="al-loading-orb" />
    </div>
  );
}

export default function App() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="al-app">
            <Navbar onOpenAuth={() => setShowAuth(true)} />

            <main className="al-main">
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/market" element={<Market />} />
                  <Route
                    path="/portfolio"
                    element={
                      <ProtectedRoute onOpenAuth={() => setShowAuth(true)}>
                        <Portfolio />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/calculator"
                    element={
                      <ProtectedRoute onOpenAuth={() => setShowAuth(true)}>
                        <Calculator />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/compare" element={<Compare />} />
                  <Route path="/news" element={<News />} />
                  <Route path="/summary" element={<Summary />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute onOpenAuth={() => setShowAuth(true)}>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute onOpenAuth={() => setShowAuth(true)}>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Suspense>
            </main>

            <Footer />
            <ChatWidget apiBase={PROD_API_URL} />

            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
          </div>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
