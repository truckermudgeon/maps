export const throttle = <T extends unknown[], U>(
  callback: (...args: T) => U,
  delay: number,
) => {
  let wait = false;
  return (...args: T) => {
    if (wait) {
      return undefined;
    }

    const val = callback(...args);
    wait = true;
    setTimeout(() => (wait = false), delay);

    return val;
  };
};
