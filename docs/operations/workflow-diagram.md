# GitHub Actions Workflow Analysis

## Summary
- **Total Workflows**: 22
- **Main Workflows**: 9
- **Reusable Workflows**: 13

## Legend

The diagrams use color coding to distinguish different types of workflow components:

**Triggers** - Event triggers that start workflows:
```mermaid
flowchart LR
    trigger_example(["trigger (push, schedule, etc.)"])
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    class trigger_example trigger
```

**Main Workflows** - Primary workflow files that can be triggered directly:
```mermaid
flowchart LR
    main_workflow_example["Main Workflow"]
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    class main_workflow_example mainWorkflow
```

**Reusable Workflows** - Workflow files that are called by other workflows:
```mermaid
flowchart LR
    reusable_workflow_example["Reusable Workflow"]
    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    class reusable_workflow_example reusable
```

**Jobs** - Individual jobs within workflows showing internal dependencies:
```mermaid
flowchart LR
    job_example["job-name"]
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000
    class job_example job
```


## Workflow Flow Diagrams by Trigger

### Delete Triggered Workflows

Workflows triggered by `delete`:
- **Clean up Flexion Azure Resources** (`azure-remove-branch.yml`)

```mermaid
flowchart LR
    trigger_delete(["delete"])
    azure_remove_branch_yml["Clean up Flexion Azure Resources"]
    azure_remove_branch_yml_list["list"]
    azure_remove_branch_yml_check["check"]
    azure_remove_branch_yml_clean_up["clean-up"]

    trigger_delete --> azure_remove_branch_yml
    azure_remove_branch_yml --> azure_remove_branch_yml_list
    azure_remove_branch_yml --> azure_remove_branch_yml_check
    azure_remove_branch_yml --> azure_remove_branch_yml_clean_up

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_delete trigger
    class azure_remove_branch_yml mainWorkflow
    class azure_remove_branch_yml_list job
    class azure_remove_branch_yml_check job
    class azure_remove_branch_yml_clean_up job
```

### Push Triggered Workflows

Workflows triggered by `push`:
- **Continuous Deployment** (`continuous-deployment.yml`)

```mermaid
flowchart LR
    trigger_push(["push"])
    continuous_deployment_yml["Continuous Deployment"]
    continuous_deployment_yml_setup["Setup"]
    reusable_build_info_yml["reusable-build-info.yml"]
    reusable_build_info_yml_build_info["Run Info"]
    continuous_deployment_yml_accessibility_test["accessibility-test"]
    reusable_accessibility_yml["reusable-accessibility.yml"]
    reusable_accessibility_yml_playwright_accessibility_test["playwright-accessibility-test"]
    continuous_deployment_yml_unit_test_frontend["unit-test-frontend"]
    reusable_unit_test_yml["reusable-unit-test.yml"]
    reusable_unit_test_yml_unit_test["Unit test ${{ inputs.path }}"]
    continuous_deployment_yml_unit_test_backend["unit-test-backend"]
    continuous_deployment_yml_unit_test_common["unit-test-common"]
    continuous_deployment_yml_security_scan["Security"]
    sub_security_scan_yml["Security"]
    sub_security_scan_yml_sca_scan["SCA Scan"]
    sub_security_scan_yml_sast_scan["SAST Scan"]
    continuous_deployment_yml_build["Build"]
    sub_build_yml["sub-build.yml"]
    sub_build_yml_see_slot_name["see-slot-name"]
    sub_build_yml_build_frontend_predeployment["Build Frontend Predeployment"]
    reusable_build_frontend_yml["reusable-build-frontend.yml"]
    reusable_build_frontend_yml_build_frontend["build-frontend"]
    sub_build_yml_backend["backend"]
    continuous_deployment_yml_deploy["Cloud Resource Deployment"]
    sub_deploy_yml["sub-deploy.yml"]
    sub_deploy_yml_deploy_infra["Azure Infrastructure"]
    reusable_deploy_yml["reusable-deploy.yml"]
    reusable_deploy_yml_deploy_azure_infrastructure["deploy-azure-infrastructure"]
    sub_deploy_yml_build_frontend_deployment_artifact["Build Frontend for deployment"]
    sub_deploy_yml_deploy_supporting_infrastructure["Supporting Infrastructure"]
    reusable_infrastructure_deploy_yml["reusable-infrastructure-deploy.yml"]
    reusable_infrastructure_deploy_yml_deploy_log_analytics_workspace["deploy-log-analytics-workspace"]
    reusable_infrastructure_deploy_yml_deploy_db["deploy-db"]
    continuous_deployment_yml_deploy_code_slot["Slot Code Deployment"]
    sub_deploy_code_slot_yml["sub-deploy-code-slot.yml"]
    sub_deploy_code_slot_yml_deploy_code["Slot Code Deployment"]
    sub_deploy_code_yml["sub-deploy-code.yml"]
    sub_deploy_code_yml_deploy_webapp["deploy-webapp"]
    sub_deploy_code_yml_deploy_api["deploy-api"]
    sub_deploy_code_yml_deploy_dataflows_app["deploy-dataflows-app"]
    sub_deploy_code_yml_endpoint_test_application["endpoint-test-application"]
    reusable_endpoint_test_yml["reusable-endpoint-test.yml"]
    reusable_endpoint_test_yml_endpoint_test_application["endpoint-test-application"]
    sub_deploy_code_yml_enable_access["enable-access"]
    sub_deploy_code_slot_yml_deploy_webapp_slot["deploy-webapp-slot"]
    sub_deploy_code_slot_yml_deploy_api_slot["deploy-api-slot"]
    sub_deploy_code_slot_yml_deploy_dataflows_slot["deploy-dataflows-slot"]
    sub_deploy_code_slot_yml_endpoint_test_application_slot["endpoint-test-application-slot"]
    sub_deploy_code_slot_yml_execute_e2e_test["execute-e2e-test"]
    reusable_e2e_yml["reusable-e2e.yml"]
    reusable_e2e_yml_playwright_e2e_test["playwright-e2e-test"]
    sub_deploy_code_slot_yml_swap_webapp_deployment_slot["swap-webapp-deployment-slot"]
    sub_deploy_code_slot_yml_swap_nodeapi_deployment_slot["swap-nodeapi-deployment-slot"]
    sub_deploy_code_slot_yml_swap_dataflows_app_deployment_slot["swap-dataflows-app-deployment-slot"]
    sub_deploy_code_slot_yml_endpoint_test_application_post_swap["endpoint-test-application-post-swap"]
    sub_deploy_code_slot_yml_enable_access["enable-access"]

    trigger_push --> continuous_deployment_yml
    continuous_deployment_yml --> continuous_deployment_yml_setup
    reusable_build_info_yml --> reusable_build_info_yml_build_info
    continuous_deployment_yml_setup --> reusable_build_info_yml
    continuous_deployment_yml --> continuous_deployment_yml_accessibility_test
    reusable_accessibility_yml --> reusable_accessibility_yml_playwright_accessibility_test
    continuous_deployment_yml_accessibility_test --> reusable_accessibility_yml
    continuous_deployment_yml --> continuous_deployment_yml_unit_test_frontend
    reusable_unit_test_yml --> reusable_unit_test_yml_unit_test
    continuous_deployment_yml_unit_test_frontend --> reusable_unit_test_yml
    continuous_deployment_yml --> continuous_deployment_yml_unit_test_backend
    continuous_deployment_yml_unit_test_backend --> reusable_unit_test_yml
    continuous_deployment_yml --> continuous_deployment_yml_unit_test_common
    continuous_deployment_yml_unit_test_common --> reusable_unit_test_yml
    continuous_deployment_yml --> continuous_deployment_yml_security_scan
    sub_security_scan_yml --> sub_security_scan_yml_sca_scan
    sub_security_scan_yml --> sub_security_scan_yml_sast_scan
    continuous_deployment_yml_security_scan --> sub_security_scan_yml
    continuous_deployment_yml --> continuous_deployment_yml_build
    sub_build_yml --> sub_build_yml_see_slot_name
    sub_build_yml --> sub_build_yml_build_frontend_predeployment
    reusable_build_frontend_yml --> reusable_build_frontend_yml_build_frontend
    sub_build_yml_build_frontend_predeployment --> reusable_build_frontend_yml
    sub_build_yml --> sub_build_yml_backend
    continuous_deployment_yml_build --> sub_build_yml
    continuous_deployment_yml --> continuous_deployment_yml_deploy
    sub_deploy_yml --> sub_deploy_yml_deploy_infra
    reusable_deploy_yml --> reusable_deploy_yml_deploy_azure_infrastructure
    sub_deploy_yml_deploy_infra --> reusable_deploy_yml
    sub_deploy_yml --> sub_deploy_yml_build_frontend_deployment_artifact
    sub_deploy_yml_build_frontend_deployment_artifact --> reusable_build_frontend_yml
    sub_deploy_yml --> sub_deploy_yml_deploy_supporting_infrastructure
    reusable_infrastructure_deploy_yml --> reusable_infrastructure_deploy_yml_deploy_log_analytics_workspace
    reusable_infrastructure_deploy_yml --> reusable_infrastructure_deploy_yml_deploy_db
    sub_deploy_yml_deploy_supporting_infrastructure --> reusable_infrastructure_deploy_yml
    continuous_deployment_yml_deploy --> sub_deploy_yml
    continuous_deployment_yml --> continuous_deployment_yml_deploy_code_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_deploy_code
    sub_deploy_code_yml --> sub_deploy_code_yml_deploy_webapp
    sub_deploy_code_yml --> sub_deploy_code_yml_deploy_api
    sub_deploy_code_yml --> sub_deploy_code_yml_deploy_dataflows_app
    sub_deploy_code_yml --> sub_deploy_code_yml_endpoint_test_application
    reusable_endpoint_test_yml --> reusable_endpoint_test_yml_endpoint_test_application
    sub_deploy_code_yml_endpoint_test_application --> reusable_endpoint_test_yml
    sub_deploy_code_yml --> sub_deploy_code_yml_enable_access
    sub_deploy_code_slot_yml_deploy_code --> sub_deploy_code_yml
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_deploy_webapp_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_deploy_api_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_deploy_dataflows_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_endpoint_test_application_slot
    sub_deploy_code_slot_yml_endpoint_test_application_slot --> reusable_endpoint_test_yml
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_execute_e2e_test
    reusable_e2e_yml --> reusable_e2e_yml_playwright_e2e_test
    sub_deploy_code_slot_yml_execute_e2e_test --> reusable_e2e_yml
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_swap_webapp_deployment_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_swap_nodeapi_deployment_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_swap_dataflows_app_deployment_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_endpoint_test_application_post_swap
    sub_deploy_code_slot_yml_endpoint_test_application_post_swap --> reusable_endpoint_test_yml
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_enable_access
    continuous_deployment_yml_deploy_code_slot --> sub_deploy_code_slot_yml

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_push trigger
    class continuous_deployment_yml mainWorkflow
    class continuous_deployment_yml_setup job
    class reusable_build_info_yml reusable
    class reusable_build_info_yml_build_info job
    class continuous_deployment_yml_accessibility_test job
    class reusable_accessibility_yml reusable
    class reusable_accessibility_yml_playwright_accessibility_test job
    class continuous_deployment_yml_unit_test_frontend job
    class reusable_unit_test_yml reusable
    class reusable_unit_test_yml_unit_test job
    class continuous_deployment_yml_unit_test_backend job
    class continuous_deployment_yml_unit_test_common job
    class continuous_deployment_yml_security_scan job
    class sub_security_scan_yml mainWorkflow
    class sub_security_scan_yml_sca_scan job
    class sub_security_scan_yml_sast_scan job
    class continuous_deployment_yml_build job
    class sub_build_yml reusable
    class sub_build_yml_see_slot_name job
    class sub_build_yml_build_frontend_predeployment job
    class reusable_build_frontend_yml reusable
    class reusable_build_frontend_yml_build_frontend job
    class sub_build_yml_backend job
    class continuous_deployment_yml_deploy job
    class sub_deploy_yml reusable
    class sub_deploy_yml_deploy_infra job
    class reusable_deploy_yml reusable
    class reusable_deploy_yml_deploy_azure_infrastructure job
    class sub_deploy_yml_build_frontend_deployment_artifact job
    class sub_deploy_yml_deploy_supporting_infrastructure job
    class reusable_infrastructure_deploy_yml reusable
    class reusable_infrastructure_deploy_yml_deploy_log_analytics_workspace job
    class reusable_infrastructure_deploy_yml_deploy_db job
    class continuous_deployment_yml_deploy_code_slot job
    class sub_deploy_code_slot_yml reusable
    class sub_deploy_code_slot_yml_deploy_code job
    class sub_deploy_code_yml reusable
    class sub_deploy_code_yml_deploy_webapp job
    class sub_deploy_code_yml_deploy_api job
    class sub_deploy_code_yml_deploy_dataflows_app job
    class sub_deploy_code_yml_endpoint_test_application job
    class reusable_endpoint_test_yml reusable
    class reusable_endpoint_test_yml_endpoint_test_application job
    class sub_deploy_code_yml_enable_access job
    class sub_deploy_code_slot_yml_deploy_webapp_slot job
    class sub_deploy_code_slot_yml_deploy_api_slot job
    class sub_deploy_code_slot_yml_deploy_dataflows_slot job
    class sub_deploy_code_slot_yml_endpoint_test_application_slot job
    class sub_deploy_code_slot_yml_execute_e2e_test job
    class reusable_e2e_yml reusable
    class reusable_e2e_yml_playwright_e2e_test job
    class sub_deploy_code_slot_yml_swap_webapp_deployment_slot job
    class sub_deploy_code_slot_yml_swap_nodeapi_deployment_slot job
    class sub_deploy_code_slot_yml_swap_dataflows_app_deployment_slot job
    class sub_deploy_code_slot_yml_endpoint_test_application_post_swap job
    class sub_deploy_code_slot_yml_enable_access job
```

##### Continuous Deployment - Job Dependencies

This diagram shows the explicit and implicit dependencies between jobs in the continuous deployment workflow:

```mermaid
flowchart LR
    subgraph "External Inputs"
        Variables["Variables"]
        Variables_CAMS_BASE_PATH["CAMS_BASE_PATH"]
        Variables_CAMS_LAUNCH_DARKLY_ENV["CAMS_LAUNCH_DARKLY_ENV"]
        Variables_CAMS_SERVER_PORT["CAMS_SERVER_PORT"]
        Variables_CAMS_SERVER_PROTOCOL["CAMS_SERVER_PROTOCOL"]
        Variables_NODE_VERSION["NODE_VERSION"]
    end

    subgraph continuous_deployment_workflow["Continuous Deployment"]
        setup["Setup"]
        subgraph accessibility_test_subgraph["accessibility-test"]
            accessibility_test_vars["NODE_VERSION"]
        end
        subgraph unit_test_frontend_subgraph["unit-test-frontend"]
            unit_test_frontend_vars["NODE_VERSION"]
        end
        subgraph unit_test_backend_subgraph["unit-test-backend"]
            unit_test_backend_vars["NODE_VERSION"]
        end
        subgraph unit_test_common_subgraph["unit-test-common"]
            unit_test_common_vars["NODE_VERSION"]
        end
        security_scan["Security"]
        subgraph build_subgraph["Build"]
            build_vars["CAMS_BASE_PATH<br/>CAMS_LAUNCH_DARKLY_ENV<br/>CAMS_SERVER_PORT<br/>CAMS_SERVER_PROTOCOL<br/>NODE_VERSION<br/>apiFunctionName<br/>azResourceGrpAppEncrypted<br/>dataflowsFunctionName<br/>ghaEnvironment<br/>slotName<br/>webappName"]
        end
        subgraph deploy_subgraph["Cloud Resource Deployment"]
            deploy_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>azResourceGrpNetworkEncrypted<br/>dataflowsFunctionName<br/>deployVnet<br/>environmentHash<br/>ghaEnvironment<br/>slotName<br/>stackName<br/>webappName"]
        end
        subgraph deploy_code_slot_subgraph["Slot Code Deployment"]
            deploy_code_slot_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>dataflowsFunctionName<br/>environmentHash<br/>ghaEnvironment<br/>initialDeployment<br/>slotName<br/>stackName<br/>webappName"]
        end
    end

        Variables --> Variables_CAMS_BASE_PATH
        Variables --> Variables_CAMS_LAUNCH_DARKLY_ENV
        Variables --> Variables_CAMS_SERVER_PORT
        Variables --> Variables_CAMS_SERVER_PROTOCOL
        Variables --> Variables_NODE_VERSION
    Variables_CAMS_BASE_PATH -.-> build_subgraph
    Variables_CAMS_LAUNCH_DARKLY_ENV -.-> build_subgraph
    Variables_CAMS_SERVER_PORT -.-> build_subgraph
    Variables_CAMS_SERVER_PROTOCOL -.-> build_subgraph
    Variables_NODE_VERSION -.-> accessibility_test_subgraph
    Variables_NODE_VERSION -.-> build_subgraph
    Variables_NODE_VERSION -.-> unit_test_backend_subgraph
    Variables_NODE_VERSION -.-> unit_test_common_subgraph
    Variables_NODE_VERSION -.-> unit_test_frontend_subgraph
    accessibility_test_subgraph ==>|"needs"| deploy_subgraph
    build_subgraph ==>|"needs"| deploy_subgraph
    deploy_subgraph ==>|"needs"| deploy_code_slot_subgraph
    security_scan ==>|"needs"| deploy_subgraph
    setup ==>|"needs"| build_subgraph
    setup ==>|"needs"| deploy_code_slot_subgraph
    setup ==>|"needs"| deploy_subgraph
    unit_test_backend_subgraph ==>|"needs"| deploy_subgraph
    unit_test_common_subgraph ==>|"needs"| deploy_subgraph
    unit_test_frontend_subgraph ==>|"needs"| deploy_subgraph

    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,fill-opacity:0.15,stroke:#f3e5f5,stroke-width:1px,color:#ffffff
    classDef jobSubgraph fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000
    class continuous_deployment_workflow mainWorkflow
    class Variables external
    class accessibility_test_subgraph jobSubgraph
    class build_subgraph jobSubgraph
    class deploy_subgraph jobSubgraph
    class deploy_code_slot_subgraph jobSubgraph
    class security_scan job
    class setup job
    class unit_test_backend_subgraph jobSubgraph
    class unit_test_common_subgraph jobSubgraph
    class unit_test_frontend_subgraph jobSubgraph
```

##### Deploy code for slot - Job Dependencies

This diagram shows the explicit and implicit dependencies between jobs in the deploy code for slot workflow:

```mermaid
flowchart LR
    subgraph "External Inputs"
        Workflow_Inputs["Workflow Inputs"]
        Workflow_Inputs_apiFunctionName["apiFunctionName"]
        Workflow_Inputs_azResourceGrpAppEncrypted["azResourceGrpAppEncrypted"]
        Workflow_Inputs_dataflowsFunctionName["dataflowsFunctionName"]
        Workflow_Inputs_environmentHash["environmentHash"]
        Workflow_Inputs_ghaEnvironment["ghaEnvironment"]
        Workflow_Inputs_slotName["slotName"]
        Workflow_Inputs_stackName["stackName"]
        Workflow_Inputs_webappName["webappName"]
    end

    subgraph sub_deploy_code_slot_workflow["Deploy code for slot"]
        subgraph deploy_code_subgraph["Slot Code Deployment"]
            deploy_code_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>dataflowsFunctionName<br/>environmentHash<br/>ghaEnvironment<br/>stackName<br/>webappName"]
        end
        deploy_webapp_slot["deploy-webapp-slot"]
        deploy_api_slot["deploy-api-slot"]
        deploy_dataflows_slot["deploy-dataflows-slot"]
        subgraph endpoint_test_application_slot_subgraph["endpoint-test-application-slot"]
            endpoint_test_application_slot_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>environmentHash<br/>ghaEnvironment<br/>slotName<br/>stackName<br/>webappName"]
        end
        subgraph execute_e2e_test_subgraph["execute-e2e-test"]
            execute_e2e_test_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>dataflowsFunctionName<br/>environmentHash<br/>ghaEnvironment<br/>slotName<br/>stackName<br/>webappName"]
        end
        swap_webapp_deployment_slot["swap-webapp-deployment-slot"]
        swap_nodeapi_deployment_slot["swap-nodeapi-deployment-slot"]
        swap_dataflows_app_deployment_slot["swap-dataflows-app-deployment-slot"]
        subgraph endpoint_test_application_post_swap_subgraph["endpoint-test-application-post-swap"]
            endpoint_test_application_post_swap_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>environmentHash<br/>ghaEnvironment<br/>stackName<br/>webappName"]
        end
        enable_access["enable-access"]
    end

        Workflow_Inputs --> Workflow_Inputs_apiFunctionName
        Workflow_Inputs --> Workflow_Inputs_azResourceGrpAppEncrypted
        Workflow_Inputs --> Workflow_Inputs_dataflowsFunctionName
        Workflow_Inputs --> Workflow_Inputs_environmentHash
        Workflow_Inputs --> Workflow_Inputs_ghaEnvironment
        Workflow_Inputs --> Workflow_Inputs_slotName
        Workflow_Inputs --> Workflow_Inputs_stackName
        Workflow_Inputs --> Workflow_Inputs_webappName
    Workflow_Inputs_apiFunctionName -.-> deploy_code_subgraph
    Workflow_Inputs_apiFunctionName -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_apiFunctionName -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_apiFunctionName -.-> execute_e2e_test_subgraph
    Workflow_Inputs_azResourceGrpAppEncrypted -.-> deploy_code_subgraph
    Workflow_Inputs_azResourceGrpAppEncrypted -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_azResourceGrpAppEncrypted -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_azResourceGrpAppEncrypted -.-> execute_e2e_test_subgraph
    Workflow_Inputs_dataflowsFunctionName -.-> deploy_code_subgraph
    Workflow_Inputs_dataflowsFunctionName -.-> execute_e2e_test_subgraph
    Workflow_Inputs_environmentHash -.-> deploy_code_subgraph
    Workflow_Inputs_environmentHash -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_environmentHash -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_environmentHash -.-> execute_e2e_test_subgraph
    Workflow_Inputs_ghaEnvironment -.-> deploy_code_subgraph
    Workflow_Inputs_ghaEnvironment -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_ghaEnvironment -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_ghaEnvironment -.-> execute_e2e_test_subgraph
    Workflow_Inputs_slotName -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_slotName -.-> execute_e2e_test_subgraph
    Workflow_Inputs_stackName -.-> deploy_code_subgraph
    Workflow_Inputs_stackName -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_stackName -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_stackName -.-> execute_e2e_test_subgraph
    Workflow_Inputs_webappName -.-> deploy_code_subgraph
    Workflow_Inputs_webappName -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_webappName -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_webappName -.-> execute_e2e_test_subgraph
    deploy_api_slot ==>|"needs"| endpoint_test_application_slot_subgraph
    deploy_api_slot ==>|"needs"| execute_e2e_test_subgraph
    deploy_api_slot ==>|"needs"| swap_dataflows_app_deployment_slot
    deploy_api_slot ==>|"needs"| swap_nodeapi_deployment_slot
    deploy_api_slot ==>|"needs"| swap_webapp_deployment_slot
    deploy_dataflows_slot ==>|"needs"| endpoint_test_application_slot_subgraph
    deploy_dataflows_slot ==>|"needs"| execute_e2e_test_subgraph
    deploy_dataflows_slot ==>|"needs"| swap_dataflows_app_deployment_slot
    deploy_dataflows_slot ==>|"needs"| swap_nodeapi_deployment_slot
    deploy_dataflows_slot ==>|"needs"| swap_webapp_deployment_slot
    deploy_webapp_slot ==>|"needs"| endpoint_test_application_slot_subgraph
    deploy_webapp_slot ==>|"needs"| execute_e2e_test_subgraph
    deploy_webapp_slot ==>|"needs"| swap_dataflows_app_deployment_slot
    deploy_webapp_slot ==>|"needs"| swap_nodeapi_deployment_slot
    deploy_webapp_slot ==>|"needs"| swap_webapp_deployment_slot
    endpoint_test_application_post_swap_subgraph ==>|"needs"| enable_access
    endpoint_test_application_slot_subgraph ==>|"needs"| execute_e2e_test_subgraph
    execute_e2e_test_subgraph ==>|"needs"| swap_dataflows_app_deployment_slot
    execute_e2e_test_subgraph ==>|"needs"| swap_nodeapi_deployment_slot
    execute_e2e_test_subgraph ==>|"needs"| swap_webapp_deployment_slot
    swap_dataflows_app_deployment_slot ==>|"needs"| endpoint_test_application_post_swap_subgraph
    swap_nodeapi_deployment_slot ==>|"needs"| endpoint_test_application_post_swap_subgraph
    swap_webapp_deployment_slot ==>|"needs"| endpoint_test_application_post_swap_subgraph

    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,fill-opacity:0.15,stroke:#f3e5f5,stroke-width:1px,color:#ffffff
    classDef jobSubgraph fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000
    class sub_deploy_code_slot_workflow mainWorkflow
    class Workflow_Inputs external
    class deploy_api_slot job
    class deploy_code_subgraph jobSubgraph
    class deploy_dataflows_slot job
    class deploy_webapp_slot job
    class enable_access job
    class endpoint_test_application_post_swap_subgraph jobSubgraph
    class endpoint_test_application_slot_subgraph jobSubgraph
    class execute_e2e_test_subgraph jobSubgraph
    class swap_dataflows_app_deployment_slot job
    class swap_nodeapi_deployment_slot job
    class swap_webapp_deployment_slot job
```

### Schedule Triggered Workflows

Workflows triggered by `schedule`:
- **Build Custom Azure CLI Runner Image** (`build-azure-cli-image.yml`)
- **Stand Alone DAST Scan** (`dast-scan.yml`)

```mermaid
flowchart LR
    trigger_schedule(["schedule"])
    build_azure_cli_image_yml["Build Custom Azure CLI Runner Image"]
    build_azure_cli_image_yml_build_and_push["build-and-push"]
    dast_scan_yml["Stand Alone DAST Scan"]
    dast_scan_yml_setup["Setup"]
    reusable_build_info_yml["reusable-build-info.yml"]
    reusable_build_info_yml_build_info["Run Info"]
    dast_scan_yml_execute_dast_scan["execute-dast-scan"]
    reusable_dast_yml["reusable-dast.yml"]
    reusable_dast_yml_zap_dast_scan["zap-dast-scan"]

    trigger_schedule --> build_azure_cli_image_yml
    build_azure_cli_image_yml --> build_azure_cli_image_yml_build_and_push
    trigger_schedule --> dast_scan_yml
    dast_scan_yml --> dast_scan_yml_setup
    reusable_build_info_yml --> reusable_build_info_yml_build_info
    dast_scan_yml_setup --> reusable_build_info_yml
    dast_scan_yml --> dast_scan_yml_execute_dast_scan
    reusable_dast_yml --> reusable_dast_yml_zap_dast_scan
    dast_scan_yml_execute_dast_scan --> reusable_dast_yml

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_schedule trigger
    class build_azure_cli_image_yml mainWorkflow
    class build_azure_cli_image_yml_build_and_push job
    class dast_scan_yml mainWorkflow
    class dast_scan_yml_setup job
    class reusable_build_info_yml reusable
    class reusable_build_info_yml_build_info job
    class dast_scan_yml_execute_dast_scan job
    class reusable_dast_yml reusable
    class reusable_dast_yml_zap_dast_scan job
```

### Workflow_call Triggered Workflows

Workflows triggered by `workflow_call`:
- **Security** (`sub-security-scan.yml`)

```mermaid
flowchart LR
    trigger_workflow_call(["workflow_call"])
    sub_security_scan_yml["Security"]
    sub_security_scan_yml_sca_scan["SCA Scan"]
    sub_security_scan_yml_sast_scan["SAST Scan"]

    trigger_workflow_call --> sub_security_scan_yml
    sub_security_scan_yml --> sub_security_scan_yml_sca_scan
    sub_security_scan_yml --> sub_security_scan_yml_sast_scan

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_workflow_call trigger
    class sub_security_scan_yml mainWorkflow
    class sub_security_scan_yml_sca_scan job
    class sub_security_scan_yml_sast_scan job
```

### Workflow_dispatch Triggered Workflows

The `workflow_dispatch` trigger allows manual execution of workflows. Each workflow is shown individually below:

#### Clean up Flexion Azure Resources

Manual execution of `azure-remove-branch.yml`

```mermaid
flowchart LR
    trigger_workflow_dispatch(["workflow_dispatch"])
    azure_remove_branch_yml["Clean up Flexion Azure Resources"]
    azure_remove_branch_yml_list["list"]
    azure_remove_branch_yml_check["check"]
    azure_remove_branch_yml_clean_up["clean-up"]

    trigger_workflow_dispatch --> azure_remove_branch_yml
    azure_remove_branch_yml --> azure_remove_branch_yml_list
    azure_remove_branch_yml --> azure_remove_branch_yml_check
    azure_remove_branch_yml --> azure_remove_branch_yml_clean_up

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_workflow_dispatch trigger
    class azure_remove_branch_yml mainWorkflow
    class azure_remove_branch_yml_list job
    class azure_remove_branch_yml_check job
    class azure_remove_branch_yml_clean_up job
```

#### Build Custom Azure CLI Runner Image

Manual execution of `build-azure-cli-image.yml`

```mermaid
flowchart LR
    trigger_workflow_dispatch(["workflow_dispatch"])
    build_azure_cli_image_yml["Build Custom Azure CLI Runner Image"]
    build_azure_cli_image_yml_build_and_push["build-and-push"]

    trigger_workflow_dispatch --> build_azure_cli_image_yml
    build_azure_cli_image_yml --> build_azure_cli_image_yml_build_and_push

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_workflow_dispatch trigger
    class build_azure_cli_image_yml mainWorkflow
    class build_azure_cli_image_yml_build_and_push job
```

#### Continuous Deployment

Manual execution of `continuous-deployment.yml`

```mermaid
flowchart LR
    trigger_workflow_dispatch(["workflow_dispatch"])
    continuous_deployment_yml["Continuous Deployment"]
    continuous_deployment_yml_setup["Setup"]
    reusable_build_info_yml["reusable-build-info.yml"]
    reusable_build_info_yml_build_info["Run Info"]
    continuous_deployment_yml_accessibility_test["accessibility-test"]
    reusable_accessibility_yml["reusable-accessibility.yml"]
    reusable_accessibility_yml_playwright_accessibility_test["playwright-accessibility-test"]
    continuous_deployment_yml_unit_test_frontend["unit-test-frontend"]
    reusable_unit_test_yml["reusable-unit-test.yml"]
    reusable_unit_test_yml_unit_test["Unit test ${{ inputs.path }}"]
    continuous_deployment_yml_unit_test_backend["unit-test-backend"]
    continuous_deployment_yml_unit_test_common["unit-test-common"]
    continuous_deployment_yml_security_scan["Security"]
    sub_security_scan_yml["Security"]
    sub_security_scan_yml_sca_scan["SCA Scan"]
    sub_security_scan_yml_sast_scan["SAST Scan"]
    continuous_deployment_yml_build["Build"]
    sub_build_yml["sub-build.yml"]
    sub_build_yml_see_slot_name["see-slot-name"]
    sub_build_yml_build_frontend_predeployment["Build Frontend Predeployment"]
    reusable_build_frontend_yml["reusable-build-frontend.yml"]
    reusable_build_frontend_yml_build_frontend["build-frontend"]
    sub_build_yml_backend["backend"]
    continuous_deployment_yml_deploy["Cloud Resource Deployment"]
    sub_deploy_yml["sub-deploy.yml"]
    sub_deploy_yml_deploy_infra["Azure Infrastructure"]
    reusable_deploy_yml["reusable-deploy.yml"]
    reusable_deploy_yml_deploy_azure_infrastructure["deploy-azure-infrastructure"]
    sub_deploy_yml_build_frontend_deployment_artifact["Build Frontend for deployment"]
    sub_deploy_yml_deploy_supporting_infrastructure["Supporting Infrastructure"]
    reusable_infrastructure_deploy_yml["reusable-infrastructure-deploy.yml"]
    reusable_infrastructure_deploy_yml_deploy_log_analytics_workspace["deploy-log-analytics-workspace"]
    reusable_infrastructure_deploy_yml_deploy_db["deploy-db"]
    continuous_deployment_yml_deploy_code_slot["Slot Code Deployment"]
    sub_deploy_code_slot_yml["sub-deploy-code-slot.yml"]
    sub_deploy_code_slot_yml_deploy_code["Slot Code Deployment"]
    sub_deploy_code_yml["sub-deploy-code.yml"]
    sub_deploy_code_yml_deploy_webapp["deploy-webapp"]
    sub_deploy_code_yml_deploy_api["deploy-api"]
    sub_deploy_code_yml_deploy_dataflows_app["deploy-dataflows-app"]
    sub_deploy_code_yml_endpoint_test_application["endpoint-test-application"]
    reusable_endpoint_test_yml["reusable-endpoint-test.yml"]
    reusable_endpoint_test_yml_endpoint_test_application["endpoint-test-application"]
    sub_deploy_code_yml_enable_access["enable-access"]
    sub_deploy_code_slot_yml_deploy_webapp_slot["deploy-webapp-slot"]
    sub_deploy_code_slot_yml_deploy_api_slot["deploy-api-slot"]
    sub_deploy_code_slot_yml_deploy_dataflows_slot["deploy-dataflows-slot"]
    sub_deploy_code_slot_yml_endpoint_test_application_slot["endpoint-test-application-slot"]
    sub_deploy_code_slot_yml_execute_e2e_test["execute-e2e-test"]
    reusable_e2e_yml["reusable-e2e.yml"]
    reusable_e2e_yml_playwright_e2e_test["playwright-e2e-test"]
    sub_deploy_code_slot_yml_swap_webapp_deployment_slot["swap-webapp-deployment-slot"]
    sub_deploy_code_slot_yml_swap_nodeapi_deployment_slot["swap-nodeapi-deployment-slot"]
    sub_deploy_code_slot_yml_swap_dataflows_app_deployment_slot["swap-dataflows-app-deployment-slot"]
    sub_deploy_code_slot_yml_endpoint_test_application_post_swap["endpoint-test-application-post-swap"]
    sub_deploy_code_slot_yml_enable_access["enable-access"]

    trigger_workflow_dispatch --> continuous_deployment_yml
    continuous_deployment_yml --> continuous_deployment_yml_setup
    reusable_build_info_yml --> reusable_build_info_yml_build_info
    continuous_deployment_yml_setup --> reusable_build_info_yml
    continuous_deployment_yml --> continuous_deployment_yml_accessibility_test
    reusable_accessibility_yml --> reusable_accessibility_yml_playwright_accessibility_test
    continuous_deployment_yml_accessibility_test --> reusable_accessibility_yml
    continuous_deployment_yml --> continuous_deployment_yml_unit_test_frontend
    reusable_unit_test_yml --> reusable_unit_test_yml_unit_test
    continuous_deployment_yml_unit_test_frontend --> reusable_unit_test_yml
    continuous_deployment_yml --> continuous_deployment_yml_unit_test_backend
    continuous_deployment_yml_unit_test_backend --> reusable_unit_test_yml
    continuous_deployment_yml --> continuous_deployment_yml_unit_test_common
    continuous_deployment_yml_unit_test_common --> reusable_unit_test_yml
    continuous_deployment_yml --> continuous_deployment_yml_security_scan
    sub_security_scan_yml --> sub_security_scan_yml_sca_scan
    sub_security_scan_yml --> sub_security_scan_yml_sast_scan
    continuous_deployment_yml_security_scan --> sub_security_scan_yml
    continuous_deployment_yml --> continuous_deployment_yml_build
    sub_build_yml --> sub_build_yml_see_slot_name
    sub_build_yml --> sub_build_yml_build_frontend_predeployment
    reusable_build_frontend_yml --> reusable_build_frontend_yml_build_frontend
    sub_build_yml_build_frontend_predeployment --> reusable_build_frontend_yml
    sub_build_yml --> sub_build_yml_backend
    continuous_deployment_yml_build --> sub_build_yml
    continuous_deployment_yml --> continuous_deployment_yml_deploy
    sub_deploy_yml --> sub_deploy_yml_deploy_infra
    reusable_deploy_yml --> reusable_deploy_yml_deploy_azure_infrastructure
    sub_deploy_yml_deploy_infra --> reusable_deploy_yml
    sub_deploy_yml --> sub_deploy_yml_build_frontend_deployment_artifact
    sub_deploy_yml_build_frontend_deployment_artifact --> reusable_build_frontend_yml
    sub_deploy_yml --> sub_deploy_yml_deploy_supporting_infrastructure
    reusable_infrastructure_deploy_yml --> reusable_infrastructure_deploy_yml_deploy_log_analytics_workspace
    reusable_infrastructure_deploy_yml --> reusable_infrastructure_deploy_yml_deploy_db
    sub_deploy_yml_deploy_supporting_infrastructure --> reusable_infrastructure_deploy_yml
    continuous_deployment_yml_deploy --> sub_deploy_yml
    continuous_deployment_yml --> continuous_deployment_yml_deploy_code_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_deploy_code
    sub_deploy_code_yml --> sub_deploy_code_yml_deploy_webapp
    sub_deploy_code_yml --> sub_deploy_code_yml_deploy_api
    sub_deploy_code_yml --> sub_deploy_code_yml_deploy_dataflows_app
    sub_deploy_code_yml --> sub_deploy_code_yml_endpoint_test_application
    reusable_endpoint_test_yml --> reusable_endpoint_test_yml_endpoint_test_application
    sub_deploy_code_yml_endpoint_test_application --> reusable_endpoint_test_yml
    sub_deploy_code_yml --> sub_deploy_code_yml_enable_access
    sub_deploy_code_slot_yml_deploy_code --> sub_deploy_code_yml
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_deploy_webapp_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_deploy_api_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_deploy_dataflows_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_endpoint_test_application_slot
    sub_deploy_code_slot_yml_endpoint_test_application_slot --> reusable_endpoint_test_yml
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_execute_e2e_test
    reusable_e2e_yml --> reusable_e2e_yml_playwright_e2e_test
    sub_deploy_code_slot_yml_execute_e2e_test --> reusable_e2e_yml
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_swap_webapp_deployment_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_swap_nodeapi_deployment_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_swap_dataflows_app_deployment_slot
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_endpoint_test_application_post_swap
    sub_deploy_code_slot_yml_endpoint_test_application_post_swap --> reusable_endpoint_test_yml
    sub_deploy_code_slot_yml --> sub_deploy_code_slot_yml_enable_access
    continuous_deployment_yml_deploy_code_slot --> sub_deploy_code_slot_yml

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_workflow_dispatch trigger
    class continuous_deployment_yml mainWorkflow
    class continuous_deployment_yml_setup job
    class reusable_build_info_yml reusable
    class reusable_build_info_yml_build_info job
    class continuous_deployment_yml_accessibility_test job
    class reusable_accessibility_yml reusable
    class reusable_accessibility_yml_playwright_accessibility_test job
    class continuous_deployment_yml_unit_test_frontend job
    class reusable_unit_test_yml reusable
    class reusable_unit_test_yml_unit_test job
    class continuous_deployment_yml_unit_test_backend job
    class continuous_deployment_yml_unit_test_common job
    class continuous_deployment_yml_security_scan job
    class sub_security_scan_yml mainWorkflow
    class sub_security_scan_yml_sca_scan job
    class sub_security_scan_yml_sast_scan job
    class continuous_deployment_yml_build job
    class sub_build_yml reusable
    class sub_build_yml_see_slot_name job
    class sub_build_yml_build_frontend_predeployment job
    class reusable_build_frontend_yml reusable
    class reusable_build_frontend_yml_build_frontend job
    class sub_build_yml_backend job
    class continuous_deployment_yml_deploy job
    class sub_deploy_yml reusable
    class sub_deploy_yml_deploy_infra job
    class reusable_deploy_yml reusable
    class reusable_deploy_yml_deploy_azure_infrastructure job
    class sub_deploy_yml_build_frontend_deployment_artifact job
    class sub_deploy_yml_deploy_supporting_infrastructure job
    class reusable_infrastructure_deploy_yml reusable
    class reusable_infrastructure_deploy_yml_deploy_log_analytics_workspace job
    class reusable_infrastructure_deploy_yml_deploy_db job
    class continuous_deployment_yml_deploy_code_slot job
    class sub_deploy_code_slot_yml reusable
    class sub_deploy_code_slot_yml_deploy_code job
    class sub_deploy_code_yml reusable
    class sub_deploy_code_yml_deploy_webapp job
    class sub_deploy_code_yml_deploy_api job
    class sub_deploy_code_yml_deploy_dataflows_app job
    class sub_deploy_code_yml_endpoint_test_application job
    class reusable_endpoint_test_yml reusable
    class reusable_endpoint_test_yml_endpoint_test_application job
    class sub_deploy_code_yml_enable_access job
    class sub_deploy_code_slot_yml_deploy_webapp_slot job
    class sub_deploy_code_slot_yml_deploy_api_slot job
    class sub_deploy_code_slot_yml_deploy_dataflows_slot job
    class sub_deploy_code_slot_yml_endpoint_test_application_slot job
    class sub_deploy_code_slot_yml_execute_e2e_test job
    class reusable_e2e_yml reusable
    class reusable_e2e_yml_playwright_e2e_test job
    class sub_deploy_code_slot_yml_swap_webapp_deployment_slot job
    class sub_deploy_code_slot_yml_swap_nodeapi_deployment_slot job
    class sub_deploy_code_slot_yml_swap_dataflows_app_deployment_slot job
    class sub_deploy_code_slot_yml_endpoint_test_application_post_swap job
    class sub_deploy_code_slot_yml_enable_access job
```

##### Continuous Deployment - Job Dependencies

This diagram shows the explicit and implicit dependencies between jobs in the continuous deployment workflow:

```mermaid
flowchart LR
    subgraph "External Inputs"
        Variables["Variables"]
        Variables_CAMS_BASE_PATH["CAMS_BASE_PATH"]
        Variables_CAMS_LAUNCH_DARKLY_ENV["CAMS_LAUNCH_DARKLY_ENV"]
        Variables_CAMS_SERVER_PORT["CAMS_SERVER_PORT"]
        Variables_CAMS_SERVER_PROTOCOL["CAMS_SERVER_PROTOCOL"]
        Variables_NODE_VERSION["NODE_VERSION"]
    end

    subgraph continuous_deployment_workflow["Continuous Deployment"]
        setup["Setup"]
        subgraph accessibility_test_subgraph["accessibility-test"]
            accessibility_test_vars["NODE_VERSION"]
        end
        subgraph unit_test_frontend_subgraph["unit-test-frontend"]
            unit_test_frontend_vars["NODE_VERSION"]
        end
        subgraph unit_test_backend_subgraph["unit-test-backend"]
            unit_test_backend_vars["NODE_VERSION"]
        end
        subgraph unit_test_common_subgraph["unit-test-common"]
            unit_test_common_vars["NODE_VERSION"]
        end
        security_scan["Security"]
        subgraph build_subgraph["Build"]
            build_vars["CAMS_BASE_PATH<br/>CAMS_LAUNCH_DARKLY_ENV<br/>CAMS_SERVER_PORT<br/>CAMS_SERVER_PROTOCOL<br/>NODE_VERSION<br/>apiFunctionName<br/>azResourceGrpAppEncrypted<br/>dataflowsFunctionName<br/>ghaEnvironment<br/>slotName<br/>webappName"]
        end
        subgraph deploy_subgraph["Cloud Resource Deployment"]
            deploy_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>azResourceGrpNetworkEncrypted<br/>dataflowsFunctionName<br/>deployVnet<br/>environmentHash<br/>ghaEnvironment<br/>slotName<br/>stackName<br/>webappName"]
        end
        subgraph deploy_code_slot_subgraph["Slot Code Deployment"]
            deploy_code_slot_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>dataflowsFunctionName<br/>environmentHash<br/>ghaEnvironment<br/>initialDeployment<br/>slotName<br/>stackName<br/>webappName"]
        end
    end

        Variables --> Variables_CAMS_BASE_PATH
        Variables --> Variables_CAMS_LAUNCH_DARKLY_ENV
        Variables --> Variables_CAMS_SERVER_PORT
        Variables --> Variables_CAMS_SERVER_PROTOCOL
        Variables --> Variables_NODE_VERSION
    Variables_CAMS_BASE_PATH -.-> build_subgraph
    Variables_CAMS_LAUNCH_DARKLY_ENV -.-> build_subgraph
    Variables_CAMS_SERVER_PORT -.-> build_subgraph
    Variables_CAMS_SERVER_PROTOCOL -.-> build_subgraph
    Variables_NODE_VERSION -.-> accessibility_test_subgraph
    Variables_NODE_VERSION -.-> build_subgraph
    Variables_NODE_VERSION -.-> unit_test_backend_subgraph
    Variables_NODE_VERSION -.-> unit_test_common_subgraph
    Variables_NODE_VERSION -.-> unit_test_frontend_subgraph
    accessibility_test_subgraph ==>|"needs"| deploy_subgraph
    build_subgraph ==>|"needs"| deploy_subgraph
    deploy_subgraph ==>|"needs"| deploy_code_slot_subgraph
    security_scan ==>|"needs"| deploy_subgraph
    setup ==>|"needs"| build_subgraph
    setup ==>|"needs"| deploy_code_slot_subgraph
    setup ==>|"needs"| deploy_subgraph
    unit_test_backend_subgraph ==>|"needs"| deploy_subgraph
    unit_test_common_subgraph ==>|"needs"| deploy_subgraph
    unit_test_frontend_subgraph ==>|"needs"| deploy_subgraph

    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,fill-opacity:0.15,stroke:#f3e5f5,stroke-width:1px,color:#ffffff
    classDef jobSubgraph fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000
    class continuous_deployment_workflow mainWorkflow
    class Variables external
    class accessibility_test_subgraph jobSubgraph
    class build_subgraph jobSubgraph
    class deploy_subgraph jobSubgraph
    class deploy_code_slot_subgraph jobSubgraph
    class security_scan job
    class setup job
    class unit_test_backend_subgraph jobSubgraph
    class unit_test_common_subgraph jobSubgraph
    class unit_test_frontend_subgraph jobSubgraph
```

##### Deploy code for slot - Job Dependencies

This diagram shows the explicit and implicit dependencies between jobs in the deploy code for slot workflow:

```mermaid
flowchart LR
    subgraph "External Inputs"
        Workflow_Inputs["Workflow Inputs"]
        Workflow_Inputs_apiFunctionName["apiFunctionName"]
        Workflow_Inputs_azResourceGrpAppEncrypted["azResourceGrpAppEncrypted"]
        Workflow_Inputs_dataflowsFunctionName["dataflowsFunctionName"]
        Workflow_Inputs_environmentHash["environmentHash"]
        Workflow_Inputs_ghaEnvironment["ghaEnvironment"]
        Workflow_Inputs_slotName["slotName"]
        Workflow_Inputs_stackName["stackName"]
        Workflow_Inputs_webappName["webappName"]
    end

    subgraph sub_deploy_code_slot_workflow["Deploy code for slot"]
        subgraph deploy_code_subgraph["Slot Code Deployment"]
            deploy_code_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>dataflowsFunctionName<br/>environmentHash<br/>ghaEnvironment<br/>stackName<br/>webappName"]
        end
        deploy_webapp_slot["deploy-webapp-slot"]
        deploy_api_slot["deploy-api-slot"]
        deploy_dataflows_slot["deploy-dataflows-slot"]
        subgraph endpoint_test_application_slot_subgraph["endpoint-test-application-slot"]
            endpoint_test_application_slot_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>environmentHash<br/>ghaEnvironment<br/>slotName<br/>stackName<br/>webappName"]
        end
        subgraph execute_e2e_test_subgraph["execute-e2e-test"]
            execute_e2e_test_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>dataflowsFunctionName<br/>environmentHash<br/>ghaEnvironment<br/>slotName<br/>stackName<br/>webappName"]
        end
        swap_webapp_deployment_slot["swap-webapp-deployment-slot"]
        swap_nodeapi_deployment_slot["swap-nodeapi-deployment-slot"]
        swap_dataflows_app_deployment_slot["swap-dataflows-app-deployment-slot"]
        subgraph endpoint_test_application_post_swap_subgraph["endpoint-test-application-post-swap"]
            endpoint_test_application_post_swap_vars["apiFunctionName<br/>azResourceGrpAppEncrypted<br/>environmentHash<br/>ghaEnvironment<br/>stackName<br/>webappName"]
        end
        enable_access["enable-access"]
    end

        Workflow_Inputs --> Workflow_Inputs_apiFunctionName
        Workflow_Inputs --> Workflow_Inputs_azResourceGrpAppEncrypted
        Workflow_Inputs --> Workflow_Inputs_dataflowsFunctionName
        Workflow_Inputs --> Workflow_Inputs_environmentHash
        Workflow_Inputs --> Workflow_Inputs_ghaEnvironment
        Workflow_Inputs --> Workflow_Inputs_slotName
        Workflow_Inputs --> Workflow_Inputs_stackName
        Workflow_Inputs --> Workflow_Inputs_webappName
    Workflow_Inputs_apiFunctionName -.-> deploy_code_subgraph
    Workflow_Inputs_apiFunctionName -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_apiFunctionName -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_apiFunctionName -.-> execute_e2e_test_subgraph
    Workflow_Inputs_azResourceGrpAppEncrypted -.-> deploy_code_subgraph
    Workflow_Inputs_azResourceGrpAppEncrypted -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_azResourceGrpAppEncrypted -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_azResourceGrpAppEncrypted -.-> execute_e2e_test_subgraph
    Workflow_Inputs_dataflowsFunctionName -.-> deploy_code_subgraph
    Workflow_Inputs_dataflowsFunctionName -.-> execute_e2e_test_subgraph
    Workflow_Inputs_environmentHash -.-> deploy_code_subgraph
    Workflow_Inputs_environmentHash -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_environmentHash -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_environmentHash -.-> execute_e2e_test_subgraph
    Workflow_Inputs_ghaEnvironment -.-> deploy_code_subgraph
    Workflow_Inputs_ghaEnvironment -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_ghaEnvironment -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_ghaEnvironment -.-> execute_e2e_test_subgraph
    Workflow_Inputs_slotName -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_slotName -.-> execute_e2e_test_subgraph
    Workflow_Inputs_stackName -.-> deploy_code_subgraph
    Workflow_Inputs_stackName -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_stackName -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_stackName -.-> execute_e2e_test_subgraph
    Workflow_Inputs_webappName -.-> deploy_code_subgraph
    Workflow_Inputs_webappName -.-> endpoint_test_application_post_swap_subgraph
    Workflow_Inputs_webappName -.-> endpoint_test_application_slot_subgraph
    Workflow_Inputs_webappName -.-> execute_e2e_test_subgraph
    deploy_api_slot ==>|"needs"| endpoint_test_application_slot_subgraph
    deploy_api_slot ==>|"needs"| execute_e2e_test_subgraph
    deploy_api_slot ==>|"needs"| swap_dataflows_app_deployment_slot
    deploy_api_slot ==>|"needs"| swap_nodeapi_deployment_slot
    deploy_api_slot ==>|"needs"| swap_webapp_deployment_slot
    deploy_dataflows_slot ==>|"needs"| endpoint_test_application_slot_subgraph
    deploy_dataflows_slot ==>|"needs"| execute_e2e_test_subgraph
    deploy_dataflows_slot ==>|"needs"| swap_dataflows_app_deployment_slot
    deploy_dataflows_slot ==>|"needs"| swap_nodeapi_deployment_slot
    deploy_dataflows_slot ==>|"needs"| swap_webapp_deployment_slot
    deploy_webapp_slot ==>|"needs"| endpoint_test_application_slot_subgraph
    deploy_webapp_slot ==>|"needs"| execute_e2e_test_subgraph
    deploy_webapp_slot ==>|"needs"| swap_dataflows_app_deployment_slot
    deploy_webapp_slot ==>|"needs"| swap_nodeapi_deployment_slot
    deploy_webapp_slot ==>|"needs"| swap_webapp_deployment_slot
    endpoint_test_application_post_swap_subgraph ==>|"needs"| enable_access
    endpoint_test_application_slot_subgraph ==>|"needs"| execute_e2e_test_subgraph
    execute_e2e_test_subgraph ==>|"needs"| swap_dataflows_app_deployment_slot
    execute_e2e_test_subgraph ==>|"needs"| swap_nodeapi_deployment_slot
    execute_e2e_test_subgraph ==>|"needs"| swap_webapp_deployment_slot
    swap_dataflows_app_deployment_slot ==>|"needs"| endpoint_test_application_post_swap_subgraph
    swap_nodeapi_deployment_slot ==>|"needs"| endpoint_test_application_post_swap_subgraph
    swap_webapp_deployment_slot ==>|"needs"| endpoint_test_application_post_swap_subgraph

    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,fill-opacity:0.15,stroke:#f3e5f5,stroke-width:1px,color:#ffffff
    classDef jobSubgraph fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000
    class sub_deploy_code_slot_workflow mainWorkflow
    class Workflow_Inputs external
    class deploy_api_slot job
    class deploy_code_subgraph jobSubgraph
    class deploy_dataflows_slot job
    class deploy_webapp_slot job
    class enable_access job
    class endpoint_test_application_post_swap_subgraph jobSubgraph
    class endpoint_test_application_slot_subgraph jobSubgraph
    class execute_e2e_test_subgraph jobSubgraph
    class swap_dataflows_app_deployment_slot job
    class swap_nodeapi_deployment_slot job
    class swap_webapp_deployment_slot job
```

#### Stand Alone DAST Scan

Manual execution of `dast-scan.yml`

```mermaid
flowchart LR
    trigger_workflow_dispatch(["workflow_dispatch"])
    dast_scan_yml["Stand Alone DAST Scan"]
    dast_scan_yml_setup["Setup"]
    reusable_build_info_yml["reusable-build-info.yml"]
    reusable_build_info_yml_build_info["Run Info"]
    dast_scan_yml_execute_dast_scan["execute-dast-scan"]
    reusable_dast_yml["reusable-dast.yml"]
    reusable_dast_yml_zap_dast_scan["zap-dast-scan"]

    trigger_workflow_dispatch --> dast_scan_yml
    dast_scan_yml --> dast_scan_yml_setup
    reusable_build_info_yml --> reusable_build_info_yml_build_info
    dast_scan_yml_setup --> reusable_build_info_yml
    dast_scan_yml --> dast_scan_yml_execute_dast_scan
    reusable_dast_yml --> reusable_dast_yml_zap_dast_scan
    dast_scan_yml_execute_dast_scan --> reusable_dast_yml

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_workflow_dispatch trigger
    class dast_scan_yml mainWorkflow
    class dast_scan_yml_setup job
    class reusable_build_info_yml reusable
    class reusable_build_info_yml_build_info job
    class dast_scan_yml_execute_dast_scan job
    class reusable_dast_yml reusable
    class reusable_dast_yml_zap_dast_scan job
```

#### Deploy Security Scan Storage

Manual execution of `deploy-security-scan-storage.yml`

```mermaid
flowchart LR
    trigger_workflow_dispatch(["workflow_dispatch"])
    deploy_security_scan_storage_yml["Deploy Security Scan Storage"]
    deploy_security_scan_storage_yml_deploy_storage["Deploy Scan Storage"]

    trigger_workflow_dispatch --> deploy_security_scan_storage_yml
    deploy_security_scan_storage_yml --> deploy_security_scan_storage_yml_deploy_storage

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_workflow_dispatch trigger
    class deploy_security_scan_storage_yml mainWorkflow
    class deploy_security_scan_storage_yml_deploy_storage job
```

#### Stand Alone E2E Test Runs

Manual execution of `e2e-test.yml`

```mermaid
flowchart LR
    trigger_workflow_dispatch(["workflow_dispatch"])
    e2e_test_yml["Stand Alone E2E Test Runs"]
    e2e_test_yml_setup["Setup"]
    reusable_build_info_yml["reusable-build-info.yml"]
    reusable_build_info_yml_build_info["Run Info"]
    e2e_test_yml_execute_e2e_test["execute-e2e-test"]
    reusable_e2e_yml["reusable-e2e.yml"]
    reusable_e2e_yml_playwright_e2e_test["playwright-e2e-test"]

    trigger_workflow_dispatch --> e2e_test_yml
    e2e_test_yml --> e2e_test_yml_setup
    reusable_build_info_yml --> reusable_build_info_yml_build_info
    e2e_test_yml_setup --> reusable_build_info_yml
    e2e_test_yml --> e2e_test_yml_execute_e2e_test
    reusable_e2e_yml --> reusable_e2e_yml_playwright_e2e_test
    e2e_test_yml_execute_e2e_test --> reusable_e2e_yml

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_workflow_dispatch trigger
    class e2e_test_yml mainWorkflow
    class e2e_test_yml_setup job
    class reusable_build_info_yml reusable
    class reusable_build_info_yml_build_info job
    class e2e_test_yml_execute_e2e_test job
    class reusable_e2e_yml reusable
    class reusable_e2e_yml_playwright_e2e_test job
```

#### NPM Package Updates

Manual execution of `update-dependencies.yml`

```mermaid
flowchart LR
    trigger_workflow_dispatch(["workflow_dispatch"])
    update_dependencies_yml["NPM Package Updates"]
    update_dependencies_yml_update_all["Update all NPM projects"]

    trigger_workflow_dispatch --> update_dependencies_yml
    update_dependencies_yml --> update_dependencies_yml_update_all

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_workflow_dispatch trigger
    class update_dependencies_yml mainWorkflow
    class update_dependencies_yml_update_all job
```

### Workflow_run Triggered Workflows

Workflows triggered by `workflow_run`:
- **slack-notification** (`slack-notification.yml`)

```mermaid
flowchart LR
    trigger_workflow_run(["workflow_run"])
    slack_notification_yml["slack-notification"]
    slack_notification_yml_notify["notify"]

    trigger_workflow_run --> slack_notification_yml
    slack_notification_yml --> slack_notification_yml_notify

    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000

    class trigger_workflow_run trigger
    class slack_notification_yml mainWorkflow
    class slack_notification_yml_notify job
```

## Overview: All Triggers and Main Workflows

```mermaid
flowchart LR
    trigger_workflow_call(["workflow_call"])
    sub_security_scan_yml["Security"]
    trigger_workflow_dispatch(["workflow_dispatch"])
    deploy_security_scan_storage_yml["Deploy Security Scan Storage"]
    e2e_test_yml["Stand Alone E2E Test Runs"]
    azure_remove_branch_yml["Clean up Flexion Azure Resources"]
    continuous_deployment_yml["Continuous Deployment"]
    build_azure_cli_image_yml["Build Custom Azure CLI Runner Image"]
    dast_scan_yml["Stand Alone DAST Scan"]
    update_dependencies_yml["NPM Package Updates"]
    trigger_delete(["delete"])
    azure_remove_branch_yml["Clean up Flexion Azure Resources"]
    trigger_push(["push"])
    continuous_deployment_yml["Continuous Deployment"]
    trigger_schedule(["schedule"])
    build_azure_cli_image_yml["Build Custom Azure CLI Runner Image"]
    dast_scan_yml["Stand Alone DAST Scan"]
    trigger_workflow_run(["workflow_run"])
    slack_notification_yml["slack-notification"]

    trigger_workflow_call --> sub_security_scan_yml
    trigger_workflow_dispatch --> deploy_security_scan_storage_yml
    trigger_workflow_dispatch --> e2e_test_yml
    trigger_workflow_dispatch --> azure_remove_branch_yml
    trigger_workflow_dispatch --> continuous_deployment_yml
    trigger_workflow_dispatch --> build_azure_cli_image_yml
    trigger_workflow_dispatch --> dast_scan_yml
    trigger_workflow_dispatch --> update_dependencies_yml
    trigger_delete --> azure_remove_branch_yml
    trigger_push --> continuous_deployment_yml
    trigger_schedule --> build_azure_cli_image_yml
    trigger_schedule --> dast_scan_yml
    trigger_workflow_run --> slack_notification_yml

    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000

    class trigger_workflow_call trigger
    class trigger_workflow_dispatch trigger
    class trigger_delete trigger
    class trigger_push trigger
    class trigger_schedule trigger
    class trigger_workflow_run trigger
    class sub_security_scan_yml mainWorkflow
    class deploy_security_scan_storage_yml mainWorkflow
    class e2e_test_yml mainWorkflow
    class azure_remove_branch_yml mainWorkflow
    class continuous_deployment_yml mainWorkflow
    class build_azure_cli_image_yml mainWorkflow
    class dast_scan_yml mainWorkflow
    class update_dependencies_yml mainWorkflow
    class slack_notification_yml mainWorkflow
```

## Workflow Details

### Main Workflows
- **Security** (`sub-security-scan.yml`)
  - Triggers: workflow_call
  - Jobs: 2
- **Deploy Security Scan Storage** (`deploy-security-scan-storage.yml`)
  - Triggers: workflow_dispatch
  - Jobs: 1
- **Stand Alone E2E Test Runs** (`e2e-test.yml`)
  - Triggers: workflow_dispatch
  - Jobs: 2
- **Clean up Flexion Azure Resources** (`azure-remove-branch.yml`)
  - Triggers: delete, workflow_dispatch
  - Jobs: 3
- **Continuous Deployment** (`continuous-deployment.yml`)
  - Triggers: push, workflow_dispatch
  - Jobs: 9
- **Build Custom Azure CLI Runner Image** (`build-azure-cli-image.yml`)
  - Triggers: schedule, workflow_dispatch
  - Jobs: 1
- **Stand Alone DAST Scan** (`dast-scan.yml`)
  - Triggers: schedule, workflow_dispatch
  - Jobs: 2
- **NPM Package Updates** (`update-dependencies.yml`)
  - Triggers: workflow_dispatch
  - Jobs: 1
- **slack-notification** (`slack-notification.yml`)
  - Triggers: workflow_run
  - Jobs: 1

### Reusable Workflows
- **Provision and Configure Cloud Resources** (`sub-deploy.yml`)
  - Jobs: 3
- **Azure Deployment - Supporting Infrastructure** (`reusable-infrastructure-deploy.yml`)
  - Jobs: 2
- **End-to-end Tests** (`reusable-e2e.yml`)
  - Jobs: 1
- **Deploy code for slot** (`sub-deploy-code-slot.yml`)
  - Jobs: 11
- **Endpoint Tests** (`reusable-endpoint-test.yml`)
  - Jobs: 1
- **Azure Deployment - Infrastructure** (`reusable-deploy.yml`)
  - Jobs: 1
- **End-to-end Tests** (`reusable-accessibility.yml`)
  - Jobs: 1
- **Deploy code** (`sub-deploy-code.yml`)
  - Jobs: 5
- **Execute Node Project Unit Tests** (`reusable-unit-test.yml`)
  - Jobs: 1
- **Build Frontend** (`reusable-build-frontend.yml`)
  - Jobs: 1
- **Build** (`sub-build.yml`)
  - Jobs: 3
- **Build Info** (`reusable-build-info.yml`)
  - Jobs: 1
- **DAST Scan** (`reusable-dast.yml`)
  - Jobs: 1
