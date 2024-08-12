"use strict";

const FEATURE_VERSION = 8;
const MAX_GUESSES = 10;

function parse(str) {
  let args = str.split('&');
  let argMap = {};
  for (let arg of args) {
    let split = arg.split('=');
    argMap[split[0]] = decodeURIComponent(split[1]);
  }
  return argMap;
}

function parseDate(dateStr, offsetDays = 0) {
  const parts = dateStr.split('-').map(s => parseInt(s));
  return new Date(parts[0], parts[1] - 1, parts[2] + offsetDays, 0, 0, 0, 0);
}

// A simple 16-bit PRNG.
// Using only 16-bit numbers avoids numerical precision limits with plain Javascript numbers.
function prng16(seed) {
  const m = 0x10000; // 2^16
  const a = 20021;
  const c = 1;
  let state = seed;
  return function() {
      state = (a * state + c) % m;
      return state;
  };
}

const ARGS = parse(window.location.search.substr(1));
// Custom puzzles from before other languages were supported are english. Newer custom
// puzzles include the language in the URL.
let AUTO_LANG = 'en';
if (!ARGS.puzzle) {
  if (navigator.language.startsWith('fr')) AUTO_LANG = 'fr';
  else if (navigator.language.startsWith('es')) AUTO_LANG = 'es';
}
const LANG = ARGS.l || AUTO_LANG;

let AVAILABLE_COUNT;
let PUZZLE_COUNT;
let PUZZLE;
let STRINGS = [];

const scoreChars = '1234567890';
const scoreChar = {};
for (let i = 0; i < scoreChars.length; ++i) {
  scoreChar[scoreChars[i]] = i + 1;
}
function setScore(day, score) {
  while (SOLVED.length <= day) {
    SOLVED = SOLVED + ' ';
  }
  SOLVED = SOLVED.slice(0, day) + scoreChars[score - 1] + SOLVED.slice(day + 1);
  localStorage.setItem(`crosswordle-scores-${LANG}`, SOLVED);
}
function getScore(day) {
  if (SOLVED.length <= day)
    return undefined;
  return scoreChar[SOLVED[day]];
}
let SOLVED = '';

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
const MAX_LENGTH = 12;

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

const CHUNK_SIZE = 100;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

async function loadPuzzle(index) {
  const chunk = Math.floor(index / CHUNK_SIZE);
  const chunkIndex = index % CHUNK_SIZE;
  return (await (await fetch(`./src/puzzles/${LANG}/${(chunk * CHUNK_SIZE).toString().padStart(6, '0')}.json`)).json()).puzzles[chunkIndex];
}

async function isWord(word) {
  await loadWordLength(word.length);
  return dictionary.has(word) || puzzle.words.indexOf(word) != -1;
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

function hasCommonLetter(word1, word2) {
  for (let i = 0; i < word1.length; i++) {
    if (word2.indexOf(word1[i]) != -1)
      return true;
  }
  return false;
}

function setComponent(container, target, text, visible) {
  if (visible) {
    document.querySelector(container).classList.remove('hidden');
  } else {
    document.querySelector(container).classList.add('hidden');
  }
  document.querySelector(target).textContent = text;
}

function animateChange(elems, callback, options) {
  if (options === 0 || options.duration === 0) {
    callback();
    return;
  }
  let before = elems.map(elem => elem.getBoundingClientRect());
  callback();
  let fromTransforms = elems.map((elem, idx) => {
    const cur = elem.getBoundingClientRect();
    return `translate(${before[idx].left - cur.left}px, ${before[idx].top - cur.top}px)`;
  });
  for (let i = 0; i < elems.length; ++i) {
    elems[i].animate([
      {transform: fromTransforms[i], offset: 0}
    ], options);
  }
}

let BASE_DATE = null;
let BASE_INDEX = 0;
let TODAY_INDEX;
let FIRST_PUZZLE = null;
let LAST_PUZZLE = null;
let puzzle = null;
let summary = '';
async function init() {
  let data = await (await fetch(`./src/lang/${LANG}.json`)).json();
  STRINGS = data.strings;
  PUZZLE_COUNT = data.puzzle_count;
  BASE_DATE = data.base_date;
  BASE_INDEX = data.base_index || 0;
  FIRST_PUZZLE = parseDate(BASE_DATE, -BASE_INDEX);
  LAST_PUZZLE = parseDate(BASE_DATE, PUZZLE_COUNT - BASE_INDEX);
  TODAY_INDEX = Math.floor((Date.now() - FIRST_PUZZLE) / MILLISECONDS_PER_DAY);
  AVAILABLE_COUNT = TODAY_INDEX < BASE_INDEX ? BASE_INDEX : Math.min(TODAY_INDEX + 1, PUZZLE_COUNT);
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
  document.getElementById('show-settings').addEventListener('click', () => {
    document.querySelector('.settings').classList.remove('hidden');
  });
  document.getElementById('close-settings').addEventListener('click', () => {
    document.querySelector('.settings').classList.add('hidden');
  });
  document.getElementById('close-victory').addEventListener('click', () => {
    document.querySelector('.victory').classList.add('hidden');
  });
  let menuListener = (evt) => {
    document.querySelector('.menu .contents').classList.add('hidden');
    document.body.removeEventListener('click', menuListener, {capture: true});
  };
  document.getElementById('expand-button').addEventListener('click', () => {
    document.querySelector('.menu .contents').classList.remove('hidden');
    document.body.addEventListener('click', menuListener, {capture: true});
  });
  let archiveLoaded = false;
  document.getElementById('show-archive').addEventListener('click', () => {
    document.querySelector('.archive').classList.remove('hidden');
    if (archiveLoaded)
      return;
    archiveLoaded = true;
    updateArchive();
  });
  document.getElementById('close-archive').addEventListener('click', () => {
    document.querySelector('.archive').classList.add('hidden');
  });
  document.getElementById('show-help').addEventListener('click', () => {
    document.querySelector('.help').classList.remove('hidden');
  });
  document.getElementById('close-help').addEventListener('click', () => {
    document.querySelector('.help').classList.add('hidden');
  });
  document.getElementById('close-news').addEventListener('click', () => {
    document.querySelector('.news').classList.add('hidden');
  });
  let hardModeCheckbox = document.getElementById('hard-mode');
  hardModeCheckbox.addEventListener('change', () => {
    if (gameGuesses.length > 0) {
      showMessage(STRINGS['hard-mode-next-game']);
    }
    settings.hardMode = hardModeCheckbox.checked;
    localStorage.setItem('crosswordle-settings', JSON.stringify(settings));
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
  let seenHelp = localStorage.getItem('crosswordle-help');
  if (seenHelp)
    seenHelp = parseInt(seenHelp);
  if (seenHelp === null) {
    document.querySelector('.help').classList.remove('hidden');
    localStorage.setItem('crosswordle-help', FEATURE_VERSION);
  } else if (seenHelp < FEATURE_VERSION) {
    let features = document.querySelectorAll('.news .feature[version]');
    for (let i = 0; i < features.length; i++) {
      if (parseInt(features[i].getAttribute('version')) <= seenHelp) {
        features[i].style.display = 'none';
      }
    }
    document.querySelector('.news').classList.remove('hidden');
    localStorage.setItem('crosswordle-help', FEATURE_VERSION);
  }
  let playRandom = function() {
    const puzzles = Math.min(AVAILABLE_COUNT);
    if (puzzles < 2)
      return;
    const complete = [];
    const incomplete = [];
    for (let i = 0; i < puzzles; ++i) {
      if (getScore(i) === undefined) {
        incomplete.push(i);
      } else {
        complete.push(i);
      }
    }
    const selectFrom = incomplete.length > 0 ? incomplete : complete;
    let url = window.location.href.split('?')[0] + '?';
    let selected = selectFrom[Math.floor(Math.random() * selectFrom.length)];
    if (ARGS.l)
      url += `l=${ARGS.l}&`;
    url += `day=${selected}`;
    window.location = url;
  };
  for (const randomBtn of document.querySelectorAll('.random')) {
    randomBtn.addEventListener('click', playRandom);
  }
  document.getElementById('custom-crosswordle').setAttribute('placeholder', STRINGS['custom-crosswordle-example']);
  document.getElementById('create').addEventListener('click', async () => {
    let errors = '';
    let puzzle = document.getElementById('custom-crosswordle').value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(' ', '+');
    let words = puzzle.split('+');
    if (words.length != 2) {
      errors += STRINGS['two-words-required'] + '\n';
    } else if (!hasCommonLetter(words[0], words[1])) {
      errors += STRINGS['common-letter-required'] + '\n';
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
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.style.display = 'none';

    let link = document.getElementById('custom-link');
    let href = `${window.location.origin}${window.location.pathname}?l=${LANG}&puzzle=${encode(puzzle)}`;
    link.textContent = href;
    link.href = href;
    link.classList.remove('hidden');
  });
  initKeyboard();
  let args = ARGS;
  let title = '';
  let words;
  let day;
  if (args.puzzle) {
    title = STRINGS['custom-crosswordle'];
    PUZZLE = {puzzle: decode(args.puzzle), hint: args.hint ? decodeURIComponent(args.hint) : ''};
  } else {
    day = TODAY_INDEX;
    if (args.day !== undefined) {
      day = Math.max(0, Math.min(day, parseInt(args.day)));
    }
    // Select a seeded random puzzle if there are no more available yet.
    if (PUZZLE_COUNT <= day || day < BASE_INDEX) {
      day = prng16(Math.abs(Math.floor((Date.now() - parseDate("2022-01-01")) / MILLISECONDS_PER_DAY)))() % AVAILABLE_COUNT;
    }
    title = `Crosswordle ${day} (${LANG})`;
    PUZZLE = await loadPuzzle(day);
  }
  let dateText = '';
  if (PUZZLE.date) {
    const dateParts = PUZZLE.date.split('-').map(s => parseInt(s));
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0, 0);
    dateText = date.toLocaleDateString(LANG, {
        year: "numeric",
        month: "long",
        day: "numeric"});
  }
  setComponent('.date', '#date', dateText, !!dateText);
  setComponent('.author', '#author', PUZZLE.author, !!PUZZLE.author);
  document.querySelector('.info').innerHTML = PUZZLE.info || '';
  words = PUZZLE.puzzle.split(/[+ ]/);
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

  // Create empty spacers to reserve space for clues.
  let resultSpacer = document.createElement('div');
  resultSpacer.classList = 'spacer';
  for (let i = 0; i < words.length; ++i) {
    let resultSpace;
    for (let j = 0; j < words[i].length; ++j) {
      resultSpace = document.createElement('div');
      resultSpace.classList = 'spacer tile';
      resultSpacer.appendChild(resultSpace);
    }
    resultSpace = document.createElement('div');
    resultSpace.classList = 'spacer empty';
    resultSpacer.appendChild(resultSpace);
  }
  document.querySelector('.main .clues').appendChild(resultSpacer);

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
    /*
    // TODO: Remove obsolete settings.
    if ('dynamicKeyboard' in settings) {
      delete settings['dynamicKeyboard'];
      localStorage.setItem('crosswordle-settings', JSON.stringify(settings));
    }
    */
  }

  SOLVED = localStorage.getItem(`crosswordle-scores-${LANG}`) || '';

  // Note, setting this before hardMode is set means that the user can see the hint,
  // and then switch to hard mode. However, we don't want to lock the user into
  // easy mode if they just haven't set the hard mode setting yet.
  // TODO: Consider delaying showing the hint until the user interacts with the puzzle.
  setComponent('.hint', '#hint', PUZZLE.hint, !settings.hardMode && !!PUZZLE.hint);

  // Restore progress
  let progress = localStorage.getItem('crosswordle-daily');
  if (!progress) {
    return;
  }
  let parsed = JSON.parse(progress);
  if (puzzle.day === undefined || parsed.day != puzzle.day)
    return;
  if (parsed.lang != LANG)
    return;
  hardMode = parsed.hardMode || false;
  orangeClues = parsed.orangeClues || false;
  setComponent('.hint', '#hint', PUZZLE.hint, !hardMode && !!PUZZLE.hint);
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

/**
 * Update the archive view based on the given puzzle index and date.
 * @param {Number?} index
 * @param {String?} puzzleDate
 */
async function updateArchive(index, indexDate) {
  const container = document.querySelector('.archive .months');
  const nextButton = document.querySelector('.archive .next-year');
  const prevButton = document.querySelector('.archive .prev-year');
  let iDate = null;
  if (index === undefined) {
    if (puzzle.day !== undefined) {
      index = puzzle.day;
      iDate = parseDate(PUZZLE.date);
    } else {
      index = AVAILABLE_COUNT - 1;
      iDate = parseDate((await loadPuzzle(index)).date);
    }
  } else {
    iDate = parseDate(indexDate);
  }
  const year = iDate.getFullYear();
  const firstDate = new Date(iDate.getFullYear(), 0, 0);
  const lastDate = new Date(iDate.getFullYear() + 1, 0, 1);
  const neededBefore = Math.ceil((iDate - firstDate) / MILLISECONDS_PER_DAY);
  const neededAfter = Math.ceil((lastDate - iDate) / MILLISECONDS_PER_DAY);
  let prevYearIndex = Math.max(0, index - neededBefore);
  const maxIndex = AVAILABLE_COUNT - 1;
  let nextYearIndex = Math.min(maxIndex, index + neededAfter);
  const start = Math.floor(prevYearIndex / CHUNK_SIZE) * CHUNK_SIZE;
  const fetches = [];
  for (let chunk = Math.floor(prevYearIndex / CHUNK_SIZE); chunk <= Math.floor(nextYearIndex / CHUNK_SIZE); ++chunk) {
    fetches.push(fetch(`./src/puzzles/${LANG}/${(chunk * CHUNK_SIZE).toString().padStart(6, '0')}.json`).then(r => r.json()));
  }
  const chunks = await Promise.all(fetches);
  let getPuzzle = (i) => chunks[Math.floor((i - start) / CHUNK_SIZE)].puzzles[i % CHUNK_SIZE];
  for (;prevYearIndex < index && parseDate(getPuzzle(prevYearIndex + 1).date).getFullYear() < year; ++prevYearIndex);
  for (;nextYearIndex > index && parseDate(getPuzzle(nextYearIndex - 1).date).getFullYear() > year; --nextYearIndex);
  container.innerHTML = '';
  document.querySelector('.archive .cur-year').textContent = year;
  let startIndex = prevYearIndex;
  let endIndex = nextYearIndex;
  const prevYearPuzzle = getPuzzle(prevYearIndex);
  if (parseDate(prevYearPuzzle.date).getFullYear() < year) {
    startIndex++;
    prevButton.removeAttribute('disabled');
    prevButton.onclick = () => {
      prevButton.setAttribute('disabled', '');
      nextButton.setAttribute('disabled', '');
      updateArchive(prevYearIndex, prevYearPuzzle.date);
    };
  }
  const nextYearPuzzle = getPuzzle(nextYearIndex);
  if (parseDate(nextYearPuzzle.date).getFullYear() > year) {
    endIndex--;
    nextButton.removeAttribute('disabled');
    nextButton.onclick = () => {
      prevButton.setAttribute('disabled', '');
      nextButton.setAttribute('disabled', '');
      updateArchive(nextYearIndex, nextYearPuzzle.date);
    };
  }

  const weekDays = [];
  var d = new Date();
  while(d.getDay() > 0) {
      d.setDate(d.getDate() + 1);
  }
  while(weekDays.length < 7) {
      weekDays.push(d.toLocaleDateString(LANG, {weekday: 'short'}).match(/\w+/)[0]);
      d.setDate(d.getDate() + 1);
  }
  d = new Date();
  let cur = new Date(year, parseDate(getPuzzle(startIndex).date).getMonth(), 1, 0, 0, 0, 0);
  let nextIndex = startIndex;
  let nextPuzzle = getPuzzle(nextIndex);
  let curMonth = -1;
  while (nextIndex <= endIndex) {
    if (cur.getMonth() != curMonth) {
      curMonth = cur.getMonth();
      const month = document.createElement('div');
      container.appendChild(month);
      const title = document.createElement('div');
      title.className = 'title';
      title.style.gridArea = '1 / 1 / 1 / 7';
      title.textContent = cur.toLocaleDateString(LANG, { year: 'numeric', month: 'short' });
      month.appendChild(title);
      month.className = 'month';
      let col = 1;
      let row = 2;
      for (const day of weekDays) {
        const headerDay = document.createElement('div');
        headerDay.className = 'header';
        headerDay.textContent = day;
        headerDay.style.gridArea = `${row} / ${col++}`;
        month.appendChild(headerDay);
      }
      let day = cur;
      while (day.getMonth() == curMonth) {
        const dayDiv = document.createElement('a');
        const newCol = day.getDay() + 1;
        if (newCol < col)
          ++row;
        col = newCol;
        dayDiv.style.gridArea = `${row} / ${col}`;
        dayDiv.textContent = day.getDate();
        if (nextPuzzle && day.toISOString().substring(0,10) == nextPuzzle.date) {
          const score = getScore(nextIndex);
          if (score !== undefined) {
            dayDiv.classList.add('complete');
          }
          let url = '?'
          if (ARGS.l)
            url += `l=${ARGS.l}&`;
          dayDiv.setAttribute('href', url + `day=${nextIndex}`);
          ++nextIndex;
          nextPuzzle = nextIndex <= endIndex ? getPuzzle(nextIndex) : null;
        }
        month.appendChild(dayDiv);
        day.setDate(day.getDate() + 1);
      }
      cur = day;
    }
  }
}

const OVERFLOW = 10;
async function postScore(puzzle, score) {
  let stats = document.getElementById('stats');
  stats.innerHTML = "";
  let variant = '';
  if (orangeClues)
    variant = '-orange';
  let response = await fetch(`https://serializer.ca/stats/crosswordle-${puzzle}${variant}`, {
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
  updateHints();
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
    updateHints();
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
    updateHints();
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
let orangeClues = false;
let settings = {};
let gameGuesses = [];
let clues = {
  green: [],
  // 'a': {min: N, max: true/false, not: Set([indices])}
  letters: {},
};
for (let i = 0; i < alphabet.length; ++i) {
  clues.letters[alphabet[i]] = {min: [0, 0], max: [false, false], not: new Set()};
}

function letterCount() {
  let letters = {};
  for (let i = 0; i < alphabet.length; ++i) {
    letters[alphabet[i]] = [0, 0];
  }

  for (let i = 0; i < puzzle.words.length; ++i) {
    for (let j = 0; j < puzzle.words[i].length; ++j) {
      let c = tile([i, j]).children[0].textContent.toLowerCase();
      if (c == '' || alphabet.indexOf(c) == -1) {
        continue;
      }
      letters[c][i]++;
    }
  }
  return letters;
}

async function updateHints() {
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
      if (clues.green[i] && clues.green[i][j]) {
        if (c != clues.green[i][j]) {
          greenLetters[clues.green[i][j]] = true;
        }
        if (c == clues.green[i][j]) {
          t.classList.add('green-hint');
        } else {
          t.classList.remove('green-hint');
        }
      }
      if (!c || alphabet.indexOf(c) == -1)
        continue;
      guesses[i] += c;
      if (i == 1 && j == puzzle.offsets[1])
        continue;
      // If the chosen letter can't go in this position or there are too many
      // in the guess, highlight them.
      let maxLetters = Infinity;
      let letterCount = 0;
      if (orangeClues) {
        letterCount = letters[c][i];
        if (clues.letters[c]?.max[i])
          maxLetters = clues.letters[c].min[i];
      } else {
        letterCount = letters[c][0] + letters[c][1];
        if (clues.letters[c]?.max[0] && clues.letters[c]?.max[1])
          maxLetters = clues.letters[c].min[0] + clues.letters[c].min[1];
      }
      if (c && (clues.letters[c]?.not.has(index) ||
                letterCount > maxLetters)) {
        t.classList.add('error');
      } else {
        t.classList.remove('error');
      }
    }
  }

  const curWord = selected[0];
  for (let i = 0; i < alphabet.length; ++i) {
    let c = alphabet[i];
    let key = document.querySelector(`.key[code=${c}]`);
    if (greenLetters[c]) {
      key.classList.add('green');
    } else {
      key.classList.remove('green');
    }

    let minLetters = 0;
    let maxLetters = Infinity;
    let letterCount = 0;
    let totalLetters = letters[c][0] + letters[c][1];
    let totalNeeded = clues.letters[c].min[0] + clues.letters[c].min[1];
    if (orangeClues) {
      letterCount = letters[c][curWord];
      minLetters = clues.letters[c].min[curWord];
      if (clues.letters[c]?.max[curWord])
        maxLetters = clues.letters[c].min[curWord];
    } else {
      letterCount = letters[c][0] + letters[c][1];
      minLetters = clues.letters[c].min[0] + clues.letters[c].min[1];
      if (clues.letters[c]?.max[0] && clues.letters[c]?.max[1])
        maxLetters = clues.letters[c].min[0] + clues.letters[c].min[1];
    }

    if (minLetters > letterCount) {
      key.classList.add('yellow');
      key.classList.remove('orange');
    } else if (orangeClues && totalNeeded > totalLetters) {
      key.classList.remove('yellow');
      key.classList.add('orange');
    } else {
      key.classList.remove('yellow');
      key.classList.remove('orange');
    }
    if (letterCount >= maxLetters) {
      key.classList.add('black');
    } else {
      key.classList.remove('black');
    }
  }

  // If either word is invalid, highlight the entire word.
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

async function guess() {
  let guesses = [];
  if (gameGuesses.length == 0) {
    orangeClues = !settings.hardMode;
  }
  for (let i = 0; i < puzzle.words.length; i++) {
    guesses.push('');
    for (let j = 0; j < puzzle.words[i].length; j++) {
      let c = tile([i, j]).children[0].textContent.toLowerCase();
      if (c == '') {
        throw new UserError(STRINGS['incomplete']);
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
  let str = guesses.join(' ');
  gameGuesses.push(str);
  if (puzzle.day !== undefined) {
    localStorage.setItem('crosswordle-daily', JSON.stringify({
        day: puzzle.day, lang: LANG, guesses: gameGuesses, hardMode, orangeClues}));
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
  let answerLetters = [{}, {}];
  let both = puzzle.words[0][puzzle.offsets[0]];
  let clued = [[], []];
  for (let i = 0; i < puzzle.words.length; i++) {
    for (let j = 0; j < puzzle.words[i].length; j++) {
      let c = puzzle.words[i][j];
      answerLetters[i][c] = (answerLetters[i][c] || 0) + 1;
      clued[i][j] = false;
    }
  }

  let decrement = (word, letter, index = -1) => {
    answerLetters[word][letter]--;
    // If the crossing letter is used, remove from the other word.
    if ((answerLetters[word][letter] == 0 || index === puzzle.offsets[word]) && letter === both) {
      both = null;
      answerLetters[1 - word][letter]--;
    }
  }

  let markClued = (word, pos) => {
    clued[word][pos] = true;
  }

  let result = document.createElement('div');
  let resultTiles = [];
  for (let i = 0; i < guesses.length; i++) {
    resultTiles.push([]);
    for (let j = 0; j < guesses[i].length; j++) {
      let log = document.createElement('div');
      resultTiles[i][j] = log;
      log.classList = 'tile';
      if (j == puzzle.offsets[i]) {
        log.classList.add('crossing');
      }
      let letter = document.createElement('div');
      letter.textContent = guesses[i][j].toUpperCase();
      log.appendChild(letter);
      result.appendChild(log);
    }
    if (i < guesses.length - 1) {
      let space = document.createElement('div');
      space.classList = 'empty';
      result.appendChild(space);
    }
  }

  // Mark green first.
  let wrong = 0;
  let letters = {};
  for (let i = 0; i < alphabet.length; ++i) {
    letters[alphabet[i]] = {min: [0, 0], max: [false, false]};
  }
  for (let i = 0; i < guesses.length; i++) {
    if (clues.green.length <= i)
      clues.green.push([]);
    for (let j = 0; j < guesses[i].length; j++) {
      if (clued[i][j])
        continue;
      if (guesses[i][j] == puzzle.words[i][j]) {
        clues.green[i][j] = guesses[i][j];
        if (!tile([i, j]).classList.contains('green')) {
          tile([i, j]).classList.add('green');
          decrement(i, guesses[i][j], j);
        }
        letters[guesses[i][j]].min[i]++;
        resultTiles[i][j].classList.add('green');
        markClued(i, j);
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
      if (clued[i][j])
        continue;

      clues.letters[guesses[i][j]].not.add(count - 1);
      if (answerLetters[i][guesses[i][j]]) {
        tile([i, j]).classList.add('yellow');
        resultTiles[i][j].classList.add('yellow');
        markClued(i, j);
        letters[guesses[i][j]].min[i]++;
        decrement(i, guesses[i][j]);
      }
    }
  }

  // Then mark orange
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      if (clued[i][j])
        continue;
      if (answerLetters[1 - i][guesses[i][j]]) {
        const clueClass = orangeClues ? (i == 0 ? 'orange-vert' : 'orange-horiz') : 'yellow';
        tile([i, j]).classList.add(clueClass);
        resultTiles[i][j].classList.add(clueClass);
        markClued(i, j);
        letters[guesses[i][j]].min[1 - i]++;
        letters[guesses[i][j]].max[i] = true;
        decrement(1 - i, guesses[i][j]);
      } else {
        letters[guesses[i][j]].max[0] = letters[guesses[i][j]].max[1] = true;
      }
    }
  }

  // Merge new information with existing.
  for (let i = 0; i < alphabet.length; ++i) {
    let c = alphabet[i];
    for (let j = 0; j < puzzle.words.length; ++j) {
      clues.letters[c].min[j] = Math.max(clues.letters[c].min[j], letters[c].min[j]);
      if (letters[c].max[j])
        clues.letters[c].max[j] = true;
    }
  }

  // Then do a reveal, and add to the clues row.
  let animationPromises = [];
  let startDelay = 0;
  summary += '\n';
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      let t = resultTiles[i][j];
      if (t.classList.contains('green')) {
        summary += '🟩';
      } else if (t.classList.contains('yellow')) {
        summary += '🟨';
      } else if (t.classList.contains('orange-horiz')) {
        summary += '🟧';
      } else if (t.classList.contains('orange-vert')) {
        summary += '🟧';
      } else {
        summary += '⬜';
      }
    }
    if (i < guesses.length - 1) {
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
        t.classList.remove('orange-horiz');
        t.classList.remove('orange-vert');
        if (i == 0 && j == 0)
          updateSelection([i, j]);
      }
      if (i != 1 || j != puzzle.offsets[1]) {
        animate();
        startDelay += 150;
      }
    }
  }
  if (puzzle.day !== undefined && (!wrong || gameGuesses.length >= MAX_GUESSES)) {
    // Post and fetch histogram data early to have it visible before
    // animations finish.
    const score = !wrong ? gameGuesses.length : 100;
    const prevScore = getScore(puzzle.day);
    setScore(puzzle.day, Math.min(10, score));
    postScore(`${LANG}-${puzzle.day}`, prevScore === undefined && interactive ? score : undefined);
  }
  if (animationPromises.length > 0) {
    await Promise.all(animationPromises);
  }
  updateHints();
  if (wrong && gameGuesses.length < MAX_GUESSES) {
    // TODO: Add letter animations.
    const animationOptions = {
      duration: interactive ? 300 : 0,
      easing: 'ease'
    };
    animateChange([document.querySelector('.main .grid')], () => {
      document.querySelector('.main .clues').appendChild(result);
    }, animationOptions);
    result.animate([{opacity: 0, transform: 'translateY(-100%)', offset: 0}], animationOptions);
    document.querySelector('.keyboard').scrollIntoView();
  } else {
    // Show victory screen after clues are revealed.
    let guesses = gameGuesses.length;
    let indicator = '';
    if (orangeClues)
      indicator += '🔸';
    document.getElementById('guesses').textContent = guesses;
    document.getElementById('answer').textContent = puzzle.words.join(' ');
    document.getElementById('share').onclick = function() {
      navigator.clipboard.writeText(`${puzzle.title} ${guesses}/${MAX_GUESSES}${indicator}${summary}\n${window.location.href}`);
      showMessage(STRINGS['copied-clipboard']);
    };
    finished = true;
    document.querySelector('.victory').setAttribute('result', wrong ? 'lost' : 'won');
    showVictory();
  }
}

function showVictory() {
  document.querySelector('.victory').classList.remove('hidden');
}

async function showMessage(text) {
  let div = document.querySelector('.modal');
  div.querySelector('.message').textContent = text;
  div.classList.remove('hidden');
  await div.animate([
      {opacity: 0},
      {opacity: 1, offset: 0.1},
      {opacity: 1, offset: 0.9},
      {opacity: 0}], {
      duration: 2000}).finished;
  div.classList.add('hidden');
}

init();