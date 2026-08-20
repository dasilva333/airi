# Technical Hand-off: Live2D DSL & Dating Sim State Integration

## 📋 Objective
Build and verify the robust parsing and runtime execution of custom interactive Live2D Domain Specific Languages (DSL). This entails downloading a curated set of complex interactive models from Steam, parsing their custom triggers, and integrating them into the core tamagotchi/dating-sim state machine (managing tension, intimacy, menu toggling, and expression updates).

---

## 🛠️ Step 1: Download & Package the Live2D Models

1. **Clone the Packager Repo**:
   Clone the helper tool designed to package Steam Workshop items into local asset packages (`.lpk` format) used by the engine:
   ```bash
   git clone https://github.com/dasilva333/steam-lpk-packager.git
   ```

2. **Acquire target workshop items**:
   Run the download/packaging tool using the newly generated batch file [batch-dsl-test-cases.txt](file:///Users/richardpinedo/Projects.nosync/steam-lpk-packager/batch-dsl-test-cases.txt):
   ```bash
   # Inside steam-lpk-packager:
   # Execute the downloader/processor utility passing the batch file
   python process_batch2_safe.py batch-dsl-test-cases.txt
   ```
   *Note: This downloads the raw Live2D models, extracts them, and packages/moves them into the correct asset sub-folders.*

---

## 🔍 Step 2: Read the Special Sauce Spec

The target models contain advanced, interactive scripting blocks that were stripped out of the core `.model3.json` structure to prevent WebGL renderer crashes, but need to be parsed and interpreted at the application layer.

* **Insights & Stripped Schema Document**: [live2d-special-sauce-insights.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/live2d-special-sauce-insights.md)
  Refer to this file to inspect how each Steam ID uses custom logic. For instance:
  * **Choices / Menus** (`live2d_2883004043`, `live2d_3626567931`): DSL nodes containing structured arrays of `Choices` (e.g. `{"Text": "Option", "NextMtn": "A"}`).
  * **Intimacy & Expression Hooks** (`live2d_2262182171`): Command sequences invoking sound clips, custom expressions, and intimacy bonuses (e.g. `{"Command": "start_mtn Face#2:01", "Intimacy": {"Min": 20, "Bonus": 1}}`).
  * **Variables & Conditions** (`live2d_3626567931`): Stateful operations like `VarFloats` checking variables or assigning values (e.g. `{"Name": "DoubleClickTimer", "Type": 2, "Code": "assign 0"}`).

---

## ⚙️ Step 3: Implement & Test the DSL Interpreter

1. **Review interpreter specs**:
   * Review [live2d-dsl-interpreter-spec.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/live2d-dsl-interpreter-spec.md) for context on how the interpreter parses variables, conditional statements (`equal`, `greater`, etc.), and sequence triggers.
   * Understand the game mechanics integration: [dating-sim-gamestate-mechanics.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/dating-sim-gamestate-mechanics.md) and [dating-sim-intimacy-spec.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/dating-sim-intimacy-spec.md).

2. **Load Models into Airi**:
   Place the generated Live2D directories inside the Airi assets/cache paths (typically `packages/stage-ui-live2d/` or within the dev runtime cache directories).

3. **Verify the Interpreter/State Machine**:
   Implement or expand the parser logic to:
   * **Parse commands**: Parse actions such as `clear_exp`, `start_mtn`, `change_cos`, and UI buttons dynamically.
   * **Manage Intimacy & Tension states**: Map parameters like `"Intimacy": {"Min": 80, "Bonus": 1}` directly into the active dating session / tamagotchi store.
   * **Execute conditional branches**: Support conditional animation playing based on the current intimacy level and expression states.

## Relevant Skills

- [[airi-live2d-dsl-interpreter]]
