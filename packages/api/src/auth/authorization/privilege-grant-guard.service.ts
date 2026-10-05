import { PrivilegeCode, RoleType } from '@edanalytics/models';
import { Role } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityNotFoundError, Repository } from 'typeorm';
import { CustomHttpException, ValidationHttpException } from '../../utils/customExceptions';
import { AuthService } from '../auth.service';

export type AssignContext = { kind: 'team-membership'; teamId: number } | { kind: 'global-user' };

export const insufficientPrivilegesException = (missing: PrivilegeCode[]) =>
  new CustomHttpException(
    {
      type: 'Error',
      title: 'Insufficient privileges',
      message: `You cannot grant privileges you do not hold: ${missing.join(', ')}`,
    },
    403,
  );

/**
 * Enforces the no-escalation rule (AC-644): an actor may only grant privileges they hold,
 * whether by defining a role or by assigning one.
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
   * Validates the role's shape for the context, then checks the actor holds its privileges.
   * No-op when unassigning (null/undefined) or when the role is unchanged.
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

    if (context.kind === 'team-membership') {
      const isValidTeamRole =
        role !== null &&
        role.type === RoleType.UserTeam &&
        (role.teamId === null || role.teamId === undefined || role.teamId === context.teamId);
      if (!isValidTeamRole) {
        throw new ValidationHttpException({
          field: 'roleId',
          message: 'Role is not a valid team role for this team.',
        });
      }
      await this.assertCanGrant(actorId, role.privilegeIds ?? [], context.teamId, logTarget);
    } else {
      if (role === null || role.type !== RoleType.UserGlobal) {
        throw new ValidationHttpException({
          field: 'roleId',
          message: 'Role is not a valid global user role.',
        });
      }
      await this.assertCanGrant(actorId, role.privilegeIds ?? [], undefined, logTarget);
    }
  }
}
