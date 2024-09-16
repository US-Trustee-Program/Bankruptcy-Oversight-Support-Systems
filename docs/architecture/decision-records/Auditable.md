# Auditable

## Context

A historical record needs to be kept related to certain data points in CAMS. This historical record involves tracking when a change was made, and by whom. We were previously managing this for orders and assignments in an ad hoc manner. To ensure consistency and to reduce boilerplate code, we need a way to provide this functionality through code common to all data types that require historical records.

## Decision

We have created the `Auditable` type which contains the common properties for history. We have also created the `createAuditRecord` function which provides default values for the properties and the ability to override if needed. Consider the example type—`Foo`—as follows:

```typescript
type Foo = Auditable & {
  prop1: string;
  prop2: number;
}
```

To create a historical record for an action initiated by a user, call the `createAuditRecord` as follows:

```typescript
createAuditRecord<Foo>({ record: someFoo, session: userSession });
```

To create a historical record for an action initiated by the system, call the `createAuditRecord` as follows:

```typescript
createAuditRecord<Foo>({ record: someFoo });
```

To create a historical record with an override, call the `createAuditRecord` as follows:

```typescript
const override = { updatedOn: someDate, updatedBy: someUser };
createAuditRecord<Foo>({ record: someFoo, override });
```

## Status

Approved

## Consequences

Developers need to remember to make use of this type and the function, but it should reduce the amount of boilerplate/duplicate code we have to write to track history.
