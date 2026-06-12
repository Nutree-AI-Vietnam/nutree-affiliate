import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable, type Column } from "../DataTable";

interface Row {
  name: string;
  amt: number;
}

describe("DataTable", () => {
  const cols: Column<Row>[] = [
    { key: "name", header: "Name" },
    { key: "amt", header: "Amount", render: (r) => `$${r.amt}` },
  ];
  it("renders headers and rows", () => {
    render(<DataTable columns={cols} rows={[{ name: "Alex", amt: 80 }]} rowKey={(r) => r.name} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("$80")).toBeInTheDocument();
  });
  it("renders an empty state", () => {
    render(<DataTable columns={cols} rows={[]} rowKey={(r) => r.name} empty="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});
