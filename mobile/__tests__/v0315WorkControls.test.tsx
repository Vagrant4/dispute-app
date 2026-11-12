import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { NoteSheet } from "../src/screens/NoteSheet";
import { TaskPickerSheet } from "../src/screens/TaskPickerSheet";

describe("0.3.15 work controls", () => {
  it("edits and saves an existing shift note with status feedback", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<NoteSheet initialValue="Existing evidence" readOnly={false} onClose={jest.fn()} onSave={onSave} />);
    fireEvent.changeText(screen.getByLabelText("Shift note"), "Updated evidence");
    fireEvent.press(screen.getByText("Save note"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Updated evidence"));
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("shows a visible note error and becomes read-only after clock-out", async () => {
    render(<NoteSheet initialValue="Sealed note" readOnly onClose={jest.fn()} onSave={jest.fn()} />);
    expect(screen.getByLabelText("Shift note").props.editable).toBe(false);
    expect(screen.getByText("This note is read-only after clock-out.")).toBeTruthy();
    expect(screen.queryByText("Save note")).toBeNull();
  });

  it("shows a visible error when saving a note fails", async () => {
    render(<NoteSheet initialValue="" readOnly={false} onClose={jest.fn()} onSave={jest.fn().mockRejectedValue(new Error("disk"))} />);
    fireEvent.press(screen.getByText("Save note"));
    expect(await screen.findByText("Couldn’t save note. Try again.")).toBeTruthy();
  });

  it("lists, selects, adds, and long-press renames tasks", async () => {
    const onSelect = jest.fn();
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onRename = jest.fn().mockResolvedValue(undefined);
    render(<TaskPickerSheet tasks={[{ id: "task-1", projectId: "p1", name: "Framing" }]} selectedId={null} onClose={jest.fn()} onSelect={onSelect} onAdd={onAdd} onRename={onRename} />);
    fireEvent.press(screen.getByText("Framing"));
    expect(onSelect).toHaveBeenCalledWith("task-1");
    fireEvent.changeText(screen.getByLabelText("Task name"), "Cleanup");
    fireEvent.press(screen.getByText("+ Add task"));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Cleanup"));
    fireEvent(screen.getByText("Framing"), "longPress");
    expect(screen.getByLabelText("Task name").props.value).toBe("Framing");
    fireEvent.changeText(screen.getByLabelText("Task name"), "Structure");
    fireEvent.press(screen.getByText("Rename task"));
    await waitFor(() => expect(onRename).toHaveBeenCalledWith("task-1", "Structure"));
  });
});
