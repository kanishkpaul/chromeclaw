import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
function Fixture() {
  const [city, setCity] = useState("");
  return createElement(
    "form",
    { onSubmit: (event) => event.preventDefault() },
    createElement("p", null, "The React form destination is Kolkata."),
    createElement(
      "label",
      null,
      "City",
      createElement("input", {
        value: city,
        onChange: (event) => setCity(event.target.value),
      }),
    ),
    createElement("button", null, "Save"),
  );
}
flushSync(() =>
  createRoot(document.getElementById("root")).render(createElement(Fixture)),
);
