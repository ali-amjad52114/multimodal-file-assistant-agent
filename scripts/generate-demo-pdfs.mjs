/**
 * Generates the CV-104 demo document pack into public/demo/:
 *   - 3 minimal, text-extractable PDFs (uncompressed content streams, so
 *     pdfplumber — and even a raw byte search — can find every string)
 *   - 3 .txt mirrors with identical content (extraction fallback layer)
 *
 * Run once: node scripts/generate-demo-pdfs.mjs
 * Self-verifies that key strings are present in the raw PDF bytes.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'demo');

const DRAWING = `ELECTRICAL DRAWING E-3401 REV C - CONVEYOR CV-104
Sheet 1 of 1 - MCC-3 Single Line & Control

MCC-3 BUCKET 4B - CONVEYOR CV-104 MOTOR STARTER
Supply: 480V 3PH 60Hz from MCC-3 main bus
Breaker: CB-104, 40A thermal-magnetic
Drive: VFD-104 (see OEM manual for fault codes)
Overload: OL-104 set at 32A
Motor: M-104, 25 HP, 480V, FLA 31A

CONTROL CIRCUIT (120V from CPT-3):
Start permissives (all required):
- E-stop string ES-1 healthy
- Upstream conveyor CV-103 running (permissive relay CR-103)
- Belt drift switches DS-104A / DS-104B not tripped
- Pull-cord switches PC-104 (1-4) reset

INTERLOCKS:
- CV-104 trips if downstream conveyor CV-105 stops (interlock relay CR-105)
- Zero-speed switch ZS-104 alarms after 5s below setpoint

NOTES:
1. All work on MCC-3 requires isolation at CB-104 and bus verification.
2. Refer to site procedure SOP-ELEC-07 before opening any bucket.`;

const MANUAL = `ACME DRIVES VFD-2000 SERIES - INSTALLATION & TROUBLESHOOTING MANUAL
Section 6: Fault Codes and Corrective Actions

FAULT CODE TABLE:
F0A1 Overvoltage - DC bus above limit. Check supply, decel time.
F0B2 Undervoltage - DC bus below limit. Check supply, loose terminals.
F0C1 Overcurrent - Output current exceeded 200% of drive rating.
F0D3 Overtemperature - Heatsink above limit. Check fans and filters.
F0E4 Ground fault - Leakage current detected. Megger motor and cable.

F0C1 OVERCURRENT - DETAILS:
Possible causes:
1. Mechanical jam or blockage on the driven load
2. Motor overload (excessive material load, belt drag)
3. Short circuit in motor cable or terminal box
4. Loose power wiring at drive output or motor terminals
5. Failed motor bearing causing mechanical drag
6. Acceleration time set too short for load inertia

Corrective actions:
- Inspect the driven equipment for jams before resetting
- Verify motor current against nameplate FLA
- Check output wiring and motor terminal tightness
- Review acceleration/deceleration parameters (P2.03 / P2.04)

WARNING: Do not reset the drive repeatedly after F0C1.
Repeated resets into a fault can damage the drive and motor.
If the fault returns after one reset, isolate and investigate.`;

const PROCEDURE = `SITE PROCEDURE SOP-ELEC-07 REV 4
ELECTRICAL ISOLATION AND MCC ACCESS

1. SCOPE
This procedure applies to all work on motor control centers (MCC),
including opening any MCC bucket, resetting breakers, and inspecting
motor starters or drives.

2. LOCKOUT/TAGOUT (LOTO) - MANDATORY
Lockout/Tagout is required before opening any MCC bucket.
Steps:
2.1 Obtain a LOTO permit from the shift supervisor.
2.2 Identify the isolation point on the drawing (breaker or disconnect).
2.3 Open, lock and tag the breaker. Apply personal lock.
2.4 Verify zero energy with a rated tester at the bucket terminals.
2.5 Record permit number and isolation verification on the permit.

3. RESET AND RE-ENERGIZATION
3.1 Breaker or drive resets require supervisor authorization.
3.2 A completed LOTO permit must be attached to the work order.
3.3 After reset, monitor the first start from a safe position.

4. ESCALATION
If a fault trips again after one authorized reset, stop work and
escalate to the reliability engineer. Do not attempt repeated resets.`;

/** Build a minimal single-page PDF with an uncompressed text content stream. */
function makePdf(text) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const lines = text.split('\n');
  let content = 'BT /F1 10 Tf 50 780 Td 13 TL\n';
  for (const line of lines) content += `(${esc(line)}) Tj T*\n`;
  content += 'ET';

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return pdf;
}

const DOCS = [
  { base: 'CV-104-drawing', text: DRAWING, mustContain: ['CV-104', 'CB-104', 'SOP-ELEC-07'] },
  { base: 'VFD-manual', text: MANUAL, mustContain: ['F0C1', 'Overcurrent', 'Mechanical jam'] },
  { base: 'site-procedure', text: PROCEDURE, mustContain: ['Lockout/Tagout', 'MCC bucket', 'supervisor'] },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const doc of DOCS) {
  const pdf = makePdf(doc.text);

  // Self-verify: content streams are uncompressed ASCII, so key strings must
  // be findable in the raw bytes (escaped parens accounted for by mustContain
  // choices — none contain parentheses).
  for (const key of doc.mustContain) {
    if (!pdf.includes(key)) {
      throw new Error(`Verification failed: "${key}" not found in ${doc.base}.pdf raw bytes`);
    }
  }

  writeFileSync(join(OUT_DIR, `${doc.base}.pdf`), pdf, 'latin1');
  writeFileSync(join(OUT_DIR, `${doc.base}.txt`), doc.text, 'utf8');
  console.log(`ok: ${doc.base}.pdf (${pdf.length} bytes) + ${doc.base}.txt`);
}

console.log('Demo pack generated in', OUT_DIR);
