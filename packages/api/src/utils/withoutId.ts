/**
 * Returns a shallow copy of a create payload with any `id` property removed.
 *
 * TypeORM's `repository.save()` treats an entity with a primary key as an
 * update, so a create payload that carries an `id` would overwrite an
 * existing row. The global `ValidationPipe` already strips `id` from request
 * bodies (AC-642); this is defence in depth for create methods that pass a
 * DTO straight into `repository.create()`.
 *
 * @example
 * ```typescript
 * return this.usersRepository.save(this.usersRepository.create(withoutId(createUserDto)));
 * ```
 */
export function withoutId<T extends object>(dto: T): Omit<T, 'id'> {
  const copy = { ...dto } as T & { id?: unknown };
  delete copy.id;
  return copy;
}
