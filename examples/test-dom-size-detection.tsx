// Test components demonstrating nesting depth detection for INP (attributes, text, ternary removed)

// Component that triggers NESTING detection (depth 6 > max 5)
export function DeepNestingComponent() {
  return (
    <div>
      <section>
        <article>
          <header>
            <nav>
              <ul>
                {" "}
                {/* Depth 6 - triggers detection */}
                <li>Depth level 7 - too deep!</li>
              </ul>
            </nav>
          </header>
        </article>
      </section>
    </div>
  );
}

// Component that DOES NOT trigger detection (depth 4 <= max 5)
export function AcceptableNestingComponent() {
  return (
    <div>
      <section>
        <article>
          <p>Depth 4 - this is acceptable</p>
        </article>
      </section>
    </div>
  );
}

// Component with HEAVYWEIGHT element deep nesting (table at depth 6 - HIGH severity)
export function HeavyweightNestedComponent() {
  return (
    <div>
      <section>
        <div>
          <div>
            <div>
              <table>
                {" "}
                {/* Heavyweight element at depth 6 - HIGH severity */}
                <tbody>
                  <tr>
                    <td>Table cell at depth 8</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Real-world deep nesting example with CSS classes
export function RealWorldDeepNesting() {
  return (
    <div className="page-container">
      <main className="main-content">
        <div className="content-wrapper">
          <section className="feature-section">
            <div className="card">
              <div className="card-body">
                {/* Depth 6 - triggers detection */}
                <div className="alert alert-info">
                  <p>This component structure is too deeply nested!</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// Simple component within limits
export function SimpleComponent() {
  return (
    <div>
      <p>Depth 2 - perfectly fine!</p>
    </div>
  );
}
