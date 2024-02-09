import { Person } from './cams/parties';

export function getFullName(person: Person, fullMiddle = false) {
  const fullName = [];
  if (person.firstName) fullName.push(person.firstName);
  if (person.middleName) {
    fullName.push(fullMiddle ? person.middleName : person.middleName.slice(0, 1));
  }
  if (person.lastName) fullName.push(person.lastName);
  if (person.generation) fullName.push(person.generation);

  return fullName.join(' ');
}
