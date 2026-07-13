// =============================================================================
// MockData.gs
// Structured mock customer brief data for the Agentforce Briefs proof of concept.
// To integrate with Salesforce/Agentforce, replace the contents of MOCK_BRIEFS
// and implement fetchBriefFromSalesforce() in Code.gs.
// =============================================================================

var MOCK_BRIEFS = {
  jordanLee: {
    // ── Identity ──────────────────────────────────────────────────────────────
    customerName: "Jordan Lee",
    meetingTitle: "Jordan Lee – Vehicle Consultation",

    // ── Meeting details (used as fallback if event context is unavailable) ───
    meeting: {
      title: "Jordan Lee – Vehicle Consultation",
      dateLabel: "Today, July 14",
      timeLabel: "10:00 – 11:00 AM",
      guestCount: 2
    },

    // ── At-a-glance summary ──────────────────────────────────────────────────
    summary: "Returning Volkswagen owner. Two ID.4 matches on lot and available, including one already staged for the appointment. Confirm if Jordan has home charging.",

    // ── Current vehicle ──────────────────────────────────────────────────────
    currentVehicle: {
      name: "2021 Volkswagen Tiguan SE",
      tradeInRange: "$8,400–$10,200"
    },

    // ── Customer preferences (rendered as pill-style tags) ───────────────────
    preferences: ["ID.4", "Blue exterior", "Long range", "AWD", "Premium interior"],

    // ── Matching inventory ───────────────────────────────────────────────────
    // Both vehicles share the same image (one Dusk Blue ID.4 photo hosted in the repo).
    // The raw GitHub URL must be used — the blob/webpage URL will not render in CardService.
    inventory: [
      {
        name: "2026 ID.4 AWD Pro S",
        vin: "VIN …4K2187",
        color: "Dusk Blue",
        location: "Staged at Delivery Bay 2",
        isStaged: true,
        imageUrl: "https://raw.githubusercontent.com/MHolenstein/Agentforce-Briefs/main/ID4%20Dusk%20Blue-v4.png"
      },
      {
        name: "2026 ID.4 AWD Pro",
        vin: "VIN …7M6042",
        color: "Dusk Blue",
        location: "North Lot • Row C • Space 14",
        isStaged: false,
        imageUrl: "https://raw.githubusercontent.com/MHolenstein/Agentforce-Briefs/main/ID4%20Dusk%20Blue-v4.png"
      }
    ],

    // ── Opportunity alert ────────────────────────────────────────────────────
    opportunity: "$1,500 loyalty incentive expires Friday",

    // ── Recommended next steps ───────────────────────────────────────────────
    recommendedSteps: [
      "Start with the staged AWD Pro S",
      "Confirm home charging access",
      "Mention owner-loyalty incentive before test drive"
    ]
  }
};

/**
 * Returns the mock brief that matches the given event context, or null.
 * Matching is case-insensitive on the event title.
 *
 * @param {Object} eventContext  Output of getSelectedEventContext().
 * @returns {Object|null}
 */
function getMockCustomerBrief(eventContext) {
  var title = (eventContext && eventContext.title) ? eventContext.title.toLowerCase() : "";

  if (title.indexOf("jordan lee") !== -1 || title.indexOf("vehicle consultation") !== -1) {
    return MOCK_BRIEFS.jordanLee;
  }

  return null;
}
