# Case Management System (CAMS)

## [United States Trustee Program](https://www.justice.gov/ust)

The United States Trustee Program is the component of the Department of Justice responsible for
overseeing the administration of bankruptcy cases and private trustees under 28 U.S.C. § 586 and 11
U.S.C. § 101, et seq. We are a national program with broad administrative, regulatory, and
litigation/enforcement authorities whose mission is to promote the integrity and efficiency of the
bankruptcy system for the benefit of all stakeholders–debtors, creditors, and the public. The USTP
consists of an Executive Office in Washington, DC, and 21 regions with 90 field office locations
nationwide.

[Learn More](https://www.justice.gov/ust/about-program)

# Local Development

CAMS supports local development with Docker-based MongoDB for faster iteration and offline development.

## Quick Start

```shell
# One-time setup
npm run docker:up          # Start local MongoDB
npm run seed:local-db      # Load test data

# Start development servers
npm run start:backend      # Terminal 1
npm run start:frontend     # Terminal 2
```

## Requirements

- Node.js 18.13.0 or above
- Docker and Docker Compose
- Azure Functions Core Tools

## Configuration

Copy the environment template and configure your local settings:

```shell
cp backend/.env.local.example backend/.env
```

Update `backend/.env` with your DXTR database credentials (required for seed data).

## Managing the Local Database

```shell
npm run docker:up              # Start MongoDB
npm run docker:down            # Stop MongoDB (keeps data)
npm run docker:down:volumes    # Stop and delete all data
npm run seed:local-db          # Reload seed data
```

See [Running Documentation](docs/running.md) for detailed setup instructions and troubleshooting.

# Further Documentation

The majority of our documentation is located in the `docs` directory and
[hosted on GitHub Pages](https://us-trustee-program.github.io/Bankruptcy-Oversight-Support-Systems/#/)
via Docsify.
