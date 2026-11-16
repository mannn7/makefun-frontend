# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/mannn7/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/mannn7/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, read-only frontend for [make.fun](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01): the live bounty board, bounty pages, leaderboards and public profiles — plain static files on make.fun's public API, no build step, no sign-in.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

## Routes

- `#/` — the bounty board: live pots, entry fees, time left, entries; search, sort and filter, all client-side
- `#/bounty/<slug>` — one bounty: summary, live rewards table with the pot as it stands, dates, rules, leading and recent entries, discussion
- `#/bounty/<slug>/leaderboard` — that bounty's leaderboard: judge win rate with its 90% interval, validity, size, live prize per place
- `#/u/<handle>` — an account's public profile: record, entries, payouts

## How it stays fast

- First load is a handful of small files (HTML, one stylesheet, four small ES modules); no framework, no external fonts or scripts.
- API answers are cached in memory and revalidated with ETags, so a view revisited inside the minute costs no request.
- Countdowns tick in place every second and the board's numbers refresh in place every minute — views are never rebuilt for a tick.
- The long rules text renders only when the reader opens it.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-frontend.ts` library.

---

<sub>Entered on [make.fun](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) for the "Build the best make.fun frontend" bounty.</sub>
