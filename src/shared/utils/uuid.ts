/**
 * UUIDv7 generator implementation
 * UUIDv7 format: time-ordered UUID with millisecond timestamp prefix
 *
 * Structure (RFC 9562):
 * 0-3: timestamp (48 bits, milliseconds since Unix epoch)
 * 4: version (4 bits, 0b0111 = 7) + rand_a (12 bits)
 * 5: variant (2 bits, 0b10) + rand_b (62 bits)
 */

let lastTimestamp = 0;
let lastRandA = 0;

export function generateUUIDv7(): string {
  const timestamp = Date.now();

  let randA: number;
  if (timestamp === lastTimestamp) {
    // Same millisecond, increment randA to ensure monotonicity
    randA = (lastRandA + 1) & 0xfff;
    if (randA === 0) {
      // RandA overflow, wait for next millisecond
      while (Date.now() === timestamp) {
        // Busy wait (should be very rare)
      }
      return generateUUIDv7();
    }
  } else {
    // New millisecond, generate new randA
    randA = crypto.getRandomValues(new Uint16Array(1))[0] & 0xfff;
  }

  lastTimestamp = timestamp;
  lastRandA = randA;

  // Generate random bytes for the rest
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));

  // Build the UUID
  const bytes = new Uint8Array(16);

  // Timestamp (48 bits, big-endian)
  bytes[0] = (timestamp >>> 40) & 0xff;
  bytes[1] = (timestamp >>> 32) & 0xff;
  bytes[2] = (timestamp >>> 24) & 0xff;
  bytes[3] = (timestamp >>> 16) & 0xff;
  bytes[4] = (timestamp >>> 8) & 0xff;
  bytes[5] = timestamp & 0xff;

  // Version (4 bits) + randA (12 bits)
  bytes[6] = (0x70 | (randA >>> 8)) & 0xff;
  bytes[7] = randA & 0xff;

  // Variant (2 bits) + randB (6 bits)
  bytes[8] = (0x80 | (randomBytes[0] & 0x3f)) & 0xff;

  // Remaining 7 bytes of randB
  bytes.set(randomBytes.subarray(1), 9);

  // Convert to hex string with dashes
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

// Alias for backward compatibility
export const randomUUID = generateUUIDv7;
