export function defineEntityFields<T>() {
  return <K extends readonly (keyof T)[]>(...fields: K): K => fields;
}

export function fieldsOf<T>() {
  return <K extends readonly (keyof T)[]>(...fields: K): K => fields;
}

