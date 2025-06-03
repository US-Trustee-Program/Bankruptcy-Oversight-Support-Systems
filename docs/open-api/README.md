# OpenAPI Documentation

This directory contains the OpenAPI specifications for the CAMS API.

## Structure

- `openapi.json`: Main OpenAPI specification file that can be used as an entry point for tools that consume OpenAPI specs.
- `specs/`: Directory containing individual API endpoint specifications.
  - `case-assignments.json`: Specification for the case assignments endpoints.
  - (Additional endpoint specs will be added here)
- `schemas/`: Directory containing reusable schema definitions.
  - `common.json`: Common schema definitions used across multiple endpoints.

## Usage

### Adding a New Endpoint

1. Create a new JSON file in the `specs/` directory for your endpoint.
2. Define the endpoint paths, operations, and responses according to the OpenAPI 3.0 specification.
3. Reference common schemas from `schemas/common.json` using `$ref: "../schemas/common.json#/SchemaName"`.

### Adding a New Schema

1. If your endpoint uses a schema that could be reused across multiple endpoints, add it to `schemas/common.json`.
2. Otherwise, include the schema definition directly in your endpoint specification file.

## Tools

You can use various tools to work with these OpenAPI specifications:

- [Swagger UI](https://swagger.io/tools/swagger-ui/): Visualize and interact with the API's resources.
- [Swagger Editor](https://editor.swagger.io/): Edit OpenAPI specifications with real-time validation.
- [Swagger Codegen](https://swagger.io/tools/swagger-codegen/): Generate client libraries, server stubs, and API documentation.

## Benefits

- **Consistency**: Ensures consistent API documentation across all endpoints.
- **Reusability**: Common schemas can be defined once and reused across multiple endpoints.
- **Tooling**: Enables the use of various OpenAPI tools for visualization, testing, and code generation.
- **Maintainability**: Easier to maintain and update API documentation as the API evolves.
