import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  visibilityLabel: string;
};

export function PasswordInput({ visibilityLabel, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-field">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        aria-label={`${visible ? "Masquer" : "Afficher"} ${visibilityLabel}`}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {visible ? "visibility_off" : "visibility"}
        </span>
      </button>
    </span>
  );
}
