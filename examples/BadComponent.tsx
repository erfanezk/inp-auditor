import type React from "react";

export function BadComponent() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Heavy loop in onSubmit handler
    const data: Array<{ id: number; value: number; processed: number }> = [];
    for (let i = 0; i < 50000; i++) {
      data.push({
        id: i,
        value: Math.random() * 1000,
        processed: Math.sqrt(i),
      });
    }

    console.log("Processed", data.length, "items");
  };

  const handleMouseEnter = () => {
    // While loop in event handler
    let count = 0;
    while (count < 2000) {
      count++;
      count * 2;
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <button type="submit">Submit (Bad INP)</button>
      </form>
      <button type="button" onMouseEnter={handleMouseEnter}>
        Hover me (Bad INP)
      </button>
    </div>
  );
}
