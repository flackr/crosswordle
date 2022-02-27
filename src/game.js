"use strict";

function parse(str) {
  let args = str.split('&');
  let argMap = {};
  for (let arg of args) {
    let split = arg.split('=');
    argMap[split[0]] = split[1];
  }
  return argMap;
}
const ARGS = parse(window.location.search.substr(1));
// Custom puzzles from before other languages were supported are english. Newer custom
// puzzles include the language in the URL.
const AUTO_LANG = (!ARGS.puzzle && navigator.language.startsWith('fr')) ? 'fr' : 'en';
const LANG = ARGS.l || AUTO_LANG;

let ENCODED = [];
let STRINGS = [];

// Insert values into slotted positions in named string.
function templateStr(langStr, values) {
  let str = langStr.split('{}');
  let result = '';
  for (let i = 0; i < str.length; ++i) {
    result += str[i];
    if (i < str.length - 1)
      result += values[i];
  }
  return result;
}

const alphabet = 'abcdefghijklmnopqrstuvwxyz';
let dictionary = new Set();
let dictionaryLengths = [];
const MAX_LENGTH = 10;

function loadWordLength(length) {
  let fetchWords = async function(length) {
    if (length > MAX_LENGTH)
      return;
    let result = await fetch(`third_party/aspell6/${LANG}/words-${length}.txt`);
    let words = await result.text();
    words.split(/\r?\n/).forEach(word => {
      dictionary.add(word);
    });
  };
  if (!dictionaryLengths[length])
    dictionaryLengths[length] = fetchWords(length);
  return dictionaryLengths[length];
}

async function isWord(word) {
  await loadWordLength(word.length);
  return dictionary.has(word);
}

function initKeyboard() {
  let keyboard = document.querySelector('.keyboard');
  let addKey = function(gridArea, text, code) {
    let key = document.createElement('div');
    key.classList.add('key');
    if (text.length > 1)
      key.classList.add('small');
    key.setAttribute('code', code);
    key.innerHTML = text;
    key.style.gridArea = gridArea;
    key.addEventListener('click', (evt) => {
      evt.preventDefault();
      type(code);
    });
    keyboard.appendChild(key);
  }
  for (let i = 0; i < 26; ++i) {
    let lower = alphabet[i];
    let upper = alphabet[i].toUpperCase();
    addKey(lower, upper, lower);
  }
  addKey('R', STRINGS['enter'], 'Enter');
  addKey('B', STRINGS['erase'], 'Backspace');
  document.addEventListener('keydown', (evt) => {
    if (evt.target != document.body)
      return;
    // Don't handle modified keys.
    if (evt.ctrlKey || evt.metaKey || evt.altKey)
      return;
    if (type(evt.key.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
      evt.preventDefault();
  });
}

const ENCODING = 'qwertyuiopasdfghjklzxcvbnm';
function encode(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] < 'a' || text[i] > 'z') {
      result += text[i];
      continue;
    }
    let offset = i;
    result += ENCODING[(alphabet.indexOf(text[i]) + offset) % 26];
  }
  return result;
}

function decode(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] < 'a' || text[i] > 'z') {
      result += text[i];
      continue;
    }
    let offset = i;
    result += alphabet[(ENCODING.indexOf(text[i]) + 26 - offset) % 26];
  }
  return result;
}

let FIRST_PUZZLE = null;
let puzzle = null;
let summary = '';
async function init() {
  let data = await (await fetch(`src/lang/${LANG}.json`)).json();
  STRINGS = data.strings;
  ENCODED = data.puzzles;
  FIRST_PUZZLE = new Date(data.first_date[0], data.first_date[1], data.first_date[2], 0, 0, 0, 0);
  // Insert translated element strings
  let elems = document.querySelectorAll('[data-str]');
  for (let elem of elems) {
    elem.innerHTML = STRINGS[elem.getAttribute('data-str')];
  }

  let languageEl = document.getElementById('language');
  let currentLang = ARGS.l || '';
  for (let i = 0; i < languageEl.options.length; ++i) {
    if (languageEl.options[i].getAttribute('value') == currentLang) {
      languageEl.selectedIndex = i;
      break;
    }
  }
  languageEl.addEventListener('change', () => {
    let search = '';
    let selectedLang = languageEl.value;
    // TODO: Should other arguments be preserved?
    if (selectedLang) {
      window.location.search = `?l=${selectedLang}`;
    } else {
      window.location.href = window.location.href.split('?')[0];
    }
  });
  document.getElementById('close-settings').addEventListener('click', () => {
    document.querySelector('.settings').style.display = '';
  });
  document.getElementById('show-settings').addEventListener('click', () => {
    document.querySelector('.settings').style.display = 'block';
  });
  document.getElementById('close-victory').addEventListener('click', () => {
    document.querySelector('.victory').style.display = '';
  });
  document.getElementById('show-help').addEventListener('click', () => {
    document.querySelector('.help').style.display = 'block';
  });
  document.getElementById('close-help').addEventListener('click', () => {
    document.querySelector('.help').style.display = '';
  });
  let hardModeCheckbox = document.getElementById('hard-mode');
  hardModeCheckbox.addEventListener('change', () => {
    if (hardModeCheckbox.checked && gameGuesses.length > 0) {
      showMessage(STRINGS['hard-mode-next-game']);
    }
    settings.hardMode = hardModeCheckbox.checked;
    localStorage.setItem('crosswordle-settings', JSON.stringify(settings));
    if (!hardModeCheckbox.checked) {
      // Hard mode can be turned off mid-game.
      hardMode = false;
    }
  });
  let highContrastCheckbox = document.getElementById('high-contrast');
  highContrastCheckbox.addEventListener('change', () => {
    settings.highContrast = highContrastCheckbox.checked;
    localStorage.setItem('crosswordle-settings', JSON.stringify(settings));
    updateHighContrast();
  });
  let skipFilledCheckbox = document.getElementById('skip-filled');
  skipFilledCheckbox.addEventListener('change', () => {
    settings.skipFilled = skipFilledCheckbox.checked;
    localStorage.setItem('crosswordle-settings', JSON.stringify(settings));
  });
  let dynamicKeybordCheckbox = document.getElementById('dynamic-keyboard');
  dynamicKeybordCheckbox.addEventListener('change', () => {
    settings.dynamicKeyboard = dynamicKeybordCheckbox.checked;
    localStorage.setItem('crosswordle-settings', JSON.stringify(settings));
    updateHints(true);
  });
  let seenHelp = localStorage.getItem('crosswordle-help');
  if (seenHelp === null) {
    document.querySelector('.help').style.display = 'block';
    localStorage.setItem('crosswordle-help', '1');
  }
  document.getElementById('custom-crosswordle').setAttribute('placeholder', STRINGS['custom-crosswordle-example']);
  document.getElementById('create').addEventListener('click', async () => {
    let errors = '';
    let puzzle = document.getElementById('custom-crosswordle').value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(' ', '+');
    let words = puzzle.split('+');
    if (words.length != 2) {
      errors += STRINGS['two-words-required'] + '\n';
    }
    for (let i = 0; i < words.length; i++) {
      let valid = await isWord(words[i]);
      if (!valid) {
        errors += `${templateStr(STRINGS['unrecognized-word'], [words[i]])}\n`;
      }
    }
    let errorEl = document.getElementById('custom-error');
    errorEl.textContent = errors;
    if (errors) {
      errorEl.style.display = 'block';
      return;
    }
    errorEl.style.display = 'none';

    let link = document.getElementById('custom-link');
    let href = `${window.location.origin}${window.location.pathname}?l=${LANG}&puzzle=${encode(puzzle)}`;
    link.textContent = href;
    link.href = href;
    link.style.display = 'block';
  });
  initKeyboard();
  let args = ARGS;
  let title = '';
  let words;
  let day;
  if (args.puzzle) {
    title = STRINGS['custom-crosswordle'];
    words = decode(args.puzzle).split('+');
  } else {
    day = Math.floor((Date.now() - FIRST_PUZZLE) / (60 * 60 * 24 * 1000));
    if (ENCODED.length > day) {
      title = `Crosswordle ${day} (${LANG})`;
      words = decode(ENCODED[day]).split(' ');
    } else {
      throw Error('No more puzzles available.');
    }
  }
  document.title = document.querySelector('.title h1').textContent = title;

  // Find most central overlap between the two words.
  let best = null;
  let score = function(i, j) {
    return Math.abs(Math.floor(words[0].length / 2) - i) + Math.abs(Math.floor(words[1].length / 2) - j);
  }
  let size = `fit-content(${100 / words[0].length}%)`;
  let columns = '';
  for (let i = 0; i < words[0].length; ++i) {
    columns += size + ' ';
    for (let j = 0; j < words[1].length; ++j) {
      // Find positions with identical letters.
      if (words[0][i] != words[1][j])
        continue;
      let current = score(i, j);
      if (best === null || current < best.score) {
        best = {
          day,
          title,
          score: current,
          words,
          offsets: [i, j],
        }
      }
    }
  }
  if (!best) {
    throw new Error('No common letter between words');
  }
  puzzle = best;
  let grid = document.querySelector('.main .grid');
  grid.style.gridTemplateColumns = columns;
  let addCell = function(word, char, x, y) {
    let container = document.createElement('div');
    container.style.gridRow = (y + 1);
    container.style.gridColumn = (x + 1);
    let cell = document.createElement('div');
    container.appendChild(cell);
    cell.classList.add('tile');
    cell.classList.add(`word_${word}_${char}`);
    cell.appendChild(document.createElement('div'));
    cell.appendChild(document.createElement('div'));
    grid.appendChild(container);
    cell.addEventListener('click', click);
    return cell;
  }
  for (let i = 0; i < words[0].length; ++i) {
    let cell = addCell(0, i, i, best.offsets[1]);
    if (i == best.offsets[0]) {
      cell.classList.add(`word_1_${best.offsets[1]}`);
    }
  }
  for (let i = 0; i < words[1].length; ++i) {
    if (i == best.offsets[1])
      continue;
    addCell(1, i, best.offsets[0], i);
  }
  updateSelection([0, 0]);
  for (let i = 0; i < words.length; ++i) {
    loadWordLength(words[i].length);
  }
  document.documentElement.style.setProperty('--size', Math.max(words[0].length, words[1].length));

  // Restore settings
  let storedSettings = localStorage.getItem('crosswordle-settings');
  if (storedSettings) {
    settings = JSON.parse(storedSettings);
    if (settings.hardMode)
      document.getElementById('hard-mode').checked = true;
    if (settings.skipFilled)
      document.getElementById('skip-filled').checked = true;
    if (settings.highContrast) {
      document.getElementById('high-contrast').checked = true;
      updateHighContrast();
    }
  }
  if (settings.dynamicKeyboard || settings.dynamicKeyboard === undefined)
    document.getElementById('dynamic-keyboard').checked = true;

  // Restore progress
  let progress = localStorage.getItem('crosswordle-daily');
  if (!progress)
    return;
  let parsed = JSON.parse(progress);
  if (puzzle.day === undefined || parsed.day != puzzle.day)
    return;
  if (parsed.lang != LANG)
    return;
  hardMode = parsed.hardMode || false;
  gameGuesses = parsed.guesses;
  for (let guess of gameGuesses) {
    setGuess(guess.toUpperCase());
    addGuess(guess, false);
  }
}

function updateHighContrast() {
  if (settings.highContrast) {
    document.documentElement.classList.add('high-contrast');
  } else {
    document.documentElement.classList.remove('high-contrast');
  }
}

const OVERFLOW = 10;
async function postScore(puzzle, score) {
  let stats = document.getElementById('stats');
  stats.innerHTML = "";
  let response = await fetch(`https://serializer.ca/stats/crosswordle-${puzzle}`, {
    method: score ? 'POST' : 'GET',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'omit',
    headers: score ? {
      'Content-Type': 'application/json',
    } : undefined,
    body: score ? JSON.stringify({score}) : undefined
  });
  let json = await response.json();
  let maxIndex = 1;
  let count = 0;
  let overflow = 0;
  for (let i in json.scores) {
    if (parseInt(i) >= OVERFLOW) {
      overflow += json.scores[i];
      maxIndex = OVERFLOW;
    } else {
      maxIndex = Math.max(parseInt(i), maxIndex);
    }
    count += json.scores[i];
  }
  let maxValue = Math.max(1, overflow);
  for (let i = 1; i < OVERFLOW; ++i) {
    maxValue = Math.max(maxValue, json.scores[i] || 0);
  }
  if (count < 5)
    return;
  let html = `<p>${STRINGS['daily-scores']}</p><table>`;
  for (let i = 1; i <= maxIndex; ++i) {
    let score = i == OVERFLOW ? overflow : (json.scores[i] || 0);
    html += `<tr><td>${i}${i<OVERFLOW?'':'+'}</td><td><div class="bar" style="width: ${Math.round(score / maxValue * 100)}%"></div></td></tr>`;
  }
  html += '</table';
  stats.innerHTML = html;
}

// Returns the tile for a given word, index
function tile(selection) {
  if (!selection)
    return null;
  return document.querySelector(`.word_${selection[0]}_${selection[1]}`);
}

let selected = null;
function updateSelection(newSelection) {
  let oldTile = tile(selected)
  if (oldTile) oldTile.classList.remove('selected');
  selected = newSelection;
  let newTile = tile(selected);
  if (newTile) newTile.classList.add('selected');
}

function setTile(tile, text, index) {
  if (!tile)
    return;
  for (let child of tile.children) {
    if (index !== undefined) {
      if (index-- != 0)
        continue;
    }
    child.textContent = text;
  }
}

let finished = false;
function type(code) {
  if (code == 'ArrowRight' || code == 'ArrowLeft') {
    let start = selected[0] == 0 ? selected[1] : puzzle.offsets[0];
    if (code == 'ArrowLeft' && start > 0)
      updateSelection([0, start - 1]);
    else if (code == 'ArrowRight' && start < puzzle.words[0].length - 1)
      updateSelection([0, start + 1]);
    return true
  } else if (code == 'ArrowUp' || code == 'ArrowDown') {
      let start = selected[0] == 1 ? selected[1] : puzzle.offsets[1];
      if (code == 'ArrowUp' && start > 0)
        updateSelection([1, start - 1]);
      else if (code == 'ArrowDown' && start < puzzle.words[1].length - 1)
        updateSelection([1, start + 1]);
      return true
  } else if (code == 'Enter') {
    if (finished) {
      showVictory();
    } else {
      tryGuess();
    }
    return true;
  } else if (!finished && code == 'Backspace') {
    let cur = tile(selected);
    if (cur && cur.children[0].textContent != '') {
      // Erase selected cell if non-empty
    } else if (selected[1] > 0) {
      updateSelection([selected[0], selected[1] - 1]);
    } else if (selected[0] == 1) {
      updateSelection([0, puzzle.words[0].length - 1]);
    }
    setTile(tile(selected), '');
    updateHints(false);
    return true;
  } else if (!finished && code.length == 1) {
    setTile(tile(selected), code.toUpperCase());
    let advance = 1;
    while (selected[1] < puzzle.words[selected[0]].length && (
               advance-- > 0 ||
               settings.skipFilled && tile(selected).children[0].textContent != '')) {
      if (selected[0] == 0 && selected[1] == puzzle.words[selected[0]].length - 1) {
        updateSelection([1, 0]);
      } else {
        updateSelection([selected[0], selected[1] + 1]);
      }
    }
    updateHints(false);
    return true;
  }
  return false;
}

function click(elem) {
  for (let className of this.classList) {
    if (className.startsWith('word_')) {
      let m = className.match(/word_([0-9]+)_([0-9]+)/);
      if (!m) continue;
      let newSelection = [parseInt(m[1]), parseInt(m[2])];
      if (newSelection[0] == selected[0] && newSelection[1] == selected[1])
        continue;
      updateSelection(newSelection);
      break;
    }
  }
}

class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}

let guessInProgress = false;
async function tryGuess() {
  // Prevent guessing while a previous guess is being processed.
  if (guessInProgress)
    return;
  guessInProgress = true;
  try {
    await guess();
  } catch (err) {
    if (err instanceof UserError) {
      showMessage(err.message);
    } else {
      throw err;
    }
  } finally {
    guessInProgress = false;
  }
}

const WORD_DESC = ['Horizontal', 'Vertical'];
let hardMode = false;
let settings = {};
let gameGuesses = [];
let clues = {
  green: [],
  // 'a': {min: N, max: true/false, not: Set([indices])}
  letters: {},
};
for (let i = 0; i < alphabet.length; ++i) {
  clues.letters[alphabet[i]] = {min: 0, max: false, not: new Set()};
}

function letterCount() {
  let letters = {};
  for (let i = 0; i < puzzle.words.length; ++i) {
    for (let j = 0; j < puzzle.words[i].length; ++j) {
      if (i == 1 && j == puzzle.offsets[1])
        continue;
      let c = tile([i, j]).children[0].textContent.toLowerCase();
      if (c == '') {
        continue;
      }
      letters[c] = letters[c] || 0;
      letters[c]++;
    }
  }
  return letters;
}

async function updateHints(full) {
  let useDynamicKeyboard = settings.dynamicKeyboard || settings.dynamicKeyboard === undefined;
  if (!full && !useDynamicKeyboard)
    return;
  let greenLetters = {};
  let letters = letterCount();
  let count = 0;
  let guesses = [];
  for (let i = 0; i < puzzle.words.length; ++i) {
    guesses.push('');
    for (let j = 0; j < puzzle.words[i].length; ++j) {
      let index = count++;
      let t = tile([i, j]);
      let c = t.children[0].textContent.toLowerCase();
      if (c) {
        guesses[i] += c;
      }
      if (i == 1 && j == puzzle.offsets[1])
        continue;
      if (clues.green[i] && clues.green[i][j]) {
        if (!useDynamicKeyboard || c != clues.green[i][j]) {
          greenLetters[clues.green[i][j]] = true;
        }
        if (useDynamicKeyboard && c == clues.green[i][j]) {
          t.classList.add('green-hint');
        } else {
          t.classList.remove('green-hint');
        }
      }
      // If the chosen letter can't go in this position or there are too many
      // in the guess, highlight them.
      if (useDynamicKeyboard && c && clues.letters[c] && (
              clues.letters[c].not.has(index) ||
              (clues.letters[c].max && clues.letters[c].min < letters[c]))) {
        t.classList.add('error');
      } else {
        t.classList.remove('error');
      }
    }
  }

  // If either word is invalid, highlight the entire word.
  if (useDynamicKeyboard) {
    for (let i = 0; i < puzzle.words.length; ++i) {
      if (guesses[i].length != puzzle.words[i].length)
        continue;
      let valid = await isWord(guesses[i]);
      if (!valid) {
        for (let j = 0; j < puzzle.words[i].length; ++j) {
          tile([i, j]).classList.add('error');
        }
      }
    }
  }

  for (let i = 0; i < alphabet.length; ++i) {
    let c = alphabet[i];
    let key = document.querySelector(`.key[code=${c}]`);
    if (greenLetters[c]) {
      key.classList.add('green');
    } else {
      key.classList.remove('green');
    }
    if ((!useDynamicKeyboard && clues.letters[c].min > 0) ||
        clues.letters[c].min > (letters[c] || 0)) {
      key.classList.add('yellow');
    } else {
      key.classList.remove('yellow');
    }
    if ((!useDynamicKeyboard && clues.letters[c].max && clues.letters[c].min == 0) ||
        (useDynamicKeyboard && clues.letters[c].max && clues.letters[c].min <= (letters[c] || 0))) {
      key.classList.add('black');
    } else {
      key.classList.remove('black');
    }
  }
}

async function guess() {
  let guesses = [];
  if (gameGuesses.length == 0) {
    hardMode = settings.hardMode;
  }
  for (let i = 0; i < puzzle.words.length; i++) {
    guesses.push('');
    for (let j = 0; j < puzzle.words[i].length; j++) {
      let c = tile([i, j]).children[0].textContent.toLowerCase();
      if (c == '') {
        throw new UserError(STRINGS['incomplete']);
      }
      if (hardMode && clues.green[i] && clues.green[i][j] && clues.green[i][j] != c) {
        throw new UserError(templateStr(
            STRINGS[i == 0 ? 'horizontal-word-letter-must-be' : 'vertical-word-letter-must-be'],
            [j + 1, clues.green[i][j].toUpperCase()]));
      }
      guesses[i] += c;
    }
  }
  for (let i = 0; i < guesses.length; i++) {
    let valid = await isWord(guesses[i]);
    if (!valid) {
      throw new UserError(templateStr(STRINGS['unrecognized-word'], [guesses[i]]));
    }
  }
  if (hardMode) {
    let letters = letterCount();
    for (let c in clues.letters) {
      let clue = clues.letters[c];
      let inGuess = letters[c] || 0;
      if (clue.min > inGuess) {
        throw new UserError(templateStr(STRINGS['min-letters'], [clue.min, c.toUpperCase()]));
      }
    }
  }
  let str = guesses.join(' ');
  gameGuesses.push(str);
  if (puzzle.day !== undefined) {
    localStorage.setItem('crosswordle-daily', JSON.stringify({
        day: puzzle.day, lang: LANG, guesses: gameGuesses, hardMode}));
  }
  await addGuess(str, true);
}

function setGuess(guess) {
  let guesses = guess.split(' ');
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      setTile(tile([i, j]), guesses[i][j]);
    }
  }
}

async function addGuess(guess, interactive) {
  let guesses = guess.split(' ');
  let answerLetters = {};
  for (let i = 0; i < puzzle.words.length; i++) {
    for (let j = 0; j < puzzle.words[i].length; j++) {
      if (i == 1 && j == puzzle.offsets[1])
        continue;
      let c = puzzle.words[i][j];
      answerLetters[c] = (answerLetters[c] || 0) + 1;
    }
  }

  // Mark green first.
  let wrong = 0;
  let letters = {};
  for (let i = 0; i < alphabet.length; ++i) {
    letters[alphabet[i]] = {min: 0, max: false};
  }
  for (let i = 0; i < guesses.length; i++) {
    if (clues.green.length <= i)
      clues.green.push([]);
    for (let j = 0; j < guesses[i].length; j++) {
      if (i == 1 && j == puzzle.offsets[1])
        continue;
      if (guesses[i][j] == puzzle.words[i][j]) {
        clues.green[i][j] = guesses[i][j];
        letters[guesses[i][j]].min++;
        tile([i, j]).classList.add('green');
        answerLetters[guesses[i][j]]--;
      } else {
        wrong++;
      }
    }
  }

  let count = 0;
  // Then mark yellow
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      ++count;
      if (i == 1 && j == puzzle.offsets[1])
        continue;
      if (guesses[i][j] != puzzle.words[i][j]) {
        clues.letters[guesses[i][j]].not.add(count - 1);
        if (answerLetters[guesses[i][j]]) {
          tile([i, j]).classList.add('yellow');
          letters[guesses[i][j]].min++;
          answerLetters[guesses[i][j]]--;
        } else {
          letters[guesses[i][j]].max = true;
        }
      }
    }
  }

  // Merge new information with existing.
  for (let i = 0; i < alphabet.length; ++i) {
    let c = alphabet[i];
    clues.letters[c].min = Math.max(clues.letters[c].min, letters[c].min);
    if (letters[c].max)
      clues.letters[c].max = true;
  }

  // Then do a reveal, and add to the clues row.
  let animationPromises = [];
  let startDelay = 0;
  let result = document.createElement('div');
  summary += '\n';
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      let t = tile([i, j]);
      let log = document.createElement('div');
      log.classList = 'tile';
      if (j == puzzle.offsets[i]) {
        log.classList.add('crossing');
      }
      if (t.classList.contains('green')) {
        summary += '🟩';
        log.classList.add('green');
      } else if (t.classList.contains('yellow')) {
        summary += '🟨';
        log.classList.add('yellow');
      } else {
        summary += '⬜';
      }
      let letter = document.createElement('div');
      letter.textContent = guesses[i][j].toUpperCase();
      log.appendChild(letter);
      // TODO: Animate tiles to log area.
      result.appendChild(log);
    }
    if (i < guesses.length - 1) {
      let space = document.createElement('div');
      space.classList = 'empty';
      result.appendChild(space);
      summary += ' ';
    }
  }
  // Animate the tiles and then clear their contents if not green.
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      let t = tile([i, j]);
      async function animate() {
        let fill = wrong == 0 ? 'forwards' : 'none';
        let a1;
        if (interactive || wrong == 0) {
          a1 = t.animate([
            {transform: 'none'},
            {transform: 'rotateY(180deg)'}], {
              duration: 600,
              delay: startDelay,
              fill}).finished;
          animationPromises.push(a1);
        }
        if (wrong == 0) {
          return;
        }
        let a2;
        if (interactive) {
          a2 = t.animate([
            {transform: 'rotateY(180deg)'},
            {transform: 'rotateY(180deg)', offset: 0.8},
            {transform: 'none'}], {
            duration: 3000,
            delay: startDelay + 600,
          }).finished;
          animationPromises.push(a2);
          await a1;
        }
        if (!t.classList.contains('green'))
          setTile(t, '', 1);
        if (interactive) {
          await a2;
        }
        if (!t.classList.contains('green'))
          setTile(t, '', 0);
        t.classList.remove('green');
        t.classList.remove('yellow');
        if (i == 0 && j == 0)
          updateSelection([i, j]);
      }
      if (i != 1 || j != puzzle.offsets[1]) {
        animate();
        startDelay += 150;
      }
    }
  }
  if (!wrong && puzzle.day) {
    // Post and fetch histogram data early to have it visible before
    // animations finish.
    postScore(`${LANG}-${puzzle.day}`, interactive ? gameGuesses.length : undefined);
  }
  if (animationPromises.length > 0) {
    await Promise.all(animationPromises);
  }
  updateHints(true);
  if (wrong) {
    // TODO: Add letter animations.
    document.querySelector('.main .clues').appendChild(result);
    if (interactive) {
      result.animate({opacity: [0, 1]}, 200);
    }
    document.querySelector('.keyboard').scrollIntoView();
  } else {
    // Show victory screen after clues are revealed.
    let guesses = gameGuesses.length;
    let indicator = hardMode ? '*' : '';
    document.getElementById('guesses').textContent = guesses;
    document.getElementById('share').onclick = function() {
      navigator.clipboard.writeText(`${puzzle.title} ${guesses}/∞${indicator}${summary}\n${window.location.href}`);
      showMessage(STRINGS['copied-clipboard']);
    }
    finished = true;
    showVictory();
  }
}

function showVictory() {
  document.querySelector('.victory').style.display = 'block';
}

async function showMessage(text) {
  let div = document.querySelector('.modal');
  div.querySelector('.message').textContent = text;
  div.style.display = 'block';
  await div.animate([
      {opacity: 0},
      {opacity: 1, offset: 0.1},
      {opacity: 1, offset: 0.9},
      {opacity: 0}], {
      duration: 2000}).finished;
  div.style.display = '';
}

init();