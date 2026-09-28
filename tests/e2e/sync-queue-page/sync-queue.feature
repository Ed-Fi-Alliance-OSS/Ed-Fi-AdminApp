Feature: Sync Queue

  Rule: User already has a Team Ownership, Environment, Team, Role created

    Scenario: Sync queue
      Given the user is logged with a valid user
      When the user clicks the Sync queue option
      Then the sync table should be displayed with all task completed
