# PRD: Deployment Guide for Admin App v4

> **Last updated:** 26 June 2026
> **Owner:** Stephen Fuqua, Ed-Fi Alliance \
> **Jira Project:** AC \
> **Repository:** `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`

## Overview

This Product Requirements Document (PRD) outlines improvements to the initial deployment and setup of the Ed-Fi Admin App v4, intended to reduce the time to value for new users of the application.

## Purpose and Strategic Alignment

The Ed-Fi Alliance's strategic goals for 2026 include *"Growth, maintenance, and technical support for the Ed-Fi Data Standard and Ed-Fi Technology Suite"*. Under this heading, we have a sub-goal of:

> Tool enhancements for cost-effective administration of large-scale deployments of the Ed-Fi API applications: adoption of new tools in 10 strategic deployments

In this sense, the applications in question are the Ed-Fi Admin App v4 and the Ed-Fi ODS Admin API v2 application that supports it. In 2026, we have identified database instance management and certification automation as key themes for new feature development, which may help drive the adoption goal. However, it will take time to develop these features, and there is frequently a lag time between release of Ed-Fi software and its adoption.

The goal for strategic deployments does not require these new features; deployment of the December 2025 releases (Admin App v4.0 and Admin API v2.3) also qualify. For the most part, this is a job for Ed-Fi staff, who will perform outreach and education.

This document outlines additional engineering efforts intended to lower barriers to entry once an agency decides to embark on deployment of these applications.

## Target Market

While the true goal for Admin App is to support "large scale" installations — with many school years and many school districts to support — most of our current community members have simple setups. The "large scale" goal is more about the future than the present.

Therefore, this PRD targets any relatively simple deployment scenarios in settings including pilot data hubs, state education agencies, and commercial deployments. For simplicity's sake, the document will be framed from the perspective of a small to medium sized state; however, the same factors largely apply in all other scenarios.

## Personas

### SEA System Administrator

Consider a system administrator at a state education agency (SEA) whose primary mission is to collect local education agency (LEA) data for mandatory state reporting. This system administrator is in a hybrid IT role, serving both as a programmer and an IT administrator. They are responsible for deployment and maintenance of the Ed-Fi Technology Suite running on either Windows Server on-premises or have recently moved to a cloud provider. They may be interested in Docker but likely have little practical experience with it at this time.

**Primary motivations**

- Create and manage Ed-Fi ODS/API credentials for all applications that need to submit data on behalf of an LEA.
- Get into the application quickly and get out again, back to other pressing concerns.

**Technical depth**

- Has broad, but not deep, responsibilities covering programming, data engineering, deployment, and technical support.
- Technical skills are rooted in support and deployment of .NET applications in Windows, using Microsoft SQL Server, and hosting web applications in Microsoft IIS.

**Key challenges**

- Lack of time for professional development, learning new skills such as development and support of Node.js applications.

## Jobs to Be Done

This document assumes several other jobs to be done that have already been delivered in the Admin App version 4.0 release, such as:

- Create API client credentials
- Manage claimsets
- Upload new profiles
- Etc.

### JTBD 1: Install Admin App in Windows Server

**Primary personas:** SEA System Administrator

**When** I am deploying the Ed-Fi Admin App,  
**I want** to quickly understand the recommended system architecture and automate as many steps as possible,  
**so I can** begin issuing Ed-Fi ODS/API credentials for application integrations.

**How the Deployment Guide Helps**

- Lays out a roadmap for successful deployment and use of the Admin App.
- Streamlines decision-making.
- Provides tools and guidance to automate portions of the setup process.

**Signals of Success**

- Clear understanding of the technical requirements for deployment.
- Fewer mouse clicks through the user interface before getting to credential management.
- Low latency when accessing the application.

## Scope

Work on this PRD will deliver improved documentation and scripts to aide in deployment of the new Ed-Fi Admin App. Outputs from this work include:

- New and/or improved documentation articles for [docs.ed-fi.org](https://docs.ed-fi.org)
- SQL scripts for rapid initial data setup
- PowerShell scripts for deployment of the Ed-Fi Admin App application in a Windows Server environment

New articles will be placed in the context of the SEA Playbook in the Getting Started section of the documentation site. Additional modifications may also be necessary in the Admin App and/or ODS Admin API pages in the Reference section.

New automation scripts will be placed in the main branch of the Admin App or other source code repositories as appropriate.

These materials will focus on installation in Windows with Microsoft SQL Server, assuming installation on a virtual machine that could be on-premises or in the cloud. Time permitting, they may be extended to provide high-level guidance on using Docker and/or managed cloud services, and to include translation of SQL scripts to PostgreSQL.

## Must Have Features

The features below describe known points of friction and frustration for those new to the Ed-Fi Admin App, along with a brief overview of an approach to easing that frustration.

> ⚠️ **Note:** The contents below include recipes and conditions of satisfaction. The recipes are intended as a starting point for understanding the challenge. The engineers implementing this PRD should review and adjust as needed.

### FT1: Entra ID as Alternative to Keycloak

**Goal:** Help the reader configure Microsoft Entra ID as an Open ID Connect provider for Admin App.

For additional context and initial work on this, see [Setup a Microsoft Entra ID instance to test OpenID Connect with Admin Console](https://edfi.atlassian.net/wiki/spaces/OTD/pages/954531848/Setup+an+Microsoft+Entra+ID+instance+to+test+OpenID+Connect+with+Admin+Console) and [Jira work item AC-247](https://edfi.atlassian.net/browse/AC-247).

**Recipe**

- Details about how to configure Entra ID are not yet known, and will need to be determined by the engineers working on this PRD.
- Provide instructions on both Entra ID, and on how to configure the `oidc` table so that Admin App will use the correct provider.

**Conditions of Satisfaction**

- A system administrator can sign-in to Admin App using a Microsoft account instead of using Keycloak.
- **NOTE:** These instructions should work whether Admin App is running in Linux (including Docker containers) or in Windows.

### FT2: Roadmap to Success

**Goal:** Help the user understand the deployment architecture and make critical decisions before beginning the installation process. This "Roadmap to Success" page would become part of the [Getting Started](https://docs.ed-fi.org/reference/admin-app/getting-started) documentation.

**Recipe**

- Introduce the primary purpose of the application: management of vendor credentials for integrating with one or more deployments of the Ed-Fi ODS/API, each containing one or more ODS database instances (e.g. one instance per school year[^1]).
- Provide a simple C4 diagram showing relationships between the following components:
  - Ed-Fi Admin App
  - Ed-Fi ODS Admin API
  - Ed-Fi ODS/API
  - `EdFi_Admin` database
  - `EdFi_Security` database
  - `AdminApp` database
  - Identity provider
- Mention that user authentication requires use of an Open ID Connect (OIDC) compatible Identity Provider (IdP) such as Keycloak or Microsoft Entra ID.
- Prescribe that the application initially be placed inside the network security firewall, for access only by staff and contractors, in order to limit the attack surface.
- Include a note about the optional Yopass component, mentioning that it provides higher security for sharing credentials, at the cost of additional components to install and configure. Note that Yopass would need to be accessible to vendors through the firewall. Then link out to the reference documentation for more information on installation.
- Introduce basic concepts in the Ed-Fi Admin App:
  - Teams
  - Environments
  - Instances
  - Education Organizations
  - Vendors
  - Profiles
  - Claimsets
  - Applications
  - Credentials
- The [User's Guide to Admin App v4](https://docs.ed-fi.org/reference/admin-app/user-guide/) already documents many of these concepts. We want to make sure there is a single glossary that defines these concepts, and perhaps some diagrams that show how the concepts relate to each other (e.g. one team can manage one or many environments; one environment can have multiple instances with different education organizations; one environment can have multiple vendors, profiles, and claimsets; each vendor can have multiple applications; an application has a claimset and a profile, and it can have many credentials).
- Clarify that this deployment guide will help them quickly move through setup of a single user with full administrative rights, with a single team, single environment, and two school year ODS instances, and two local education agencies.

**Conditions of Satisfaction**

- A reader on docs.ed-fi.org will have a strong understanding of how Admin App relates to the Ed-Fi Technology Suite and what components they can manage within the Technology Suite.

### FT3: Windows Server Installation

**Goal:** Walk through installation steps for the necessary components.

**Assumptions**

- The Ed-Fi ODS/API is already installed and configured.
- User is familiar with basic Windows administrative tasks.
- User is comfortable configuring IIS, including TLS certificate setup.

**Recipe** — provides instructions for:

- Creating an Admin App system user in Entra ID, then recording the Entra ID settings for later use:
  - Page for accessing personal account information, if available
  - Issuer name
  - Admin App system credentials:
    - Client ID
    - Client Secret
    - Scope
- Installing the `AdminApp` database tables, with a recommendation to install into its own database instance independent from the `EdFi_Admin` and `EdFi_Security` databases. This allows the application to support multiple deployments of the ODS/API in the future, for example when a prior year is on a different ODS/API version than the current year.
- Inserting Entra ID settings into the Admin App `oidc` table.
- Configuring and loading the web site files into IIS as a new web site, with optional PowerShell script.
- Running Admin App's Node.js backend so that it starts automatically and recovers from failures, and configuring IIS as a reverse-proxy to it. The specific hosting mechanism — for example an IIS-managed process or a standalone background service — is an implementation decision left to the engineers.

**Conditions of Satisfaction**

- A reader on docs.ed-fi.org, following these steps, will be able to sign-in to Admin App with administrative credentials and perform basic tasks in the application (e.g. creating an environment).

### FT4: Global Admin Quick Start

**Goal:** Simplify the global admin configuration process so that the user can more quickly get to their end goal of credential management.

**Recipe**

- Provide a SQL script to pre-configure the global admin with default settings:
  - Administrative user, with username set as a variable at the top of the script
    - This should be the same user configured in the initial Admin App bootstrap script
  - Create a single team
  - Place the user in that team with global admin role
  - Create a single environment, with the environment name as a variable at the top of the script, defaulting to `"Ed-Fi ODS/API v7.3"`
  - Set the new team to own the environment
  - Anything else required so that the user can enter the application and go straight to instance management
- Describe variables and note the username must have already been created in the OAuth provider (Entra ID, Keycloak, etc.).
- Instruct the reader to run the script in the Admin App database.
- Additionally, instruct on setup of the `dbo.odsInstances` table in the `EdFi_Admin` database, if not already configured. If already configured, note the exact instance names.
- Direct the user to try logging into the Admin App application using their administrative user account, and navigate to the environment management page to enter the ODS instance names recorded above.
- Provide links to detailed Reference pages wherever applicable.

**Conditions of Satisfaction**

- A system administrator will be able to install Admin App and then run this script. After running the script, the system administrator can sign-in to Admin App, can enter the new environment, and can begin managing instances.

### FT5: Claimsets

**Background:** Admin App does not allow users to create an application with one of the default claimsets. The end user must first copy, rename, and upload one of these claimsets.

**Goal:** Automate the copy-and-rename process for all built-in claimsets.

**Recipe**

- Provide a SQL script that copies built-in claimsets and recreates them under a new name prefixed with `"AA"` for Admin App / Admin API. For example, it would copy the `"SIS Vendor"` claimset as `"AA SIS Vendor"`. Prefixing with `"AA"` will make it easy to select the new claimset in a dropdown menu.
- This script will need to insert data into the following tables:
  - `ClaimSets`
  - `ClaimSetResourceClaimActions`
  - `ClaimSetResourceClaimActionAuthorizationStrategyOverrides`
- Instruct the reader to run the script in the `EdFi_Security` database.

**Acceptance Criteria**

- After running this script, a system administrator can sign-in to Admin App and create a new set of client credentials using the just-created claimset copies.

### FT6: Changes to Existing Documentation

**Goal:** Minor reorganization of documentation.

**Conditions of Satisfaction**

- Move or remove some content from the existing Reference pages:
  - Move to the new deployment guide: *Security Considerations*
  - Replace "Windows IIS" guidance with a link to the new pages: *"For Windows installation, see the SEA Deployment Guide"*
- Reorder the page links in the left-side navigation pane, moving "Installing Ed-Fi Admin App" to the top, followed by "Configuring an Identity Provider", and leaving all other pages in the same order.
- The ODS Instance script in the Global Administration Tasks page fails to mention which database this is in (`EdFi_Admin`).

### FT7: Education Organization Synchronization

**Background:** Today, Admin App users must manually create Education Organizations in the Admin App database. The next release of Admin App (4.1) will provide a synchronization utility.

**Goal:** Create a one-time process for copying education organizations into the Admin App database.

**Assumption:** Admin App has already been configured with relevant environments and instances.

**Recipe**

- Determine the requirements for loading education organizations into the Admin App database.
- Provide a SQL and/or PowerShell script to export education organizations from an `EdFi_ODS` database into a CSV file.
- Provide a SQL and/or PowerShell script to transform and load those education organizations into the Admin App database.
- These scripts should take the *type* of education organization into account.

**Conditions of Satisfaction**

- After running the script, a system administrator can sign into Admin App and can see relevant education organizations while creating a new Application.

[^1]: In addition to the current school year, there may be regulatory reasons to keep one or more prior years' databases active, for example to accept corrections to prior years' data.
