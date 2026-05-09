# Money Mate

Money Mate is a personal finance management app built with Angular, Ionic, and Capacitor. It helps users track transactions, manage budgets, and view financial insights.

## Live Demo

[![Open Live Demo](https://img.shields.io/badge/Open-Live%20Demo-2ea44f?style=for-the-badge)](https://jsramraj.github.io/apps/moneymate/)

Try it here: [Money Mate Live Demo](https://jsramraj.github.io/apps/moneymate/)

## Get it on Play Store

<img src="src/assets/assets/get-it-on-playstore.png" alt="Get it on Google Play" style="height:48px;width:auto;vertical-align:middle;border-radius:8px;box-shadow:0 2px 8px #0002;" />

## Overview

The app focuses on day-to-day money tracking with a mobile-first UX and offline-friendly local storage.

Core app areas include:
- Dashboard and customizable widgets
- Transactions list and transaction form
- Accounts management
- Categories management
- Budgets management
- Transaction imports (CSV and quick add)
- Authentication/onboarding flow
- Settings, linked sheet, and about pages

## Tech Stack

- Angular 20
- Ionic 8
- Capacitor 8
- TypeScript (strict)
- RxJS
- Dexie (IndexedDB)
- angular-google-charts
- PapaParse

## Project Structure

```text
src/app/
  auth/
  dashboard/
  transactions/
  accounts/
  categories/
  budgets/
  imports/
  settings/
  tabs/
  core/
  shared/
```

## Getting Started

Prerequisites:
- Node.js 18+
- npm

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm start
```

## Scripts

- `npm start` - start dev server
- `npm run build` - production build
- `npm run watch` - development build in watch mode
- `npm run lint` - run lint checks
- `npm run test` - run unit tests

## Notes

- This project uses Angular standalone components and lazy-loaded routes.
- Route entry points are defined in `src/app/app.routes.ts` and `src/app/tabs/tabs.routes.ts`.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
