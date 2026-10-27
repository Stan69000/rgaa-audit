// src/shared.js
// Accès aux modules partagés avec l'extension (extension/shared/).
// En développement ils sont lus dans le dépôt ; dans le paquet npm, `npm pack`
// les copie au préalable dans cli/vendor/ (script prepack).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CANDIDATE_DIRS = [
  path.join(__dirname, '..', 'vendor'),
  path.join(__dirname, '..', '..', 'extension', 'shared'),
];

function sharedPath(fileName) {
  for (const dir of CANDIDATE_DIRS) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Module partagé introuvable : ${fileName}`);
}

function requireShared(fileName) {
  return require(sharedPath(fileName));
}

const sourceCache = new Map();
function readSharedSource(fileName) {
  if (!sourceCache.has(fileName)) sourceCache.set(fileName, fs.readFileSync(sharedPath(fileName), 'utf8'));
  return sourceCache.get(fileName);
}

module.exports = { sharedPath, requireShared, readSharedSource };
