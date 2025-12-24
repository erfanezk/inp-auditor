import React, { useState } from "react";

// Bad example 1: JavaScript animation instead of CSS
export const BadAnimationExample1 = () => {
  const [position, setPosition] = useState(0);

  const animateWithJavaScript = () => {
    // Uses setTimeout for animation instead of CSS
    const interval = setInterval(() => {
      setPosition((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 16); // Roughly 60fps
  };

  return (
    <div>
      <div style={{ transform: `translateX(${position}px)` }}>Animating with JavaScript (bad)</div>
      <button type="button" onClick={animateWithJavaScript}>
        Start JavaScript animation
      </button>
    </div>
  );
};

// Bad example 2: Non-composited CSS properties
export const BadAnimationExample2 = () => {
  const [width, setWidth] = useState(100);

  const toggleWidth = () => {
    setWidth(width === 100 ? 300 : 100);
  };

  return (
    <div>
      <div
        style={{
          width: `${width}px`, // Non-composited property
          height: "50px",
          backgroundColor: "red",
          transition: "width 0.3s ease", // Still causes layout thrashing
        }}
      >
        Animated width (non-composited)
      </div>
      <button type="button" onClick={toggleWidth}>
        Toggle width
      </button>
    </div>
  );
};

// Bad example 3: Multiple non-composited properties
export const BadAnimationExample3 = () => {
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const moveElement = () => {
    setPos({ left: Math.random() * 200, top: Math.random() * 200 });
  };

  return (
    <div>
      <div
        style={{
          position: "absolute",
          left: `${pos.left}px`, // Non-composited
          top: `${pos.top}px`, // Non-composited
          width: "50px",
          height: "50px",
          backgroundColor: "blue",
        }}
      >
        Moving element
      </div>
      <button type="button" onClick={moveElement}>
        Move element
      </button>
    </div>
  );
};

// Bad example 4: JavaScript animation with nested timers
export const BadAnimationExample4 = () => {
  const [scale, setScale] = useState(1);

  const animateScale = () => {
    // Complex JavaScript animation logic
    requestAnimationFrame(() => {
      setScale(1.2);
      setTimeout(() => {
        setScale(1);
      }, 500);
    });
  };

  return (
    <div>
      <div
        style={{
          transform: `scale(${scale})`, // Good: composited property
          width: "100px",
          height: "100px",
          backgroundColor: "green",
          transition: "transform 0.3s ease",
        }}
      >
        Scaling element
      </div>
      <button type="button" onClick={animateScale}>
        Scale animation (using RAF unnecessarily)
      </button>
    </div>
  );
};
