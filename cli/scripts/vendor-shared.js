// Copie les modules partagés avec l'extension dans cli/vendor/ avant `npm pack` / `npm publish` :
// le paquet npm ne contient que le dossier cli/.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', '..', 'extension', 'shared');
const target = path.join(__dirname, '..', 'vendor');

fs.mkdirSync(target, { recursive: true });
for (const file of fs.readdirSync(source).filter((f) => f.endsWith('.js'))) {
  fs.copyFileSync(path.join(source, file), path.join(target, file));
  console.log(`vendor/${file}`);
}
