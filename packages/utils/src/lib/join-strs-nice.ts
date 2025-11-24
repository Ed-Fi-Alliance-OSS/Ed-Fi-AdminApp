export const joinStrsNice = (strs: string[]) => {
  if (strs.length === 0) return '';
  if (strs.length === 1) return strs[0];
  if (strs.length === 2) return strs[0] + ' and ' + strs[1];

  const newStrs = [...strs];
  const lastStr = newStrs.pop();
  return newStrs.join(', ') + ' and ' + lastStr;
};
