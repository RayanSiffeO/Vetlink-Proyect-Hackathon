// scripts/e2e-browser.mjs — E2E de navegador real (Edge headless via playwright-core)
// Uso:  node scripts/e2e-browser.mjs <baseUrl> <outDir>
// Genera reporte JSON y capturas en <outDir>. Exit 0 si todas las comprobaciones pasan.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_CORE ?? 'D:/hackaton/Programa/e2e-tools/node_modules/playwright-core';
const { chromium } = require(playwrightPath);
const edgePath = process.env.MSEDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const base = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const outDir = process.argv[3] ?? 'releases/cp2/e2e';
const shots = path.join(outDir, 'screenshots');
const repo = path.resolve(process.cwd());
fs.mkdirSync(shots, { recursive: true });

const checks = [];
const consoleErrors = [];
const startedAt = Date.now();

function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail: String(detail) });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
}

async function expectText(page, text, timeout = 15000) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout });
}

const sample = (name) => path.join(repo, 'data', 'samples', name);

const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${String(error)}`));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`);
});

try {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await expectText(page, 'Entra en la demo');
  check('login carga', true);
  await shot(page, '01-login');

  await page.locator('button[data-demo-user="laura"]').click();
  await page.waitForURL('**/patients', { timeout: 20000 });
  await expectText(page, 'Pacientes');
  await expectText(page, 'Bruno');
  await expectText(page, 'Kira');
  await expectText(page, 'Luna');
  check('login Laura y bandeja de pacientes', true);
  await shot(page, '02-pacientes');

  await page.getByLabel('Seleccionar ficheros de historia clínica').setInputFiles([
    sample('Clínica Veterinaria Vall del Sol.docx'),
    sample('export_MAS-0004587_anonimizado.xlsx'),
    sample('historial.json'),
    sample('export_clinica_norte.csv')
  ]);
  await expectText(page, 'Resultado de la importación', 30000);
  const readyCount = await page.locator('li span.badge', { hasText: 'Listo' }).count();
  const reviewCount = await page.locator('li span.badge', { hasText: 'Revisar' }).count();
  check('importación 3 formatos', readyCount >= 3, `${readyCount} READY`);
  check('CSV a revisión', reviewCount >= 1, `${reviewCount} NEEDS_REVIEW`);
  await shot(page, '03-importacion');

  await page.goto(`${base}/patients/pat_kira`, { waitUntil: 'networkidle' });
  await expectText(page, 'Kira');
  await expectText(page, 'carprofeno');
  await expectText(page, 'Encuentros');
  check('ficha canónica con alertas', true);
  await shot(page, '04-ficha-kira');

  await page.goto(`${base}/specialists`, { waitUntil: 'networkidle' });
  await expectText(page, 'Marc');
  await expectText(page, 'Elena');
  await expectText(page, 'Javier');
  check('marketplace con 3 especialistas', true);
  await shot(page, '05-marketplace');

  await page.goto(`${base}/requests/new?patient_id=pat_kira`, { waitUntil: 'networkidle' });
  await expectText(page, 'Nueva solicitud');
  await page.locator('select').nth(1).selectOption('spc_marc');
  await page.locator('textarea').first().fill('Control ocular OS y valoración de la pauta; revisar alergia a carprofeno.');
  await page.locator('input[name="urgencia"][value="ALTA"]').check();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await page.waitForURL(/\/requests\/req_/, { timeout: 20000 });
  await expectText(page, 'Resumen no identificativo');
  await page.getByRole('tab', { name: 'Briefing' }).click();
  await expectText(page, 'Briefing bloqueado');
  check('solicitud creada y briefing bloqueado', true);
  await shot(page, '06-solicitud-clinica');

  await page.locator('button[title="Cerrar sesión"]').click();
  await page.waitForURL('**/login', { timeout: 20000 });
  await page.locator('button[data-demo-user="marc"]').click();
  await page.waitForURL('**/requests', { timeout: 20000 });
  await page.locator('a[href^="/requests/req_"]').first().click();
  await page.waitForURL(/\/requests\/req_/, { timeout: 20000 });
  await expectText(page, 'Aceptar la derivación y confirmar franja');
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await expectText(page, 'Agendada', 20000);
  check('especialista acepta y agenda', true);
  await page.getByRole('tab', { name: 'Briefing' }).click();
  await expectText(page, 'VetBriefing · pre-visita', 20000);
  await expectText(page, 'Acciones prioritarias');
  check('briefing desbloqueado tras aceptar', true);
  await shot(page, '07-briefing-desbloqueado');

  await page.goto(`${base}/calendar`, { waitUntil: 'networkidle' });
  const calendarText = await page.locator('main').innerText();
  check('calendario con cita', calendarText.length > 80 && !/No se pudo/i.test(calendarText));
  await shot(page, '08-calendario');
} catch (error) {
  check('flujo E2E', false, String(error?.message ?? error));
  try { await shot(page, '99-error'); } catch { /* la captura es opcional */ }
} finally {
  await browser.close();
}

const failed = checks.filter((item) => !item.ok).length;
const expectedHttpGuards = /(401 \(Unauthorized\)|403 \(Forbidden\))/;
const expectedConsole = consoleErrors.filter((item) => expectedHttpGuards.test(item));
const unexpectedConsole = consoleErrors.filter((item) => !expectedHttpGuards.test(item));
const report = {
  suite: 'VetLink Browser E2E (Edge headless)',
  base_url: base,
  generated_at: new Date().toISOString(),
  duration_ms: Date.now() - startedAt,
  total: checks.length,
  passed: checks.length - failed,
  failed,
  console_errors: unexpectedConsole,
  expected_console_errors: expectedConsole,
  expected_console_errors_note: '401 = comprobacion de sesion sin cookie; 403 = briefing bloqueado a proposito antes de aceptar',
  checks
};
fs.writeFileSync(path.join(outDir, 'browser-report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(`\nRESULTADO BROWSER E2E: ${report.passed}/${report.total} PASS, ${failed} FAIL`);
console.log(`capturas: ${shots}`);
if (report.console_errors.length > 0) console.log(`errores de consola: ${report.console_errors.length}`);
process.exit(failed > 0 ? 1 : 0);
