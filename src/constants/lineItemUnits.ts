export const LINE_ITEM_UNIT_OPTIONS = [
  { value: "item", label: "Item" },
  { value: "each", label: "Each" },
  { value: "hour", label: "Hour" },
  { value: "sq ft", label: "Sq Ft" },
  { value: "linear ft", label: "Linear Ft" },
  { value: "day", label: "Day" },
  { value: "cubic yd", label: "Cubic Yd" },
  { value: "cubic ft", label: "Cubic Ft" },
  { value: "ton", label: "Ton" },
  { value: "lb", label: "Lb" },
  { value: "gallon", label: "Gallon" },
  { value: "yard", label: "Yard" },
  { value: "linear yard", label: "Linear Yard" },
] as const;

export const LINE_ITEM_UNIT_VALUES = LINE_ITEM_UNIT_OPTIONS.map((option) => option.value);
