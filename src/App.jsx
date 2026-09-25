import { useEffect, useState } from "react";
import "./App.css";

import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import DailyCheckIn from "./components/DailyCheckIn";
import AICompanion from "./components/AICompanion";
import Insights from "./components/Insights";
import Goals from "./components/Goals";
import Analytics from "./components/Analytics";
import Profile from "./components/Profile";

import {
  supabase,
  supabaseConfigReady,
} from "./lib/supabase";

import { getWellnessData } from "./utils/wellnessData";
import { getLatestCloudCheckin } from "./utils/supabaseData";

const navigationItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: "⌂",
  },
  {
    id: "checkin",
    label: "Daily Check-In",
    shortLabel: "Check-in",
    icon: "✓",
  },
  {
    id: "ai",
    label: "AI Companion",
    shortLabel: "AI",
    icon: "✦",
  },
  {
    id: "insights",
    label: "Insights",
    shortLabel: "Insights",
    icon: "◌",
  },
  {
    id: "analytics",
    label: "Analytics",
    shortLabel: "Analytics",
    icon: "⌁",
  },
  {
    id: "goals",
    label: "Goals",
    shortLabel: "Goals",
    icon: "◎",
  },
];

const referenceSidebarItems = [
  { id: "devices", label: "Connected Devices", icon: "▣" },
  { id: "profile", label: "Profile", icon: "◯" },
];

const mobilePrimaryItems = [
  navigationItems[0],
  navigationItems[1],
  navigationItems[2],
  navigationItems[4],
];

const mobileMoreItems = [
  navigationItems[3],
  navigationItems[5],
  { id: "profile", label: "Profile", shortLabel: "Profile", icon: "◯" },
];

function App() {
  const [session, setSession] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");

  const [latestData, setLatestData] = useState(null);
  const [dataSource, setDataSource] = useState("local");

  const [authLoading, setAuthLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (mounted) {
          setSession(session);
          setAuthLoading(false);
        }
      } catch (error) {
        console.error("Could not load session:", error);

        if (mounted) {
          setSession(null);
          setAuthLoading(false);
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;

        setSession(nextSession);
        setAuthLoading(false);

        if (!nextSession) {
          setLatestData(null);
          setDataSource("local");
          setActivePage("dashboard");
          setMobileMoreOpen(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadDashboardData() {
    setDashboardLoading(true);

    try {
      if (session && supabase) {
        try {
          const cloudData = await getLatestCloudCheckin();

          if (cloudData) {
            setLatestData(cloudData);
            setDataSource("cloud");
            return;
          }
        } catch (cloudError) {
          console.warn(
            "Could not load latest cloud check-in:",
            cloudError
          );
        }
      }

      const localData = getWellnessData();

      if (localData) {
        setLatestData(localData);
        setDataSource("local");
      } else {
        setLatestData(null);
        setDataSource("local");
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setLatestData(null);
      setDataSource("local");
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    if (!session) {
      setDashboardLoading(false);
      return;
    }

    if (activePage === "dashboard") {
      loadDashboardData();
    }
  }, [session, activePage]);

  useEffect(() => {
    setMobileMoreOpen(false);
  }, [activePage]);

  function navigateTo(page) {
    setActivePage(page);
    setMobileMoreOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSignOut() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out error:", error);
      return;
    }

    setSession(null);
    setLatestData(null);
    setDataSource("local");
    setActivePage("dashboard");
    setMobileMoreOpen(false);
  }

  function toggleMobileMore() {
    setMobileMoreOpen((current) => !current);
  }

  function handleReferenceNav(item) {
    if (item.id === "profile") {
      navigateTo("profile");
      return;
    }

    if (item.id === "devices") {
      toggleMobileMore();
    }
  }

  if (!supabaseConfigReady) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-card">
          <div className="app-brand-mark">W</div>

          <h1>WELLsync</h1>

          <p>
            Supabase is not configured yet. Please check your{" "}
            <code>.env.local</code> file.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-card">
          <div className="app-brand-mark">W</div>

          <h1>WELLsync</h1>

          <p>Loading your wellness space...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar-top">
          <button
            type="button"
            className="sidebar-brand sidebar-brand-button"
            onClick={() => navigateTo("dashboard")}
            aria-label="Go to dashboard"
          >
            <div className="sidebar-brand-icon">W</div>

            <div className="sidebar-brand-copy">
              <div className="sidebar-brand-name">WELLsync</div>
              <div className="sidebar-brand-subtitle">
                Personal Wellness
              </div>
            </div>
          </button>

          <div className="sidebar-nav">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${
                  activePage === item.id ? "active" : ""
                }`}
                onClick={() => navigateTo(item.id)}
                aria-current={activePage === item.id ? "page" : undefined}
              >
                <span className="nav-item-icon" aria-hidden="true">
                  {item.icon}
                </span>

                <span>{item.label}</span>

                {item.id === "ai" && (
                  <span className="nav-ai-dot" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>

          <div className="sidebar-reference-nav" aria-label="Wellness modules">
            {referenceSidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="nav-item nav-item-reference"
                onClick={() => handleReferenceNav(item)}
              >
                <span className="nav-item-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {item.id === "devices" && (
                  <span className="nav-coming-soon">Soon</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-bottom"><div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {session.user?.email?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div className="sidebar-user-info">
              <strong>
                {session.user?.email?.split("@")[0] || "User"}
              </strong>

              <span>Wellness journey</span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-signout"
            onClick={handleSignOut}
          >
            <span aria-hidden="true">↪</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
          <button
            type="button"
            className="mobile-brand-button"
            onClick={() => navigateTo("dashboard")}
            aria-label="Go to dashboard"
          >
            <div className="mobile-brand-icon">W</div>

            <div className="mobile-brand-text">
              <strong>WELLsync</strong>
              <span>
                {navigationItems.find((item) => item.id === activePage)
                  ?.label || "Dashboard"}
              </span>
            </div>
          </button>

          <div className="mobile-header-actions">
            <button
              type="button"
              className="mobile-header-ai"
              onClick={() => navigateTo("ai")}
              aria-label="Open AI Companion"
              aria-current={activePage === "ai" ? "page" : undefined}
            >
              <span aria-hidden="true">✦</span>
            </button>

            <button
              type="button"
              className="mobile-header-avatar"
              onClick={toggleMobileMore}
              aria-label="Open account and more navigation"
              aria-expanded={mobileMoreOpen}
            >
              {session.user?.email?.charAt(0)?.toUpperCase() || "U"}
            </button>
          </div>
        </header>

        <div className="mobile-more-panel-wrap">
          <div
            className={`mobile-more-backdrop ${
              mobileMoreOpen ? "visible" : ""
            }`}
            onClick={() => setMobileMoreOpen(false)}
            aria-hidden="true"
          />

          <div
            className={`mobile-more-panel ${
              mobileMoreOpen ? "open" : ""
            }`}
            aria-hidden={!mobileMoreOpen}
          >
            <div className="mobile-more-handle" />

            <div className="mobile-more-heading">
              <div>
                <span className="mobile-more-kicker">WELLsync</span>
                <h2>More</h2>
              </div>

              <button
                type="button"
                className="mobile-more-close"
                onClick={() => setMobileMoreOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className="mobile-more-account">
              <div className="mobile-account-avatar">
                {session.user?.email?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <strong>
                  {session.user?.email?.split("@")[0] || "User"}
                </strong>
                <span>Wellness journey</span>
              </div>
            </div>

            <div className="mobile-more-links">
              {mobileMoreItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`mobile-more-link ${
                    activePage === item.id ? "active" : ""
                  }`}
                  onClick={() => navigateTo(item.id)}
                >
                  <span className="mobile-more-link-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  <span className="mobile-more-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="mobile-more-signout"
              onClick={handleSignOut}
            >
              <span aria-hidden="true">↪</span>
              Sign out
            </button>
          </div>
        </div>

        <section className="app-page-stage">
          {activePage === "dashboard" && (
            <div className="page-container">
              {dashboardLoading ? (
                <div className="page-loading-card">
                  <div className="loading-spinner" />
                  <p>Loading your wellness data...</p>
                </div>
              ) : (
                <Dashboard
                  latestData={latestData}
                  onNavigate={navigateTo}
                  dataSource={dataSource}
                />
              )}
            </div>
          )}

          {activePage === "checkin" && (
            <div className="page-container">
              <DailyCheckIn />
            </div>
          )}

          {activePage === "ai" && (
            <div className="page-container">
              <AICompanion />
            </div>
          )}

          {activePage === "insights" && (
            <div className="page-container">
              <Insights onNavigate={navigateTo} />
            </div>
          )}

          {activePage === "analytics" && (
            <div className="page-container">
              <Analytics onNavigate={navigateTo} />
            </div>
          )}

          {activePage === "goals" && (
            <div className="page-container">
              <Goals onNavigate={navigateTo} />
            </div>
          )}

          {activePage === "profile" && (
            <div className="page-container">
              <Profile onNavigate={navigateTo} />
            </div>
          )}
        </section>

        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {mobilePrimaryItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mobile-nav-item ${
                activePage === item.id ? "active" : ""
              }`}
              onClick={() => navigateTo(item.id)}
              aria-current={activePage === item.id ? "page" : undefined}
            >
              <span className="mobile-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="mobile-nav-label">{item.shortLabel}</span>

              {item.id === "ai" && (
                <span className="mobile-ai-pulse" aria-hidden="true" />
              )}
            </button>
          ))}

          <button
            type="button"
            className={`mobile-nav-item ${
              mobileMoreOpen ||
              mobileMoreItems.some((item) => item.id === activePage)
                ? "active"
                : ""
            }`}
            onClick={toggleMobileMore}
            aria-expanded={mobileMoreOpen}
          >
            <span className="mobile-nav-icon mobile-more-icon" aria-hidden="true">
              ⋯
            </span>
            <span className="mobile-nav-label">More</span>
          </button>
        </nav>
      </main>
    </div>
  );
}

export default App;
