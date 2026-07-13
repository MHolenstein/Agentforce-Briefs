// =============================================================================
// Code.gs  –  Agentforce Briefs  |  Google Calendar Workspace Add-on
// =============================================================================
// Entry points declared in appsscript.json:
//   homepageTrigger  → buildHomepageCard(e)
//   eventOpenTrigger → buildEventBriefCard(e)
//
// Action handlers (called by CardService widget interactions):
//   prepareAppointmentAction(e)  — pushes the confirmation card
//   backToBriefAction(e)         — pops the confirmation card, returns to brief
// =============================================================================

// Secondary-text gray — closest match to Figma #83888E.
var GRAY = "#80868B";

// Salesforce cloud logo for the branded footer.
// ?raw=true on a GitHub blob URL returns the raw file bytes (equivalent to
// raw.githubusercontent.com) — safe for CardService.newImage().
var SALESFORCE_LOGO_URL =
  "https://github.com/MHolenstein/Agentforce-Briefs/blob/main/salesforce-logo.png?raw=true";

// Raw GitHub URL for the vehicle image.
var VEHICLE_IMAGE_URL =
  "https://raw.githubusercontent.com/MHolenstein/Agentforce-Briefs/main/ID4%20Dusk%20Blue-v4.png";

// Salesforce logo used as the footer image.
var AGENTFORCE_FOOTER_URL =
  "https://raw.githubusercontent.com/MHolenstein/Agentforce-Briefs/main/salesforce-logo.png";

// Empty-state illustration shown on the homepage when no event is selected.
// Versioned filename to bust any previously cached assets.
var EMPTY_STATE_IMAGE_URL =
  "https://raw.githubusercontent.com/MHolenstein/Agentforce-Briefs/main/agentforce-empty-state-v3.png";

// =============================================================================
// PUBLIC ENTRY POINTS
// =============================================================================

/**
 * Calendar homepageTrigger — shown when no event is selected.
 *
 * No card.setHeader(): the host panel already displays "Agentforce Briefs."
 * Content begins immediately with the empty-state illustration and message.
 *
 * Centering: CardService has no viewport-height or vertical-centering API.
 * A single section with no header provides the most compact top margin the
 * platform allows. Horizontal centering is approximated by placing the image
 * and text in separate single-column sections — Google renders each widget
 * full-width, so short text naturally sits centered within the panel.
 */
function buildHomepageCard(e) {
  try {
    var card = CardService.newCardBuilder();

    var section = CardService.newCardSection()
      .setCollapsible(false);

    // Illustration — rendered above the message, full-width, aspect ratio preserved.
    console.log(JSON.stringify({ imageType: "empty-state", imageUrl: EMPTY_STATE_IMAGE_URL }));
    section.addWidget(
      CardService.newImage()
        .setImageUrl(EMPTY_STATE_IMAGE_URL)
        .setAltText("Select a meeting to see its customer brief")
    );

    // Primary message — sentence case, not bolded in full.
    section.addWidget(
      CardService.newTextParagraph()
        .setText("Select a customer meeting")
    );

    // Supporting text — muted, two natural lines.
    section.addWidget(
      CardService.newTextParagraph()
        .setText(
          "<font color=\"" + GRAY + "\">" +
          "Customer context, available inventory, and recommended " +
          "next steps will appear here." +
          "</font>"
        )
    );

    card.addSection(section);
    return card.build();
  } catch (err) {
    return _buildErrorCard("Homepage error: " + err.message);
  }
}

/**
 * Calendar eventOpenTrigger — shown when the user opens a calendar event.
 *
 * No card.setHeader() here: the host panel already displays "Agentforce Briefs".
 * Adding a CardHeader would produce a redundant label and an extra divider.
 */
function buildEventBriefCard(e) {
  console.log("VEHICLE_IMAGE_URL: " + VEHICLE_IMAGE_URL);
  console.log("EMPTY_STATE_IMAGE_URL: " + EMPTY_STATE_IMAGE_URL);
  console.log("AGENTFORCE_FOOTER_URL: " + AGENTFORCE_FOOTER_URL);
  try {
    var eventContext = getSelectedEventContext(e);
    var brief        = resolveCustomerBrief(eventContext);

    if (!brief) {
      return _buildEmptyStateCard(eventContext);
    }

    // Live event data wins over mock meeting defaults.
    if (eventContext.title)               brief.meeting.title      = eventContext.title;
    if (eventContext.dateLabel)           brief.meeting.dateLabel   = eventContext.dateLabel;
    if (eventContext.timeLabel)           brief.meeting.timeLabel   = eventContext.timeLabel;
    if (eventContext.guestCount !== null) brief.meeting.guestCount  = eventContext.guestCount;
    brief.meeting.isAllDay = eventContext.isAllDay;

    var card = CardService.newCardBuilder();

    // Sections correspond to the four visual groups in the Figma:
    //   §1  Meeting context
    //   §2  Summary + current vehicle          (Figma: rule 1 → rule 2)
    //   §3  Interested in                  ─┐
    //   §4  Matching vehicles               │  (Figma: rule 2 → rule 3)
    //   §5  Opportunity                    ─┘
    //   §6  Recommended next steps + action button + footer
    card.addSection(buildMeetingSection(brief));
    card.addSection(buildSummaryAndVehicleSection(brief));
    card.addSection(buildPreferencesSection(brief));
    card.addSection(buildInventorySection(brief));
    card.addSection(buildOpportunitySection(brief));
    card.addSection(buildRecommendedStepsSection(brief));

    return card.build();
  } catch (err) {
    return _buildErrorCard("Brief error: " + err.message);
  }
}

// =============================================================================
// ACTION HANDLERS  (called by CardService button interactions)
// =============================================================================

/**
 * Called when the user taps "Prepare appointment."
 * Pushes the confirmation card on top of the brief card.
 * On return the user sees the confirmation state; the brief card remains on
 * the stack beneath so backToBriefAction() can pop back to it.
 */
function prepareAppointmentAction(e) {
  var nav = CardService.newNavigation()
    .pushCard(buildConfirmationCard());

  return CardService.newActionResponseBuilder()
    .setNavigation(nav)
    .build();
}

/**
 * Called when the user taps "Back to customer brief" on the confirmation card.
 * Pops the confirmation card, revealing the brief card beneath it.
 */
function backToBriefAction(e) {
  var nav = CardService.newNavigation().popCard();

  return CardService.newActionResponseBuilder()
    .setNavigation(nav)
    .build();
}

// =============================================================================
// CONTEXT & DATA RESOLUTION  (do not modify)
// =============================================================================

/**
 * Extracts relevant fields from the Apps Script event object.
 * Returns a normalised context object; missing fields are null.
 */
function getSelectedEventContext(e) {
  var ctx = {
    title:      null,
    dateLabel:  null,
    timeLabel:  null,
    isAllDay:   false,
    guestCount: null
  };

  try {
    if (!e || !e.calendar || !e.calendar.id) {
      console.warn("getSelectedEventContext: no e.calendar.id present",
                   JSON.stringify(e && e.calendar));
      return ctx;
    }

    var eventId = e.calendar.id;
    var calId   = e.calendar.calendarId ? e.calendar.calendarId : "primary";

    console.log(JSON.stringify({
      calendarContext: e.calendar,
      resolvedCalId:   calId,
      resolvedEventId: eventId
    }));

    // Calendar Advanced Service — must be enabled in the Services panel.
    var calEvent = Calendar.Events.get(calId, eventId);

    if (!calEvent) {
      console.warn("getSelectedEventContext: Calendar.Events.get returned null");
      return ctx;
    }

    var title = calEvent.summary || "";
    console.log(JSON.stringify({ fetchedTitle: title }));
    ctx.title = title || null;

    // Delegate all date/time formatting to the dedicated helpers.
    // Handles timed vs all-day, timezone resolution, Today detection,
    // and multi-day spans — no hardcoded strings.
    var formatted  = formatEventDateTime(calEvent.start, calEvent.end);
    ctx.dateLabel  = formatted.dateLabel;
    ctx.timeLabel  = formatted.timeLabel;
    ctx.isAllDay   = !calEvent.start.dateTime && !!calEvent.start.date;

    var attendees  = calEvent.attendees;
    ctx.guestCount = Array.isArray(attendees)
      ? attendees.filter(function(a) { return !a.organizer; }).length
      : 0;

  } catch (err) {
    console.error("getSelectedEventContext error: " + err.message, err.stack || "");
  }

  return ctx;
}

/**
 * Resolves the customer brief. Delegates to mock data today.
 * Uncomment the live fetch seam when Salesforce is ready.
 */
function resolveCustomerBrief(eventContext) {
  // ── Future integration seam ──────────────────────────────────────────────
  // var liveBrief = fetchBriefFromSalesforce(eventContext);
  // if (liveBrief) return liveBrief;
  // ────────────────────────────────────────────────────────────────────────
  return getMockCustomerBrief(eventContext);
}

/**
 * Future integration seam — replace with an authenticated Salesforce/Agentforce call.
 */
function fetchBriefFromSalesforce(eventContext) {
  // 1. Obtain OAuth 2.0 token (store credentials in PropertiesService).
  // 2. UrlFetchApp.fetch(SALESFORCE_ENDPOINT, { ... })
  // 3. Return a structured brief matching the MOCK_BRIEFS schema, or null.
  return null;
}

// =============================================================================
// SECTION BUILDERS
// =============================================================================

/**
 * §1 — Meeting context.
 * Title: strongest emphasis. Date/time: one muted line. Guests: icon + count.
 *
 * Date/time line is composed from the dynamic context values:
 *   - timed event:   "Tuesday, July 14 · 12:00 PM – 1:00 PM"
 *   - all-day event: "Tuesday, July 14 · All day"
 *   - date only:     "Tuesday, July 14"  (if time is unavailable)
 */
function buildMeetingSection(data) {
  var section = CardService.newCardSection()
    .setCollapsible(false);

  section.addWidget(
    CardService.newTextParagraph()
      .setText("<b>" + _esc(data.meeting.title) + "</b>")
  );

  // Compose the date·time line, handling null timeLabel gracefully.
  var dateTimeLine;
  if (data.meeting.dateLabel && data.meeting.timeLabel) {
    dateTimeLine = _esc(data.meeting.dateLabel) + "  ·  " + _esc(data.meeting.timeLabel);
  } else if (data.meeting.dateLabel && data.meeting.isAllDay) {
    dateTimeLine = _esc(data.meeting.dateLabel) + "  ·  All day";
  } else if (data.meeting.dateLabel) {
    dateTimeLine = _esc(data.meeting.dateLabel);
  } else {
    dateTimeLine = "Date unavailable";
  }

  section.addWidget(
    CardService.newTextParagraph()
      .setText("<font color=\"" + GRAY + "\">" + dateTimeLine + "</font>")
  );

  if (data.meeting.guestCount !== null && data.meeting.guestCount !== undefined) {
    section.addWidget(
      CardService.newDecoratedText()
        .setText(
          data.meeting.guestCount +
          (data.meeting.guestCount !== 1 ? " guests" : " guest")
        )
        .setStartIcon(
          CardService.newIconImage()
            .setIcon(CardService.Icon.MULTIPLE_PEOPLE)
            .setAltText("Guests")
        )
        .setWrapText(false)
    );
  }

  return section;
}

/**
 * §2 — Summary paragraph + current vehicle.
 *
 * Both elements sit between Figma rule 1 and rule 2 — one CardSection.
 * DecoratedText label hierarchy:
 *   setTopLabel    → "Current vehicle"  (renders small and muted natively)
 *   setText        → vehicle name       (native body weight)
 *   setBottomLabel → trade-in range     (renders small and muted; plain text only)
 */
function buildSummaryAndVehicleSection(data) {
  var section = CardService.newCardSection()
    .setCollapsible(false);

  section.addWidget(
    CardService.newTextParagraph()
      .setText(_esc(data.summary))
  );

  section.addWidget(
    CardService.newDecoratedText()
      .setTopLabel("Current vehicle")
      .setText(_esc(data.currentVehicle.name))
      .setBottomLabel("Est. trade-in: " + _esc(data.currentVehicle.tradeInRange))
      .setWrapText(true)
  );

  return section;
}

/**
 * §3 — Interested in.
 *
 * Attempts ChipList (developer preview for Workspace add-ons).
 * Falls back to mid-dot separated text if the preview API is unavailable.
 *
 * Chip.setLabel() is the correct method — NOT setText().
 * setLabel() is a plain-text context; do NOT use _esc() here.
 *
 * Developer preview note: enrol the linked GCP project at
 * https://developers.google.com/workspace/preview to enable chips.
 * If unavailable, the catch block logs a warning and returns the text fallback.
 */
function buildPreferencesSection(data) {
  var section = CardService.newCardSection()
    .setHeader("Interested in")
    .setCollapsible(false);

  section.addWidget(_buildPreferencesWidget(data.preferences));
  return section;
}

/**
 * §4 — Matching vehicles.
 *
 * Each vehicle row is built by _addVehicleRow(). The temporary standalone
 * test Image widget has been removed — URL is confirmed reachable.
 */
function buildInventorySection(data) {
  var section = CardService.newCardSection()
    .setHeader("Matching vehicles available (" + data.inventory.length + ")")
    .setCollapsible(false);

  console.log(JSON.stringify({ imageType: "vehicle", imageUrl: VEHICLE_IMAGE_URL }));

  if (!data.inventory || data.inventory.length === 0) {
    console.warn("inventory: data.inventory is empty — skipping vehicle rows");
    section.addWidget(
      CardService.newTextParagraph()
        .setText("<font color=\"" + GRAY + "\">No vehicles available.</font>")
    );
    return section;
  }

  data.inventory.forEach(function(vehicle, idx) {
    console.log("inventory: rendering vehicle " + idx + " — " + vehicle.name);
    _addVehicleRow(section, vehicle, idx);
    console.log("inventory: vehicle " + idx + " widget added");

    if (idx < data.inventory.length - 1) {
      section.addWidget(CardService.newDivider());
    }
  });

  return section;
}

/**
 * §5 — Opportunity.
 * Bold body text signals importance without alert styling.
 */
function buildOpportunitySection(data) {
  var section = CardService.newCardSection()
    .setHeader("Opportunity")
    .setCollapsible(false);

  section.addWidget(
    CardService.newTextParagraph()
      .setText("<b>" + _esc(data.opportunity) + "</b>")
  );

  return section;
}

/**
 * §6 — Recommended next steps, primary action button, and footer.
 *
 * Steps: SelectionInput CHECK_BOX. Items pre-unchecked; no onChange action.
 * Button: filled TextButton (#0250D9) → prepareAppointmentAction().
 *
 * Footer: a single CardService.newImage() widget rendering the precomposed
 * AGENTFORCE_FOOTER_URL lockup (Salesforce cloud logo + "Powered by Agentforce"
 * on a transparent background). Placing it in this same section keeps it
 * directly beneath the button with no divider between them. CardService renders
 * natural widget padding above and below the image, approximating the requested
 * 16–20 px breathing room without explicit spacer widgets.
 * Fallback: plain italic TextParagraph if the image URL is not yet set or fails.
 */
function buildRecommendedStepsSection(data) {
  var section = CardService.newCardSection()
    .setHeader("Recommended next steps")
    .setCollapsible(false);

  var input = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName("brief_next_steps");

  data.recommendedSteps.forEach(function(step, idx) {
    input.addItem(step, "step_" + idx, false);
  });

  section.addWidget(input);

  var prepareAction = CardService.newAction()
    .setFunctionName("prepareAppointmentAction");

  section.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("Prepare appointment")
          .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
          .setBackgroundColor("#0250D9")
          .setOnClickAction(prepareAction)
      )
  );

  // Footer — "Powered by [logo] Agentforce" on one line.
  // DecoratedText + setStartIcon renders the logo at text height inline.
  // Layout: [logo icon]  Powered by Agentforce
  // If IconImage throws (icon URL unsupported), falls back to plain italic text.
  console.log(JSON.stringify({ imageType: "footer", imageUrl: AGENTFORCE_FOOTER_URL }));
  try {
    section.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(
          CardService.newIconImage()
            .setIconUrl(AGENTFORCE_FOOTER_URL)
            .setAltText("Salesforce")
        )
        .setText("Powered by Agentforce")
        .setWrapText(false)
    );
    console.log("footer: DecoratedText+icon widget added");
  } catch (footerErr) {
    console.error("footer: DecoratedText+icon failed (" + footerErr.message + ") — falling back to text");
    section.addWidget(
      CardService.newTextParagraph()
        .setText("<font color=\"" + GRAY + "\"><i>Powered by Agentforce</i></font>")
    );
  }

  return section;
}


// =============================================================================
// CONFIRMATION CARD
// =============================================================================

/**
 * Builds the "Appointment prepared" confirmation card.
 * Pushed onto the card stack by prepareAppointmentAction().
 * The "Back to customer brief" button calls backToBriefAction() which pops
 * this card, returning to the brief card already beneath it on the stack.
 */
function buildConfirmationCard() {
  var card = CardService.newCardBuilder();

  var section = CardService.newCardSection()
    .setCollapsible(false);

  section.addWidget(
    CardService.newTextParagraph()
      .setText("<b>Appointment prepared</b>")
  );

  section.addWidget(
    CardService.newTextParagraph()
      .setText(
        "The 2026 ID.4 AWD Pro S remains staged at Delivery Bay 2. " +
        "The customer brief and loyalty incentive have been shared with " +
        "the appointment team."
      )
  );

  section.addWidget(
    CardService.newTextParagraph()
      .setText(
        "<font color=\"" + GRAY + "\">Agentforce coordinated this update " +
        "without leaving Calendar.</font>"
      )
  );

  var backAction = CardService.newAction()
    .setFunctionName("backToBriefAction");

  section.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("Back to customer brief")
          .setOnClickAction(backAction)
      )
  );

  card.addSection(section);
  return card.build();
}

// =============================================================================
// PRIVATE WIDGET HELPERS
// =============================================================================

/**
 * Builds the "Interested in" widget.
 *
 * Primary: ChipList with WRAPPED layout (developer preview for add-ons).
 * Fallback: · separated TextParagraph on any runtime error.
 *
 * Chip.setLabel() — correct method name, confirmed. Do NOT use _esc() here;
 * setLabel() is a plain-text context, not HTML.
 */
function _buildPreferencesWidget(preferences) {
  try {
    var chipList = CardService.newChipList()
      .setLayout(CardService.ChipListLayout.WRAPPED);

    preferences.forEach(function(label) {
      chipList.addChip(
        CardService.newChip()
          .setLabel(label)
          .setAltText(label)
      );
    });

    return chipList;
  } catch (err) {
    console.warn("ChipList unavailable (developer preview): " + err.message);
    return CardService.newTextParagraph()
      .setText(
        preferences.map(function(p) { return _esc(p); }).join("  ·  ")
      );
  }
}

/**
 * Adds a single vehicle row to the given section using a stacked layout.
 * No Columns — Calendar silently drops Image widgets inside Column containers.
 *
 * Layout (top to bottom):
 *   1. Vehicle image  — CardService.newImage(), aspect ratio preserved by the host.
 *                       Wrapped in a local try/catch; text always renders even if
 *                       the image widget throws.
 *   2. Bold model name, muted VIN · color, location — one TextParagraph.
 */
function _addVehicleRow(section, vehicle, idx) {
  var name     = _esc(vehicle.name);
  var vin      = _esc(vehicle.vin);
  var color    = _esc(vehicle.color);
  var location = _esc(vehicle.location);
  var imgUrl   = vehicle.imageUrl || VEHICLE_IMAGE_URL;

  var bodyHtml =
    "<b>" + name + "</b><br>" +
    "<font color=\"" + GRAY + "\">" + vin + "  ·  " + color + "</font><br>" +
    location;

  // Image — stacked above the text. Any builder-level error is caught and logged;
  // the text paragraph below always executes regardless.
  try {
    console.log(JSON.stringify({ imageType: "vehicle", imageUrl: imgUrl }));
    section.addWidget(
      CardService.newImage()
        .setImageUrl(imgUrl)
        .setAltText(color + " exterior")
    );
    console.log("_addVehicleRow[" + idx + "]: image widget added");
  } catch (imgErr) {
    console.error("_addVehicleRow[" + idx + "]: image failed — " + imgErr.message);
  }

  // Text — always rendered.
  section.addWidget(
    CardService.newTextParagraph().setText(bodyHtml)
  );
}


// =============================================================================
// CARD-LEVEL HELPERS
// =============================================================================

/**
 * Empty-state card — shown when the open event has no matching brief.
 * No card header: host panel label is sufficient.
 */
function _buildEmptyStateCard(eventContext) {
  var card    = CardService.newCardBuilder();
  var section = CardService.newCardSection();

  var headline = (eventContext && eventContext.title)
    ? "No brief found for <b>" + _esc(eventContext.title) + "</b>."
    : "No brief found for this meeting.";

  section.addWidget(CardService.newTextParagraph().setText(headline));
  section.addWidget(
    CardService.newTextParagraph()
      .setText(
        "<font color=\"" + GRAY + "\">This proof of concept includes mock data " +
        "for Jordan Lee – Vehicle Consultation.</font>"
      )
  );

  card.addSection(section);
  return card.build();
}

/**
 * Minimal error card — retains a CardHeader so the panel is not completely
 * blank on unexpected exceptions.
 */
function _buildErrorCard(message) {
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader().setTitle("Agentforce Briefs")
  );

  var section = CardService.newCardSection();
  section.addWidget(
    CardService.newTextParagraph()
      .setText(
        "Something went wrong. Please try again.<br>" +
        "<font color=\"" + GRAY + "\">" + _esc(message) + "</font>"
      )
  );

  card.addSection(section);
  return card.build();
}

// =============================================================================
// DATE / TIME HELPERS
// =============================================================================

/**
 * Top-level formatter. Accepts the raw calEvent.start and calEvent.end objects
 * from the Calendar Advanced Service (not pre-parsed Date objects) and returns
 * { dateLabel, timeLabel } ready to display.
 *
 * All-day:  start.date present, start.dateTime absent.
 * Timed:    start.dateTime present (ISO 8601 with UTC offset, e.g. "2025-07-14T10:00:00-07:00").
 *
 * Returns { dateLabel: null, timeLabel: null } on any error so the card can
 * fall back to mock values without throwing.
 */
function formatEventDateTime(startObj, endObj) {
  var result = { dateLabel: null, timeLabel: null };

  try {
    if (!startObj) return result;

    var isAllDay = !startObj.dateTime && !!startObj.date;

    // Resolve the IANA timezone to use for display.
    // Priority: event's own timeZone field → script project timezone.
    // Utilities.formatDate() requires a valid IANA string ("America/Los_Angeles").
    var tz = (startObj.timeZone) || Session.getScriptTimeZone();

    result.dateLabel = formatEventDate(startObj, endObj, tz);
    result.timeLabel = isAllDay ? null : formatEventTimeRange(startObj, endObj, tz);

  } catch (err) {
    console.error("formatEventDateTime error: " + err.message);
  }

  return result;
}

/**
 * Returns the date portion of the display string.
 *
 * Single-day timed:  "Tuesday, July 14"  (or "Today, July 14" if today)
 * Single-day all-day: same format
 * Multi-day all-day: "Monday, July 14 – Wednesday, July 16"
 *
 * For all-day events the Google Calendar API stores end.date as the *exclusive*
 * end (i.e. a 1-day event on July 14 has end.date = "2025-07-15"). We subtract
 * one day before displaying the end date to show the inclusive range.
 */
function formatEventDate(startObj, endObj, tz) {
  try {
    var isAllDay = !startObj.dateTime && !!startObj.date;

    // Parse start — for all-day events append T00:00:00 so Date() parses in
    // local/script time rather than UTC midnight (which can shift the day).
    var startStr = isAllDay ? startObj.date + "T00:00:00" : startObj.dateTime;
    var startDate = new Date(startStr);

    var today = new Date();
    var startFormatted = Utilities.formatDate(startDate, tz, "EEEE, MMMM d");

    // Detect "Today"
    var todayFormatted = Utilities.formatDate(today, tz, "EEEE, MMMM d");
    if (startFormatted === todayFormatted) {
      startFormatted = "Today, " + Utilities.formatDate(startDate, tz, "MMMM d");
    }

    // Multi-day all-day: check whether end (exclusive) minus 1 day ≠ start
    if (isAllDay && endObj && endObj.date) {
      var endExclusive = new Date(endObj.date + "T00:00:00");
      // Subtract one day to get the inclusive end date
      var endInclusive = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);
      var endFormatted = Utilities.formatDate(endInclusive, tz, "EEEE, MMMM d");

      if (endFormatted !== startFormatted) {
        return startFormatted + " – " + endFormatted;
      }
    }

    return startFormatted;

  } catch (err) {
    console.error("formatEventDate error: " + err.message);
    return null;
  }
}

/**
 * Returns the time range portion of the display string for timed events.
 * "12:00 PM – 1:00 PM"
 *
 * Uses Utilities.formatDate() with the event's own timezone so the displayed
 * time is always correct for the event's location, not the viewer's system clock.
 *
 * Strips the leading zero from hours (Utilities uses "h" not "hh" for that)
 * and omits minutes when they are :00 for cleaner display ("1 PM" not "1:00 PM")
 * — change the format string below if you prefer always-show-minutes.
 */
function formatEventTimeRange(startObj, endObj, tz) {
  try {
    if (!startObj || !startObj.dateTime) return null;

    var startDate = new Date(startObj.dateTime);
    var startStr  = Utilities.formatDate(startDate, tz, "h:mm a");

    // Trim ":00" → plain hour, e.g. "1:00 PM" → "1 PM"
    startStr = startStr.replace(/:00 /, " ");

    if (!endObj || !endObj.dateTime) return startStr;

    var endDate = new Date(endObj.dateTime);
    var endStr  = Utilities.formatDate(endDate, tz, "h:mm a");
    endStr      = endStr.replace(/:00 /, " ");

    return startStr + " – " + endStr;

  } catch (err) {
    console.error("formatEventTimeRange error: " + err.message);
    return null;
  }
}

// =============================================================================
// UTILITY HELPERS
// =============================================================================

/**
 * Escapes HTML special characters for use inside TextParagraph / DecoratedText
 * HTML content.
 *
 * Do NOT use in plain-text contexts: Chip.setLabel(), DecoratedText.setTopLabel(),
 * DecoratedText.setBottomLabel() — these accept plain strings only. Passing
 * _esc() output there would render literal "&amp;" text.
 */
function _esc(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
