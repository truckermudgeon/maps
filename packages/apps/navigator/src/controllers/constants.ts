export const enum CameraMode {
  FOLLOW,
  FREE,
}

export const enum NavPageKey {
  CHOOSE_DESTINATION,
  SEARCH_ALONG,
  /** shows instructions for panning/zooming map to choose */
  CHOOSE_ON_MAP,
  /** a list of search results that can be routed to */
  DESTINATIONS,
  /** a list of routes to a destination */
  ROUTES,
  /** step-by-step directions, from an in-progress route */
  DIRECTIONS_FROM_ROUTE_CONTROLS,
  /** step-by-step directions, from the `ROUTES` page */
  DIRECTIONS_FROM_ROUTES_LIST,
  /** re-order and/or delete waypoints in the active route. */
  MANAGE_STOPS,
}
