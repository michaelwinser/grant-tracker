# Grant Tracker — Product Requirements Document

## Problem Statement

A small non-profit grant-making organization manages ~30-35 grants and contracts annually through a collaborative, iterative process. The informal nature of this process—while valuable for building strong grantee relationships—leads to:

1. **Grants falling through the cracks** — Proposals arriving via webform get forgotten; in-progress grants lose momentum when no one tracks their status
2. **Scattered internal discussion** — Stakeholder feedback, action items, and decision rationale are spread across meeting notes, emails, and chat—none of which can live in the shared proposal doc without revealing internal thinking to grantees
3. **Forgotten decisions** — Even approved grants with phased disbursements get "re-evaluated" months later because stakeholders have no persistent record of what was decided and why
4. **Manual compliance tracking** — Determining which grantees have submitted monthly/quarterly/annual reports requires manual checking across GitHub repos and documents
5. **Budget visibility gaps** — Understanding allocation across categories (A/B/C/D) and by grant year (vs disbursement date) requires spreadsheet gymnastics

The organization currently manages this in Google Sheets, which works but provides no workflow support, no separation of internal/external content, and no easy way to link to a specific grant in discussions.

## Users & Personas

### Michael (Lead Program Manager) — Primary User
- Uses the tool daily
- Initiates grants, drives proposals through iteration, tracks all active work
- Needs: Quick status overview, action item tracking, ability to share links to specific grants in emails/chat
- Pain: Context-switching between sheet, docs, email to piece together grant status

### Program Managers (2-3) — Regular Users
- Use the tool several times per week
- Manage specific grants, update statuses, track their action items
- Needs: Clear view of their grants, easy status updates
- Pain: Uncertainty about where things stand, manual tracking of to-dos

### Stakeholders (Board) — Weekly Reviewers
- Review during weekly meetings, occasional ad-hoc access
- Make final approval decisions, provide feedback, assign action items
- Needs: Dashboard of grants requiring attention, history of decisions and rationale
- Pain: No persistent record of discussions; forgetting what was decided

### Marketing Partner — Occasional User
- Tracks grant activity for communications purposes
- Adds artifacts (blog posts, announcements) to grant records
- Needs: Read access to grant status and artifacts, ability to add links
- Pain: Out of the loop on what's active and what's publishable

### Grantees — Indirect Users (Never Touch the Tool)
- Collaborate on proposals via shared Google Docs
- Submit monthly reports via GitHub
- Receive notifications via email (from team, not automated)
- The tool tracks their submissions but they never log into it

## Grant Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Initial Contact → Evaluation Meeting → Proposal Development ◄──┐      │
│                                                    │             │      │
│                                                    ▼             │      │
│                                          Stakeholder Review ─────┘      │
│                                                    │                    │
│                                    ┌───────────────┼───────────────┐    │
│                                    ▼               ▼               ▼    │
│                                Approved        Deferred        Rejected │
│                                    │               │               │    │
│                                    ▼               │               ▼    │
│                              Notification ◄───────┘           (Closed) │
│                                    │                                    │
│                                    ▼                                    │
│                                 Signing                                 │
│                                    │                                    │
│                                    ▼                                    │
│                              Disbursement                               │
│                                    │                                    │
│                                    ▼                                    │
│                                 Active                                  │
│                                    │                                    │
│                                    ▼                                    │
│                                Finished                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Stages:**
1. **Initial Contact** — Inquiry received (webform, email, introduction)
2. **Evaluation Meeting** — Meeting with Michael to assess fit
3. **Proposal Development** — Collaborative iteration on the proposal doc
4. **Stakeholder Review** — Board reviews; may loop back to Proposal Development
5. **Approved / Rejected / Deferred** — Decision made
6. **Notification** — Grantee informed of decision
7. **Signing** — DocuSign process completed
8. **Disbursement** — PO/invoice processing (details not modeled)
9. **Active** — Work is underway
10. **Finished** — Grant complete, final reports received

## Functional Requirements

### Core Grant Management

**FR-1: Grant Registry**
- Each grant/contract has a unique ID in format: `CODE-YEAR-Codename` (e.g., `PYPI-2026-Staffing`)
- CODE: 2-4 letter prefix derived from organization/project
- YEAR: Grant year (not necessarily disbursement year)
- Codename: One-word identifier derived from title
- System warns on duplicate IDs; enforces uniqueness
- Full human-readable title also stored (e.g., "PyPI Sustainability Staffing 2026")

**FR-2: Grant Detail Record**
- Organization name, primary contact
- Type: Grant or Contract
- Category: A, B, C, or D (configurable for future evolution)
- Ecosystem beneficiary
- Amount, grant year, disbursement schedule notes
- Current status (lifecycle stage)
- Links to: Proposal Doc, Internal Notes Doc, Drive Folder, GitHub repo (if applicable)
- Timestamps: Created, last modified, status change history

**FR-3: Status Tracking**
- Visual pipeline view showing grants by stage
- Filter by: Category, Type, Program Manager, Status
- Status change history preserved (who, when, from/to)

**FR-4: Permalinks**
- Every grant has a shareable URL (e.g., `/grant/PYPI-2026-Staffing`)
- Links work in emails, Slack, meeting notes

### Internal Discussion & Action Items

**FR-5: Internal Notes Document**
- Each grant has a private Google Doc for stakeholder discussion
- Automatically created in the grant's Drive folder
- Not shared with grantees
- Contains: Meeting notes, decision rationale, concerns, context

**FR-6: Action Items**
- Action items linked to specific grants
- Fields: Description, assignee, due date, status (open/done), source (e.g., "2025-01-15 stakeholder meeting")
- Visible in grant detail view
- Rollup view: "My action items" across all grants

### Reporting & Compliance

**FR-7: Report Tracking**
- For each active grant, track expected submissions:
  - Monthly activity reports (GitHub)
  - Quarterly outcome summaries (Doc/blog post)
  - Annual report
- Mark reports as: Expected, Received, Overdue
- Link to actual submission when received

**FR-8: GitHub Integration**
- GitHub Action monitors designated repos for monthly report commits
- Pushes "report received" status to the tracking sheet
- Graceful degradation: If action fails, manual marking still works

**FR-9: Compliance Dashboard**
- View: Which grantees owe reports this month/quarter?
- Filter by: Time period, grant, status

### Artifacts

**FR-10: Artifact Registry**
- Link artifacts to grants: Blog posts, meeting notes, announcements, final reports
- Fields: Type, title, URL, date, added by
- Marketing partner can add artifacts

### Budget & Reporting

**FR-11: Budget Allocation View**
- Total committed/disbursed by category (A/B/C/D)
- Grant year aware (Category A staffing grants attributed to year of work)
- Current year vs historical comparison

**FR-12: Historical Data**
- Support for past grants (retroactive entry)
- Year-over-year reporting
- All grants searchable regardless of status

### Automation & Integration

**FR-13: Folder/Doc Creation**
- When a grant moves to "Proposal Development," auto-create:
  - Drive folder: `Grants/YEAR/CODE-Codename/`
  - Proposal Doc (from template, shared with grantee)
  - Internal Notes Doc (team only)
- Can be triggered via Apps Script or manual with a button

**FR-14: Template Emails**
- For "Notification" stage: Pre-filled email templates for approval/rejection
- User copies and sends manually (no auto-send in v1)

## Non-Functional Requirements

**NFR-1: Walkaway-able Architecture**
- Google Sheets and Drive remain fully functional if the PWA disappears
- All data readable/editable directly in Sheets
- No vendor lock-in beyond Google Workspace

**NFR-2: No Backend Server**
- PWA hosted on GitHub Pages (static)
- All API calls (Sheets, Drive) made client-side with user's OAuth token
- Eliminates hosting cost and maintenance burden

**NFR-3: Schema Enforcement**
- Google Sheets Tables used for data validation
- Dropdowns for enumerated fields (Status, Category, Type)
- Apps Script for cross-field validation and uniqueness warnings

**NFR-4: Team-Only Access**
- PWA authenticates via Google OAuth
- Allowlist of team Google accounts
- Marketing partner included in team access

**NFR-5: Performance**
- Dashboard loads in <3 seconds for typical data volume (~100 grants)
- Sheets API pagination handled gracefully

## Success Metrics

1. **No grants lost** — Every inquiry tracked from first contact
2. **Action item completion rate** — Measurable; target >90% on-time
3. **Report compliance visibility** — Can answer "who owes us a report?" in <30 seconds
4. **Decision traceability** — Any stakeholder can find why a grant was approved/rejected
5. **Time to grant status** — Can determine any grant's current state in <10 seconds

## Scope Boundaries

### In Scope (v1)
- Grant/contract registry with full lifecycle
- Internal notes and action items
- Report tracking (manual + GitHub automation)
- Artifact linking
- Budget allocation views
- Permalinks
- Google Sheets as system of record
- PWA for enhanced UI

### Out of Scope (v1)
- Automated email notifications
- Grantee-facing portal
- DocuSign integration
- Invoice/PO tracking details
- Calendar integration
- Mobile-optimized experience (works, but not prioritized)

### Future Considerations
- Slack notifications for status changes
- Automated report reminders
- AppSheet or Airtable migration if PWA proves insufficient
- Grantee self-service report submission

## Alternative Approaches Considered

**AppSheet**: Could provide a no-code app layer over Google Sheets with forms and views. Worth prototyping if the custom PWA proves too complex. Trade-off: Less customization, but zero maintenance.

**Airtable**: Richer data modeling, better views. Trade-off: Moves away from Google ecosystem; adds subscription cost; less "walkaway-able."

**Full CRM (Salesforce, HubSpot)**: Overkill for scale; high overhead; poor fit for collaborative grant development workflow.

**Recommendation**: Start with the PWA approach. It's low-cost, maintainable, and preserves full control. If it proves burdensome, AppSheet is a viable fallback that can use the same underlying Sheets.

---

*Document version: 1.0*
*Last updated: 2025-01-18*
