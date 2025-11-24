import { Ids } from '@edanalytics/models';
import { In } from 'typeorm';

/** Construct a TypeORM `where` clause for the `id` field using the auth cache for it. */
export function whereIds(ids: Ids) {
  if (ids === true) {
    return {};
  } else {
    return {
      id: In([...ids]),
    };
  }
}

/** Check a resource ID in question against the auth cache for that ID. Note
 * that the cached value may be `true` or a `Set`. See the [Authorization
 * Readme](../authorization/README.md) for further information. */
export function checkId(id: number | string, ids: Ids) {
  if (ids === true) {
    return true;
  } else {
    return ids.has(id);
  }
}
