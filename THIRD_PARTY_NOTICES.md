# Open-source reuse and reference notes

This application composes established open-source building blocks instead of reimplementing their accessibility, routing, date arithmetic, database migration or icon systems.

## Reused in the implementation

- shadcn/ui — https://github.com/shadcn-ui/ui — MIT. Bundled UI components used directly: Tabs, Dialog, AlertDialog, Checkbox, Progress, Empty, Skeleton, Sonner wrapper. Original component files and notices retained.
- Radix Primitives / radix-ui — https://github.com/radix-ui/primitives — MIT. Accessible keyboard handling, dialog focus management and controls, via the installed components.
- date-fns — https://github.com/date-fns/date-fns — MIT. Calendar-day difference, annual anniversary adjustment, date parsing and formatting.
- Lucide — https://github.com/lucide-icons/lucide — ISC. Interface icons.
- Sonner — https://github.com/emilkowalski/sonner — MIT. Notifications.
- Drizzle ORM / Kit — https://github.com/drizzle-team/drizzle-orm — Apache-2.0. Schema declarations and migration generation.
- Vinext — https://github.com/cloudflare/vinext — MIT. React routing and Worker build integration, supplied by the Sites starter.
- Sites Vite plugin — vendored MIT license in build/sites-vite-plugin.LICENSE.

Installed dependency licenses remain in their package directories. A copy of the date-fns, Radix and Lucide notices is retained in notices/.

## Product reference only — no source copied

SharedMoments — https://github.com/tech-kev/SharedMoments (AGPL-3.0): reviewed its photo feed, timeline, relationship counter and custom-list organization. Its Python/Flask/Docker architecture is not compatible with this site's Workers runtime; no source was copied.

cat-run — https://github.com/iuhoay/cat-run: inspected its stats module; no source copied because a repository LICENSE file could not be verified at the referenced path. This application's small pet-state model is original and persisted server-side.

The kitten artwork is newly generated for this site. All private photographs are user uploads and are served through authenticated endpoints.

## Independent account update

Better Auth 1.7.5 — https://github.com/better-auth/better-auth — MIT. Email/password hashing, secure cookie sessions, sign-in, sign-out, password changes and database-backed rate limiting are provided by the library. Source license retained in notices/better-auth-MIT.txt. Public self-registration and unused authentication routes are not exposed; two one-use activation slots are enforced by the application. Original member IDs and their data are preserved through an auth-members mapping.
