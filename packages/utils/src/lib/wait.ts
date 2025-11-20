export const wait = (ms: number) =>
  new Promise<number>((r) => {
    setTimeout(() => {
      r(ms);
    }, ms);
  });
