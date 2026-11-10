/**
 * Client-safe utilities for displaying agent names in the UI.
 * Does NOT contain sensitive data (no bank accounts, no webhook URLs, no IDs).
 */

export function getAgentDisplayName(percentageVal: any, agentNameHint?: string): string {
  if (agentNameHint) {
    const hint = String(agentNameHint).toLowerCase();
    if (hint.includes('sudiyono')) return 'Sudiyono';
    if (hint.includes('juneth')) return 'Juneth Andriani';
    if (hint.includes('sarahati') || hint.includes('tarigan')) return 'Sarahati Br Tarigan';
    if (hint.includes('irene') || hint.includes('respati')) return 'Irene Dyah Rhespati';
  }

  const str = String(percentageVal || '').replace('%', '').trim();
  let num = parseFloat(str);
  if (isNaN(num)) return 'Irene Dyah Rhespati';
  if (num > 0 && num <= 1) {
    num = Math.round(num * 100);
  } else {
    num = Math.round(num);
  }

  if (num === 90) return 'Sudiyono';
  if (num === 80) return 'Juneth Andriani';
  if (num === 50) return 'Sarahati Br Tarigan';
  return 'Irene Dyah Rhespati';
}
