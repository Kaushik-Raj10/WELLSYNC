import { useEffect, useState } from "react";
import "./App.css";

import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import DailyCheckIn from "./components/DailyCheckIn";
import AICompanion from "./components/AICompanion";
import Insights from "./components/Insights";
import Goals from "./components/Goals";
import Analytics from "./components/Analytics";

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
    icon: "⌂",
  },
  {
    id: "checkin",
    label: "Daily Check-In",
    icon: "✓",
  },
  {
    id: "ai",
    label: "AI Companion",
    icon: "✦",
  },
  {
    id: "insights",
    label: "Insights",
    icon: "◌",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: "⌁",
  },
  {
    id: "goals",
    label: "Goals",
    icon: "◎",
  },
];

function App() {
  const [session, setSession] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");

  const [latestData, setLatestData] = useState(null);
  const [dataSource, setDataSource] = useState("local");

  const [authLoading, setAuthLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setSession(session);
        setAuthLoading(false);
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
            setDashboardLoading(false);
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
      console.error(
        "Failed to load dashboard data:",
        error
      );

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
  }

  function navigateTo(page) {
    setActivePage(page);
  }

  if (!supabaseConfigReady) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-card">
          <div className="app-brand-mark">W</div>

          <h1>WELLsync</h1>

          <p>
            Supabase is not configured yet. Please check your
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
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">W</div>

            <div>
              <div className="sidebar-brand-name">
                WELLsync
              </div>

              <div className="sidebar-brand-subtitle">
                Personal Wellness
              </div>
            </div>
          </div>

          <div className="sidebar-nav">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${
                  activePage === item.id
                    ? "active"
                    : ""
                }`}
                onClick={() => navigateTo(item.id)}
              >
                <span className="nav-item-icon">
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {session.user?.email?.charAt(0)?.toUpperCase() ||
                "U"}
            </div>

            <div className="sidebar-user-info">
              <strong>
                {session.user?.email?.split("@")[0] ||
                  "User"}
              </strong>

              <span>Wellness journey</span>
            </div>
          </div>

          <button
            className="sidebar-signout"
            onClick={handleSignOut}
          >
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="mobile-header">
          <div className="mobile-brand">
            <div className="mobile-brand-icon">W</div>
            <span>WELLsync</span>
          </div>
        </div>

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
            <Insights />
          </div>
        )}

        {activePage === "analytics" && (
          <div className="page-container">
            <Analytics />
          </div>
        )}

        {activePage === "goals" && (
          <div className="page-container">
            <Goals />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;