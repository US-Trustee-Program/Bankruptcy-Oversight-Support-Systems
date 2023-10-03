## Node.js Version

[Node Version Manager](https://github.com/nvm-sh/nvm) supports consistent use of a specific version of Node.js across environments.

### Install `nvm`

See: https://github.com/nvm-sh/nvm#install--update-script

### `.nvmrc`

The Node.js version used by the project is specified in the `.nvmrc` resource file.

### Installing a Node.js version

Use `nvm` to install a Node.js version.

```sh
nvm install <node version string>

# For example:
nvm install v18.17
```

### Use the Node.js version for the project

Use `nvm` to switch to the Node.js version in use for the project. Run the following shell command to manually switch Node.js versions
when changing into the project directory. The `nvm` utility uses the `.nvmrc` file to determine which Node.js version to use.

```sh
nvm use
```

Alternatively a version can be specified. Note the version must have been previously installed using `nvm install`. This can be
used to override the version specified in the `.nvmrc` file.

```sh
nvm use <node version string>

# For example:
nvm use v18.17
```

### Automatically use the Node.js version for the project

The `nvm use` command can be automatically called when changing into the project directory.

See: https://github.com/nvm-sh/nvm#deeper-shell-integration

### Updating the Node.js version for the project
Update the `.nvmrc` file when the version of Node.js in use is changed.

```sh
node -v > .nvmrc
```
