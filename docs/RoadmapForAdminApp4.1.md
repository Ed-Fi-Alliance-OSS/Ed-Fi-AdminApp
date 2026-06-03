# Roadmap for Admin App 4.1

**Team size:** 3 developers, 1 tester, 1 product owner
**Team capacity:** 60% (due to many running projects in parallel)
**Sprint length:** 2 weeks · **Full-capacity velocity:** ~35 pts/sprint · **Effective velocity at 60%:** ~21 pts/sprint
**Roadmap start date:** Jun 10, 2026

## References

[PRD-AdminApp-v4.1.md document](https://github.com/Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp/tree/main/docs)

## Summary

| Metric | Value |
| -- | -- |
| Total dev story points (estimated) | 176 |
| Completed (tracked in this roadmap) | 0 pts |
| **Remaining dev points (estimated)** | **176 pts** |
| Effective velocity (60% capacity) | 21 pts/sprint |
| Sprints needed (estimated scope) | 9 |
| **Projected dev ETA (estimated scope)** | **October 14, 2026** |
| With QA buffer sprint | October 28, 2026 |
| Development tickets in scope | 54 |
| Unestimated tickets | 5 (AC-408 epic) |

## Jobs to Be Done

| Area | Associated Epics |
| -- | -- |
| JTBD: Issue Credentials | [AC-456](https://edfi.atlassian.net/browse/AC-456) |
| JTBD: Synchronize with Running Ed-Fi Deployments | [AC-363](https://edfi.atlassian.net/browse/AC-363), [ADMINAPI-1331](https://edfi.atlassian.net/browse/ADMINAPI-1331) |
| JTBD: Instance Management | [AC-506](https://edfi.atlassian.net/browse/AC-506), [ADMINAPI-1344](https://edfi.atlassian.net/browse/ADMINAPI-1344) |
| JTBD: Evaluate Claimsets and Profiles | TBD |
| Others: V3 specification integration on Admin App | [AC-522](https://edfi.atlassian.net/browse/AC-522) |
| Others: Implement E2E and unit test in Admin App | [AC-509](https://edfi.atlassian.net/browse/AC-509) |
| Others: Improve AdminAPI-2 Test Coverage | [ADMINAPI-1251](https://edfi.atlassian.net/browse/ADMINAPI-1251) |

## Epics

| Id | Title | Pending Story Points |
| -- | -- | -- |
| AC-363 | Non-Starting Blocks Synchronization Process | 3 |
| AC-509 | Implement E2E and unit test in Admin App | 32 |
| AC-522 | Admin App supports Admin Api with V3 specification | 26 |
| AC-506 | Instance Management Integration | 17 |
| AC-408 | Enhanced User Interface Functionality | TBD |
| ADMINAPI-1344 | Managing Ed-Fi ODS database instances using the Admin API | 6 |
| ADMINAPI-1439 | Claim Set Export - Import API Design - V3 | 12 |
| ADMINAPI-1251 | Improve AdminAPI-2 Test Coverage | 31 |

## Sprints

| Sprint | Starts | Ends |
| -- | -- | -- |
| Sprint 61 | May 27th | Jun 10th |
| Sprint 62 | Jun 10th | Jun 24th |
| Sprint 63 | Jun 24th | Jul 8th |
| Sprint 64 | Jul 8th | Jul 22nd |
| Sprint 65 | Jul 22nd | Aug 5th |
| Sprint 66 | Aug 5th | Aug 19th |
| Sprint 67 | Aug 19th | Sep 2nd |
| Sprint 68 | Sep 2nd | Sep 16th |
| Sprint 69 | Sep 16th | Sep 30th |
| Sprint 70 | Sep 30th | Oct 14th |
| Sprint 71 | Oct 14th | Oct 28th |
| Sprint 72 | Oct 28th | Nov 11th |
| Sprint 73 | Nov 11th | Nov 25th |
| Sprint 74 | Nov 25th | Dec 9th |

## Pending tickets per epic

### AC-363 Non-Starting Blocks Synchronization Process

| Link | Dependencies | Status | Story Points |
| -- | -- | -- | -- |
| https://edfi.atlassian.net/browse/AC-521 | None | Open | 3 |

### AC-509 Implement E2E and unit test in Admin App

| Link | Dependencies | Status | Story Points |
| -- | -- | -- | -- |
| https://edfi.atlassian.net/browse/AC-516 | None | Completed | 0 |
| https://edfi.atlassian.net/browse/AC-510 | None | Completed | 0 |
| https://edfi.atlassian.net/browse/AC-511 | AC-516 | Open | 8 |
| https://edfi.atlassian.net/browse/AC-512 | AC-516/AC-510 | Open | 2 |
| https://edfi.atlassian.net/browse/AC-513 | AC-516 | Open | 8 |
| https://edfi.atlassian.net/browse/AC-514 | AC-516 | Open | 5 |
| https://edfi.atlassian.net/browse/AC-515 | AC-516/AC-514/AC-513/AC-547 | Open | 3 |
| https://edfi.atlassian.net/browse/AC-536 | AC-516/AC-524 | Open | 8 |
| https://edfi.atlassian.net/browse/AC-544 | AC-516 | Open | 8 |
| https://edfi.atlassian.net/browse/AC-545 | AC-516/AC-524 | Open | 5 |
| https://edfi.atlassian.net/browse/AC-546 | AC-516/AC-511/AC-544 | Open | 8 |
| https://edfi.atlassian.net/browse/AC-547 | AC-516 | Open | 3 |
| https://edfi.atlassian.net/browse/AC-548 | AC-516/AC-522 | Open | 3 |
| https://edfi.atlassian.net/browse/AC-549 | AC-516/AC-522 | Open | 5 |

### AC-522 Admin App supports Admin Api with V3 specification

| Link | Dependencies | Status | Story Points |
| -- | -- | -- | -- |
| https://edfi.atlassian.net/browse/AC-523 | None | Completed | 0 |
| https://edfi.atlassian.net/browse/AC-524 | AC-523/AC-525 | Open | 5 |
| https://edfi.atlassian.net/browse/AC-525 | None | Open | 2 |
| https://edfi.atlassian.net/browse/AC-526 | AC-524/AC-523 | Open | 3 |
| https://edfi.atlassian.net/browse/AC-527 | AC-526 | Open | 3 |
| https://edfi.atlassian.net/browse/AC-528 | AC-526/AC-527 | Open | 5 |
| https://edfi.atlassian.net/browse/AC-529 | AC-526/AC-527 | Open | 3 |
| https://edfi.atlassian.net/browse/AC-530 | AC-526/AC-527 | Open | 3 |

### AC-506 Instance Management Integration

| Link | Dependencies | Status | Story Points |
| -- | -- | -- | -- |
| https://edfi.atlassian.net/browse/AC-507 | None | Open | 5 |
| https://edfi.atlassian.net/browse/AC-540 | AC-507 | Open | 3 |
| https://edfi.atlassian.net/browse/AC-541 | AC-507/AC-540 | Open | 3 |
| https://edfi.atlassian.net/browse/AC-542 | AC-507/AC-541 | Open | 3 |
| https://edfi.atlassian.net/browse/AC-543 | AC-507/AC-542 | Open | 3 |

### AC-408 Enhanced User Interface Functionality

| Link | Dependencies | Status | Story Points |
| -- | -- | -- | -- |
| https://edfi.atlassian.net/browse/AC-439 | TBD | TBD | TBD |
| https://edfi.atlassian.net/browse/AC-409 | TBD | TBD | TBD |
| https://edfi.atlassian.net/browse/AC-410 | TBD | TBD | TBD |
| https://edfi.atlassian.net/browse/AC-412 | TBD | TBD | TBD |
| https://edfi.atlassian.net/browse/AC-413 | TBD | TBD | TBD |

### ADMINAPI-1365 Sync Up Admin API 2.3 and CMS

| Link | Dependencies | Status | Story Points |
| -- | -- | -- | -- |
| https://edfi.atlassian.net/browse/ADMINAPI-1380 | None | Open | 5 |
| https://edfi.atlassian.net/browse/ADMINAPI-1383 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1382 | None | Open | 5 |
| https://edfi.atlassian.net/browse/AC-503 | None | Open | 2 |
| https://edfi.atlassian.net/browse/AC-504 | None | Open | 2 |

### ADMINAPI-1344 Managing Ed-Fi ODS database instances using the Admin API

| Link | Dependencies | Status | Story Points |
| -- | -- | -- | -- |
| https://edfi.atlassian.net/browse/ADMINAPI-1417 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1436 | ADMINAPI-1417 | Open | 3 |

### ADMINAPI-1439 Claim Set Export - Import API Design - V3

| Link | Dependencies | Status | Story Points |
| -- | -- | -- | -- |
| https://edfi.atlassian.net/browse/ADMINAPI-1440 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1441 | ADMINAPI-1440 | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1442 | ADMINAPI-1440/ADMINAPI-1441 | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1443 | ADMINAPI-1440/ADMINAPI-1441 | Open | 3 |

### ADMINAPI-1251 Improve AdminAPI-2 Test Coverage

| Link | Dependencies | Status | Story Points |
| -- | -- | -- | -- |
| https://edfi.atlassian.net/browse/ADMINAPI-1370 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1253 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1397 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1254 | None | Open | 5 |
| https://edfi.atlassian.net/browse/ADMINAPI-1256 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1257 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1398 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1399 | None | Open | 3 |
| https://edfi.atlassian.net/browse/ADMINAPI-1400 | None | Open | 2 |
| https://edfi.atlassian.net/browse/ADMINAPI-1255 | None | Open | 3 |

---

## Sprint Gantt Chart

```mermaid
gantt
	title Admin App 4.1 - Sprint Plan
	dateFormat  YYYY-MM-DD
	axisFormat  %b %d

	section Prerequisites
	AC-516/AC-510                                  :done, ac516, 2026-05-27, 2026-06-10
	AC-523                                         :done, ac523, 2026-05-27, 2026-06-10

	section Sprint 62 - Jun 10 to Jun 24 (~21 pts)
	AC-521                                          :ac521, 2026-06-10, 2026-06-24
	AC-507                                          :ac507, 2026-06-10, 2026-06-24
	ADMINAPI-1417                                   :a1417, 2026-06-10, 2026-06-24
	ADMINAPI-1370                                   :a1370, 2026-06-10, 2026-06-24
	ADMINAPI-1253                                   :a1253, 2026-06-10, 2026-06-24
	ADMINAPI-1400                                   :a1400, 2026-06-10, 2026-06-24
	AC-525                                          :ac525, 2026-06-10, 2026-06-24

	section Sprint 63 - Jun 24 to Jul 8 (~22 pts)
	AC-540                                          :ac540, 2026-06-24, 2026-07-08
	ADMINAPI-1436                                   :a1436, 2026-06-24, 2026-07-08
	ADMINAPI-1397                                   :a1397, 2026-06-24, 2026-07-08
	ADMINAPI-1254                                   :a1254, 2026-06-24, 2026-07-08
	AC-524                                          :ac524, 2026-06-24, 2026-07-08
	ADMINAPI-1383                                   :a1383, 2026-06-24, 2026-07-08

	section Sprint 64 - Jul 8 to Jul 22 (~22 pts)
	AC-541                                          :ac541, 2026-07-08, 2026-07-22
	AC-511                                          :ac511, 2026-07-08, 2026-07-22
	AC-512                                          :ac512, 2026-07-08, 2026-07-22
	ADMINAPI-1256                                   :a1256, 2026-07-08, 2026-07-22
	ADMINAPI-1398                                   :a1398, 2026-07-08, 2026-07-22
	AC-503                                          :ac503, 2026-07-08, 2026-07-22

	section Sprint 65 - Jul 22 to Aug 5 (~22 pts)
	AC-542                                          :ac542, 2026-07-22, 2026-08-05
	AC-513                                          :ac513, 2026-07-22, 2026-08-05
	AC-514                                          :ac514, 2026-07-22, 2026-08-05
	ADMINAPI-1399                                   :a1399, 2026-07-22, 2026-08-05
	ADMINAPI-1255                                   :a1255, 2026-07-22, 2026-08-05

	section Sprint 66 - Aug 5 to Aug 19 (~22 pts)
	AC-543                                          :ac543, 2026-08-05, 2026-08-19
	AC-526                                          :ac526, 2026-08-05, 2026-08-19
	AC-527                                          :ac527, 2026-08-05, 2026-08-19
	AC-529                                          :ac529, 2026-08-05, 2026-08-19
	ADMINAPI-1257                                   :a1257, 2026-08-05, 2026-08-19
	ADMINAPI-1380                                   :a1380, 2026-08-05, 2026-08-19
	AC-504                                          :ac504, 2026-08-05, 2026-08-19

	section Sprint 67 - Aug 19 to Sep 2 (~22 pts)
	AC-528                                          :ac528, 2026-08-19, 2026-09-02
	AC-530                                          :ac530, 2026-08-19, 2026-09-02
	AC-547                                          :ac547, 2026-08-19, 2026-09-02
	ADMINAPI-1382                                   :a1382, 2026-08-19, 2026-09-02
	ADMINAPI-1440                                   :a1440, 2026-08-19, 2026-09-02
	ADMINAPI-1441                                   :a1441, 2026-08-19, 2026-09-02

	section Post-ETA Backlog (Not in Sep 2 target)
	AC-515                                          :ac515, 2026-09-03, 2026-09-16
	AC-536                                          :ac536, 2026-09-03, 2026-09-16
	AC-544                                          :ac544, 2026-09-03, 2026-09-16
	AC-545                                          :ac545, 2026-09-03, 2026-09-16
	AC-546                                          :ac546, 2026-09-03, 2026-09-16
	AC-548                                          :ac548, 2026-09-03, 2026-09-16
	AC-549                                          :ac549, 2026-09-03, 2026-09-16
	ADMINAPI-1442                                   :a1442, 2026-09-03, 2026-09-16
	ADMINAPI-1443                                   :a1443, 2026-09-03, 2026-09-16

	section Unestimated Backlog
	AC-408                                          :ac408, 2026-08-05, 2026-09-16
	ADMINAPI-1365                                   :a1365, 2026-08-05, 2026-09-16

	section QA Buffer (Optional)
	QA Sign-off                                     :crit, qa, 2026-09-17, 2026-10-01
```
