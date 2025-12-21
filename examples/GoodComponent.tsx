export function GoodComponent() {
  const handleClick = () => {
    // This is fine - no heavy loops
    console.log("Button clicked");
  };

  return (
    <button type="button" onClick={handleClick}>
      Click me (Good)
    </button>
  );
}
