export const arrayElemIf = <ElementType>(condition: boolean, element: ElementType) =>
  condition ? [element] : [];
