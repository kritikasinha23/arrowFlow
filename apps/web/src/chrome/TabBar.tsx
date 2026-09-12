import { NavLink, useLocation } from "react-router-dom";
import { IconCalendar, IconGear, IconHome, IconShieldTab, IconStar } from "./icons";

const TABS = [
  { to: "/home", label: "Home", testId: "tab-home", icon: IconHome, match: ["/", "/home"] },
  { to: "/daily", label: "Challenge", testId: "tab-challenge", icon: IconCalendar, match: ["/daily", "/challenge"] },
  { to: "/league", label: "Leagues", testId: "tab-leagues", icon: IconShieldTab, match: ["/league"] },
  {
    to: "/collection",
    label: "Collection",
    testId: "tab-collection",
    icon: IconStar,
    match: ["/collection", "/levels", "/campaign"],
  },
  { to: "/settings", label: "Settings", testId: "tab-settings", icon: IconGear, match: ["/settings"] },
] as const;

export function TabBar() {
  const { pathname } = useLocation();

  return (
    <nav className="tabbar" data-testid="tabbar">
      {TABS.map((tab) => {
        const on = (tab.match as readonly string[]).includes(pathname);
        return (
          <NavLink key={tab.to} to={tab.to} data-testid={tab.testId} className={on ? "tab on" : "tab"}>
            <span className="tab-icon">
              <tab.icon filled={on} />
            </span>
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
