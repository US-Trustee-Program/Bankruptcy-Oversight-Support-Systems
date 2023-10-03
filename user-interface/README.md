# CAMS User Interface

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

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.
