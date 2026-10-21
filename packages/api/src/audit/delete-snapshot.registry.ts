import type { EntityTarget } from 'typeorm';

export type DeleteSnapshotOptions = {
  /** Relations to load alongside the entity so the builder can read them. */
  relations?: string[];
};

type Registration = {
  build: (target: never) => Record<string, unknown>;
  relations: string[];
};

const registry = new Map<unknown, Registration>();

/**
 * Registers an allowlist-based builder that turns an entity into the snapshot stored in the
 * audit details when that entity is deleted. Builders must pick fields explicitly.
 */
export const registerDeleteSnapshot = <T>(
  entity: EntityTarget<T>,
  toSnapshot: (target: T) => Record<string, unknown>,
  options: DeleteSnapshotOptions = {},
): void => {
  registry.set(entity, {
    build: toSnapshot as Registration['build'],
    relations: options.relations ?? [],
  });
};

export const getDeleteSnapshotBuilder = <T>(
  entity: EntityTarget<T>,
): ((target: T) => Record<string, unknown>) | undefined =>
  registry.get(entity)?.build as ((target: T) => Record<string, unknown>) | undefined;

export const getDeleteSnapshotRelations = (entity: EntityTarget<unknown>): string[] =>
  registry.get(entity)?.relations ?? [];
