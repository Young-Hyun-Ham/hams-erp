import type { Employee } from "@/lib/types";

export default function Avatar({
  person,
  small = false,
}: {
  person: Employee;
  small?: boolean;
}) {
  const colors = ["peach", "lavender", "mint", "blue"];
  return (
    <span
      className={`avatar ${colors[person.name.charCodeAt(0) % 4]} ${small ? "small" : ""}`}
    >
      {person.name.slice(1)}
    </span>
  );
}
