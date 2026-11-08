/**
 * Gràfics SVG senzills per al report (sense dependències): línies i barres, amb la sèrie
 * principal en blau i les de referència en gris, com als gràfics del report_1.
 */
const WIDTH = 760;
const HEIGHT = 380;
const MARGIN = { left: 56, right: 24, top: 64, bottom: 56 };
export const COLORS = {
  accent: '#2563eb',
  reference: '#9ca3af',
  grid: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
};

const escape = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const format = (value) => (Math.round(value * 10) / 10).toLocaleString('ca-ES');

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function frame({ title, subtitle, yMax, xLabels, x }) {
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const y = (value) => MARGIN.top + plotHeight - (value / yMax) * plotHeight;
  const parts = [
    `<text x="${MARGIN.left}" y="26" font-size="16" font-weight="bold" fill="${COLORS.text}">${escape(title)}</text>`,
  ];
  if (subtitle) {
    parts.push(
      `<text x="${MARGIN.left}" y="46" font-size="12" fill="${COLORS.muted}">${escape(subtitle)}</text>`,
    );
  }
  for (let step = 0; step <= 4; step++) {
    const value = (yMax / 4) * step;
    parts.push(
      `<line x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${y(value)}" y2="${y(value)}" stroke="${COLORS.grid}"/>`,
      `<text x="${MARGIN.left - 8}" y="${y(value) + 4}" font-size="11" text-anchor="end" fill="${COLORS.muted}">${format(value)}</text>`,
    );
  }
  const every = Math.max(1, Math.ceil(xLabels.length / 12));
  const last = xLabels.length - 1;
  xLabels.forEach((label, index) => {
    // L'última etiqueta sempre; les altres, cada `every` i sense trepitjar l'última.
    if ((index % every === 0 && last - index >= every) || index === last) {
      parts.push(
        `<text x="${x(index)}" y="${HEIGHT - MARGIN.bottom + 20}" font-size="11" text-anchor="middle" fill="${COLORS.muted}">${escape(label)}</text>`,
      );
    }
  });
  return { parts, y };
}

function svg(title, parts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Arial, sans-serif" role="img" aria-label="${escape(title)}"><rect width="100%" height="100%" fill="#ffffff"/>${parts.join('')}</svg>\n`;
}

function legend(series) {
  let offset = WIDTH - MARGIN.right;
  return [...series].reverse().map((item) => {
    const width = item.name.length * 6.5 + 28;
    offset -= width;
    const swatch = item.dashed
      ? `<line x1="${offset}" x2="${offset + 18}" y1="22" y2="22" stroke="${item.color}" stroke-width="2.5" stroke-dasharray="6 4"/>`
      : `<rect x="${offset}" y="16" width="18" height="12" fill="${item.color}"/>`;
    return `${swatch}<text x="${offset + 24}" y="26" font-size="12" fill="${COLORS.text}">${escape(item.name)}</text>`;
  });
}

/** `series`: [{ name, values: [nombre | null], color, dashed }] sobre les mateixes `xLabels`. */
export function lineChart({ title, subtitle, xLabels, series }) {
  const yMax = niceMax(
    Math.max(...series.flatMap((item) => item.values.filter((v) => v !== null))),
  );
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const x = (index) =>
    MARGIN.left + (xLabels.length > 1 ? (index / (xLabels.length - 1)) * plotWidth : plotWidth / 2);
  const { parts, y } = frame({ title, subtitle, yMax, xLabels, x });
  for (const item of series) {
    const points = item.values
      .map((value, index) => (value === null ? null : `${x(index)},${y(value)}`))
      .filter(Boolean)
      .join(' ');
    parts.push(
      `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="2.5"${item.dashed ? ' stroke-dasharray="6 4"' : ''}/>`,
    );
    if (!item.dashed) {
      item.values.forEach((value, index) => {
        if (value !== null)
          parts.push(
            `<circle cx="${x(index)}" cy="${y(value)}" r="3" fill="${item.color}"><title>${escape(`${xLabels[index]}: ${format(value)}`)}</title></circle>`,
          );
      });
    }
  }
  return svg(title, [...parts, ...legend(series)]);
}

/** Barres agrupades: `series`: [{ name, values, color }] sobre les mateixes `xLabels`. */
export function barChart({ title, subtitle, xLabels, series, showValues = true }) {
  const yMax = niceMax(Math.max(...series.flatMap((item) => item.values)));
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const band = plotWidth / xLabels.length;
  const x = (index) => MARGIN.left + band * index + band / 2;
  const { parts, y } = frame({ title, subtitle, yMax, xLabels, x });
  const barWidth = Math.min(36, (band * 0.7) / series.length);
  series.forEach((item, seriesIndex) => {
    item.values.forEach((value, index) => {
      const left = x(index) - (barWidth * series.length) / 2 + barWidth * seriesIndex;
      parts.push(
        `<rect x="${left}" y="${y(value)}" width="${barWidth - 2}" height="${y(0) - y(value)}" fill="${item.color}"><title>${escape(`${xLabels[index]} · ${item.name}: ${format(value)}`)}</title></rect>`,
      );
      if (showValues && value > 0) {
        parts.push(
          `<text x="${left + (barWidth - 2) / 2}" y="${y(value) - 6}" font-size="11" text-anchor="middle" fill="${COLORS.text}">${format(value)}</text>`,
        );
      }
    });
  });
  return svg(title, [...parts, ...(series.length > 1 ? legend(series) : [])]);
}
