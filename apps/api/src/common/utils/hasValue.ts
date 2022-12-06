function hasValue(value: any) {
  return value != null && !(Array.isArray(value) && value.length === 0);
}

export default hasValue;
