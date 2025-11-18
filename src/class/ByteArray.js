class ByteArray {
  constructor(options = {}) {
    const defaultOptions = {
      size: 255n,
      shift: 0n,
    };
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
  }

  dealOptions() {
    const {
      options: {
        size,
        shift,
      },
    } = this;
    if (typeof size !== 'bigint') {
      throw new Error('[Error] The option size should be of type bigInt.');
    }
    if (!(size > 0n)) {
      throw new Error('[Error] Option size should be a positive integer.');
    }
    if (typeof shift !== 'bigint') {
      throw new Error('[Error] The option shift should be of type bigInt.');
    }
    if (!(size >= 0n)) {
      throw new Error('[Error] Option shift should be greater than or equal to zero.');
    }
  }

  fromInt(n) {
    const {
      options: {
        size,
        shift,
      },
    } = this;
    n = BigInt(n);
    const ans = [];
    if (n > (size - 1n - shift)) {
      while (n > size - shift) {
        const q = n % (size - shift);
        ans.push(Number(q + shift));
        n = n / size - shift;
      }
    }
    ans.push(Number(n + shift));
    return ans;
  }

  toInt(buf) {
    const {
      options: {
        size,
        shift,
      },
    } = this;
    let n = 0n;
    for (let i = 0n; i < buf.length; i += 1n) {
      n += (BigInt(buf[i]) - shift) * (size - shift) ** i;
    }
    return n;
  }
}

export default ByteArray;
