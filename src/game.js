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

const alphabet = 'abcdefghijklmnopqrstuvwxyz';
let dictionary = async function() {
  let result = await fetch('third_party/aspell6-en/en-common.txt');
  let words = await result.text();
  let dict = {};
  words.split(/\r?\n/).forEach(word => {
    dict[word] = true;
  });
  return dict;
}();

function initKeyboard() {
  let keyboard = document.querySelector('.keyboard');
  let addKey = function(gridArea, text, code) {
    let key = document.createElement('div');
    key.className = 'key';
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
  addKey('R', 'Enter', 'Enter');
  addKey('B', 'Erase', 'Backspace');
  document.addEventListener('keydown', (evt) => {
    if (type(evt.key))
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

let puzzle = null;
let summary = '';
function init() {
  document.getElementById('close-settings').addEventListener('click', () => {
    document.querySelector('.settings').style.display = '';
  });
  document.getElementById('show-settings').addEventListener('click', () => {
    document.querySelector('.settings').style.display = 'block';
  });
  document.getElementById('close-victory').addEventListener('click', () => {
    document.querySelector('.victory').style.display = '';
  });
  initKeyboard();
  let args = parse(window.location.search.substr(1));
  let title = '';
  let words;
  if (args.puzzle) {
    title = 'Custom Crosswordle';
    words = decode(args.puzzle).split('+');
  } else {
    let day = Math.floor((Date.now() - (new Date(2022,0,30,0,0,0,0))) / (60 * 60 * 24 * 1000));
    if (PUZZLES.length > day) {
      title = `Crosswordle ${day}`;
      words = PUZZLES[day].split(' ');
    } else {
      throw Error('No more puzzles available.');
    }
  }
  document.title = document.querySelector('.title h1').textContent = title;
  summary = title;

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
  let grid = document.querySelector('.grid');
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
  document.documentElement.style.setProperty('--size', Math.max(words[0].length, words[1].length));
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

function type(code) {
  if (code == 'Enter') {
    tryGuess();
    return true;
  } else if (code == 'Backspace') {
    let cur = tile(selected);
    if (cur && cur.children[0].textContent != '') {
      // Erase selected cell if non-empty
    } else if (selected[1] > 0) {
      updateSelection([selected[0], selected[1] - 1]);
    } else if (selected[0] == 1) {
      updateSelection([0, puzzle.words[0].length - 1]);
    }
    setTile(tile(selected), '');
    return true;
  } else if (code.length == 1) {
    setTile(tile(selected), code.toUpperCase());
    if (selected[1] < puzzle.words[selected[0]].length) {
      if (selected[0] == 0 && selected[1] == puzzle.words[selected[0]].length - 1) {
        updateSelection([1, 0]);
      } else {
        updateSelection([selected[0], selected[1] + 1]);
      }
    }
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
  console.log(this);
}

class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}

async function tryGuess() {
  try {
    await guess();
  } catch (err) {
    if (err instanceof UserError) {
      showError(err.message);
    } else {
      throw err;
    }
  }
}

async function guess() {
  let answerLetters = {};
  for (let i = 0; i < puzzle.words.length; i++) {
    for (let j = 0; j < puzzle.words[i].length; j++) {
      if (i == 1 && j == puzzle.offsets[1])
        continue;
      let c = puzzle.words[i][j];
      answerLetters[c] = (answerLetters[c] || 0) + 1;
    }
  }
  let guesses = [];
  for (let i = 0; i < puzzle.words.length; i++) {
    guesses.push('');
    for (let j = 0; j < puzzle.words[i].length; j++) {
      let c = tile([i, j]).children[0].textContent;
      if (c == '') {
        throw new UserError('Incomplete word');
      }
      guesses[i] += c.toLowerCase();
    }
  }
  let dict = await dictionary;
  for (let i = 0; i < guesses.length; i++) {
    if (!dict[guesses[i]]) {
      throw new UserError('Invalid word ' + guesses[i]);
    }
  }

  // Mark green first.
  let wrong = 0;
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      if (i == 1 && j == puzzle.offsets[1])
        continue;
      if (guesses[i][j] == puzzle.words[i][j]) {
        document.querySelector(`.key[code=${guesses[i][j]}]`).classList.add('green');
        tile([i, j]).classList.add('green');
        answerLetters[guesses[i][j]]--;
      } else {
        wrong++;
      }
    }
  }

  // Then mark yellow
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      if (i == 1 && j == puzzle.offsets[1])
        continue;
      if (guesses[i][j] != puzzle.words[i][j]) {
        if (answerLetters[guesses[i][j]]) {
          document.querySelector(`.key[code=${guesses[i][j]}]`).classList.add('yellow');
          tile([i, j]).classList.add('yellow');
          answerLetters[guesses[i][j]]--;
        } else if (!(guesses[i][j] in answerLetters)) {
          document.querySelector(`.key[code=${guesses[i][j]}]`).classList.add('black');
        }
      }
    }
  }

  // Then do a reveal, and add to the clues row.
  let animationPromises = [];
  let delay = 0;
  let result = document.createElement('div');
  summary += '\n';
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      let t = tile([i, j]);
      if (i != 1 || j != puzzle.offsets[1]) {
        async function animate() {
          let a1 = t.animate([
            {transform: 'none'},
            {transform: 'rotateY(180deg)'}], {
              duration: 600,
              delay,
              fill: wrong ? 'none' : 'forwards'}).finished;
          animationPromises.push(a1);
          if (wrong == 0) {
            return;
          }
          let a2 = t.animate([
            {transform: 'rotateY(180deg)'},
            {transform: 'none'}], {
            fill: 'backwards',
            duration: 600,
            delay: 2400,
          }).finished;
          animationPromises.push(a2);
          await a1;
          setTile(t, '', 1);
          await a2;
          setTile(t, '', 0);
          t.classList.remove('green');
          t.classList.remove('yellow');
          if (i == 0 && j == 0)
            updateSelection([i, j]);
        }
        animate();
        delay += 150;
      }
      let log = document.createElement('div');
      log.classList = 'tile';
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
  // TODO: Add animation.
  if (wrong) {
    document.querySelector('.clues').appendChild(result);
  } else {
    // Show victory screen after clues are revealed.
    await Promise.all(animationPromises);
    document.getElementById('guesses').textContent = (summary.split('\n').length - 1);
    document.getElementById('share').onclick = function() {
      navigator.clipboard.writeText(`${summary}\n${window.location.href}`);
    }
    document.querySelector('.victory').style.display = 'block';
  }
  document.querySelector('.keyboard').scrollIntoView();
}

async function showError(text) {
  let div = document.querySelector('.error');
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

document.addEventListener('DOMContentLoaded', init)