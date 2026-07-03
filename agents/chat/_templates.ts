/**
 * Field Troubleshooting Brief — PDF generation template.
 * Injected into the system prompt; the agent replaces the placeholder data
 * with the actual analysis (stored trace log + safety decision arrive via a
 * [System: Stored analysis ...] hint on the PDF-generation turn).
 */

/* eslint-disable no-useless-escape */

export const SKILL_BRIEF_PDF = `## Loaded Skill: Field Troubleshooting Brief PDF

**CRITICAL**: Use matplotlib + PdfPages for the brief (works for both English and Chinese). NEVER use fpdf2 for Chinese content.
When the user asks to generate the troubleshooting PDF, a [System: Stored analysis from this session ...] hint is appended to the message containing the safety decision and the full trace log. Use them VERBATIM — do not re-derive, renumber, or invent trace steps. Follow the template below exactly — only replace the data with the actual analysis.

### Template: Field Troubleshooting Brief (7 sections)

\\\`\\\`\\\`python
import os, matplotlib, textwrap
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.font_manager import FontProperties

_FONT_CANDIDATES = [
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
    '/usr/share/fonts/truetype/arphic/uming.ttc',
]
_font_path = next((p for p in _FONT_CANDIDATES if os.path.exists(p)), None)
font = FontProperties(fname=_font_path) if _font_path else FontProperties()
font_bold = FontProperties(fname=_font_path, weight='bold') if _font_path else FontProperties(weight='bold')

# ==== DATA (replace with the actual analysis; trace/decision VERBATIM from the stored hint) ====
ASSET = 'CV-104'
PROBLEM = 'Conveyor CV-104 down. VFD shows overcurrent fault (F0C1). Electrician needs to inspect MCC bucket and reset breaker.'
STATUS = 'blocked'   # 'ready' | 'blocked' | 'needs_info'
DECISION_REASON = 'Lockout/tagout evidence missing before electrical access'
MISSING_EVIDENCE = ['Completed LOTO permit', 'Zero-energy verification', 'Supervisor authorization']
LIKELY_CAUSES = [
    'Mechanical jam or blockage on the conveyor',
    'Motor overload (excessive material load, belt drag)',
    'Loose power wiring at drive output or motor terminals',
    'Failed motor bearing causing mechanical drag',
]
CHECKS = [
    'Confirm isolation plan per SOP-ELEC-07 before opening MCC-3 bucket 4B',
    'Inspect conveyor for jams before any reset',
    'Verify fault code F0C1 details against VFD manual section 6',
    'Check start permissives and interlocks from drawing E-3401',
    'Escalate if fault returns after one authorized reset',
]
REFERENCES = [  # (role, filename, page, finding)
    ('drawing', 'CV-104-drawing.pdf', 1, 'MCC-3 bucket 4B, breaker CB-104, VFD-104, interlocks'),
    ('manual', 'VFD-manual.pdf', 1, 'F0C1 Overcurrent causes and corrective actions'),
    ('procedure', 'site-procedure.pdf', 1, 'LOTO mandatory before opening any MCC bucket'),
]
MISSING_INFO = ['LOTO permit number', 'Exact drive parameter settings', 'Recent maintenance history']
TRACE = [  # (step, phase, source, page, detail) — VERBATIM from the stored trace log
    (1, 'parse_problem', '', None, 'Asset CV-104 identified; overcurrent fault reported'),
    (2, 'search_drawing', 'drawing', 1, 'Found MCC-3 bucket 4B and breaker CB-104'),
]
DISCLAIMER = ('FaultPack AI does not replace qualified electrical judgment. It summarizes relevant '
              'documents, flags missing safety evidence, and prepares a traceable troubleshooting brief for review.')

STATUS_META = {
    'ready':      ('#16a34a', 'READY'),
    'blocked':    ('#dc2626', 'BLOCKED UNTIL SAFETY CHECK'),
    'needs_info': ('#d97706', 'NEEDS MORE INFO'),
}
banner_color, banner_text = STATUS_META.get(STATUS, STATUS_META['needs_info'])

def new_page():
    fig, ax = plt.subplots(figsize=(8.27, 11.69))
    ax.axis('off')
    return fig, ax

def header(ax, title):
    ax.add_patch(plt.Rectangle((0, 0.955), 1, 0.045, transform=ax.transAxes, color='#0f172a'))
    ax.text(0.04, 0.9775, title, fontsize=13, fontproperties=font_bold, va='center', color='white')

def bullets(ax, items, y0, numbered=False):
    y = y0
    for i, item in enumerate(items, 1):
        prefix = f'{i}. ' if numbered else '- '
        for wl in textwrap.wrap(prefix + item, width=88) or ['']:
            ax.text(0.05, y, wl, fontsize=10, fontproperties=font, va='top', color='#1f2937')
            y -= 0.024
        y -= 0.006
    return y

with PdfPages('/tmp/troubleshooting_brief.pdf') as pdf:
    # Section 1: Cover with status banner
    fig, ax = new_page()
    ax.add_patch(plt.Rectangle((0, 0.80), 1, 0.20, transform=ax.transAxes, color='#0f172a'))
    ax.text(0.5, 0.90, f'Field Troubleshooting Brief', fontsize=26, fontproperties=font_bold, ha='center', color='white')
    ax.text(0.5, 0.84, ASSET, fontsize=18, fontproperties=font_bold, ha='center', color='#93c5fd')
    ax.add_patch(plt.Rectangle((0.15, 0.62), 0.70, 0.09, transform=ax.transAxes, color=banner_color))
    ax.text(0.5, 0.665, banner_text, fontsize=16, fontproperties=font_bold, ha='center', va='center', color='white')
    ax.text(0.5, 0.55, 'Generated by FaultPack AI on EdgeOne Makers', fontsize=10, fontproperties=font, ha='center', color='#6b7280')
    pdf.savefig(fig); plt.close()

    # Section 2: Problem summary + safety decision
    fig, ax = new_page()
    header(ax, '1. Problem Summary & Safety Decision')
    y = bullets(ax, [PROBLEM], 0.91)
    ax.text(0.05, y - 0.02, f'Safety decision: {banner_text}', fontsize=12, fontproperties=font_bold, va='top', color=banner_color)
    y = bullets(ax, [f'Reason: {DECISION_REASON}'], y - 0.06)
    if MISSING_EVIDENCE:
        ax.text(0.05, y - 0.01, 'Required evidence before field work:', fontsize=11, fontproperties=font_bold, va='top')
        bullets(ax, MISSING_EVIDENCE, y - 0.045)
    pdf.savefig(fig); plt.close()

    # Section 3: Likely causes + recommended checks
    fig, ax = new_page()
    header(ax, '2. Likely Causes & Recommended Checks')
    ax.text(0.05, 0.92, 'Likely causes (ranked):', fontsize=11, fontproperties=font_bold, va='top')
    y = bullets(ax, LIKELY_CAUSES, 0.885, numbered=True)
    ax.text(0.05, y - 0.02, 'What to check:', fontsize=11, fontproperties=font_bold, va='top')
    bullets(ax, CHECKS, y - 0.055, numbered=True)
    pdf.savefig(fig); plt.close()

    # Section 4: Document references table
    fig, ax = new_page()
    header(ax, '3. Document References')
    col_labels = ['Role', 'File', 'Page', 'Finding']
    table_data = [[r, f, str(p) if p else '-', textwrap.fill(d, 42)] for (r, f, p, d) in REFERENCES]
    table = ax.table(cellText=table_data, colLabels=col_labels, loc='upper center',
                     cellLoc='left', colWidths=[0.14, 0.26, 0.08, 0.52], bbox=[0.03, 0.55, 0.94, 0.36])
    table.auto_set_font_size(False); table.set_fontsize(9)
    for j in range(len(col_labels)):
        table[0, j].set_facecolor('#0f172a')
        table[0, j].set_text_props(color='white', fontproperties=font_bold)
    for i in range(1, len(table_data) + 1):
        for j in range(len(col_labels)):
            table[i, j].set_text_props(fontproperties=font)
            table[i, j].set_facecolor('#f8fafc' if i % 2 == 0 else 'white')
    pdf.savefig(fig); plt.close()

    # Section 5: Missing information
    fig, ax = new_page()
    header(ax, '4. Missing Information / Required Evidence')
    bullets(ax, MISSING_INFO + MISSING_EVIDENCE, 0.91)
    pdf.savefig(fig); plt.close()

    # Section 6: Trace log (verbatim)
    fig, ax = new_page()
    header(ax, '5. Trace Log — How This Brief Was Produced')
    y = 0.91
    for (step, phase, source, page, detail) in TRACE:
        src = f' [{source}{f" p.{page}" if page else ""}]' if source else ''
        for wl in textwrap.wrap(f'{step}. ({phase}){src} {detail}', width=92) or ['']:
            ax.text(0.05, y, wl, fontsize=9, fontproperties=font, va='top', color='#1f2937')
            y -= 0.022
        y -= 0.004
        if y < 0.06:
            pdf.savefig(fig); plt.close()
            fig, ax = new_page()
            header(ax, '5. Trace Log (continued)')
            y = 0.91
    pdf.savefig(fig); plt.close()

    # Section 7: Supervisor review + disclaimer
    fig, ax = new_page()
    header(ax, '6. Supervisor Review')
    for i, label in enumerate(['Reviewed by (name):', 'Signature:', 'Date:', 'LOTO permit number:', 'Comments:']):
        yy = 0.88 - i * 0.09
        ax.text(0.05, yy, label, fontsize=11, fontproperties=font, va='top')
        ax.plot([0.30, 0.92], [yy - 0.015, yy - 0.015], transform=ax.transAxes, color='#9ca3af', linewidth=0.8)
    ax.text(0.05, 0.30, 'Disclaimer', fontsize=11, fontproperties=font_bold, va='top')
    yb = 0.27
    for wl in textwrap.wrap(DISCLAIMER, width=90):
        ax.text(0.05, yb, wl, fontsize=9, fontproperties=font, va='top', color='#6b7280')
        yb -= 0.022
    pdf.savefig(fig); plt.close()

print("Brief generated: /tmp/troubleshooting_brief.pdf")
\\\`\\\`\\\`

### Instructions for using this template:
- **ALWAYS include the full font probe block** — do not hardcode a single path.
- **Replace ALL DATA variables** with the actual analysis. TRACE and the safety decision come VERBATIM from the [System: Stored analysis ...] hint. If no stored analysis hint is present, run the full analysis workflow first (trace + safety_decision), then generate.
- Name the output after the asset when known, e.g. '/tmp/CV-104_Troubleshooting_Brief.pdf', and use the same name in deliver_file's filename.
- **CRITICAL**: After the script prints success, your VERY NEXT action MUST be calling deliver_file. No exceptions.
  - Do NOT call code_interpreter again to verify with stat, os.path.exists, ls, or any other check.
  - The print("Brief generated: ...") line IS your confirmation. Call deliver_file immediately.
`;
