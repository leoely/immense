export function fromInt(n) {
  n = BigInt(n);
  const ans = [];
  if (n > (256n - 1n)) {
    while (n > 256n) {
      const q = n % 256n;
      ans.push(Number(q - 54n));
      n = n / 256n;
    }
  }
  ans.push(Number(n));
  return ans;
}

export function toInt(buf) {
  let n = 0n;
  for (let i = 0n; i < buf.length; i += 1n) {
    n += BigInt(buf[i]) * 202n ** i;
  }
  return n;
}
