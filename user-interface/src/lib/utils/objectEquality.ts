export function deepEqual(object1: object, object2: object) {
  const keys1: string[] = Object.keys(object1);
  const keys2: string[] = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  let key: string;
  for (key of keys1) {
    const val1 = object1[key as keyof typeof object1];
    const val2 = object2[key as keyof typeof object2];
    const areObjects = isObject(val1) && isObject(val2);
    if ((areObjects && !deepEqual(val1, val2)) || (!areObjects && val1 !== val2)) {
      return false;
    }
  }

  return true;
}

function isObject(ob: object) {
  return ob != null && typeof ob === 'object';
}
