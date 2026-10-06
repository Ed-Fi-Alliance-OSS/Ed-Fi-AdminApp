import { PRIVILEGES, PrivilegeCode, RoleType } from '@edanalytics/models';
import { Role } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityNotFoundError, Repository } from 'typeorm';
import { CustomHttpException, ValidationHttpException } from '../../utils/customExceptions';
import { AuthService } from '../auth.service';

export type AssignContext = { kind: 'team-membership'; teamId: number } | { kind: 'global-user' };

/** How many missing privileges the 403 message names before summarising the rest. */
const MAX_LISTED_PRIVILEGES = 3;

/** A privilege's human-readable description without its trailing period, or the raw code. */
const describePrivilege = (code: PrivilegeCode) =>
  PRIVILEGES[code]?.description?.replace(/\.$/, '') ?? code;

/**
 * 403 shown to the user (the UI displays `message` in a banner), so it names privileges by
 * description and caps the list. The full list of codes is logged by `findMissing`.
 */
export const insufficientPrivilegesException = (missing: PrivilegeCode[]) => {
  const listed = missing.slice(0, MAX_LISTED_PRIVILEGES).map(describePrivilege);
  const rest = missing.length - listed.length;
  return new CustomHttpException(
    {
      type: 'Error',
      title: 'Insufficient privileges',
      message: `You cannot grant privileges you do not hold: ${listed.join('; ')}${
        rest > 0 ? `; and ${rest} more` : ''
      }.`,
    },
    403,
  );
};

/**
 * Enforces the no-escalation rule (AC-644): an actor may only grant privileges they hold,
 * whether by defining a role or by assigning one. See
 * docs/design/2026-10-06-ac-644-privilege-delegation.md for the trust model.
 *
 * The check and the caller's subsequent write are not in one transaction: if the actor is
 * demoted in the milliseconds between them, that one in-flight grant can still complete.
 * Accepted, because the actor held the privileges when the request was authorized.
 */
@Injectable()
export class PrivilegeGrantGuardService {
  private readonly logger = new Logger(PrivilegeGrantGuardService.name);

  constructor(
    private readonly authService: AuthService,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  /** Codes in `codes` the actor does not hold, deduplicated and sorted. */
  async findMissing(
    actorId: number,
    codes: PrivilegeCode[],
    teamId?: number,
    target?: string,
  ): Promise<PrivilegeCode[]> {
    if (!codes.length) return [];

    let heldPrivileges: Set<PrivilegeCode>;
    try {
      heldPrivileges = await this.authService.getUserPrivileges(actorId, teamId);
    } catch (error) {
      if (!(error instanceof EntityNotFoundError)) throw error;
      // Actor became inactive or was deleted after authentication: they hold nothing.
      heldPrivileges = new Set();
    }

    const missing = [...new Set(codes)].filter((code) => !heldPrivileges.has(code)).sort();
    if (missing.length) {
      this.logger.warn(
        `Actor ${actorId} denied granting [${missing.join(', ')}]` +
          (teamId !== undefined ? ` in team ${teamId}` : '') +
          (target ? ` (${target})` : ''),
      );
    }
    return missing;
  }

  /** Throws 403 if the actor lacks any of `codes`. No-op for an empty list. */
  async assertCanGrant(
    actorId: number,
    codes: PrivilegeCode[],
    teamId?: number,
    target?: string,
  ): Promise<void> {
    const missing = await this.findMissing(actorId, codes, teamId, target);
    if (missing.length) {
      throw insufficientPrivilegesException(missing);
    }
  }

  /**
   * Validates the role's shape for the context, then checks the actor holds the privileges it
   * newly grants: those not already on the previous role (when that role was valid for the
   * context). No-op when unassigning (null/undefined) or when the role is unchanged.
   * `target` (e.g. `membership 5`) identifies what is being assigned to, for the rejection log.
   */
  async assertCanAssignRole(
    actorId: number,
    roleId: number | null | undefined,
    context: AssignContext,
    previousRoleId?: number | null,
    target?: string,
  ): Promise<void> {
    if (roleId === null || roleId === undefined) return;
    if (roleId === previousRoleId) return;

    const logTarget = target ? `${target}, role ${roleId}` : `role ${roleId}`;

    const role = await this.rolesRepository.findOneBy({ id: roleId });

    if (!this.isValidForContext(role, context)) {
      throw new ValidationHttpException({
        field: 'roleId',
        message:
          context.kind === 'team-membership'
            ? 'Role is not a valid team role for this team. Refresh the page and choose another role.'
            : 'Role is not a valid global user role. Refresh the page and choose another role.',
      });
    }

    // Only privileges the new role adds relative to the previous role are being granted.
    // A previous role only counts if it was itself valid for this context.
    const previousRole =
      previousRoleId === null || previousRoleId === undefined
        ? null
        : await this.rolesRepository.findOneBy({ id: previousRoleId });
    const retained = new Set(
      this.isValidForContext(previousRole, context) ? previousRole.privilegeIds ?? [] : []
    );
    const added = (role.privilegeIds ?? []).filter((code) => !retained.has(code));

    await this.assertCanGrant(
      actorId,
      added,
      context.kind === 'team-membership' ? context.teamId : undefined,
      logTarget,
    );
  }

  private isValidForContext(role: Role | null, context: AssignContext): role is Role {
    if (role === null) return false;
    if (context.kind === 'team-membership') {
      return (
        role.type === RoleType.UserTeam &&
        (role.teamId === null || role.teamId === undefined || role.teamId === context.teamId)
      );
    }
    return role.type === RoleType.UserGlobal;
  }
}
