# 006 - Rule Editor UI

## Context

Rules are the core abstraction in Heliotrope: each rule maps a set of real-world conditions to an avatar image. The resolver evaluates rules by priority, but users need a way to create, edit, reorder, and test those rules through the web UI. The rule editor must support eleven condition types, each with its own form layout and validation. Two of those types (geofence circle and geofence polygon) require interactive map editing via Leaflet. The editor also needs a way to test a rule against the user's current signals without waiting for the next scheduled evaluation cycle.

This document covers the rule list page (`/rules`), the rule editor page (`/rules/:id`), the per-condition-type editor components, Leaflet integration for geofence editing, and the associated stories and E2E tests.

## Proposal

### Routes

**`/rules`** displays all rules for the current user as a list of cards. Each card shows the rule's name, priority, enabled state, a compact condition summary (for example, "3 conditions: date, weather, geofenceCircle"), and a thumbnail of its associated image. The list supports:

- **Move up / move down buttons**: each card has up/down buttons to shift priority relative to its neighbors. Priorities are re-spaced in increments of 10 after each move to leave room for future insertions without a full renumber.
- **Enable/disable toggle**: flips the rule's `enabled` field inline. Disabled rules are visually dimmed.
- **Add**: a button that creates a new rule with default values (empty name, enabled, priority set to 10 above the current highest, no conditions, no image) and navigates to `/rules/:id`.
- **Edit**: clicking a rule card navigates to `/rules/:id`.
- **Delete**: a delete button on each card opens a confirmation dialog. On confirm, the rule document is deleted from Firestore.

**`/rules/:id`** is the full rule editor described below.

### Rule editor layout

The editor page has the following fields, rendered top to bottom:

1. **Name** (text input). Required. The rule's display name.

2. **Enabled** (toggle). Defaults to `true` for new rules.

3. **Priority** (number input with increment/decrement buttons). Steps of 10. The resolver evaluates higher-priority rules first. The UI shows a hint explaining this.

4. **Image** (picker). Displays thumbnails from the user's image library, grouped by tag. Clicking a thumbnail selects it as the rule's `imageId`. The currently selected image has a visible highlight. If the library is empty, the picker shows a link to `/images` with the text "Upload images first."

5. **Conditions list**. Displays each condition as a card with the condition type label and a summary of its configuration. Each card has an edit button (expands the condition's editor inline) and a remove button. At the bottom of the list, an "Add condition" button opens a dropdown of all available condition types.

6. **Test against current signals** (button, disabled). This feature depends on the `testRule` HTTPS Function (Milestone 8). The button is rendered but disabled with the label "Test (requires signals)" until the function exists. No client-side implementation is needed in this milestone.

7. **Save** (button). Writes the rule document to Firestore. Validates that a name and image are set before saving. If validation fails, inline errors appear next to the relevant fields.

8. **Cancel** (link). Navigates back to `/rules` without saving.

### Condition editor components

Each condition type has its own editor component in `apps/web/src/components/ConditionEditor/`. Every component receives the current condition value as a prop and calls an `onChange` callback when the user modifies it. Every component has a colocated `*.stories.tsx` file with Populated and Empty stories. Condition types with non-trivial validation also have an Invalid story.

**DateCondition.tsx**

Edits a `{ type: "date", monthDay: string, windowDaysBefore?: number, windowDaysAfter?: number }` condition. Fields:

- Month and day selectors (dropdowns or two number inputs).
- Optional "window" fields: days before and days after (number inputs, default 0).

Summary text example: "March 17, +/- 0 days".

**DateRangeCondition.tsx**

Edits a `{ type: "dateRange", fromISO: string, toISO: string }` condition. Fields:

- From date (date input, ISO format).
- To date (date input, ISO format).
- Validation: `fromISO` must not be after `toISO`. If invalid, show an inline error.

Summary text example: "2026-12-20 to 2027-01-05". Stories: Populated, Empty, Invalid (from after to).

**DayOfWeekCondition.tsx**

Edits a `{ type: "dayOfWeek", days: Array<1|2|3|4|5|6|7> }` condition. Fields:

- Seven checkboxes labeled Mon through Sun (ISO weekday numbers 1 through 7).
- At least one day must be selected. If none are selected, show an inline error.

Summary text example: "Mon, Wed, Fri". Stories: Populated, Empty, Invalid (no days selected).

**MonthRangeCondition.tsx**

Edits a `{ type: "monthRange", fromMonth: number, toMonth: number }` condition. Fields:

- From month (dropdown, January through December).
- To month (dropdown, January through December).
- A note explaining that year-wrapping ranges are supported (for example, November to February matches Nov, Dec, Jan, Feb).

Summary text example: "November to February".

**TimeRangeCondition.tsx**

Edits a `{ type: "timeRange", fromLocal: string, toLocal: string }` condition. Fields:

- From time (time input, "HH:mm" format).
- To time (time input, "HH:mm" format).
- A note explaining that midnight-crossing ranges are supported (for example, "22:00 to 06:00" means overnight).

Summary text example: "09:00 to 17:00".

**TimeOfDayCondition.tsx**

Edits a `{ type: "timeOfDay", value: "day" | "night" }` condition. Fields:

- Two radio buttons: "Day (sunrise to sunset)" and "Night (sunset to sunrise)".

Summary text example: "Night".

**GeofenceCircleCondition.tsx**

Edits a `{ type: "geofenceCircle", center: [number, number], radiusMeters: number }` condition. This component integrates Leaflet.

- A Leaflet map displays the current circle (if center is set).
- **Click** on the map to place or move the center point.
- **Drag** the circle edge to adjust the radius visually, or type a radius value in a numeric input below the map.
- Numeric inputs for latitude, longitude, and radius are shown below the map for precise entry.
- The map initializes centered on the existing circle (if editing) or at a default zoom level showing the world (if creating new).

Summary text example: "Circle at [37.79, -122.41], radius 200 m".

**GeofencePolygonCondition.tsx**

Edits a `{ type: "geofencePolygon", points: Array<[number, number]> }` condition. This component integrates Leaflet.

- A Leaflet map displays the current polygon (if points exist).
- **Click** to drop vertices sequentially. Each click adds a point.
- **Double-click** to finish the polygon (closes the shape).
- **Drag** existing vertices to adjust.
- A "Clear" button removes all points and starts over.
- The map shows vertex coordinates in a list below it for reference.
- Minimum 3 points required. If fewer than 3 points exist when the user tries to save, show an inline error.

Summary text example: "Polygon with 5 vertices". Stories: Populated, Empty, Invalid (fewer than 3 points).

**CountryCondition.tsx**

Edits a `{ type: "country", codes: string[] }` condition. Fields:

- A text input for ISO 3166-1 alpha-2 country codes. Selected codes appear as removable chips (reusing the TagEditor pattern).
- At least one country must be selected. If none are selected, show an inline error.

Summary text example: "BR, US". Stories: Populated, Empty, Invalid (no codes selected).

**WeatherCondition.tsx**

Edits a `{ type: "weather", field: "precipitationMmPerHour" | "snowfallMmPerHour" | "temperatureC" | "weatherCode", op: ">" | "<" | ">=" | "<=" | "==", value: number }` condition. Fields:

- Field dropdown: "Precipitation (mm/hr)", "Snowfall (mm/hr)", "Temperature (C)", "Weather code".
- Operator dropdown: ">", "<", ">=", "<=", "==".
- Value number input.

Summary text example: "precipitationMmPerHour >= 2".

**NearCityCondition.tsx**

Edits a `{ type: "nearCity", minPopulation: number, maxDistanceKm: number }` condition. Fields:

- Minimum population (number input).
- Maximum distance in km (number input).

Summary text example: "Near city with population >= 100,000 within 10 km".

### Leaflet integration

Leaflet is included via the `leaflet` and `react-leaflet` npm packages. Leaflet's CSS is imported in the geofence condition components (not globally) to avoid affecting other pages. The map tile provider is OpenStreetMap's default tile layer, which requires no API key.

The map container has a fixed height (400px) within the condition editor card. On mount, if the condition has existing coordinates, the map fits bounds to show the geofence. If there are no existing coordinates, the map shows a world view at zoom level 2.

### Styling

All rule editor components use Tailwind CSS utility classes and shadcn/ui primitives, consistent with the rest of the web app (see Milestone 6).

## Alternatives considered

**Single monolithic rule editor component instead of per-type condition editors.** A single component with conditional rendering based on the condition type would reduce the number of files. This was rejected because each condition type has distinct fields, validation logic, and (for geofences) third-party dependencies. Separate components keep each editor focused, testable in isolation, and independently storybooked. Adding a new condition type means adding one component and one stories file without touching existing editors.

**Mapbox or Google Maps instead of Leaflet.** Both offer polished APIs and better mobile touch support. They were rejected because both require API keys and have usage-based pricing. Leaflet with OpenStreetMap tiles is free, open-source, and sufficient for a single-user tool where geofence editing happens infrequently. If the map experience proves inadequate, switching to Mapbox later would only affect the two geofence components.

**Inline editing on the rules list page instead of a dedicated editor page.** Inline editing would reduce navigation but makes the UI crowded when a rule has multiple conditions, especially geofence conditions with embedded maps. A dedicated editor page provides enough space for the full condition list, the image picker, and the test results panel. The list page stays clean with summary cards.

**Drag-to-reorder on the rules list.** For a single-user tool with typically fewer than 20 rules, simple "move up / move down" buttons achieve the same result with less implementation complexity and no drag library dependency. Drag-to-reorder could be added later as a polish item.

**Form library (React Hook Form, Formik) for the editor.** A form library would provide built-in validation and state management. This was rejected because the rule editor's validation is simple (required name, required image, per-condition checks), the condition editors manage their own local state, and adding a form library increases the bundle and introduces another dependency. Plain controlled components with inline validation are sufficient.

**Country code autocomplete with full country list.** Shipping a 249-entry country list for autocomplete adds complexity. Reusing the TagEditor chip pattern (type the 2-letter code, press Enter) is simpler and sufficient since users know their target country codes.

## Acceptance criteria

- The `/rules` page displays all rules as cards with name, priority, enabled toggle, condition summary, and image thumbnail.
- Move up / move down buttons on the `/rules` page recalculate priorities in steps of 10 and persist the new order to Firestore.
- Enable/disable toggle on a rule card updates the `enabled` field in Firestore without navigating away.
- Add button creates a new rule with defaults and navigates to `/rules/:id`.
- Delete button shows a confirmation dialog and removes the rule document on confirm.
- The `/rules/:id` editor page renders all fields: name, enabled toggle, priority with increment/decrement, image picker, conditions list, test button (disabled), save, and cancel.
- Image picker shows thumbnails from the user's library grouped by tag, with the selected image highlighted.
- "Add condition" dropdown lists all eleven condition types. Selecting one adds the condition editor inline.
- Each condition editor component renders the correct fields for its type and calls `onChange` with updated values.
- `GeofenceCircleCondition` renders a Leaflet map. Clicking places the center, dragging the edge adjusts the radius, and numeric inputs below the map allow precise entry.
- `GeofencePolygonCondition` renders a Leaflet map. Clicking adds vertices, double-clicking closes the polygon, dragging adjusts vertices, and a "Clear" button resets.
- Save validates that name and image are set, writes the rule to Firestore, and navigates back to `/rules`.
- Each condition editor has a colocated `*.stories.tsx` file with Populated and Empty stories. Condition types with non-trivial validation also include an Invalid story (DateRange, DayOfWeek, GeofencePolygon, Country).
- `Rules.stories.tsx` covers the rules list in empty, populated, and loading states.
- `RuleEditor.stories.tsx` covers the editor with a fully populated rule and with a new (empty) rule.
- Cypress E2E test creates a rule with at least three conditions, saves it, and verifies it appears on the `/rules` list.
- Cypress E2E test covers inline enable/disable toggle on the rules list page.
- Leaflet CSS is imported only in geofence condition components, not globally.
- All components use Tailwind CSS and shadcn/ui primitives.
- `pnpm typecheck` and `pnpm lint` pass.
- `pnpm test` passes.
- `pnpm storybook:build` succeeds.
