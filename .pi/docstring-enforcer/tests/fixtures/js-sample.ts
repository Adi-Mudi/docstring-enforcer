// Sample TypeScript file for testing.

function missingDoc(a: string) {
  return a;
}

/**
 * This one is fine.
 * @param b - A number.
 * @returns A number.
 */
function hasDoc(b: number) {
  return b;
}

const arrowMissing = (x: string) => x;

class Example {
  methodMissing() {}

  /** Documented method. */
  methodOk() {}

  get valueMissing() {
    return 1;
  }
}
