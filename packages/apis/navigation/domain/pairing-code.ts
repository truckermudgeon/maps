export function generatePairingCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz'; // 26^4 (~457) possible codes
  return Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}
