import { ITenantCache, PrivilegeCode, upwardInheritancePrivileges } from '@edanalytics/models';
import { Edorg, Ods, Ownership, Sbe, User, UserTenantMembership } from '@edanalytics/models-server';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Not, Repository, TreeRepository } from 'typeorm';
import { CacheService } from '../app/cache.module';
import {
  cacheAccordingToPrivileges,
  cacheEdorgPrivilegesDownward,
  cacheEdorgPrivilegesUpward,
  initializeSbePrivilegeCache,
} from './authorization/helpers';

@Injectable()
export class AuthService {
  edorgsTreeRepository: TreeRepository<Edorg>;
  constructor(
    @InjectRepository(Ods)
    private odssRepository: Repository<Ods>,
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>,
    @InjectRepository(Edorg)
    private edorgsRepository: Repository<Edorg>,
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(UserTenantMembership)
    private utmRepo: Repository<UserTenantMembership>,
    @InjectEntityManager()
    private entityManager: EntityManager,
    @Inject(CacheService) private cacheManager: CacheService
  ) {
    this.edorgsTreeRepository = this.entityManager.getTreeRepository(Edorg);
  }

  /** Get union of user's global role privileges and tenant role privileges.
   *
   * _Note that a global role may contain tenant-type privileges which apply
   * to any tenant context the user chooses to assume, as if they were assigned
   * a role within that tenant that granted those privileges locally._
   */
  async getUserPrivileges(
    userId: number,
    /** Optionally look up a tenant membership, if one exists, whose privileges will be added to the Set */
    tenantId?: number
  ) {
    const privileges = new Set<PrivilegeCode>();

    if (tenantId !== undefined) {
      // We don't want to error out if there's no membership, because a user can still be granted tenant-level privileges globally.
      const membership = await this.utmRepo.findOne({
        where: {
          userId,
          tenantId,
        },
        relations: ['role', 'role.privileges'],
      });

      membership?.role?.privileges?.forEach(({ code }) => {
        // tenant roles *shouldn't* have any non-tenant privileges, but just in case, we don't want to add any global privileges based on a tenant role.
        if (code.startsWith('tenant.')) {
          privileges.add(code);
        }
      });
    }
    const user = await this.usersRepo.findOneOrFail({
      where: {
        id: userId,
        isActive: true,
      },
      relations: ['role', 'role.privileges'],
    });

    user.role?.privileges?.forEach(({ code }) => {
      privileges.add(code);
    });
    return privileges;
  }

  private async getUser(username: string) {
    const user = await this.usersRepo.findOne({
      where: {
        username,
        userTenantMemberships: {},
      },
      relations: ['role'],
    });
    if (user === null) return null;

    const tenantMemberships = await this.utmRepo.find({
      where: {
        userId: user.id,
        roleId: Not(IsNull()),
      },
      relations: ['role', 'tenant'],
    });

    if (tenantMemberships.length) {
      user.userTenantMemberships = tenantMemberships;
    }

    return user;
  }

  async validateUser(username: string) {
    const user = await this.getUser(username);
    if (user === null || !user.isActive) {
      return null;
    } else {
      return user;
    }
  }

  async constructTenantOwnerships(tenantId: number) {
    const start = new Date();
    if (typeof tenantId !== 'number') throw new UnauthorizedException();
    const ownerships = await this.ownershipsRepository.find({
      where: {
        tenantId,
      },
      relations: ['sbe', 'ods', 'edorg', 'role', 'role.privileges'],
    });

    /** Map of all Edorgs needed during execution.
     *
     * Just a data bucket used for dynamic programming; carries no access control meaning itself.
     * */
    const allEdorgs = new Map<number, Edorg>();
    /** Map of all Odss needed during execution.
     *
     * Just a data bucket used for dynamic programming; carries no access control meaning itself.
     * */
    const allOdss = new Map<number, Ods>();
    /** Map of all Sbes needed during execution.
     *
     * Just a data bucket used for dynamic programming; carries no access control meaning itself.
     * */
    const allSbes = new Map<number, Sbe>();

    const ownedOdss: Ownership[] = [];
    const ownedEdorgs: Ownership[] = [];

    /**
     * Repository of the privileges this tenant has on each relevant Sbe
     *
     * These variables are used dynamically. As the authorization builder
     * works its way up and down the resource hierarchy, it adds new items
     * or new privileges to existing items as prescribed by the app's
     * inheritance rules.
     */
    const sbePrivileges = new Map<number, Set<PrivilegeCode>>();
    /**
     * Repository of the privileges this tenant has on each relevant ODS
     *
     * These variables are used dynamically. As the authorization builder
     * works its way up and down the resource hierarchy, it adds new items
     * or new privileges to existing items as prescribed by the app's
     * inheritance rules.
     */
    const odsPrivileges = new Map<number, Set<PrivilegeCode>>();
    /**
     * Repository of the privileges this tenant has on each relevant Ed-Org
     *
     * These variables are used dynamically. As the authorization builder
     * works its way up and down the resource hierarchy, it adds new items
     * or new privileges to existing items as prescribed by the app's
     * inheritance rules.
     */
    const edorgPrivileges = new Map<number, Set<PrivilegeCode>>();

    ownerships.forEach((o) => {
      if (o.sbe) {
        sbePrivileges.set(o.sbe.id, new Set(o.role?.privileges.map((p) => p.code) ?? []));
        allSbes.set(o.sbe.id, o.sbe);
      } else if (o.ods) {
        odsPrivileges.set(o.ods.id, new Set(o.role?.privileges.map((p) => p.code) ?? []));
        ownedOdss.push(o);
        allOdss.set(o.ods.id, o.ods);
      } else if (o.edorg) {
        edorgPrivileges.set(o.edorg.id, new Set(o.role?.privileges.map((p) => p.code) ?? []));
        ownedEdorgs.push(o);
        allEdorgs.set(o.edorg.id, o.edorg);
      }
    });

    const cache: ITenantCache = {
      'tenant.ownership:read': true,
      'tenant.role:read': true,
      'tenant.role:create': true,
      'tenant.role:update': true,
      'tenant.role:delete': true,
      'tenant.user:read': true,
      'tenant.user-tenant-membership:read': true,
      'tenant.user-tenant-membership:update': true,
      'tenant.user-tenant-membership:delete': true,
      'tenant.user-tenant-membership:create': true,
      /*

      Suppose the tenant has no Sbes. Why would we bother including the
      privilege with an empty Set (as you see below) instead of just not
      including it at all?

      We implement the following pattern: if user/tenant has a privilege
      "in theory" - regardless of whether there exists any data on which
      they could use it - then we include it in the cache. This is
      because they should be able to access the relevant page, and see
      that nothing is there. Otherwise if, for example, a tenant's ODS
      didn't have any Ed-Orgs populated in it yet, they wouldn't get the
      Ed-Org page at all.

      So in practical terms the reasons for the following line are:
      - In the front-end it constitutes the difference between displaying
      an empty page and displaying no page/nav-item, and
      - In the API it's the difference between denying a request and
      returning an empty payload.

      _Not_ because it makes any difference for what data can
      ultimately be retrieved.

      */
      'tenant.sbe:read': new Set(),
    };

    /*

    First trace the resource tree _downward_ from the owned resources,
    accumulating more privileges as we go and applying them to the
    resources we encounter.

    */

    const sbePrivilegesEntries = [...sbePrivileges.entries()];
    const [allEdorgsRaw, allOdssRaw] = await Promise.all([
      this.edorgsRepository.findBy([
        {
          sbeId: In(sbePrivilegesEntries.map(([sbeId, privileges]) => sbeId)),
        },
        {
          odsId: In(ownedOdss.map((o) => o.ods.id).filter((id) => typeof id === 'number')),
        },
      ]),
      this.odssRepository.findBy([
        {
          sbeId: In(sbePrivilegesEntries.map(([sbeId, privileges]) => sbeId)),
        },
        {
          id: In(ownedEdorgs.map((o) => o.edorg.odsId).filter((id) => typeof id === 'number')),
        },
      ]),
    ]);

    const rootEdorgsPerOds: Record<number, Edorg[]> = {};
    allEdorgsRaw.forEach((edorg) => {
      if (typeof edorg.parentId !== 'number') {
        if (!(edorg.odsId in rootEdorgsPerOds)) {
          rootEdorgsPerOds[edorg.odsId] = [];
        }
        rootEdorgsPerOds[edorg.odsId].push(edorg);
      }
      allEdorgs.set(edorg.id, edorg);
    });

    const odssPerSbe = Object.fromEntries(
      sbePrivilegesEntries.map(([sbeId, privileges]) => [sbeId, [] as Ods[]])
    );
    allOdssRaw.forEach((ods) => {
      if (!(ods.sbeId in odssPerSbe)) {
        odssPerSbe[ods.sbeId] = [];
      }
      odssPerSbe[ods.sbeId].push(ods);
      allOdss.set(ods.id, ods);
    });

    sbePrivilegesEntries.forEach(([sbeId, myPrivileges]) => {
      cacheAccordingToPrivileges(cache, myPrivileges, 'tenant.sbe', sbeId);
      initializeSbePrivilegeCache(cache, myPrivileges, sbeId);
      cacheAccordingToPrivileges(cache, myPrivileges, 'tenant.sbe.vendor', true, sbeId);
      cacheAccordingToPrivileges(cache, myPrivileges, 'tenant.sbe.claimset', true, sbeId);

      // apply downward-inheriting privileges to ODS's within this SBE
      odssPerSbe[sbeId]?.forEach((ods) => {
        if (!odsPrivileges.has(ods.id)) {
          odsPrivileges.set(ods.id, new Set());
        }
        myPrivileges.forEach((p) => odsPrivileges.get(ods.id).add(p));
      });
    });

    const odsPrivilegesEntries = [...odsPrivileges.entries()];
    odsPrivilegesEntries.forEach(([odsId, myPrivileges]) => {
      const ods = allOdss.get(odsId);

      cacheAccordingToPrivileges(cache, myPrivileges, 'tenant.sbe.ods', ods.id, ods.sbeId);

      // apply downward-inheriting privileges to root Ed-Orgs within this ODS
      rootEdorgsPerOds[odsId]?.forEach((edorg) => {
        if (!edorgPrivileges.has(edorg.id)) {
          edorgPrivileges.set(edorg.id, new Set());
        }
        myPrivileges.forEach((p) => edorgPrivileges.get(edorg.id).add(p));
      });
    });

    const edorgPrivilegesEntries = [...edorgPrivileges.entries()];

    const edorgIds = new Set(edorgPrivilegesEntries.map(([edorgId, privileges]) => edorgId));
    const edorgClosureRaw = await this.entityManager.query(
      'SELECT "id_ancestor", "id_descendant" from "edorg_closure" WHERE "id_ancestor" <> "id_descendant" and "id_ancestor" = ANY ($1)',
      [[...edorgIds.values()]]
    );

    const parentEdorgIds = new Set<number>();
    const ancestorMap = new Map<number, Set<Edorg>>();
    edorgClosureRaw.forEach((row) => {
      parentEdorgIds.add(row.id_ancestor);
      if (!ancestorMap.has(row.id_descendant)) {
        ancestorMap.set(row.id_descendant, new Set());
      }
      ancestorMap.get(row.id_descendant).add(row.id_ancestor);
    });

    const descendantMap = new Map<number, Edorg[]>();
    [...allEdorgs.values()].forEach((edorg) => {
      if (typeof edorg.parentId === 'number') {
        if (!descendantMap.has(edorg.parentId)) {
          descendantMap.set(edorg.parentId, [edorg]);
        } else {
          descendantMap.set(edorg.parentId, [...descendantMap.get(edorg.parentId), edorg]);
        }
      }
    });

    edorgPrivilegesEntries.forEach((entry) => {
      const [edorgId, myPrivileges] = entry;
      const edorg = allEdorgs.get(edorgId);

      let tree: Edorg;
      if (parentEdorgIds.has(edorgId)) {
        const buildDescendants = (edorg: Edorg) => {
          const descendants = descendantMap.get(edorg.id);
          edorg.children = descendants;
          descendants && edorg.children.forEach((child) => buildDescendants(child));
        };
        tree = edorg;
        buildDescendants(tree);
      } else {
        tree = edorg;
      }
      cacheEdorgPrivilegesDownward(cache, myPrivileges, tree, edorgPrivileges);
    });

    /*

    Then trace the tree _upward_ from the owned resources, applying
    only the upwardly-inheritable privileges.

    */
    for (const edorgId in ownedEdorgs) {
      const ownership = ownedEdorgs[edorgId];
      const edorg = ownership.edorg!;
      const ancestors = [...(ancestorMap.get(edorg.id) ?? [])];

      const ownedPrivileges = new Set(ownership.role.privileges.map((p) => p.code) ?? []);

      cacheEdorgPrivilegesUpward(cache, edorg, ownedPrivileges, ancestors);
    }

    for (const odsId in ownedOdss) {
      const ownership = ownedOdss[odsId];
      const ods = ownership.ods!;

      const ownedPrivileges = new Set(ownership.role?.privileges.map((p) => p.code) ?? []);
      const appliedPrivileges = new Set(
        [...ownedPrivileges].filter((p) => upwardInheritancePrivileges.has(p))
      );

      cacheAccordingToPrivileges(cache, appliedPrivileges, 'tenant.sbe', ods.sbeId);
      cacheAccordingToPrivileges(cache, appliedPrivileges, 'tenant.sbe.claimset', true, ods.sbeId);
      cacheAccordingToPrivileges(cache, appliedPrivileges, 'tenant.sbe.vendor', true, ods.sbeId);
    }

    const end = new Date();
    Logger.verbose(
      `Tenant ${tenantId} ownership object cached in ${(
        Number(end) - Number(start)
      ).toLocaleString()}ms`
    );
    return cache;
  }

  clearTenantOwnershipCache(tenantId: number) {
    this.cacheManager.del(String(tenantId));
  }

  async reloadTenantOwnershipCache(
    tenantId: number,
    /** Load the cache even if it's currently expired, meaning it hasn't been used in 1hr */
    evenIfInactive = true
  ) {
    const existingValue: ITenantCache | undefined = this.cacheManager.get(String(tenantId));

    if (existingValue || evenIfInactive) {
      this.clearTenantOwnershipCache(tenantId);
      const newCache = this.constructTenantOwnerships(tenantId);
      this.cacheManager.set(String(tenantId), newCache, 10 * 60 /* seconds */);
      return await newCache;
    } else {
      return null;
    }
  }

  async getTenantOwnershipCache(tenantId: number) {
    const cachedValue = this.cacheManager.get(String(tenantId));
    if (cachedValue !== undefined) {
      return await cachedValue;
    } else {
      const newCache = this.constructTenantOwnerships(tenantId);
      this.cacheManager.set(String(tenantId), newCache, 10 * 60 /* seconds */);
      return await newCache;
    }
  }
}
