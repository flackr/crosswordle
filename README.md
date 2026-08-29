# Crosswordle

Wordle with a twist of crossing words.

[Play the game](https://crosswordle.serializer.ca/)

## How to Play

Crosswordle presents you with two words that cross each other at exactly one shared letter. The goal is to guess both words in as few attempts as possible. Each guess must contain two valid dictionary words.

### Hints

You can reveal a hidden hint line at any time by clicking the **Reveal Hint** button. This consumes your one allowed hint for the puzzle — once used, it cannot be retracted.

## Puzzle Schedule

New puzzles are released daily. Your progress (completed/remaining) is tracked via `localStorage`. The puzzle index is determined by the number of days since the first puzzle was published, with a configurable base date per language.

### Custom Puzzles

You can create custom crossword puzzles through the settings panel. Enter two crossing words separated by a space (e.g., `cross word`), and the game will generate a unique URL you can share with others. Custom puzzles are hosted on the same domain and encoded in the URL parameters.

## Language Support

Crosswordle supports multiple languages. The language is auto-detected from the browser settings, but can be overridden via the `?l=` query parameter or the language selector dropdown.

| Code | Language |
|------|----------|
| en   | English  |
| nl   | Dutch    |
| fr   | French   |
| es   | Spanish  |

Language files are stored as JSON in `src/lang/`. Each file contains translated UI strings, puzzle counts, and a base date for scheduling.

## File Structure

```
├── index.html                  # Main entry point
├── favicon.ico                 # Browser tab icon
├── src/
│   ├── game.js                 # Core game logic: grid rendering, input handling, validation, scoring
│   ├── index.js                # Bootstrap / initialization script
│   ├── lang/
│   │   ├── en.json             # English language strings & metadata
│   │   ├── nl.json             # Dutch
│   │   ├── fr.json             # French
│   │   └── es.json             # Spanish
│   └── puzzles/
│       ├── README.md           # Puzzle format documentation
│       └── en/
│           └── 000000.json     # Chunked puzzle data (100 puzzles per file)
├── style/
│   └── style.css               # All styling, including responsive layout & animations
└── third_party/
    └── aspell6/
        └── {lang}/
            └── words-{n}.txt   # Dictionary word lists by length (1–12 chars)
```

## Puzzle Data Format

Puzzles are stored in JSON files, chunked 100 per file for efficient loading. Each entry contains:

```json
{
  "puzzle": "answer",
  "date": "YYYY-MM-DD",
  "hint": "Optional hint text"
}
```

The `puzzle` field holds the two crossing words (space-separated), and `date` determines when the puzzle is available. Optional `hint` text can provide a clue to the answer.

## Dictionary

Word validation uses dictionaries from [aspell6](https://aspell.net/), organized by language and word length. Word lists are loaded on demand as `.txt` files, one per length, under `third_party/aspell6/{lang}/`.

## Technical Notes

- **Framework-free**: Built with vanilla JavaScript — no dependencies or build tools required.
- **Persistence**: Game state and settings are stored in `localStorage` under keys like `crosswordle-daily`, `crosswordle-scores-{lang}`, and `crosswordle-settings`.
- **URL Parameters**: `?l=`, `?day=`, `?puzzle=`, `?hint=` for custom puzzle targeting. See `SUPPORTED_ARGS` in `game.js`.
- **Versioning**: `FEATURE_VERSION` is incremented when new features are added; the help screen uses this to show only relevant updates.
