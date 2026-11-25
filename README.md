# Teaspot shop mobile (Android)

Expo billing app for the shop tablet: same Supabase project and users as the Next.js shop.

## Setup

```bash
cp .env.example .env
# EXPO_PUBLIC_* = same values as NEXT_PUBLIC_SUPABASE_* in the shop app
npm install
npx expo install --check
npm run android
```

If you see `AsyncStorageError: Native module is null`, install AsyncStorage **2.2.0** via `npx expo install @react-native-async-storage/async-storage`, then `npx expo start --android -c`.

Expo SDK 58 expects Node 22+.

## Features

| Tab | Purpose |
|-----|---------|
| Today | Today’s entries + In / Out / Net |
| Sale | Product grid → cart → `create_sale` |
| Add | Manual income or expense |
| Reports | Today / 7 days / month summary and lists |

Open **Settings** from the gear icon on Today: manage products, categories, shop details, and account (profile + password).

## Project layout

```
App.tsx                 # Auth gate
index.ts                # Expo entry
components/
  LoginScreen.tsx
  MainApp.tsx           # Tab shell
  screens/
    TodayScreen.tsx
    SaleScreen.tsx
    EntryScreen.tsx
    ReportScreen.tsx
lib/
  config.ts             # Env + brand name
  supabase.ts           # Client + session storage
  types.ts              # Shared types
  queries.ts            # Read-only Supabase queries
  actions.ts            # Inserts + create_sale
  dates.ts              # Asia/Kolkata ranges
  format.ts             # Currency
  theme.ts              # Colors + shared styles
assets/
  icon.png              # App + splash (from shop logo)
  android-icon-foreground.png
  splash-icon.png
```

## Production APK

```bash
npx eas-cli build --platform android --profile preview
```

Or local: `npx expo run:android`.