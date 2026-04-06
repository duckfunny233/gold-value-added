export function generateUid(sequence: number) {
  return `UID${sequence.toString().padStart(8, '0')}`
}
