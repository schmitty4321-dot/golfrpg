/** A 0.5-5 star rating, with its value for screen readers. */
export const Stars = ({ value, max = 5 }: { value: number; max?: number }) => (
  <span aria-label={`${value} out of ${max} stars`} title={`${value} / ${max}`} style={{ letterSpacing: 1, color: "var(--warning)" }}>
    {"★".repeat(Math.floor(value))}
    {value % 1 ? "⯪" : ""}
    <span style={{ color: "var(--bar-track)" }}>{"★".repeat(max - Math.ceil(value))}</span>
  </span>
);
