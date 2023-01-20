# Bankruptcy Oversight Support Systems (BOSS)

## [United States Trustee Program](https://www.justice.gov/ust)

The United States Trustee Program is the component of the Department of Justice responsible for overseeing the administration of bankruptcy cases and private trustees under 28 U.S.C. § 586 and 11 U.S.C. § 101, et seq. We are a national program with broad administrative, regulatory, and litigation/enforcement authorities whose mission is to promote the integrity and efficiency of the bankruptcy system for the benefit of all stakeholders–debtors, creditors, and the public. The USTP consists of an Executive Office in Washington, DC, and 21 regions with 90 field office locations nationwide.

[Learn More](https://www.justice.gov/ust/about-program)

## Applications

### Frontend

BOSS is a React application which acts as the main place for oversight work to take place.

#### Requirements

Node version 18.13.0 or above.

#### Running

To run the application directly, execute...

```shell
npm start
```

This will serve the client on port 3000.

# Contributing

## Style and Secrets Enforcement

[pre-commit](https://pre-commit.com) allows us to make use of hooks that enforce style and prevent secrets from being committed to the repo. As such, it is expected that all code pushed to the repository have had these pre-commit hooks executed on all files created or updated. The configuration can be seen in `.pre-commit-config.yaml`.

### Possible Issue with pre-commit

When you install `pre-commit`, your package manager may install an older version such as `1.1.0`. There is a [known issue](https://github.com/Yelp/detect-secrets/issues/452) with that specific version and newer versions of Python. If in the execution of your pre-commit hooks you encounter an error like the following, you may need to update your version of `pre-commit`.

> [scan]  ERROR   No plugins to scan with!
