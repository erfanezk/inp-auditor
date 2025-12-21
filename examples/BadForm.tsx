import type { ChangeEvent } from "react";
import { useState } from "react";

export function BadForm() {
  const [value, setValue] = useState("");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Nested loops in onChange - will trigger INP rule
    for (let i = 0; i < 1000; i++) {
      for (let j = 0; j < 500; j++) {
        const computed = i * j;
        computed.toString();
      }
    }

    setValue(inputValue);
  };

  return (
    <form>
      <input type="text" value={value} onChange={handleChange} placeholder="Type here (Bad INP)" />
    </form>
  );
}
