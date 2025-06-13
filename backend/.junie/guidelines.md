# Backend Development Guidelines

This document outlines specific guidelines for the backend project of CAMS. These guidelines should be followed in addition to the [root guidelines](../../.junie/guidelines.md).

## Factory Pattern Usage

### Prefer using Factory for Dependency Injection

- Use getter functions from `factory.ts` for dependency injection
- The factory should decide which implementation to return based on context/configuration
- This approach supports the Option-Enabling Architecture by isolating implementation details

#### Example: Creating a Use Case

```typescript
// Good: Dependency injection by exclusive use of a factory
import { getMyGateway } from '../../factory';

export default class MyUseCase {
  private myGateway: MyGatewayInterface;

  constructor(applicationContext: ApplicationContext) {
    // Use the provided gateway if available, otherwise get it from the factory
    this.myGateway = getMyGateway(applicationContext);
  }

  // Use case methods...
}
```

```typescript
// Acceptable: Support dependency injection via constructor to override dependencies from factory
import { getMyGateway } from '../../factory';

export default class MyUseCase {
  private myGateway: MyGatewayInterface;

  constructor(applicationContext: ApplicationContext, myGateway?: MyGatewayInterface) {
    // Use the provided gateway if available, otherwise get it from the factory
    this.myGateway = myGateway ? myGateway : getMyGateway(applicationContext);
  }

  // Use case methods...
}
```

```typescript
// Avoid: Tight coupling to specific dependency implementations
import { MyGatewayImplementation } from '../../adapters/gateways/my-gateway';

export default class MyUseCase {
  private myGateway: MyGatewayInterface;

  constructor(myGateway: MyGatewayInterface) {
    this.myGateway = myGateway;
  }

  // Use case methods...
}
```

#### Example: Implementing a Factory Getter Function

```typescript
// In factory.ts
export const getMyGateway = (context: ApplicationContext): MyGatewayInterface => {
  if (context.config.get('dbMock')) {
    return new MockMyGateway();
  } else {
    return new MyGatewayImplementation();
  }
};
```

### Benefits of This Approach

1. **Flexibility**: Easily switch implementations based on runtime configuration
2. **Testability**: Simplifies testing by allowing mock implementations to be injected
3. **Isolation**: Keeps implementation details separate from business logic
4. **Consistency**: Provides a standard way to access dependencies throughout the application

### When to Create a New Factory Getter Function

Create a new factory getter function when:

1. You need to access a gateway, repository, or service from multiple use cases
2. You have multiple implementations of an interface (e.g., mock vs. real)
3. The implementation choice depends on configuration or context

## Error Handling

- Use the common error types defined in `common-errors/` directory
- Wrap external errors in appropriate CAMS error types
- Include meaningful error messages that can be displayed to users
- Use the `MODULE_NAME` constant to identify the source of errors

```typescript
// Good error handling
try {
  // Operation that might fail
} catch (originalError) {
  if (!isCamsError(originalError)) {
    throw new UnknownError(MODULE_NAME, {
      message: 'User-friendly error message',
      originalError,
      status: 500,
    });
  } else {
    throw originalError;
  }
}
```

## Repository Pattern

- Use the repository pattern for data access
- Repositories should be accessed through factory getter functions
- Include proper resource cleanup using `deferRelease` when appropriate

## Testing

- Mock dependencies using the provided mock implementations
- Test both success and error paths
- Use the factory pattern to inject mock dependencies during testing
