import * as ExcelJS from 'exceljs';

/** Required office hours per working day. */
export const REQUIRED_DAILY_HOURS = 9;
const HALF_DAY_REQUIRED_HOURS = REQUIRED_DAILY_HOURS / 2;


const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

export interface ReportEmployee {
    id: number;
    code: string;
    name: string;
    department: string | null;
    team: string | null;
    weekendDays: number[];
}

export interface ReportRecord {
    employeeId: number;
    date: string; // YYYY-MM-DD
    status: string;
    checkIn: Date | null;
    checkOut: Date | null;
    workHours: number | null;
}

// ─── Dates (all UTC midnight, matching how attendance dates are stored) ──────

export const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const fmtShort = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;

/** Today in Bangladesh (UTC+6) as a UTC-midnight date. */
export function todayBd(): Date {
    const bd = new Date(Date.now() + 6 * 3_600_000);
    return new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()));
}

/** Most recent Monday on or before `d`. */
function weekStartOf(d: Date): Date {
    return addDays(d, -((d.getUTCDay() + 6) % 7));
}

export function lastWeekRange(today: Date): { start: Date; end: Date } {
    const start = addDays(weekStartOf(today), -7);
    return { start, end: addDays(start, 6) };
}

export function thisMonthRange(today: Date): { start: Date; end: Date } {
    return {
        start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
        end: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)),
    };
}

export interface ReportWeek {
    index: number;
    start: Date; // clipped to the report range
    end: Date;
    days: Date[];
}

/** Splits [start, end] into Monday–Sunday weeks; first/last week are clipped to the range. */
export function splitWeeks(start: Date, end: Date): ReportWeek[] {
    const weeks: ReportWeek[] = [];
    let cursor = weekStartOf(start);
    while (cursor <= end) {
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const day = addDays(cursor, i);
            if (day >= start && day <= end) days.push(day);
        }
        weeks.push({ index: weeks.length + 1, start: days[0], end: days[days.length - 1], days });
        cursor = addDays(cursor, 7);
    }
    return weeks;
}

// ─── Per-day calculation ─────────────────────────────────────────────────────

const MISSING = '--'; // a punch that was never recorded
const WEEKOFF = 'W';

interface DayCell {
    /** In / Out cell text: a time, or a marker (W, C, S, H, L, A) */
    inText: string;
    outText: string;
    hours: number | null;
    /** worked − required, so negative = shortage, positive = extra; null when nothing is required */
    balance: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const LEAVE_MARKERS: Record<string, string> = {
    casual_leave: 'C',
    sick_leave: 'S',
    holiday: 'H',
    on_leave: 'L',
};

/** Check-in/out are stored as wall-clock time in UTC fields; shown as h:mm like the office sheet. */
function fmtTime(d: Date | null): string {
    if (!d) return MISSING;
    const h = d.getUTCHours();
    return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function buildDay(emp: ReportEmployee, date: Date, rec: ReportRecord | undefined, today: Date): DayCell {
    const dateStr = ymd(date);
    const todayStr = ymd(today);
    const blank: DayCell = { inText: '', outText: '', hours: null, balance: null };
    const marked = (m: string): DayCell => ({ inText: m, outText: m, hours: null, balance: null });

    if (dateStr > todayStr) return blank; // future: nothing to report yet

    const marker = rec ? LEAVE_MARKERS[rec.status] : undefined;
    if (marker) return marked(marker);
    if (rec?.status === 'weekend') return marked(WEEKOFF);

    const isWeekend = emp.weekendDays.includes(date.getUTCDay());
    if (isWeekend && !rec) return marked(WEEKOFF);

    const worked = rec?.workHours
        ?? (rec?.checkIn && rec?.checkOut && rec.checkOut > rec.checkIn
            ? (rec.checkOut.getTime() - rec.checkIn.getTime()) / 3_600_000
            : 0);
    const hours = round2(Number(worked));

    // Working on a weekend is extra time: no requirement, so it never counts as shortage
    const required = isWeekend ? 0 : rec?.status === 'half_day' ? HALF_DAY_REQUIRED_HOURS : REQUIRED_DAILY_HOURS;

    // Today only counts once the employee has checked out; past days always count.
    const settled = dateStr < todayStr || !!rec?.checkOut;
    const balance = settled ? round2(hours - required) : null;

    if (!rec) return { inText: 'A', outText: 'A', hours, balance };
    return { inText: fmtTime(rec.checkIn), outText: fmtTime(rec.checkOut), hours, balance };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** 9.5 -> "9h 30m"; signed adds a leading + or - (zero has none). */
function fmtHM(hours: number, signed = false): string {
    const mins = Math.round(Math.abs(hours) * 60);
    const sign = !signed || mins === 0 ? '' : hours < 0 ? '-' : '+';
    return `${sign}${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

const hoursText = (n: number | null) => (n === null ? '' : fmtHM(n));
const balanceText = (n: number | null) => (n === null ? '' : fmtHM(n, true));

const fmtDate = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(2)}`;

function safeSheetName(name: string) {
    return name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
}

const COLOR = {
    headDark: 'FF1F4E78',
    headMid: 'FF2E75B6',
    headLight: 'FFDDEBF7',
    nameCell: 'FFF2F2F2',
    white: 'FFFFFFFF',
    shortage: 'FFC00000',
    extra: 'FF00803C',
    legend: 'FF595959',
};

/** Fill + font colour per marker in the In/Out cells. */
const MARKER_STYLE: Record<string, { fill: string; font: string }> = {
    [WEEKOFF]: { fill: 'FFE7E6E6', font: 'FF7F7F7F' },
    C: { fill: 'FFFFE699', font: 'FF7F6000' },
    S: { fill: 'FFF8CBAD', font: 'FF843C0C' },
    H: { fill: 'FFD9C3F0', font: 'FF4B2A7B' },
    L: { fill: 'FFBDD7EE', font: 'FF1F4E78' },
    A: { fill: 'FFFFC7CE', font: 'FF9C0006' },
};

const THIN: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
};

function style(
    cell: ExcelJS.Cell,
    opts: { fill?: string; font?: string; bold?: boolean; italic?: boolean; align?: 'left' | 'center'; size?: number },
) {
    if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
    cell.font = {
        name: 'Calibri', size: opts.size ?? 11, bold: opts.bold, italic: opts.italic,
        color: { argb: opts.font ?? 'FF000000' },
    };
    cell.alignment = { vertical: 'middle', horizontal: opts.align ?? 'center', wrapText: false };
    cell.border = THIN;
}

/** Red for shortage ("-…"), green for extra ("+…"). */
function balanceFont(text: string): string | undefined {
    return text.startsWith('-') ? COLOR.shortage : text.startsWith('+') ? COLOR.extra : undefined;
}

// ─── Workbook ────────────────────────────────────────────────────────────────

export interface BuiltReport {
    buffer: Buffer;
    weeks: number;
    employees: number;
}

export async function buildAttendanceWorkbook(
    employees: ReportEmployee[],
    records: ReportRecord[],
    start: Date,
    end: Date,
    today: Date,
): Promise<BuiltReport> {
    const byKey = new Map<string, ReportRecord>();
    for (const r of records) byKey.set(`${r.employeeId}|${r.date}`, r);

    const weeks = splitWeeks(start, end);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ByteCode';

    // employeeId -> per-week totals, for the summary sheet
    const totals = new Map<number, { hours: number; balance: number }[]>();
    employees.forEach((e) => totals.set(e.id, []));

    const summary = wb.addWorksheet('Summary', { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
    const weekSheets = weeks.map((week) =>
        wb.addWorksheet(safeSheetName(`Week ${week.index} (${fmtShort(week.start)} - ${fmtShort(week.end)})`), {
            views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }],
        }),
    );

    // ── Week tabs ──
    weeks.forEach((week, wi) => {
        const ws = weekSheets[wi];
        const n = week.days.length;
        const totalCol = 2 + n * 4; // 1-based: col 1 is Name

        ws.getColumn(1).width = 26;
        for (let c = 2; c < totalCol; c++) ws.getColumn(c).width = (c - 2) % 4 < 2 ? 8 : (c - 2) % 4 === 2 ? 10 : 11;
        ws.getColumn(totalCol).width = 14;
        ws.getColumn(totalCol + 1).width = 16;

        // Header: Name | date (merged over 4) / weekday (merged over 4) / In Out Hours Shortage | totals
        ws.mergeCells(1, 1, 3, 1);
        ws.getCell(1, 1).value = 'Name';
        style(ws.getCell(1, 1), { fill: COLOR.headDark, font: COLOR.white, bold: true, size: 12 });

        week.days.forEach((day, i) => {
            const c = 2 + i * 4;
            ws.mergeCells(1, c, 1, c + 3);
            ws.mergeCells(2, c, 2, c + 3);
            ws.getCell(1, c).value = fmtDate(day);
            ws.getCell(2, c).value = DAY_NAMES[day.getUTCDay()].slice(0, 3);
            style(ws.getCell(1, c), { fill: COLOR.headDark, font: COLOR.white, bold: true });
            style(ws.getCell(2, c), { fill: COLOR.headMid, font: COLOR.white, bold: true });
            ['In', 'Out', 'Hours', 'Shortage'].forEach((label, k) => {
                ws.getCell(3, c + k).value = label;
                style(ws.getCell(3, c + k), { fill: COLOR.headLight, bold: true });
            });
            // paint merged-away cells so the borders/fills stay continuous
            for (let k = 1; k < 4; k++) {
                style(ws.getCell(1, c + k), { fill: COLOR.headDark });
                style(ws.getCell(2, c + k), { fill: COLOR.headMid });
            }
        });

        ['Total Hours', 'Total Shortage'].forEach((label, k) => {
            ws.mergeCells(1, totalCol + k, 3, totalCol + k);
            ws.getCell(1, totalCol + k).value = label;
            style(ws.getCell(1, totalCol + k), { fill: COLOR.headDark, font: COLOR.white, bold: true });
        });

        // Body: one row per employee
        employees.forEach((emp, ei) => {
            const r = 4 + ei;
            ws.getCell(r, 1).value = emp.name;
            style(ws.getCell(r, 1), { fill: COLOR.nameCell, bold: true, align: 'left' });

            let weekHours = 0;
            let weekBalance = 0;

            week.days.forEach((day, i) => {
                const d = buildDay(emp, day, byKey.get(`${emp.id}|${ymd(day)}`), today);
                weekHours += d.hours ?? 0;
                weekBalance += d.balance ?? 0;

                const c = 2 + i * 4;
                const marker = MARKER_STYLE[d.inText];
                const punchStyle = marker
                    ? { fill: marker.fill, font: marker.font, bold: true }
                    : {};
                ws.getCell(r, c).value = d.inText;
                ws.getCell(r, c + 1).value = d.outText;
                style(ws.getCell(r, c), punchStyle);
                style(ws.getCell(r, c + 1), punchStyle);

                const bal = balanceText(d.balance);
                ws.getCell(r, c + 2).value = hoursText(d.hours);
                ws.getCell(r, c + 3).value = bal;
                style(ws.getCell(r, c + 2), marker ? { fill: marker.fill } : {});
                style(ws.getCell(r, c + 3), {
                    fill: marker?.fill, font: balanceFont(bal), bold: !!bal,
                });
            });

            weekHours = round2(weekHours);
            weekBalance = round2(weekBalance);
            totals.get(emp.id)!.push({ hours: weekHours, balance: weekBalance });

            const tb = balanceText(weekBalance);
            ws.getCell(r, totalCol).value = hoursText(weekHours);
            ws.getCell(r, totalCol + 1).value = tb;
            style(ws.getCell(r, totalCol), { fill: 'FFFFF2CC', bold: true });
            style(ws.getCell(r, totalCol + 1), { fill: 'FFFFF2CC', bold: true, font: balanceFont(tb) });
        });

        const legendRow = 4 + employees.length + 1;
        ws.mergeCells(legendRow, 1, legendRow, Math.min(totalCol + 1, 20));
        ws.getCell(legendRow, 1).value =
            `W = Weekend/off day · C = Casual leave · S = Sick leave · H = Holiday · L = Leave · A = Absent. ` +
            `Shortage = worked − required (${REQUIRED_DAILY_HOURS}h/day): "-" is short, "+" is extra.`;
        ws.getCell(legendRow, 1).font = { italic: true, size: 10, color: { argb: COLOR.legend } };
        ws.getCell(legendRow, 1).alignment = { horizontal: 'left', vertical: 'middle' };

        for (let r = 1; r <= 3; r++) ws.getRow(r).height = r === 3 ? 20 : 22;
    });

    // ── Summary tab ──
    const header = ['Employee', 'Code', 'Department', 'Team', 'Total Hours', 'Total Shortage'];
    weeks.forEach((w) => header.push(`Week ${w.index} Hours`, `Week ${w.index} Shortage`));

    summary.mergeCells(1, 1, 1, Math.min(header.length, 8));
    summary.getCell(1, 1).value = `Summary — ${ymd(start)} to ${ymd(end)}   ("-" short, "+" extra)`;
    summary.getCell(1, 1).font = { bold: true, size: 13, color: { argb: COLOR.headDark } };
    summary.getRow(1).height = 24;

    header.forEach((label, i) => {
        const cell = summary.getCell(3, i + 1);
        cell.value = label;
        style(cell, { fill: COLOR.headDark, font: COLOR.white, bold: true });
        summary.getColumn(i + 1).width = i === 0 ? 26 : i < 4 ? 16 : 15;
    });
    summary.getRow(3).height = 22;

    employees.forEach((emp, ei) => {
        const r = 4 + ei;
        const perWeek = totals.get(emp.id)!;
        const hours = round2(perWeek.reduce((s, w) => s + w.hours, 0));
        const balance = round2(perWeek.reduce((s, w) => s + w.balance, 0));

        const values: (string | number)[] = [
            emp.name, emp.code, emp.department ?? '', emp.team ?? '',
            hoursText(hours), balanceText(balance),
            ...perWeek.flatMap((w) => [hoursText(w.hours), balanceText(w.balance)]),
        ];
        values.forEach((v, i) => {
            const cell = summary.getCell(r, i + 1);
            cell.value = v;
            const isBalance = i >= 5 && i % 2 === 1;
            style(cell, {
                align: i === 0 ? 'left' : 'center',
                bold: i === 0 || i === 4 || i === 5,
                fill: i === 0 ? COLOR.nameCell : i === 4 || i === 5 ? 'FFFFF2CC' : undefined,
                font: isBalance ? balanceFont(String(v)) : undefined,
            });
        });
    });

    const data = await wb.xlsx.writeBuffer();
    return {
        buffer: Buffer.from(data),
        weeks: weeks.length,
        employees: employees.length,
    };
}
