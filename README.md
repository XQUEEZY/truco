# Truco

Play Truco (Mineiro / Paulista rules) locally in your browser. Pure HTML/CSS/JS,
no build step, no server, no accounts — open `index.html` and play.

**[▶ Play it live](https://xqueezy.github.io/truco/)**

## How it works

Two players share one device (hotseat). Before each turn, a "pass the device"
screen hides the table until the active player taps to reveal their hand, so
nobody sees the other player's cards by accident.

- Standard Truco deck and card ranking, with dynamic manilha (trump) based on
  the "vira" card
- Full truco call/raise/accept/run flow (truco → seis → nove → doze)
- Mão de ferro at 11–11
- First to 12 points wins the match

## Project structure

- `engine.js` — the rules engine. Pure functions, no DOM, no dependencies.
  Deals hands, resolves tricks, and runs the truco call state machine.
- `app.js` — the UI controller that wires the engine to the page (hotseat
  pass-gate, rendering hands/table, button state).
- `index.html` / `style.css` — the page itself.

## Running locally

No build tooling needed. Any static file server works:

```bash
npx http-server .
# or
python -m http.server 8000
```

Then open the printed URL.

## License

MIT License — see [LICENSE](LICENSE).

Copyright (c) 2026 XQUEEZY
