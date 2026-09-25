Feature: Environments V2 with Api validation

  Scenario Outline: Environment Management v2 with Api
    Given the user is logged with a valid user
    And the user create a new team called '<team>'
    And the user create a membership to the team '<team>' with user 'admin' and role 'admin'
    When the user click on Environment option
    And the user click on Connect button
    And the user fill all the required fields on v2 <name>, <edfiApi>, <edfiManagement>, <label>
    And the user click on save button
    And the API version is detected according to the edfi api version
    And the sync queue has a queued job
    And the user assign a grant ownership to the environment <name> with team <team>
    Then the environment displays the tenants by default <name>, <tenantName>
    And the sync queue is already completed
    And the user enter to environment using the team <name> with team <team>
    And the default ods loaded

    Examples:
      | name                    | edfiApi                                    | edfiManagement                                  | label      | tenantName | team         |
      | FullSingleEnvironmentv2 | https://localhost/odsv7-adminv2-single-api | https://localhost/odsv7-adminv2-single-adminapi | production | default    | ApiTest      |
      | FullMultiEnvironmentv2  | https://localhost/odsv7-adminv2-multi-api  | https://localhost/odsv7-adminv2-multi-adminapi  | production | tenant1    | MultiApiTest |

  Scenario Outline: Create ODS template
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on ODS option
    And the user clicks on Create button
    When the user fills the ODS fields <name>, <template>
    And the user clicks on save button
    Then a new ODS <name> should be displayed on the table with status create pending
    And the ODS contains the details

    Examples:
      | environment             | name              | template |
      | FullSingleEnvironmentv2 | MinimalTemplate   | Minimal  |
      | FullSingleEnvironmentv2 | PopulatedTemplate | Sample   |

  Scenario Outline: Cancel create ODS template
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on ODS option
    And the user clicks on Create button
    When the user fills the ODS fields <name>, <template>
    And the user clicks on cancel button
    Then the ODS <name> not should be displayed on the table

    Examples:
      | environment             | name           | template |
      | FullSingleEnvironmentv2 | CancelTemplate | Minimal  |

  Scenario Outline: ODS validation fields
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on ODS option
    And the user clicks on Create button
    When the user clicks on save button
    Then not should be possible create the ods
    And a warning message should be displayed on ods fields

    Examples:
      | environment             |
      | FullSingleEnvironmentv2 |

    Examples:
      | environment             | name            |
      | FullSingleEnvironmentv2 | MinimalTemplate |

  Scenario Outline: View Education Organizations
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    When the user clicks on Ed-Orgs option
    Then the Ed-Orgs table should be displayed

    Examples:
      | environment             |
      | FullSingleEnvironmentv2 |

  Scenario Outline: Create Vendor test
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Vendor option
    And the user clicks on New button
    When the user fills the vendor fields <company>, <prefixes>, <contactName>, <contactEmail>
    And the user clicks on save button
    Then the details of vendors should be displayed

    Examples:
      | environment             | company    | prefixes        | contactName | contactEmail        |
      | FullSingleEnvironmentv2 | Edfy       | uri://ed-fi.org | EdfyTest    | edfy@mail.com       |
      | FullSingleEnvironmentv2 | Automation | uri://ed-fi.org | EdfyTest    | automation@mail.com |

  Scenario Outline: Cancel create vendor
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Vendor option
    And the user clicks on New button
    When the user fills the vendor fields <company>, <prefixes>, <contactName>, <contactEmail>
    And the user clicks on cancel button
    Then the vendor <company> not should be displayed on the table

    Examples:
      | environment             | company            | prefixes        | contactName   | contactEmail    |
      | FullSingleEnvironmentv2 | NoVendorCreated    | uri://ed-fi.org | NoEdfyTest    | noedfy@mail.com |

  Scenario Outline: Vendor validation fields
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Vendor option
    And the user clicks on New button
    And the user clicks on save button
    Then warnings message should be displayed

    Examples:
      | environment             |
      | FullSingleEnvironmentv2 |

  Scenario Outline: Edit vendor from row actions
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Vendor option
    And the user clicks the Edit vendor action
    When the user fills the vendor fields <company>, <prefixes>, <contactName>, <contactEmail>
    And the user clicks on save button
    Then the details of vendors should be displayed

    Examples:
      | environment             | company     | prefixes       | contactName | contactEmail         |
      | FullSingleEnvironmentv2 | EdfyUpdated | uri://edfi.org | Update Name | edfyUpdated@mail.com |

  Scenario Outline: Edit vendor from details
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Vendor option
    And the user clicks the first vendor in the table
    When the user fills the vendor fields <company>, <prefixes>, <contactName>, <contactEmail>
    And the user clicks on save button
    Then the details of vendors should be displayed

    Examples:
      | environment             | company       | prefixes       | contactName | contactEmail        |
      | FullSingleEnvironmentv2 | VendorUpdated | uri://edfi.org | Update Name | edfyVendor@mail.com |

  Scenario Outline: Delete vendor from row actions
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Vendor option
    And the user clicks the Delete vendor action
    When the user confirms vendor deletion
    Then the vendor <company> should be removed from the current table

    Examples:
      | environment             | company |
      | FullSingleEnvironmentv2 | Edfy    |

  Scenario Outline: Delete vendor from details
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Vendor option
    And the user clicks the first vendor in the table
    And the user clicks the Delete tab option
    When the user confirms vendor deletion
    Then the vendor <company> should be removed from the current table

    Examples:
      | environment             | company     |
      | FullSingleEnvironmentv2 | Automation  |

  Scenario Outline: Application validation fields
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Application option
    And the user clicks on New button
    When the user clicks on save button
    Then warnings message should be displayed on each field

    Examples:
      | environment             |
      | FullSingleEnvironmentv2 |

  Scenario Outline: Delete ODS from row actions
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on ODS option
    And the user hover on the ods <name>
    And the user clicks the Delete ods action
    When the user confirms ods deletion
    Then the ods <name> should have the label Delete: Pending

    Examples:
      | environment             | name              |
      | FullSingleEnvironmentv2 | PopulatedTemplate |

  Scenario Outline: Delete ODS from details
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on ODS option
    And the user clicks on the ods <name>
    And the user clicks the Delete tab option
    When the user confirms ods deletion
    Then the ods <name> should have the label Delete: Pending

    Examples:
      | environment             | name            |
      | FullSingleEnvironmentv2 | MinimalTemplate |


  Scenario Outline: Import profiles
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Profile option
    And the user clicks on New button
    When the user import a valid profile
    And the user clicks on Save button
    Then the profile should be created

    Examples:
      | environment             |
      | FullSingleEnvironmentv2 |

  Scenario Outline: Profiles validation fields
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Profile option
    And the user clicks on New button
    When the user clicks on Save button
    Then a warning message should be displayed on profiles fields

    Examples:
      | environment             |
      | FullSingleEnvironmentv2 |

  Scenario Outline: Import invalid profile
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user enter to environment using the team <environment> with team ApiTest
    And the user clicks on Profile option
    And the user clicks on New button
    When the user import an invalid profile
    And the user clicks on Save button
    Then an error message should be displayed that is not possible create the profile

    Examples:
      | environment             |
      | FullSingleEnvironmentv2 |
