// Validates every fixture with the official HL7 FHIR validator (same version as pulse-fhir-gateway).
// Downloads the validator into .cache/ on first use. Needs Java 17 or later on PATH or in JAVA_HOME.
// Fails on any error; prints warnings and information so they can be read.
import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const VERSION = '7.0.2';
const JAR = join('.cache', `validator_cli-${VERSION}.jar`);
const URL = `https://github.com/hapifhir/org.hl7.fhir.core/releases/download/${VERSION}/validator_cli.jar`;

if (!existsSync(JAR)) {
  mkdirSync('.cache', { recursive: true });
  console.log(`Downloading HL7 validator ${VERSION}`);
  const res = await fetch(URL);
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(JAR));
}

const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
const files = readdirSync('fixtures').filter((f) => f.endsWith('.json')).map((f) => join('fixtures', f));

try {
  execFileSync(java, ['-jar', JAR, ...files, '-version', '4.0.1', '-ig', 'hl7.fhir.uv.ips#1.1.0', '-output', 'validation.json'], { stdio: 'inherit' });
} catch {
  // The validator exits non-zero when it finds errors; the summary below says which.
}

const outcome = JSON.parse(readFileSync('validation.json', 'utf8'));
const outcomes = outcome.resourceType === 'Bundle' ? outcome.entry.map((e) => e.resource) : [outcome];
let errors = 0;
for (const oo of outcomes) {
  const file = oo.extension?.find((x) => x.url.endsWith('operationoutcome-file'))?.valueString ?? '?';
  for (const i of oo.issue ?? []) {
    if (i.severity === 'error' || i.severity === 'fatal') errors += 1;
    if (i.severity !== 'information') console.log(`${i.severity.toUpperCase()} ${file}: ${i.details?.text ?? i.diagnostics}`);
  }
}
console.log(`${files.length} fixtures, ${errors} error(s)`);
process.exit(errors > 0 ? 1 : 0);
