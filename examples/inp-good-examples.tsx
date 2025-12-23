import type { ChangeEvent } from "react";
import { useState } from "react";

// Example 1: Simple event handler with no heavy work
export function GoodSimpleButton() {
  const handleClick = () => {
    // This is fine - no heavy computations or blocking operations
    console.log("Button clicked");
  };

  return (
    <button type="button" onClick={handleClick}>
      Click me (Good)
    </button>
  );
}

// Example 2: Proper yielding pattern - UI update immediate, non-UI work deferred
export function GoodYieldingPattern() {
  const [text, setText] = useState("");
  const [wordCount, setWordCount] = useState(0);

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // UI update happens immediately - correct!
    setText(inputValue);

    // Non-UI work is deferred using proper pattern
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Heavy computation deferred
        const words = inputValue.split(" ").filter((w) => w.length > 0);
        setWordCount(words.length);

        // Other non-critical work
        if (words.length > 10) {
          console.log("Long text detected");
        }
      }, 0);
    });
  };

  return (
    <div>
      <input
        type="text"
        value={text}
        onInput={handleInput}
        placeholder="Type here (Good Pattern)"
      />
      <p>Words: {wordCount}</p>
    </div>
  );
}

// Example 3: API call with proper yielding
export function GoodApiCallPattern() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    // UI update immediate
    setLoading(true);

    // API call deferred
    requestAnimationFrame(() => {
      setTimeout(() => {
        fetch("/api/data")
          .then((res) => res.json())
          .then((json) => {
            setData(json);
            setLoading(false);
          });
      }, 0);
    });
  };

  return (
    <button type="button" onClick={handleClick}>
      {loading ? "Loading..." : "Fetch Data (Good)"}
    </button>
  );
}

// Example 4: Heavy computation moved outside event handler
export function GoodComputationPattern() {
  const [result, setResult] = useState(0);

  // Heavy computation moved outside event handler
  const processData = async (data: number[]) => {
    // Use requestIdleCallback or Web Worker for heavy work
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => {
        const sum = data.reduce((acc, val) => acc + val, 0);
        setResult(sum);
      });
    } else {
      // Fallback to setTimeout
      setTimeout(() => {
        const sum = data.reduce((acc, val) => acc + val, 0);
        setResult(sum);
      }, 0);
    }
  };

  const handleClick = () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => i);
    processData(largeArray);
  };

  return (
    <button type="button" onClick={handleClick}>
      Process Data (Good Pattern)
    </button>
  );
}

// Example 5: Proper state update pattern
export function GoodStateUpdatePattern() {
  const [formData, setFormData] = useState({ name: "", email: "" });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Single state update - fine
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Validation deferred
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (name === "email") {
          const isValid = value.includes("@");
          console.log("Email valid:", isValid);
        }
      }, 0);
    });
  };

  return (
    <form>
      <input name="name" value={formData.name} onChange={handleChange} placeholder="Name" />
      <input name="email" value={formData.email} onChange={handleChange} placeholder="Email" />
    </form>
  );
}

// Example 6: Array operations inside small loops are acceptable
export function GoodArrayInLoop() {
  const handleClick = () => {
    const items = Array.from({ length: 100 }, (_, i) => i);

    // Array operations inside a small loop are acceptable
    // (Small loops with array operations are less problematic than standalone heavy operations)
    for (let i = 0; i < 10; i++) {
      const mapped = items.map((item) => item * i);
      const filtered = mapped.filter((item) => item > 5);
      console.log(filtered.length);
    }
  };

  return (
    <button type="button" onClick={handleClick}>
      Process Small Loop (Good)
    </button>
  );
}
