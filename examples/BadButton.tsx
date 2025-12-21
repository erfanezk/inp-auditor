export function BadButton() {
  const handleClick = () => {
    // Heavy loop in event handler - will trigger INP rule
    for (let i = 0; i < 10000; i++) {
      console.log(`Processing item ${i}`);
      const result = Math.sqrt(i) * Math.random();
      const processed = result * 2;
      console.warn(processed);
    }
  };

  return (
    <button type="button" onClick={handleClick}>
      Click me (Bad INP)
    </button>
  );
}
