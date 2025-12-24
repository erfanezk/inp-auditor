// Examples demonstrating nesting depth detection for INP performance
// NOTE: Now only nesting depth is checked (removed attributes, text, ternary detection)

// Example 1: Deep Nesting Component (Depth 6 - triggers detection)
export function DeepNestingBadExample() {
  return (
    // Depth: 1 - Outer div
    <div>
      {/* Depth: 2 - Section */}
      <section>
        {/* Depth: 3 - Article */}
        <article>
          {/* Depth: 4 - Header */}
          <header>
            {/* Depth: 5 - Navigation */}
            <nav>
              {/* Depth: 6 - UL (TRIGGERS NESTING DETECTION - exceeds MAX_NESTING_DEPTH=5) */}
              <ul>
                {/* Depth: 7 - LI - way too deep! */}
                <li>Item 1</li>
                <li>Item 2</li>
                <li>Item 3</li>
              </ul>
            </nav>
          </header>
        </article>
      </section>
    </div>
  );
}

// Example 2: Acceptable Nesting (Depth 4 - within limits)
export function AcceptableNestingExample() {
  return (
    // Depth: 1 - Outer div
    <div>
      {/* Depth: 2 - Section */}
      <section>
        {/* Depth: 3 - Article */}
        <article>
          {/* Depth: 4 - Paragraph - this is okay */}
          <p>Acceptable nesting depth (4 levels)</p>
        </article>
      </section>
    </div>
  );
}

// Example 3: Heavyweight Element Deep Nesting (table at depth 6 - HIGH severity)
export function HeavyweightDeepNestingExample() {
  return (
    // Heavyweight element (table) at deep nesting - triggers HIGH severity
    <div>
      <section>
        <div>
          <div>
            <div>
              <table>
                {" "}
                {/* Heavyweight element at depth 6 - HIGH severity detection */}
                <thead>
                  <tr>
                    <th>Header</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Table row at depth 8 - very problematic!</td>
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

// Example 4: Real-world deep component structure
export function RealWorldDeepStructure() {
  return (
    // Typical problematic real-world component structure
    <section className="page-section">
      <div className="container">
        <div className="row">
          <div className="col-md-12">
            <div className="card">
              <div className="card-body">
                {/* Depth 6 - triggers detection */}
                <div className="alert alert-warning">
                  <p>Warning: This component structure is too deeply nested!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
