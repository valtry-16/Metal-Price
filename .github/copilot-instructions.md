# Auric Ledger - Copilot Instructions

## Project Overview
Multi-page React SPA for real-time precious metal price tracking (INR). Built with React 19, Vite 8, React Router DOM, Supabase Auth, and Chart.js. Luxury fintech design with gold accent theme.

## Architecture
- **Frontend**: `frontend/` — React + Vite, deployed on Vercel
- **Backend**: `backend/` — Node.js + Express, deployed on Render
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase (Google OAuth + Email/Password)

## Key Patterns
- All page components are lazy-loaded via `React.lazy()` in `App.jsx`
- Protected routes wrap pages with `ProtectedRoute` component
- CSS uses `al-` prefix for new design system classes; legacy market classes remain unprefixed
- Theme (dark/light) managed via `ThemeContext` with `data-theme` attribute on `<html>`
- Auth state managed via `AuthContext` wrapping Supabase client
- Utility functions in `src/utils/helpers.js`, constants in `src/utils/constants.js`
- Market page (`src/pages/Market.jsx`) contains all original dashboard logic (~1900 lines)

## Routes
| Path | Component | Protected |
|------|-----------|-----------|
| `/` | Home | No |
| `/market` | Market | No |
| `/portfolio` | Portfolio | Yes |
| `/calculator` | Calculator | Yes |
| `/compare` | Compare | No |
| `/news` | News | No |
| `/summary` | Summary | No |
| `/dashboard` | Dashboard | Yes |
| `/settings` | Settings | Yes |

## Development
- Run `npm run dev` in `frontend/` for local dev server
- Run `npm run build` in `frontend/` to build for production
- Backend runs independently on Render
- Supabase anon key must be set in `frontend/.env` for auth features

## CSS Design System
- Root variables in `:root` and `[data-theme="dark"]`
- Gold accent: `--accent` (#c59a3c light / #d4a954 dark)
- Fonts: Playfair Display (headings), Inter (body)
- New components use `al-` prefix (e.g., `.al-navbar`, `.al-page`, `.al-btn`)
- Existing market/modal/chat styles remain unprefixed for backward compatibility
- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
