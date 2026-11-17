/**
 * Days with no school in 2026-27, shown in Upcoming Events on the home page.
 *
 * This mirrors NO_CLASSES in the Firebird Hub app (App/FirebirdHub/app.js), from the FUHSD
 * 2026-27 calendar (fuhsd.org > About Us > Calendar): the same dates and the same names.
 * Update it together with the app's table every August, so the site and the app agree.
 *
 * [from, to, name, Spanish name]  (dates are YYYY-MM-DD, inclusive)
 */
export const NO_SCHOOL = [
  ['2026-09-07', '2026-09-07', 'Labor Day', 'Día del Trabajo'],
  ['2026-10-12', '2026-10-12', 'Teacher Non-Duty Day', 'Día sin clases'],
  ['2026-11-11', '2026-11-11', 'Veterans Day', 'Día de los Veteranos'],
  ['2026-11-25', '2026-11-27', 'Thanksgiving Break', 'Vacaciones de Acción de Gracias'],
  ['2026-12-21', '2027-01-01', 'Mid-Year Break', 'Vacaciones de mitad de año'],
  ['2027-01-18', '2027-01-18', 'Martin Luther King Jr. Day', 'Día de Martin Luther King Jr.'],
  ['2027-02-15', '2027-02-19', "Presidents' Week", 'Semana de los Presidentes'],
  ['2027-03-15', '2027-03-15', 'Non-Duty Day', 'Día sin clases'],
  ['2027-04-12', '2027-04-16', 'Spring Break', 'Vacaciones de primavera'],
  ['2027-05-31', '2027-05-31', 'Memorial Day', 'Día de los Caídos'],
]
