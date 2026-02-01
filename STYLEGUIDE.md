# Yogin Style Guide

## Colors
- Always use CSS variables from `:root` in `Letmein/wwwroot/admin/admin.css`.
- Primary action color: `--accent` (`#f1c232`).
- Button colors:
  - `--btn-primary-bg`, `--btn-primary-fg`
  - `--btn-secondary-bg`, `--btn-secondary-fg`, `--btn-secondary-border`

## Buttons
- **Primary**: orange background (`--btn-primary-bg`), white text, used for create/add/confirm actions.
- **Secondary**: white background with border (`--btn-secondary-border`), used for navigation, filters, view toggles, edit/delete/invite/export.
- **Icon buttons**: use `.icon-button` (40x40, circular, secondary style).

## Typography
- Hebrew (`lang="he"`): Arial.
- Default: Space Grotesk.

## Layout
- RTL supported across admin, customer, and public apps.
- Calendar starts at 07:00 with 30‑minute grid lines.

## Dates & Time
- Date: `DD/MM/YYYY`.
- Time: 24‑hour (`HH:mm`).
