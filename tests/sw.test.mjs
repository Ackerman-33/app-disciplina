import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const swSource = readFileSync(path.join(root, 'sw.js'), 'utf8');

function readAssets() {
  const list = swSource.match(/const ASSETS = (\[[\s\S]*?\]);/);
  assert.ok(list, 'no encontré ASSETS en sw.js');
  return new Function(`return ${list[1]}`)();
}

// Si UN solo archivo de la lista no existe, cache.addAll falla y la app NO funciona offline.
test('todos los archivos de ASSETS en sw.js existen', () => {
  const assets = readAssets();
  assert.ok(assets.length > 5);
  for (const a of assets) {
    if (a === './') continue;
    assert.ok(existsSync(path.join(root, a)), `falta el archivo ${a}`);
  }
});

// Al revés: si agrego un archivo y me olvido de listarlo, no estaría disponible offline.
test('todo lo de js/, fonts/ e icons/ está listado en ASSETS', () => {
  const assets = readAssets();
  for (const dir of ['js', 'fonts', 'icons']) {
    for (const f of readdirSync(path.join(root, dir))) {
      assert.ok(assets.includes(`./${dir}/${f}`), `./${dir}/${f} no está en ASSETS`);
    }
  }
});
