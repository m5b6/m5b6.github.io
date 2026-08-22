"use client";

import { useId, type InputHTMLAttributes } from "react";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  label: string;
  id?: string;
};

function Choice({ kind, label, id, className, ...rest }: ChoiceProps & { kind: "checkbox" | "radio" }) {
  const generated = useId();
  const inputId = id ?? generated;
  const classes = className ? `field-row mac-field ${className}` : "field-row mac-field";

  return (
    <div className={classes}>
      <input {...rest} type={kind} id={inputId} />
      <label htmlFor={inputId}>{label}</label>
    </div>
  );
}

export type MacCheckboxProps = ChoiceProps;

export function MacCheckbox(props: MacCheckboxProps) {
  return <Choice {...props} kind="checkbox" />;
}

export type MacRadioProps = ChoiceProps;

export function MacRadio(props: MacRadioProps) {
  return <Choice {...props} kind="radio" />;
}
