#!/usr/bin/env node

import process from 'node:process';
import fs from 'node:fs';
import readline from 'node:readline';

function hasCommonLetter(word1, word2) {
  for (let i = 0; i < word1.length; i++) {
    if (word2.indexOf(word1[i]) != -1)
      return true;
  }
  return false;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; --i) {
    // Swap with a random index <= i.
    let j = Math.floor(Math.random() * (i + 1));
    let tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

const CHUNK_SIZE = 100;
const LANGS = ['en', 'fr', 'es'];

const HELP = [
  ['--help', 'Show this help', false],
  ['--lang', 'Language', 'en'],
  ['--shuffle', 'Shuffle words', false],
  ['--allow-misspell', 'Allow misspelled words', false],
  ['--allow-duplicate', 'Allow repeated words', false],
  ['--dry-run', `Run without modifying files`, false],
  ['--list', `Export word list`, false],
];
const HELP_MAP = {};
for (let entry of HELP) {
  HELP_MAP[entry[0]] = entry;
}

function parse(args) {
  let result = {};
  for (let entry of HELP) {
    if (entry[2])
      result[entry[0].substring(2)] = entry[2];
  }
  for (let i = 2; i < args.length; ++i) {
    let split = args[i].split('=');
    let entry = HELP_MAP[split[0]];
    if (!entry) {
      console.error(`Unrecognized argument: ${split[0]}`);
      return undefined;
    }
    if (typeof(entry[2]) == 'boolean') {
      result[entry[0].substring(2)] = true;
    } else {
      let param = split.length > 1 ? split[1] : args[++i];
      if (param === undefined || param.startsWith('--')) {
        console.error(`Missing argument for ${split[0]}`);
        return undefined;
      }
      result[entry[0].substring(2)] = param;
    }
  }
  return result;
}

async function main(argv) {

  const args = parse(argv);
  if (args === undefined || args.help) {
    console.log('Arguments:');
    for (let entry of HELP) {
      console.log(`${entry[0]}\t${entry[1]}${entry[2] ? ` (default ${entry[2]})`: ''}`);
    }
    return;
  }
  const dataFile = `./src/lang/${args.lang}.json`;
  const data = JSON.parse(fs.readFileSync(dataFile));
  let index = data.puzzle_count;
  let filename = (idx) => `./src/puzzles/${args.lang}/${(idx * CHUNK_SIZE).toString().padStart(6, '0')}.json`

  if (args['list']) {
    for (let i = 0; i < Math.ceil(data.puzzle_count / CHUNK_SIZE); ++i) {
      const data = JSON.parse(fs.readFileSync(filename(i)));
      for (const puzzle of data.puzzles) {
        console.log(`${puzzle.puzzle}\t${puzzle.hint || ''}\t${puzzle.info || ''}`);
      }
    }
    return;
  }

  let previousPuzzles = new Set();
  let dict = new Set();
  if (!args['allow-misspell']) {
    const files = fs.readdirSync(`./third_party/aspell6/${args.lang}/`);
    for (let file of files) {
      if (!file.startsWith('words-'))
        continue;
      const words = fs.readFileSync(`./third_party/aspell6/${args.lang}/${file}`).toString().split('\n').filter(w => w.length > 0);
      for (let word of words) {
        dict.add(word);
      }
    }
    console.log(`Loaded ${dict.size} words from dictionary`);
  }
  if (!args['allow-duplicate']) {
    for (let i = 0; i < Math.ceil(data.puzzle_count / CHUNK_SIZE); ++i) {
      const data = JSON.parse(fs.readFileSync(filename(i)));
      for (const puzzle of data.puzzles) {
        previousPuzzles.add(puzzle.puzzle);
      }
    }
    console.log(`Loaded ${previousPuzzles.size} previous puzzles`);
  }
  const chunkCount = Math.ceil(data.puzzle_count / CHUNK_SIZE);
  let chunks = Math.floor(index / CHUNK_SIZE);
  let chunk_index = index % CHUNK_SIZE;
  const baseDate = data.base_date.split('-').map(n => parseInt(n));
  const baseIndex = data.base_index || 0;

  let loadChunk = (idx) => {
    if (idx >= chunkCount)
      return {puzzles: []};
    return JSON.parse(fs.readFileSync(filename(idx)));
  }
  let writeChunk = (idx, data) => {
    if (!args['dry-run'])
      fs.writeFileSync(filename(idx), JSON.stringify(data, undefined, 2));
  }
  let chunk = loadChunk(chunks);
  if (chunk.puzzles.length != chunk_index) {
    console.error(`Expected ${chunk_index} puzzles in chunk ${index}, found ${chunk.puzzles.length}!`);
  }

  let toadd = [];
  const rl = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
  for await (const line of rl) {
    const fields = line.split('\t');

    const data = {date: '', puzzle: fields[0]};
    if (fields[1])
      data.hint = fields[1];
    if (fields[2])
      data.info = fields[2];
    if (fields[3])
      data.author = fields[3];
    const words = data.puzzle.split(' ');

    let errors = 0;
    if (words.length != 2) {
      console.error(`Expected 2 words: ${data.puzzle}`);
      continue;
    }
    if (!hasCommonLetter(words[0], words[1])) {
      console.error(`No common letter: ${data.puzzle}`);
      ++errors;
    }
    if (dict.size > 0 && !dict.has(words[0])) {
      ++errors;
      console.error(`Word not in dictionary: ${words[0]}`);
    }
    if (dict.size > 0 && !dict.has(words[1])) {
      ++errors;
      console.error(`Word not in dictionary: ${words[1]}`);
    }
    if (previousPuzzles.has(data.puzzle)) {
      ++errors;
      console.error(`Duplicate puzzle: ${data.puzzle}`);
    }
    if (errors)
      continue;

    if (!args['allow-duplicate']) {
      previousPuzzles.add(data.puzzle);
    }
    toadd.push(data);
  }
  if (args.shuffle) {
    toadd = shuffle(toadd);
  }
  let lastDate = null;
  for (const puzzle of toadd) {
    puzzle.date = (new Date(baseDate[0], baseDate[1] - 1, baseDate[2] - baseIndex + index)).toISOString().substring(0,10);
    lastDate = puzzle.date;
    chunk.puzzles.push(puzzle);
    ++index;
    ++chunk_index;
    ++data.puzzle_count
    let nextChunks = Math.floor(index / CHUNK_SIZE);
    if (nextChunks != chunks) {
      writeChunk(chunks, chunk);
      chunk = loadChunk(nextChunks);
      chunks = nextChunks;
    }
  }
  console.log(`Added ${toadd.length} puzzles ending ${lastDate}`);
  writeChunk(chunks, chunk);
  if (!args['dry-run'])
    fs.writeFileSync(dataFile, JSON.stringify(data, undefined, 2));
}

await main(process.argv);
