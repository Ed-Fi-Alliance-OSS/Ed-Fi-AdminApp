Feature: Roles

  Scenario Outline: Create role test
    Given the user is logged with a valid user
    And the user clicks the Roles option
    And the user clicks the Create new role button
    When the user fills the role fields <name>, <description>, <type>, <privileges>
    And the user clicks the save role button
    Then the new role details should display <name>, <description>, <typeExpected>

    Examples:
      | name      | description  | type               | privileges     | typeExpected      |
      | userRoleA | descriptionA | User team          | All            | UserTeam          |
      | userRoleB | descriptionB | User global        | All            | UserGlobal        |
      | userRoleC | descriptionC | Resource ownership | All            | ResourceOwnership |
      | userRoleD | descriptionD | User team          | team           | UserTeam          |
      | userRoleE | descriptionE | User global        | me             | UserGlobal        |
      | userRoleF | descriptionF | Resource ownership | team           | ResourceOwnership |
      | userRoleG | descriptionG | User team          | role           | UserTeam          |
      | userRoleH | descriptionH | User global        | role           | UserGlobal        |
      | userRoleI | descriptionI | Resource ownership | sb-environment | ResourceOwnership |

  Scenario Outline: Cancel role creation
    Given the user is logged with a valid user
    And the user clicks the Roles option
    And the user clicks the Create new role button
    When the user fills the role fields <name>, <description>, <type>, <privileges>
    And the user clicks the cancel role button
    Then role <name> should not be created
    And the role list should be loaded

    Examples:
      | name      | description  | type               | privileges |
      | userRoleZ | descriptionZ | User team          | All        |
      | userRoleV | descriptionV | User global        | All        |
      | userRoleW | descriptionW | Resource ownership | All        |

  Rule: A role already exists

    Scenario: View role
      Given the user is logged with a valid user
      And the user clicks the Roles option
      When the user clicks the View role action
      Then the role description, type, and privileges should be displayed

    Scenario Outline: Edit role from row actions
      Given the user is logged with a valid user
      And the user clicks the Roles option
      And the user filter the role created
      And the user clicks the Edit role action
      When the user updates the role fields <name>, <description>, <privileges>
      And the user clicks the save role button
      Then the updated role details should display <name> and <description>

      Examples:
        | name        | description        | privileges |
        | roleUpdateA | updateDescriptionA | All        |
        | roleUpdateB | updateDescriptionB | All        |
        | roleUpdateC | updateDescriptionC | All        |

    Scenario Outline: Edit role from details
      Given the user is logged with a valid user
      And the user clicks the Roles option
      And the user filter the role created <roleName>
      And the user clicks role named <roleName>
      And the user clicks the edit role tab
      When the user updates the role fields <name>, <description>, <privileges>
      And the user clicks the save role button
      Then the updated role details should display <name> and <description>

      Examples:
        | roleName     | name        | description        | privileges |
        | userRoleG    | roleUpdateG | updateDescriptionG | All        |
        | userRoleI    | roleUpdateI | updateDescriptionI | All        |

    Scenario Outline: Delete role from details
      Given the user is logged with a valid user
      And the user clicks the Roles option
      And the user filter the role created <roleName>
      And the user clicks role named <roleName>
      And the user clicks the delete role tab
      When the user confirms role deletion
      Then the selected role should be removed from the role table

      Examples:
        | roleName    |
        | roleUpdateA |
        | roleUpdateB |
        | roleUpdateC |

    Scenario: Delete role from row actions
      Given the user is logged with a valid user
      And the user clicks the Roles option
      And the user filter the role created
      And the user clicks the Delete role action
      When the user confirms role deletion
      Then the selected role should be removed from the role table

    Scenario: Cancel role deletion
      Given the user is logged with a valid user
      And the user clicks the Roles option
      And the user filter the role created
      And the user clicks the Delete role action
      When the user cancels role deletion
      Then the selected role should not be removed from the role table
