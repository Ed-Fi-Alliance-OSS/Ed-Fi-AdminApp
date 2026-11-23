Feature: Certification happy path (PoC)

  # Runs after environmentv2andApi (see playwright.config.ts): the FullSingleEnvironmentv2
  # environment, the ApiTest team and the synced ODS exist by then.
  # The ODS key and secret are created on the fly through the Admin API (ods-credentials.ts).

  Scenario: Vendor creates a certification run and executes the Schools scenario
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team FullSingleEnvironmentv2 with team ApiTest
    And the vendor has ODS credentials for the data store
    When the user requests a new certification for FullSingleEnvironmentv2
    Then the Scenarios page lists at least one scenario
    When the user opens the Schools scenario
    Then its steps are listed
    When the user executes the steps of the scenario
    Then all steps report Successful
    When the user goes back to the scenarios
    Then the Schools scenario shows as Successful
