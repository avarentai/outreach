/* =========================================================================
 * Deterministic seed data generator.
 * Produces a rich, cross-referenced dataset so the demo feels like a live
 * account. Seeded PRNG → identical data every run (stable analytics/charts).
 * ========================================================================= */

import type {
  Workspace,
  User,
  Company,
  Contact,
  EmailTemplate,
  Snippet,
  Sequence,
  Campaign,
  SendingAccount,
  EmailMessage,
  Thread,
  Meeting,
  Activity,
  Note,
  Attachment,
  Experiment,
  SavedView,
  ScoringConfig,
  PipelineStage,
  ReplySentiment,
  FollowUpTask,
} from "./types";
import { seededRandom } from "./engines/scheduler";
import { DEFAULT_SCORING_CONFIG, scoreContact } from "./engines/scoring";
import { DEFAULT_SENDING_WINDOW } from "./engines/scheduler";
import { validateEmail } from "./engines/dedup";
import { wordCount, initials, avatarColor } from "./utils";
import { generateFollowUps } from "./engines/followups";

export interface SeedData {
  workspace: Workspace;
  users: User[];
  currentUserId: string;
  companies: Company[];
  contacts: Contact[];
  templates: EmailTemplate[];
  snippets: Snippet[];
  sequences: Sequence[];
  campaigns: Campaign[];
  accounts: SendingAccount[];
  messages: EmailMessage[];
  threads: Thread[];
  meetings: Meeting[];
  activities: Activity[];
  notes: Note[];
  attachments: Attachment[];
  experiments: Experiment[];
  savedViews: SavedView[];
  scoring: ScoringConfig;
  followUps: FollowUpTask[];
}

const rng = seededRandom(424242);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const chance = (p: number) => rng() < p;
const intBetween = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));

const FIRST = [
  "James", "Sarah", "Michael", "Emily", "David", "Jessica", "Robert", "Ashley",
  "William", "Amanda", "Richard", "Melissa", "Thomas", "Nicole", "Daniel", "Rachel",
  "Kevin", "Laura", "Brian", "Megan", "Jason", "Christine", "Eric", "Diana",
];
const LAST = [
  "Anderson", "Mitchell", "Torres", "Nguyen", "Patel", "Sullivan", "Reyes", "Chen",
  "Foster", "Ramirez", "Coleman", "Bryant", "Weaver", "Hughes", "Simmons", "Powell",
  "Bishop", "Fleming", "Barrett", "Hayes", "Sandoval", "Warren", "Dixon", "Frost",
];
const TITLES = [
  "VP of Lending", "Chief Lending Officer", "Director of Consumer Lending",
  "Head of Digital Banking", "SVP Retail", "Chief Credit Officer",
  "Director of Member Experience", "VP Operations", "Chief Technology Officer",
  "Director of Innovation", "Head of Underwriting", "VP of Auto Lending",
];

const COMPANY_DATA: { name: string; domain: string; industry: string }[] = [
  { name: "Summit Federal Credit Union", domain: "summitfcu.org", industry: "Credit Union" },
  { name: "Cascade Community Bank", domain: "cascadebank.com", industry: "Community Bank" },
  { name: "Meridian Auto Finance", domain: "meridianauto.com", industry: "Auto Lending" },
  { name: "Pinnacle Mortgage Group", domain: "pinnaclemtg.com", industry: "Mortgage" },
  { name: "BlueRiver Credit Union", domain: "bluerivercu.org", industry: "Credit Union" },
  { name: "Heartland Regional Bank", domain: "heartlandregional.com", industry: "Regional Bank" },
  { name: "Vantage Fintech", domain: "vantagefin.io", industry: "Fintech" },
  { name: "Copperline Community CU", domain: "copperlinecu.org", industry: "Credit Union" },
  { name: "Ironwood Savings", domain: "ironwoodsavings.com", industry: "Community Bank" },
  { name: "Northgate Lending", domain: "northgatelending.com", industry: "Auto Lending" },
  { name: "Silverpeak Financial", domain: "silverpeakfin.com", industry: "Wealth Management" },
  { name: "Harbor Point Bank", domain: "harborpointbank.com", industry: "Regional Bank" },
  { name: "Trailhead Credit Union", domain: "trailheadcu.org", industry: "Credit Union" },
  { name: "Momentum Lending Co", domain: "momentumlending.com", industry: "Mortgage" },
  { name: "Keystone Fintech Labs", domain: "keystonelabs.io", industry: "Fintech" },
  { name: "Riverside Community Bank", domain: "riversidecb.com", industry: "Community Bank" },
  { name: "Apex Auto Credit", domain: "apexautocredit.com", industry: "Auto Lending" },
  { name: "Granite State CU", domain: "granitestatecu.org", industry: "Credit Union" },
  { name: "Latitude Financial", domain: "latitudefin.com", industry: "Fintech" },
  { name: "Willowbrook Savings Bank", domain: "willowbrooksb.com", industry: "Community Bank" },
  { name: "Fairview Mortgage", domain: "fairviewmtg.com", industry: "Mortgage" },
  { name: "Crestline Credit Union", domain: "crestlinecu.org", industry: "Credit Union" },
  { name: "Beacon Regional Bank", domain: "beaconregional.com", industry: "Regional Bank" },
  { name: "Nova Lending Group", domain: "novalending.com", industry: "Auto Lending" },
  { name: "Evergreen Community CU", domain: "evergreencu.org", industry: "Credit Union" },
  { name: "Sterling Bank & Trust", domain: "sterlingbt.com", industry: "Regional Bank" },
  { name: "Pathway Fintech", domain: "pathwayfin.io", industry: "Fintech" },
  { name: "Oakmont Savings", domain: "oakmontsavings.com", industry: "Community Bank" },
  { name: "Redwood Auto Lending", domain: "redwoodauto.com", industry: "Auto Lending" },
  { name: "Horizon Federal CU", domain: "horizonfcu.org", industry: "Credit Union" },
  { name: "Maple Ridge Bank", domain: "mapleridgebank.com", industry: "Community Bank" },
  { name: "Quantum Mortgage", domain: "quantummtg.com", industry: "Mortgage" },
  { name: "Anchor Financial Group", domain: "anchorfg.com", industry: "Wealth Management" },
  { name: "Brightside Credit Union", domain: "brightsidecu.org", industry: "Credit Union" },
  { name: "Cedar Valley Bank", domain: "cedarvalleybank.com", industry: "Regional Bank" },
  { name: "Velocity Auto Finance", domain: "velocityaf.com", industry: "Auto Lending" },
  { name: "Foundry Fintech", domain: "foundryfin.io", industry: "Fintech" },
  { name: "Lakeshore Community CU", domain: "lakeshorecu.org", industry: "Credit Union" },
  { name: "Prospect Savings Bank", domain: "prospectsb.com", industry: "Community Bank" },
  { name: "Titan Lending Partners", domain: "titanlending.com", industry: "Mortgage" },
  { name: "Compass Point CU", domain: "compasspointcu.org", industry: "Credit Union" },
  { name: "Kingsway Regional Bank", domain: "kingswaybank.com", industry: "Regional Bank" },
  { name: "Nexus Auto Credit", domain: "nexusautocredit.com", industry: "Auto Lending" },
  { name: "Emberline Financial", domain: "emberlinefin.com", industry: "Fintech" },
  { name: "Woodland Federal CU", domain: "woodlandfcu.org", industry: "Credit Union" },
];

const TECH_POOL = [
  { name: "Salesforce", category: "CRM", confidence: 0.9 },
  { name: "HubSpot", category: "Marketing", confidence: 0.8 },
  { name: "WordPress", category: "CMS", confidence: 0.95 },
  { name: "Google Analytics", category: "Analytics", confidence: 0.9 },
  { name: "Cloudflare", category: "Infra", confidence: 0.85 },
  { name: "OpenAI", category: "AI", confidence: 0.7 },
  { name: "Segment", category: "Analytics", confidence: 0.6 },
  { name: "Intercom", category: "Support", confidence: 0.75 },
];

const EMP_RANGES = ["11-50", "51-200", "201-500", "501-1000", "1000-5000"];

function nowMinusDays(days: number, hour?: number, minute?: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  if (hour !== undefined) d.setHours(hour, minute ?? intBetween(0, 59), 0, 0);
  return d.toISOString();
}

/* ----------------------------- generator ---------------------------------- */

export function generateSeed(): SeedData {
  const workspace: Workspace = {
    id: "ws_avarent",
    name: "Avarent",
    domain: "avarent.ai",
    timezone: "America/Toronto",
    createdAt: nowMinusDays(180),
  };

  const users: User[] = [
    {
      id: "u_george",
      name: "George",
      email: "george@avarent.ai",
      role: "owner",
      avatarColor: avatarColor("George"),
      initials: "GE",
      title: "Co-founder",
      createdAt: nowMinusDays(180),
      lastActiveAt: nowMinusDays(0, 9),
    },
    {
      id: "u_lucas",
      name: "Lucas",
      email: "lucas@avarent.ai",
      role: "owner",
      avatarColor: avatarColor("Lucas"),
      initials: "LU",
      title: "Co-founder",
      createdAt: nowMinusDays(180),
      lastActiveAt: nowMinusDays(0, 8),
    },
  ];
  const ownerIds = users.map((u) => u.id);

  /* Companies */
  const companies: Company[] = COMPANY_DATA.map((c, i) => {
    const techCount = intBetween(2, 5);
    const techStack = [...TECH_POOL].sort(() => rng() - 0.5).slice(0, techCount);
    const crawled = chance(0.7);
    return {
      id: `co_${i + 1}`,
      name: c.name,
      domain: c.domain,
      website: `https://${c.domain}`,
      industry: c.industry,
      status: "prospect",
      tags: chance(0.3) ? ["priority"] : [],
      ownerId: pick(ownerIds),
      notes: undefined,
      enrichment: {
        contactPageUrl: `https://${c.domain}/contact`,
        aboutPageUrl: `https://${c.domain}/about`,
        careersPageUrl: chance(0.6) ? `https://${c.domain}/careers` : undefined,
        teamPageUrl: chance(0.5) ? `https://${c.domain}/team` : undefined,
        products: pick([["Consumer Loans", "Auto Loans"], ["Mortgages", "HELOC"], ["Business Banking"], ["Credit Cards", "Personal Loans"]]),
        hq: pick(["Austin, TX", "Columbus, OH", "Denver, CO", "Portland, OR", "Nashville, TN", "Charlotte, NC", "Boise, ID"]),
        employeeEstimate: pick(EMP_RANGES),
        techStack: crawled ? techStack : [],
        socialLinks: [
          { platform: "linkedin", url: `https://linkedin.com/company/${c.domain.split(".")[0]}` },
        ],
        domainAgeYears: intBetween(3, 22),
        discoveredEmails: crawled ? [`info@${c.domain}`, `contact@${c.domain}`] : [],
        lastCrawledAt: crawled ? nowMinusDays(intBetween(1, 20)) : undefined,
        crawlStatus: crawled ? "done" : "never",
      },
      createdAt: nowMinusDays(intBetween(30, 120)),
      updatedAt: nowMinusDays(intBetween(0, 10)),
    };
  });

  /* Templates (required set + variants) */
  const templates: EmailTemplate[] = [
    {
      id: "tpl_initial_v1",
      name: "Initial Outreach V1",
      category: "initial",
      subject: "Cutting {{company}}'s loan decision time",
      body:
        "Hi {{first_name}},\n\nI noticed {{company}} is active in {{industry}}. We help lenders like you approve more applications with automated, explainable underwriting — most partners cut decision time by 60%.\n\nWorth a quick look? /calendar\n\nBest,\n{{sender_name}}",
      ownerId: "u_lucas",
      tags: ["cold"],
      archived: false,
      createdAt: nowMinusDays(60),
      updatedAt: nowMinusDays(12),
      version: 1,
    },
    {
      id: "tpl_initial_v2",
      name: "Initial Outreach V2",
      category: "initial",
      subject: "Quick question about {{company}}'s underwriting",
      body:
        "Hi {{first_name}},\n\nQuick one — how is {{company}} handling loan decisioning today? We've helped {{industry}} lenders automate underwriting while staying fully compliant.\n\nOpen to a 15-min walkthrough? /demo\n\n{{sender_name}}",
      ownerId: "u_george",
      tags: ["cold"],
      archived: false,
      createdAt: nowMinusDays(45),
      updatedAt: nowMinusDays(5),
      version: 3,
    },
    {
      id: "tpl_follow1",
      name: "Follow-up #1",
      category: "follow_up",
      subject: "Re: {{company}}'s underwriting",
      body:
        "Hi {{first_name}},\n\nFloating this back to the top of your inbox. We just published a {{industry}} case study — /case-study — showing a 3x lift in approval throughput.\n\nWould a short call make sense?\n\n{{sender_name}}",
      ownerId: "u_lucas",
      tags: [],
      archived: false,
      createdAt: nowMinusDays(58),
      updatedAt: nowMinusDays(20),
      version: 2,
    },
    {
      id: "tpl_follow2",
      name: "Follow-up #2",
      category: "follow_up",
      subject: "One more idea for {{company}}",
      body:
        "Hi {{first_name}},\n\nLast thought — even a small automation on your highest-volume loan product could free your team meaningfully. Happy to share what similar lenders did.\n\n{{sender_name}}",
      ownerId: "u_lucas",
      tags: [],
      archived: false,
      createdAt: nowMinusDays(55),
      updatedAt: nowMinusDays(18),
      version: 1,
    },
    {
      id: "tpl_breakup",
      name: "Breakup Email",
      category: "breakup",
      subject: "Should I close the loop?",
      body:
        "Hi {{first_name}},\n\nI haven't heard back, so I'll assume the timing isn't right. If underwriting automation becomes a priority for {{company}}, my door's open.\n\nAll the best,\n{{sender_name}}",
      ownerId: "u_george",
      tags: [],
      archived: false,
      createdAt: nowMinusDays(50),
      updatedAt: nowMinusDays(15),
      version: 1,
    },
    {
      id: "tpl_referral",
      name: "Referral Request",
      category: "referral",
      subject: "Who owns lending decisions at {{company}}?",
      body:
        "Hi {{first_name}},\n\nI may have the wrong person — could you point me to whoever owns loan decisioning at {{company}}? Really appreciate it.\n\n{{sender_name}}",
      ownerId: "u_lucas",
      tags: [],
      archived: false,
      createdAt: nowMinusDays(40),
      updatedAt: nowMinusDays(10),
      version: 1,
    },
    {
      id: "tpl_meeting_confirm",
      name: "Meeting Confirmation",
      category: "meeting_confirmation",
      subject: "Confirmed: our call on {{company}}'s lending",
      body:
        "Hi {{first_name}},\n\nLooking forward to our conversation. I'll walk through how {{industry}} lenders automate underwriting end-to-end. Anything specific you'd like me to prep?\n\n{{sender_name}}",
      ownerId: "u_george",
      tags: [],
      archived: false,
      createdAt: nowMinusDays(35),
      updatedAt: nowMinusDays(8),
      version: 1,
    },
  ];

  const snippets: Snippet[] = [
    { id: "sn_demo", trigger: "/demo", label: "Demo link", content: "https://cal.avarent.ai/demo" },
    { id: "sn_calendar", trigger: "/calendar", label: "Calendar", content: "https://cal.avarent.ai/lucas" },
    { id: "sn_case", trigger: "/case-study", label: "Case study", content: "https://avarent.ai/cases/lending-3x" },
  ];

  /* Sequence */
  const sequences: Sequence[] = [
    {
      id: "seq_standard",
      name: "Standard 3-Touch",
      steps: [
        { id: "st_1", type: "email", templateId: "tpl_initial_v1" },
        { id: "st_2", type: "wait", waitDays: 4 },
        { id: "st_3", type: "email", templateId: "tpl_follow1" },
        { id: "st_4", type: "wait", waitDays: 5 },
        { id: "st_5", type: "email", templateId: "tpl_follow2" },
        { id: "st_6", type: "wait", waitDays: 5 },
        { id: "st_7", type: "email", templateId: "tpl_breakup" },
        { id: "st_8", type: "condition", stopOn: "on_reply" },
      ],
      createdAt: nowMinusDays(60),
      updatedAt: nowMinusDays(10),
    },
  ];

  /* Sending accounts */
  const accounts: SendingAccount[] = [
    {
      id: "acc_lucas",
      label: "Lucas — Primary",
      fromName: "Lucas at Avarent",
      fromEmail: "lucas@avarent.ai",
      provider: "resend",
      dailyLimit: 50,
      warmupEnabled: true,
      spf: "pass",
      dkim: "pass",
      dmarc: "pass",
      reputationScore: 94,
      active: true,
      createdAt: nowMinusDays(90),
    },
    {
      id: "acc_george",
      label: "George — Primary",
      fromName: "George at Avarent",
      fromEmail: "george@avarent.ai",
      provider: "resend",
      dailyLimit: 50,
      warmupEnabled: true,
      spf: "pass",
      dkim: "pass",
      dmarc: "unknown",
      reputationScore: 88,
      active: true,
      createdAt: nowMinusDays(90),
    },
  ];

  /* Campaigns */
  const campaigns: Campaign[] = [
    {
      id: "camp_cu_q3",
      name: "Credit Unions — Q3 Push",
      ownerId: "u_lucas",
      status: "active",
      sequenceId: "seq_standard",
      sendingAccountIds: ["acc_lucas"],
      contactIds: [],
      sendingWindow: DEFAULT_SENDING_WINDOW,
      stopOnReply: true,
      requireApproval: false,
      createdAt: nowMinusDays(30),
      updatedAt: nowMinusDays(1),
      startedAt: nowMinusDays(28),
    },
    {
      id: "camp_banks",
      name: "Community Banks — Warm",
      ownerId: "u_george",
      status: "active",
      sequenceId: "seq_standard",
      sendingAccountIds: ["acc_george"],
      contactIds: [],
      sendingWindow: DEFAULT_SENDING_WINDOW,
      stopOnReply: true,
      requireApproval: true,
      createdAt: nowMinusDays(24),
      updatedAt: nowMinusDays(2),
      startedAt: nowMinusDays(22),
    },
    {
      id: "camp_auto",
      name: "Auto Lenders — Test",
      ownerId: "u_lucas",
      status: "paused",
      sequenceId: "seq_standard",
      sendingAccountIds: ["acc_lucas"],
      contactIds: [],
      sendingWindow: DEFAULT_SENDING_WINDOW,
      stopOnReply: true,
      requireApproval: false,
      createdAt: nowMinusDays(18),
      updatedAt: nowMinusDays(3),
      startedAt: nowMinusDays(16),
    },
    {
      id: "camp_fintech",
      name: "Fintech Partnerships",
      ownerId: "u_george",
      status: "draft",
      sequenceId: "seq_standard",
      sendingAccountIds: ["acc_george"],
      contactIds: [],
      sendingWindow: DEFAULT_SENDING_WINDOW,
      stopOnReply: true,
      requireApproval: true,
      createdAt: nowMinusDays(5),
      updatedAt: nowMinusDays(1),
    },
  ];

  /* Contacts + downstream records */
  const contacts: Contact[] = [];
  const messages: EmailMessage[] = [];
  const threads: Thread[] = [];
  const meetings: Meeting[] = [];
  const activities: Activity[] = [];

  const stageWeights: [PipelineStage, number][] = [
    ["new", 0.18],
    ["contacted", 0.34],
    ["replied", 0.14],
    ["qualified", 0.1],
    ["meeting_scheduled", 0.08],
    ["demo_completed", 0.06],
    ["proposal_sent", 0.04],
    ["customer", 0.03],
    ["closed_lost", 0.03],
  ];
  function weightedStage(): PipelineStage {
    const r = rng();
    let acc = 0;
    for (const [s, w] of stageWeights) {
      acc += w;
      if (r <= acc) return s;
    }
    return "new";
  }

  const stageOrder: PipelineStage[] = [
    "new", "contacted", "replied", "qualified", "meeting_scheduled",
    "demo_completed", "proposal_sent", "customer", "closed_lost",
  ];
  const stageIndex = (s: PipelineStage) => stageOrder.indexOf(s);

  let contactCounter = 0;
  let msgCounter = 0;
  let threadCounter = 0;

  for (const company of companies) {
    const numContacts = intBetween(1, 3);
    // assign company to a campaign by industry
    let campaign: Campaign | undefined;
    if (/Credit Union/.test(company.industry ?? "")) campaign = campaigns[0];
    else if (/Community Bank|Regional Bank/.test(company.industry ?? "")) campaign = campaigns[1];
    else if (/Auto/.test(company.industry ?? "")) campaign = campaigns[2];
    else if (/Fintech/.test(company.industry ?? "")) campaign = campaigns[3];

    for (let k = 0; k < numContacts; k++) {
      contactCounter++;
      const first = pick(FIRST);
      const last = pick(LAST);
      const email = `${first.toLowerCase()}.${last.toLowerCase()}@${company.domain}`;
      const stage = k === 0 ? weightedStage() : chance(0.5) ? "new" : "contacted";
      const owner = campaign?.ownerId ?? pick(ownerIds);
      const contactedAtDays = stageIndex(stage) >= 1 ? intBetween(2, 28) : 0;

      const contact: Contact = {
        id: `ct_${contactCounter}`,
        companyId: company.id,
        firstName: first,
        lastName: last,
        email,
        emailValidity: validateEmail(email),
        jobTitle: pick(TITLES),
        linkedinUrl: chance(0.7) ? `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}` : undefined,
        phone: chance(0.4) ? `+1 ${intBetween(200, 989)}-${intBetween(200, 989)}-${intBetween(1000, 9999)}` : undefined,
        stage,
        stageEnteredAt: nowMinusDays(intBetween(0, contactedAtDays || 10)),
        ownerId: owner,
        campaignId: stageIndex(stage) >= 1 ? campaign?.id : undefined,
        tags: chance(0.2) ? ["decision-maker"] : [],
        score: 0,
        lastContactedAt: contactedAtDays ? nowMinusDays(contactedAtDays) : undefined,
        nextFollowUpAt: undefined,
        linkedinStatus: chance(0.5) ? pick(["not_connected", "request_sent", "connected", "messaged"]) : "none",
        linkedinNotes: undefined,
        unsubscribed: chance(0.02),
        bounced: false,
        createdAt: nowMinusDays(intBetween(10, 90)),
        updatedAt: nowMinusDays(intBetween(0, 5)),
      };

      // score
      const sc = scoreContact(
        { contact, company, engagementCount: stageIndex(stage) >= 2 ? intBetween(1, 4) : 0 },
        DEFAULT_SCORING_CONFIG,
      );
      contact.score = sc.score;
      contact.scoreBreakdown = sc.components;

      // Generate email history for contacted+ contacts
      const idx = stageIndex(stage);
      if (idx >= 1 && campaign) {
        threadCounter++;
        const threadId = `th_${threadCounter}`;
        const account = accounts.find((a) => campaign!.sendingAccountIds.includes(a.id)) ?? accounts[0];
        const messageIds: string[] = [];
        const numTouches = Math.min(idx, intBetween(1, 3));
        let bounced = false;
        let lastSentDay = contactedAtDays || intBetween(3, 25);

        for (let t = 0; t < Math.max(1, numTouches); t++) {
          msgCounter++;
          const dayOffset = Math.max(1, lastSentDay - t * intBetween(3, 6));
          // Bias sends toward Tue/Wed and 9-11am to create a learnable pattern
          const sendDate = new Date();
          sendDate.setDate(sendDate.getDate() - dayOffset);
          const preferredHours = [9, 10, 10, 11, 14];
          sendDate.setHours(pick(preferredHours), intBetween(0, 59), 0, 0);
          // nudge toward Tue/Wed
          if (chance(0.5)) {
            const day = sendDate.getDay();
            if (day === 0) sendDate.setDate(sendDate.getDate() + 2);
            if (day === 6) sendDate.setDate(sendDate.getDate() + 3);
          }
          const template = t === 0 ? pick([templates[0], templates[1]]) : templates[2];
          let status: EmailMessage["status"] = "delivered";
          if (t === 0 && chance(0.03)) {
            status = "bounced";
            bounced = true;
          } else if (idx >= 2 && t === numTouches - 1) {
            status = "replied";
          } else if (chance(0.25)) status = "opened";

          const bodyText = template.body;
          const msg: EmailMessage = {
            id: `msg_${msgCounter}`,
            threadId,
            contactId: contact.id,
            companyId: company.id,
            campaignId: campaign.id,
            sequenceStepId: `st_${t * 2 + 1}`,
            templateId: template.id,
            sendingAccountId: account.id,
            direction: "outbound",
            status,
            subject: template.subject.replace("{{company}}", company.name),
            body: bodyText,
            fromEmail: account.fromEmail,
            toEmail: contact.email,
            sentAt: sendDate.toISOString(),
            openedAt: status === "opened" || status === "replied" ? sendDate.toISOString() : undefined,
            repliedAt: undefined,
            bounceReason: status === "bounced" ? "550 mailbox not found" : undefined,
            wordCount: wordCount(bodyText),
            attempts: 1,
            createdAt: sendDate.toISOString(),
          };
          messages.push(msg);
          messageIds.push(msg.id);
          lastSentDay = dayOffset;
        }

        contact.bounced = bounced;

        // inbound reply if replied+
        let sentiment: ReplySentiment = "unclassified";
        let interested: boolean | undefined;
        let meetingBooked = false;
        if (idx >= 2 && !bounced) {
          msgCounter++;
          const replyDay = Math.max(0, lastSentDay - intBetween(0, 2));
          const replyDate = new Date();
          replyDate.setDate(replyDate.getDate() - replyDay);
          replyDate.setHours(intBetween(8, 17), intBetween(0, 59), 0, 0);
          const positive = idx >= 3 || chance(0.55);
          sentiment = positive ? "positive" : chance(0.5) ? "neutral" : "negative";
          interested = positive;
          const replyBody = positive
            ? "Thanks for reaching out — this is timely. Can you share more? Happy to find 20 minutes next week."
            : chance(0.5)
              ? "Appreciate it but we're not looking at this right now."
              : "Who else on your team could I loop in?";
          const reply: EmailMessage = {
            id: `msg_${msgCounter}`,
            threadId,
            contactId: contact.id,
            companyId: company.id,
            campaignId: campaign.id,
            direction: "inbound",
            status: "received",
            subject: `Re: ${messages[messages.length - 1].subject}`,
            body: replyBody,
            fromEmail: contact.email,
            toEmail: account.fromEmail,
            sentAt: replyDate.toISOString(),
            wordCount: wordCount(replyBody),
            createdAt: replyDate.toISOString(),
          };
          messages.push(reply);
          messageIds.push(reply.id);
          // mark the last outbound as replied
          const lastOut = [...messages].reverse().find((m) => m.threadId === threadId && m.direction === "outbound");
          if (lastOut) {
            lastOut.status = "replied";
            lastOut.repliedAt = replyDate.toISOString();
          }
          if (idx >= 4) meetingBooked = true;
        }

        const lastMsg = messages.filter((m) => m.threadId === threadId).slice(-1)[0];
        const thread: Thread = {
          id: threadId,
          contactId: contact.id,
          companyId: company.id,
          campaignId: campaign.id,
          subject: messages.find((m) => m.threadId === threadId)!.subject,
          ownerId: owner,
          state: chance(0.1) ? "archived" : "open",
          sentiment,
          interested,
          meetingBooked,
          lastMessageAt: lastMsg.sentAt ?? lastMsg.createdAt,
          unread: sentiment !== "unclassified" && chance(0.5),
          messageIds,
          createdAt: messages.find((m) => m.threadId === threadId)!.createdAt,
        };
        threads.push(thread);

        // meetings for meeting_scheduled+
        if (idx >= 4) {
          const outcomes: Meeting["outcome"][] =
            idx >= 7 ? ["won"] : idx >= 5 ? ["completed", "completed", "no_show"] : ["scheduled"];
          const outcome = pick(outcomes);
          const mDate = new Date();
          mDate.setDate(mDate.getDate() + (outcome === "scheduled" ? intBetween(1, 8) : -intBetween(1, 14)));
          mDate.setHours(pick([10, 11, 13, 14, 15]), 0, 0, 0);
          meetings.push({
            id: `mt_${meetings.length + 1}`,
            companyId: company.id,
            contactId: contact.id,
            title: `Avarent × ${company.name} — Discovery`,
            scheduledAt: mDate.toISOString(),
            durationMinutes: 30,
            attendees: [contact.email, account.fromEmail],
            agenda: "Walk through underwriting automation and fit for their loan products.",
            notes: outcome === "completed" || outcome === "won" ? "Strong interest. Discussed pilot on auto loans." : undefined,
            outcome,
            nextAction: outcome === "completed" ? "Send proposal" : outcome === "scheduled" ? "Prep demo environment" : undefined,
            ownerId: owner,
            createdAt: nowMinusDays(intBetween(1, 14)),
          });
        }

        // set next follow-up for contacted contacts without reply
        if (idx === 1 && !bounced) {
          const due = new Date();
          due.setDate(due.getDate() - intBetween(0, 3));
          due.setHours(9, 0, 0, 0);
          contact.nextFollowUpAt = due.toISOString();
        }
      }

      company.status =
        idx >= 7 ? "customer" : idx >= 4 ? "opportunity" : idx >= 1 ? "engaged" : "prospect";

      contacts.push(contact);
    }
  }

  /* Liveliness: today's live sends + a scheduled queue so the dashboard,
     deliverability, and campaign views reflect an actively-running account. */
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const freshContacts = contacts.filter(
    (c) => c.campaignId && activeCampaigns.some((ac) => ac.id === c.campaignId) && !c.bounced && !c.unsubscribed,
  );

  // ~14 emails sent earlier today (spread across morning hours)
  for (let i = 0; i < 14 && i < freshContacts.length; i++) {
    const contact = freshContacts[i];
    const campaign = campaigns.find((c) => c.id === contact.campaignId)!;
    const account = accounts.find((a) => campaign.sendingAccountIds.includes(a.id)) ?? accounts[0];
    const template = pick([templates[0], templates[1], templates[2]]);
    const today = new Date();
    today.setHours(pick([8, 9, 9, 10, 10, 11]), intBetween(0, 59), 0, 0);
    threadCounter++;
    const threadId = `th_live_${threadCounter}`;
    msgCounter++;
    const body = template.body;
    const subject = template.subject.replace("{{company}}", companies.find((c) => c.id === contact.companyId)?.name ?? "");
    messages.push({
      id: `msg_${msgCounter}`,
      threadId,
      contactId: contact.id,
      companyId: contact.companyId,
      campaignId: campaign.id,
      sequenceStepId: "st_1",
      templateId: template.id,
      sendingAccountId: account.id,
      direction: "outbound",
      status: chance(0.25) ? "opened" : "delivered",
      subject,
      body,
      fromEmail: account.fromEmail,
      toEmail: contact.email,
      sentAt: today.toISOString(),
      wordCount: wordCount(body),
      attempts: 1,
      createdAt: today.toISOString(),
    });
    threads.push({
      id: threadId,
      contactId: contact.id,
      companyId: contact.companyId,
      campaignId: campaign.id,
      subject,
      ownerId: contact.ownerId,
      state: "open",
      sentiment: "unclassified",
      meetingBooked: false,
      lastMessageAt: today.toISOString(),
      unread: false,
      messageIds: [`msg_${msgCounter}`],
      createdAt: today.toISOString(),
    });
    contact.lastContactedAt = today.toISOString();
  }

  // ~28 scheduled sends over the next few business days (the send queue)
  for (let i = 14; i < 42 && i < freshContacts.length; i++) {
    const contact = freshContacts[i];
    const campaign = campaigns.find((c) => c.id === contact.campaignId)!;
    const account = accounts.find((a) => campaign.sendingAccountIds.includes(a.id)) ?? accounts[0];
    const template = pick([templates[0], templates[1]]);
    const when = new Date();
    when.setDate(when.getDate() + intBetween(0, 4));
    when.setHours(pick([9, 10, 11, 13, 14]), intBetween(0, 59), 0, 0);
    if (when.getDay() === 0) when.setDate(when.getDate() + 1);
    if (when.getDay() === 6) when.setDate(when.getDate() + 2);
    threadCounter++;
    const threadId = `th_sched_${threadCounter}`;
    msgCounter++;
    const body = template.body;
    const subject = template.subject.replace("{{company}}", companies.find((c) => c.id === contact.companyId)?.name ?? "");
    messages.push({
      id: `msg_${msgCounter}`,
      threadId,
      contactId: contact.id,
      companyId: contact.companyId,
      campaignId: campaign.id,
      sequenceStepId: "st_1",
      templateId: template.id,
      sendingAccountId: account.id,
      direction: "outbound",
      status: campaign.requireApproval ? "pending_approval" : "scheduled",
      subject,
      body,
      fromEmail: account.fromEmail,
      toEmail: contact.email,
      scheduledAt: when.toISOString(),
      wordCount: wordCount(body),
      attempts: 0,
      createdAt: nowMinusDays(0),
    });
  }

  // wire campaign.contactIds
  for (const camp of campaigns) {
    camp.contactIds = contacts.filter((c) => c.campaignId === camp.id).map((c) => c.id);
  }

  /* Activities — derive a feed from messages, meetings, campaigns */
  for (const camp of campaigns) {
    activities.push({
      id: `act_camp_${camp.id}`,
      type: "campaign_created",
      actorId: camp.ownerId,
      campaignId: camp.id,
      summary: `Campaign "${camp.name}" created`,
      createdAt: camp.createdAt,
    });
    if (camp.status === "paused") {
      activities.push({
        id: `act_pause_${camp.id}`,
        type: "campaign_paused",
        actorId: camp.ownerId,
        campaignId: camp.id,
        summary: `Campaign "${camp.name}" paused`,
        createdAt: camp.updatedAt,
      });
    }
  }
  for (const m of messages.filter((x) => x.direction === "outbound").slice(0, 60)) {
    const c = contacts.find((x) => x.id === m.contactId)!;
    const co = companies.find((x) => x.id === m.companyId)!;
    activities.push({
      id: `act_${m.id}`,
      type: m.status === "bounced" ? "email_bounced" : "email_sent",
      actorId: c.ownerId,
      contactId: c.id,
      companyId: co.id,
      campaignId: m.campaignId,
      summary:
        m.status === "bounced"
          ? `Email to ${c.firstName} ${c.lastName} bounced`
          : `Email sent to ${c.firstName} ${c.lastName} at ${co.name}`,
      createdAt: m.sentAt ?? m.createdAt,
    });
  }
  for (const t of threads.filter((x) => x.sentiment === "positive").slice(0, 30)) {
    const c = contacts.find((x) => x.id === t.contactId)!;
    const co = companies.find((x) => x.id === t.companyId)!;
    activities.push({
      id: `act_reply_${t.id}`,
      type: "positive_reply",
      actorId: t.ownerId,
      contactId: c.id,
      companyId: co.id,
      summary: `Positive reply from ${c.firstName} ${c.lastName} at ${co.name}`,
      createdAt: t.lastMessageAt,
    });
  }
  for (const mt of meetings) {
    const co = companies.find((x) => x.id === mt.companyId)!;
    activities.push({
      id: `act_mt_${mt.id}`,
      type: "meeting_booked",
      actorId: mt.ownerId,
      companyId: co.id,
      contactId: mt.contactId,
      summary: `Meeting booked with ${co.name}`,
      createdAt: mt.createdAt,
    });
  }
  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  /* Notes & attachments for engaged companies */
  const notes: Note[] = [];
  const attachments: Attachment[] = [];
  for (const co of companies.filter((c) => c.status !== "prospect").slice(0, 14)) {
    notes.push({
      id: `note_${co.id}`,
      companyId: co.id,
      authorId: co.ownerId ?? "u_lucas",
      body: `Spoke with the team at ${co.name}. Main interest is automating **auto-loan** decisioning. Budget cycle renews in Q1.`,
      pinned: chance(0.3),
      createdAt: nowMinusDays(intBetween(2, 20)),
      updatedAt: nowMinusDays(intBetween(0, 2)),
    });
    if (chance(0.5)) {
      attachments.push({
        id: `att_${co.id}`,
        companyId: co.id,
        name: `${co.name.split(" ")[0]}-Proposal.pdf`,
        kind: "one_pager",
        sizeBytes: intBetween(120000, 900000),
        url: "#",
        uploadedById: co.ownerId ?? "u_lucas",
        createdAt: nowMinusDays(intBetween(1, 15)),
      });
    }
  }

  /* Experiments (A/B) */
  const experiments: Experiment[] = [
    {
      id: "exp_subject",
      name: "Subject: Statement vs Question",
      dimension: "subject",
      status: "running",
      campaignId: "camp_cu_q3",
      minSamplePerVariant: 50,
      variants: [
        { key: "A", label: "Cutting loan decision time", sent: 142, replied: 14, positive: 6, meetings: 3 },
        { key: "B", label: "Quick question about underwriting?", sent: 138, replied: 22, positive: 11, meetings: 5 },
      ],
      createdAt: nowMinusDays(20),
    },
    {
      id: "exp_length",
      name: "Body: Short vs Detailed",
      dimension: "email_length",
      status: "running",
      minSamplePerVariant: 40,
      variants: [
        { key: "A", label: "Under 90 words", sent: 96, replied: 15, positive: 8, meetings: 4 },
        { key: "B", label: "150+ words", sent: 91, replied: 9, positive: 3, meetings: 1 },
      ],
      createdAt: nowMinusDays(14),
    },
  ];

  /* Saved views */
  const savedViews: SavedView[] = [
    { id: "sv_followup", name: "Needs Follow-up", entity: "contacts", filters: [{ field: "nextFollowUpAt", operator: "not_empty", value: "" }], system: true, icon: "Clock" },
    { id: "sv_interested", name: "Interested", entity: "threads", filters: [{ field: "sentiment", operator: "eq", value: "positive" }], system: true, icon: "ThumbsUp" },
    { id: "sv_cu", name: "Credit Unions", entity: "companies", filters: [{ field: "industry", operator: "eq", value: "Credit Union" }], system: true, icon: "Landmark" },
    { id: "sv_banks", name: "Banks", entity: "companies", filters: [{ field: "industry", operator: "in", value: ["Community Bank", "Regional Bank"] }], system: true, icon: "Building2" },
    { id: "sv_high", name: "High Opportunity", entity: "contacts", filters: [{ field: "score", operator: "gte", value: 70 }], system: true, icon: "Flame" },
    { id: "sv_meetings", name: "Meetings This Week", entity: "meetings", filters: [], system: true, icon: "CalendarCheck" },
    { id: "sv_noreply", name: "No Reply > 7 Days", entity: "contacts", filters: [{ field: "stage", operator: "eq", value: "contacted" }], system: true, icon: "MailX" },
  ];

  const followUps = generateFollowUps({
    contacts,
    companies,
    campaigns,
    sequences,
    templates,
    snippets,
    senderName: "Lucas",
  });

  return {
    workspace,
    users,
    currentUserId: "u_lucas",
    companies,
    contacts,
    templates,
    snippets,
    sequences,
    campaigns,
    accounts,
    messages,
    threads,
    meetings,
    activities,
    notes,
    attachments,
    experiments,
    savedViews,
    scoring: DEFAULT_SCORING_CONFIG,
    followUps,
  };
}
