# Notes on using this docker container to run axe-core accessibility testing

## Description

Purpose of this container is to define an image to package and configure dependencies required for executing accessibility scanning with axe-core (axe-core/cli at the moment). Provides reusability and repeatability with accessibility scanning locally and in ci pipeline

## Prerequisite

- Docker desktop installed on box running this container image.

## Building the docker container

```bash
docker build -t axe .
```

## Running the docker container

```bash
docker run axe ${targetURL}
```

### Specifying Accessibility standards to test with using tags

```bash
docker run axe ${targetURL} --tags section508,wcag22aa,best-practice
```

Here is a list of supported [tags](https://github.com/dequelabs/axe-core/blob/5df618deddf21d2b32c68f725d8049c4d660a824/doc/API.md?plain=1#L81)

### If running in CI pipeline, use the following to fail build on error

```bash
docker run axe ${targetURL} --exit
```

### Produce json output file

```bash
docker run -v .:/home/node/tmp axe ${targetURL} --save /home/node/tmp/test.json
```

## Other notes

- Todos
  - [ ] Setup a docker registry in Azure
  - [ ] Create adhoc GHA workflow to build Docker containers and publish to registry
  - [ ] Update current CI pipeline to run docker image for accessibility testing
    - [ ] Findings should break build
- Maybes. Nice to have or should plan for.
  - [ ] Approach to handle multiple url targets
  - [ ] Consider using typescript to drive axe-core instead of cli approach

## References to useful links

- [NPM axe-core/cli](https://www.npmjs.com/package/@axe-core/cli)
- [Projects using axe-core](https://github.com/dequelabs/axe-core/blob/develop/doc/projects.md)
-
