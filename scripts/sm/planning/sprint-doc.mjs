/** Lectura de docs/sprint-<N>.md per al generador del planning (sense dependències). */

/** Text sense marques de Markdown (negretes, cursives, codi i enllaços). */
export const plain = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*|[*_`]/g, '')
    .trim();

/** Objectiu, fites i històries (títol, èpica, descripció i criteris) de docs/sprint-<N>.md. */
export function parseSprintDoc(markdown) {
  const objective = plain(markdown.match(/^\*\*Objectiu:\*\* (.+)$/m)?.[1] ?? '');
  const milestones = plain(markdown.match(/^Fites: (.+)$/m)?.[1] ?? '');
  const stories = [];
  for (const block of markdown.split(/\n(?=## )/)) {
    const heading = block.match(/^## (.+?) · \[TG-(\d+)\]/);
    if (!heading) continue;
    stories.push({
      ref: Number(heading[2]),
      title: heading[1].trim(),
      epic: block.match(/\n(?:Èpica )?([^\n]*?) · \*\*\d+ SP\*\*/)?.[1] ?? '',
      description:
        block.match(/\n\*(Com a [^*]+)\*/)?.[1] ??
        block.match(/\n(Història tècnica del Sprint[^\n]*)/)?.[1] ??
        '',
      criteria: [...block.matchAll(/\n- \[[ x]\] ([^\n]+)/g)].map((match) => plain(match[1])),
    });
  }
  return { objective, milestones, stories };
}
