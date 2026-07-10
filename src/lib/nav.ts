import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  KanbanSquare,
  Activity,
  Megaphone,
  Workflow,
  FileText,
  Clock,
  Inbox,
  Users,
  Building2,
  Globe,
  Upload,
  BarChart3,
  FlaskConical,
  GraduationCap,
  ShieldCheck,
  CalendarDays,
  Settings,
  Linkedin,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "followUpsDue" | "inboxUnread";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Pipeline", href: "/pipeline", icon: KanbanSquare },
      { label: "Activity", href: "/activity", icon: Activity },
    ],
  },
  {
    title: "Outbound",
    items: [
      { label: "Campaigns", href: "/campaigns", icon: Megaphone },
      { label: "Sequences", href: "/sequences", icon: Workflow },
      { label: "Templates", href: "/templates", icon: FileText },
      { label: "Follow-ups", href: "/follow-ups", icon: Clock, badgeKey: "followUpsDue" },
      { label: "Inbox", href: "/inbox", icon: Inbox, badgeKey: "inboxUnread" },
    ],
  },
  {
    title: "Data",
    items: [
      { label: "Leads", href: "/leads", icon: Users },
      { label: "Companies", href: "/companies", icon: Building2 },
      { label: "LinkedIn", href: "/linkedin", icon: Linkedin },
      { label: "Crawler", href: "/crawler", icon: Globe },
      { label: "Import", href: "/import", icon: Upload },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "A/B Testing", href: "/ab-testing", icon: FlaskConical },
      { label: "Learning Center", href: "/learning", icon: GraduationCap },
      { label: "Deliverability", href: "/deliverability", icon: ShieldCheck },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "Meetings", href: "/meetings", icon: CalendarDays },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((s) => s.items);
