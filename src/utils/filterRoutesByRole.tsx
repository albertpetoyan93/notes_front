export const filterRoutesByRole = (routes: any[], userRole: string | null) => {
  return routes
    .map((route) => {
      if (route.roles && !route.roles.includes(userRole)) {
        return null; // Exclude route if user does not have access
      }

      // Recursively filter children routes
      if (route.children) {
        route.children = filterRoutesByRole(route.children, userRole);
      }

      return route;
    })
    .filter(Boolean); // Remove null values
};
