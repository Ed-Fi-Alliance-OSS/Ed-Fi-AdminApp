const intersection = <A>(set1: Set<A>, set2: Set<A>): Set<A> => {
  return new Set([...set1].filter((item) => set2.has(item)));
};

const union = <A, B>(set1: Set<A>, set2: Set<B>): Set<A | B> => {
  return new Set([...set1, ...set2]);
};

const isSuperset = <A>(superset: Set<A>, subset: Set<A>) => {
  return [...subset].every((item) => superset.has(item));
};
