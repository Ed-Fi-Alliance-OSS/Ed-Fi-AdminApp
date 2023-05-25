import { In } from 'typeorm';
import { Ids } from '../authorization/tenant-cache.interface';

export function whereIds(ids: Ids) {
  if (ids === true) {
    return {};
  } else {
    return {
      id: In([...ids]),
    };
  }
}

export function filterId(id: number | string, ids: Ids) {
  if (ids === true) {
    return true;
  } else {
    return ids.has(id);
  }
}
