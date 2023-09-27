workspace {

    model {
        # People
        aust = person "AUST" "Assistant United States Trustee - manages a USTP office"
        attorney = person "Trial Attorney" "Represents USTP in court regarding bankruptcy cases"

        # System
        cams = softwareSystem "CAMS" "CAse Management System" {
            webapp = container "Webapp" "The user interface for CAMS" {
                casesScreen = component "Cases Screen" "Displays case metadata in a tabular format"
                assignScreen = component "Assignments Screen" "Displays case assignment data and provides for creating assignments"
            }
            nodeapi = container "API" "An Azure Functions App (Node.js)" {
                cases = component "Cases" "Cases API"
                assign = component "Assignments" "Assignments API"
                attorneys = component "Attorneys" "Attorneys API"
            }
            dxtrsql = container "DXTR DB" "DXTR SQL Database"
            cosmos = container "Cosmos DB" "NoSQL Database"
        }

        # Relationships
        ## People to system components
        aust -> webapp "Assigns cases to attorneys"
        attorney -> webapp "Views bankruptcy cases"
        attorney -> casesScreen "Views bankruptcy cases"
        aust -> assignScreen "Assigns cases to attorneys"
        attorney -> assignScreen "Views cases assigned to them"

        ## System components to system components
        webapp -> nodeapi "Reads and writes case data and assignments"
        webapp -> cases "Reads and writes case data"
        webapp -> assign "Reads and writes case assignments"
        nodeapi -> cosmos "Reads and writes case assignments"
        cases -> dxtrsql "Gets case data"
        cases -> cosmos "Reads case assignments"
        assign -> cosmos "Reads and writes case assignments"
        webapp -> attorneys "Reads Manhattan attorneys"
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
                casesScreen
                assignScreen
            }
            autoLayout
        }

        component nodeapi "FunctionsAPI" {
            include *
            animation {
                webapp
                cases
                assign
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
                assign
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
