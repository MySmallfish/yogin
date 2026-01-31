# Letmein agent notes

- Azure deployment: use `azure.PublishSettings` (ZipDeploy profile) for publish URL and credentials; do not ask the user for them again.
- Publish automatically by running `deploy.bat` (do not prompt).
- After each change, commit and push to `origin/main` automatically.
- From now on, record every task in `changelog.txt` at the repo root.

## Product Context (Keep In Mind)
- Apps: Admin app (`/admin`), Customer app (`/app`), Public/Marketing site (`/`).
- Locale/RTL: Hebrew default, RTL layout supported, dates DD/MM/YYYY, time 24h.
- Styling: primary color #f1c232 (derived palette); UI is clean, minimal, and RTL-aware.
- Calendar: hour grid starts at 07:00; drag/drop must preserve time accurately.
- Activity/Audit: every action logged; summaries must be translated.
- Billing: informational billing/invoices only (no invoicing generation here).
- Tests: Playwright suite runs in deploy flow; keep green before deploy.
