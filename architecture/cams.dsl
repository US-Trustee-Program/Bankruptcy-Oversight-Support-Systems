workspace {

    model {
        # People
        aust = person "AUST" "Assistant United States Trustee - manages a USTP office"
        attorney = person "Trial Attorney" "Represents USTP in court regarding bankruptcy cases"
        dataQualityAnalyst = person "Data Quality Analyst" "Verify case events"

        # System
        cams = softwareSystem "CAMS" "CAse Management System" {
            webapp = container "Webapp" "The user interface for CAMS" {
                caseAssignmentsScreen = component "Assignments Screen" "Displays case assignment data and provides for creating assignments"
                caseDetailsScreen = component "Case Details Screen" "Displays case data including dates and assigned staff, court docket, and audit history"
                dataVerificationScreen = component "Data Verification Screen" "Displays case events for data quality analysts to review"
            }
            nodeapi = container "API" "An Azure Functions App (Node.js)" {
                attorneys = component "Attorneys" "Attorneys API"
                cases = component "Cases" "Cases API"
                caseAssignments = component "Assignments" "Case Assignments API"
                caseDocket = component "Docket" "Case Docket Entries"
                caseHistory = component "Case History" "Case History API"
                caseSummary = component "Case Summary" "Case Summary API"
                offices = component "Offices" "Offices API"
                orders = component "Orders" "Orders API"
                ordersManualSync = component "Orders Manual Sync" "Orders Manual Sync API"
                ordersSuggestions = component "Orders Suggestions" "Orders Suggestions API"
                ordersSync = component "Sync" "Creates events in CAMS based on orders to transfer transactions in DXTR"
                consolidations = component "Consolidations" "Consolidation Orders API"

            }
            dxtrsql = container "DXTR DB" "DXTR SQL Database"
            cosmos = container "Cosmos DB" "NoSQL Database" {
                assignmentsCosmosContainer = component "Case Assignments Container" "Stores case assignments"
                casesCosmosContainer = component "Cases Container" "Stores case transfer records and audit logs"
                ordersCosmosContainer = component "Orders Container" "Stores case events"
                consolidationsCosmosContainer = component "Consolidations Container" "Stores consolidation orders"
                runtimeStateCosmosContainer = component "Runtime State Container" "Stores tracking information for automation"
            }
        }

        # Relationships
        ## People to system components
        aust -> webapp "Assigns cases to attorneys"
        attorney -> webapp "Views bankruptcy cases"
        attorney -> caseDetailsScreen "Views bankruptcy cases"
        aust -> caseAssignmentsScreen "Assigns cases to attorneys"
        attorney -> caseAssignmentsScreen "Views cases assigned to them"
        dataQualityAnalyst -> dataVerificationScreen "Reviews, approves, and rejects case events"

        ## System components to system components
        webapp -> nodeapi "Reads and writes case data and assignments"
        webapp -> cases "Reads and writes case data"
        webapp -> caseAssignments "Reads and writes case assignments"
        webapp -> attorneys "Reads Manhattan attorneys"
        webapp -> caseDocket "Reads case docket entries"
        webapp -> caseHistory "Reads case audit history"
        webapp -> caseSummary "Reads case summary, a subset of case details"
        webapp -> offices "Reads USTP office information"
        webapp -> orders "Reads case events"
        webapp -> ordersManualSync "Triggers order sync via HTTP"
        webapp -> ordersSuggestions "Reads case summaries for data verification"
        webapp -> consolidations "Reads and writes consolidation order data"

        nodeapi -> cosmos "Reads and writes case assignments, orders, cases, etc."

        cases -> dxtrsql "Gets case data"
        cases -> assignmentsCosmosContainer "Reads case assignments"
        cases -> casesCosmosContainer "Reads case transfer events"

        consolidations -> casesCosmosContainer "Reads and Writes consolidations"
        consolidations -> consolidationsCosmosContainer "Writes consolidations to CosmosDB"

        caseAssignments -> assignmentsCosmosContainer "Reads and writes case assignments"
        caseAssignments -> casesCosmosContainer "Writes case audit logs"

        caseDocket -> dxtrsql "Reads case docket entries"

        caseHistory -> casesCosmosContainer "Reads case audit logs"

        caseSummary -> dxtrsql "Reads case summaries"

        offices -> dxtrsql "Reads USTP office information"

        orders -> ordersCosmosContainer "Reads case events"

        ordersManualSync -> casesCosmosContainer "Writes case audit logs"
        ordersManualSync -> ordersCosmosContainer "Writes case events"
        ordersManualSync -> runtimeStateCosmosContainer "Reads and writes index for tracking last export"

        ordersSuggestions -> dxtrsql "Reads case summaries matching a case transfer event"

        ordersSync -> casesCosmosContainer "Writes case audit logs"
        ordersSync -> ordersCosmosContainer "Writes case events"
        ordersSync -> runtimeStateCosmosContainer "Reads and writes index for tracking last export"
    }

    views {
        systemlandscape "SystemLandscape" {
            include *
            autoLayout
        }

        container cams "CAMSContainers" {
            include *
            animation {
                aust
                webapp
                nodeapi
                dxtrsql
                cosmos
            }
            autoLayout
        }

        component webapp "CAMSWebapp" {
            include *
            animation {
                aust
                attorney
                caseDetailsScreen
                caseAssignmentsScreen
            }
            autoLayout
        }

        component nodeapi "FunctionsAPI" {
            include *
            animation {
                webapp
                cases
                caseAssignments
                dxtrsql
                cosmos
            }
            autolayout
        }

        component nodeapi "FunctionsAPIwithWebapp" {
            include *
            animation {
                webapp
                cases
                caseAssignments
            }
            autolayout
        }

        styles {
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Person" {
                shape person
                background #08427b
                color #ffffff
            }
        }
        theme default
    }

}
