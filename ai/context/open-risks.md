# next-forge — open risks

The full register, with what was decided, is
`specs/epics/next-forge/risks-and-open-questions.md`; this page lists only
what is still open.

- **NF-F — the live path is unproven.** No bootstrap from a tag has run
  against a workspace: the Supabase, Hyperdrive, R2 and KV applies, the
  migrations against a real project, the three deploys and their smokes, and
  the card's twenty minutes are proven only offline.
- **The app's headroom.** At about 2.8 MiB compressed the app is under
  Workers Free's 3 MiB with ~200 KiB to spare; a product that adds a heavy
  server-side dependency needs Workers Paid.
- **Clerk partially configured.** The browser knows only the publishable
  key; with it set and the secret missing, the server runs the sample user
  while the browser loads Clerk. Store both.
